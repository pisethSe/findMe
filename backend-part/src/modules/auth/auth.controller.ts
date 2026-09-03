import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
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
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";

const REFRESH_COOKIE = "findme_refresh";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
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
}

function metadataFrom(request: Request): RequestMetadata {
  return {
    userAgent: request.header("user-agent")?.slice(0, 500) ?? null,
    ipAddress: request.ip || null,
  };
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
