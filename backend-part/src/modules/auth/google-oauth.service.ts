import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

import {
  getGoogleOAuthConfig,
  type GoogleOAuthConfig,
} from "../../config/environment.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import {
  OAUTH_ONLY_PASSWORD_HASH,
  type GoogleIdentity,
  type RequestMetadata,
  type SessionTokens,
} from "./auth.types.js";
import {
  createGoogleOAuthState,
  verifyGoogleOAuthState,
} from "./google-oauth.state.js";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly authService: AuthService,
  ) {}

  config(): GoogleOAuthConfig | null {
    return getGoogleOAuthConfig(process.env);
  }

  isConfigured(): boolean {
    return this.config() !== null;
  }

  /** Where the browser should go to start Google sign-in. */
  startUrl(options: { next?: string | null; requestOrigin: string }): string {
    const config = this.requireConfiguration();
    const state = createGoogleOAuthState(
      this.stateSecret(),
      options.next ? { next: options.next } : {},
    );
    const redirectUrl = this.redirectUrl(config, options.requestOrigin);
    const query = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUrl,
      response_type: "code",
      scope: "openid email profile",
      include_granted_scopes: "true",
      prompt: "select_account",
      state,
    });
    return `${GOOGLE_AUTHORIZATION_ENDPOINT}?${query.toString()}`;
  }

  /** Completes the callback: verifies state, resolves the account, opens a session. */
  async completeSignIn(
    input: {
      code: string | undefined;
      state: string | undefined;
      requestOrigin: string;
    },
    metadata: RequestMetadata,
  ): Promise<{ session: SessionTokens; next: string | null }> {
    const config = this.requireConfiguration();
    const payload = input.state
      ? verifyGoogleOAuthState(this.stateSecret(), input.state)
      : null;
    if (!payload) {
      throw new ForbiddenException({
        code: "OAUTH_STATE_INVALID",
        message:
          "This Google sign-in attempt expired or could not be verified.",
      });
    }
    if (!input.code) {
      throw new ForbiddenException({
        code: "OAUTH_CODE_MISSING",
        message: "Google did not return an authorization code.",
      });
    }

    // Google only redirects to registered URIs, so the callback request's own
    // origin matches the registered redirect URI even in the local fallback.
    const redirectUrl = this.redirectUrl(config, input.requestOrigin);
    const accessToken = await this.exchangeCode(input.code, redirectUrl);
    const identity = await this.fetchIdentity(accessToken);
    const session = await this.resolveSession(identity, metadata);
    return { session, next: payload.next };
  }

  private async exchangeCode(
    code: string,
    redirectUrl: string,
  ): Promise<string> {
    const config = this.requireConfiguration();
    const response = await this.request(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUrl,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!response) throw exchangeFailed();

    const payload = (await response
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) throw exchangeFailed();
    return payload.access_token;
  }

  private async fetchIdentity(accessToken: string): Promise<GoogleIdentity> {
    const response = await this.request(GOOGLE_USERINFO_ENDPOINT, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response
      ?.json()
      .catch(() => ({}))) as GoogleUserInfoResponse;

    if (!response?.ok || !payload.sub || !payload.email) {
      throw new BadGatewayException({
        code: "OAUTH_PROFILE_INVALID",
        message: "Google did not return a usable account profile.",
      });
    }
    if (payload.email_verified !== true) {
      throw new ForbiddenException({
        code: "OAUTH_EMAIL_UNVERIFIED",
        message:
          "This Google account does not have a verified email address for sign-in.",
      });
    }

    return { subject: payload.sub, email: payload.email };
  }

  private async resolveSession(
    identity: GoogleIdentity,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const linked = await this.repository.findUserByGoogleSubject(
      identity.subject,
    );
    if (linked) {
      return this.authService.createSessionForUserId(linked.id, metadata);
    }

    const existing = await this.repository.findUserByEmail(identity.email);
    if (existing) {
      if (existing.deletedAt !== null || existing.accountStatus !== "ACTIVE") {
        throw accountUnavailable();
      }
      // The verified Google email matches a known account, so the account keeps
      // its role, onboarding state, and password sign-in option.
      await this.repository.linkGoogleSubject(existing.id, identity.subject);
      return this.authService.createSessionForUserId(existing.id, metadata);
    }

    return this.authService.createGoogleAccount(
      {
        email: identity.email,
        googleSubject: identity.subject,
        passwordHash: OAUTH_ONLY_PASSWORD_HASH,
      },
      metadata,
    );
  }

  private async request(
    url: string,
    init: RequestInit,
  ): Promise<Response | null> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
  }

  private stateSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET?.trim();
    if (!secret) throw notConfigured();
    return `findme:google-oauth-state:v1:${secret}`;
  }

  private redirectUrl(
    config: GoogleOAuthConfig,
    requestOrigin: string | null,
  ): string {
    if (config.redirectUrl) return config.redirectUrl;
    if (!requestOrigin) {
      throw new ServiceUnavailableException({
        code: "OAUTH_REDIRECT_UNRESOLVED",
        message:
          "Google sign-in needs GOOGLE_OAUTH_REDIRECT_URL on this server.",
      });
    }
    // Local development falls back to the API origin the browser used, which is
    // the URI a developer registers for the local Google client.
    return new URL("/api/v1/auth/google/callback", requestOrigin).href;
  }

  private requireConfiguration(): GoogleOAuthConfig {
    const config = this.config();
    if (!config) throw notConfigured();
    return config;
  }
}

function notConfigured(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: "OAUTH_NOT_CONFIGURED",
    message:
      "Google sign-in is not configured on this server. Use email and password instead.",
  });
}

function accountUnavailable(): ForbiddenException {
  return new ForbiddenException({
    code: "ACCOUNT_UNAVAILABLE",
    message: "This account is not available for sign in.",
  });
}

function exchangeFailed(): BadGatewayException {
  return new BadGatewayException({
    code: "OAUTH_EXCHANGE_FAILED",
    message: "Google sign-in could not be completed. Please try again.",
  });
}
