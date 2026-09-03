export interface ApiSuccess<TData> {
  data: TData;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields: readonly ApiFieldError[] | null;
  };
}

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPage<TData> {
  data: readonly TData[];
  meta: CursorMeta;
}

export type UserRole = "STUDENT" | "LANDLORD" | "ADMIN";
export type PreferredLocale = "KM" | "EN";

export interface AuthUserDto {
  id: string;
  email: string | null;
  role: UserRole | null;
  preferredLocale: PreferredLocale;
  onboardingComplete: boolean;
}

export interface AuthSessionDto {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: AuthUserDto;
}

export interface PasswordResetRequestedDto {
  accepted: true;
  /** Returned only by local/test environments; never returned in staging/production. */
  developmentResetToken?: string;
}
