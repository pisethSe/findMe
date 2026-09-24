import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { parseCookie, stringifySetCookie } from "cookie";
import type { Request, Response } from "express";

import { getAppEnvironment, getWebOrigin } from "../../config/environment.js";
import { AccessTokenGuard } from "./access-token.guard.js";
import { AuthService } from "./auth.service.js";
import type { AccessPrincipal, RequestMetadata } from "./auth.types.js";
import { CurrentUser } from "./current-user.decorator.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";

const REFRESH_COOKIE = "findme_refresh";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  @Post("register")
  @RateLimit("registration")
  async register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(
      input,
      metadataFrom(request),
    );
    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    );
    return sessionResponse(session);
  }

  @Post("login")
  @RateLimit("login")
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(input, metadataFrom(request));
    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    );
    return sessionResponse(session);
  }

  @Post("refresh")
  @RateLimit("sessionRefresh")
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireTrustedOrigin(request);
    const refreshToken = getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: "SESSION_REQUIRED",
        message: "A refresh session is required.",
      });
    }

    const session = await this.authService.refresh(
      refreshToken,
      metadataFrom(request),
    );
    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshTokenExpiresAt,
    );
    return sessionResponse(session);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    requireTrustedOrigin(request);
    await this.authService.logout(getRefreshToken(request));
    clearRefreshCookie(response);
  }

  @Post("forgot-password")
  @RateLimit("passwordResetRequest")
  @HttpCode(202)
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    const result = await this.authService.requestPasswordReset(input.email);
    return {
      data: {
        accepted: result.accepted,
        ...(result.developmentResetToken
          ? { developmentResetToken: result.developmentResetToken }
          : {}),
      },
    };
  }

  @Post("reset-password")
  @RateLimit("passwordReset")
  @HttpCode(200)
  async resetPassword(@Body() input: ResetPasswordDto) {
    await this.authService.resetPassword(input.token, input.password);
    return { data: { passwordReset: true } };
  }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  getMe(@CurrentUser() user: AccessPrincipal) {
    return { data: user };
  }

  /** Which sign-in providers this server can complete right now. */
  @Get("providers")
  getProviders() {
    return { data: { google: this.googleOAuth.isConfigured() } };
  }

  /**
   * Redirects the browser to Google's consent screen. The signed `state`
   * carries the relative post-sign-in path, so the flow cannot be used as an
   * open redirect.
   */
  @Get("google/start")
  @RateLimit("oauthStart")
  googleStart(
    @Query("next") next: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    const url = this.googleOAuth.startUrl({
      next: typeof next === "string" ? next : null,
      requestOrigin: requestOrigin(request),
    });
    response.redirect(url);
  }

  /**
   * Receives Google's redirect, opens the session in an httpOnly cookie, and
   * sends the browser to the SPA callback page with a machine-readable status.
   */
  @Get("google/callback")
  @RateLimit("oauthCallback")
  async googleCallback(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const code = queryValue(request.query.code);
    const state = queryValue(request.query.state);
    const providerError = queryValue(request.query.error);

    try {
      if (providerError && !code) {
        throw new ForbiddenException({
          code: "OAUTH_PROVIDER_DENIED",
          message: "Google sign-in was cancelled or refused.",
        });
      }
      const { session, next } = await this.googleOAuth.completeSignIn(
        { code, state, requestOrigin: requestOrigin(request) },
        metadataFrom(request),
      );
      setRefreshCookie(
        response,
        session.refreshToken,
        session.refreshTokenExpiresAt,
      );
      response.redirect(oauthCallbackUrl({ status: "success", next }));
    } catch (caught) {
      const code_ = exceptionCode(caught);
      if (!(caught instanceof HttpException)) {
        // Never log authorization codes, tokens, or the signed state value.
        this.logger.warn(`Google sign-in failed: ${code_}`);
      }
      response.redirect(oauthCallbackUrl({ status: "error", code: code_ }));
    }
  }
}

function metadataFrom(request: Request): RequestMetadata {
  return {
    userAgent: request.header("user-agent")?.slice(0, 500) ?? null,
    ipAddress: request.ip || null,
  };
}

function queryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 4096
    ? value
    : undefined;
}

function requestOrigin(request: Request): string {
  return `${request.protocol}://${request.header("host") ?? ""}`;
}

function oauthCallbackUrl(input: {
  status: "success" | "error";
  code?: string;
  next?: string | null;
}): string {
  const url = new URL("/auth/callback", getWebOrigin(process.env.WEB_ORIGIN));
  url.searchParams.set("status", input.status);
  if (input.code) url.searchParams.set("code", input.code);
  if (input.next) url.searchParams.set("next", input.next);
  return url.href;
}

function exceptionCode(caught: unknown): string {
  if (caught instanceof HttpException) {
    const body = caught.getResponse();
    if (typeof body === "object" && body !== null && "code" in body) {
      const code = (body as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
  }
  return "OAUTH_SIGNIN_FAILED";
}

function getRefreshToken(request: Request): string | undefined {
  return parseCookie(request.headers.cookie ?? "")[REFRESH_COOKIE];
}

function refreshCookieOptions() {
  const environment = getAppEnvironment(process.env.APP_ENV);
  return {
    httpOnly: true,
    secure: environment === "staging" || environment === "production",
    sameSite: "lax" as const,
    path: REFRESH_COOKIE_PATH,
  };
}

function setRefreshCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.setHeader(
    "Set-Cookie",
    stringifySetCookie({
      name: REFRESH_COOKIE,
      value: token,
      ...refreshCookieOptions(),
      expires: expiresAt,
    }),
  );
}

function clearRefreshCookie(response: Response): void {
  response.setHeader(
    "Set-Cookie",
    stringifySetCookie({
      name: REFRESH_COOKIE,
      value: "",
      ...refreshCookieOptions(),
      expires: new Date(0),
      maxAge: 0,
    }),
  );
}

function requireTrustedOrigin(request: Request): void {
  const origin = request.header("origin");
  if (origin && origin !== getWebOrigin(process.env.WEB_ORIGIN)) {
    throw new ForbiddenException({
      code: "ORIGIN_FORBIDDEN",
      message: "This request origin is not allowed.",
    });
  }
}

function sessionResponse(session: {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: AccessPrincipal;
}) {
  return {
    data: {
      accessToken: session.accessToken,
      accessTokenExpiresInSeconds: session.accessTokenExpiresInSeconds,
      user: session.user,
    },
  };
}
