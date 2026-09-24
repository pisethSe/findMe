const OAUTH_MESSAGES: Record<string, string> = {
  OAUTH_STATE_INVALID:
    "This Google sign-in attempt expired or could not be verified. Please try again.",
  OAUTH_CODE_MISSING:
    "Google did not return an authorization code. Please try again.",
  OAUTH_PROVIDER_DENIED: "Google sign-in was cancelled.",
  OAUTH_NOT_CONFIGURED:
    "Google sign-in is not set up on this server yet. Sign in with email and password instead.",
  OAUTH_REDIRECT_UNRESOLVED:
    "Google sign-in is not set up on this server yet. Sign in with email and password instead.",
  OAUTH_EMAIL_UNVERIFIED:
    "This Google account does not have a verified email address for sign-in.",
  OAUTH_EXCHANGE_FAILED:
    "Google sign-in could not be completed. Please try again.",
  OAUTH_PROFILE_INVALID:
    "Google did not return a usable account profile. Please try again.",
  OAUTH_SIGNIN_FAILED:
    "Google sign-in could not be completed. Please try again.",
  ACCOUNT_UNAVAILABLE: "This account is not available for sign in.",
  ACCOUNT_ALREADY_EXISTS:
    "An account already uses this email address. Sign in with your password instead.",
  GOOGLE_ACCOUNT_ALREADY_LINKED:
    "This Google account is already linked to another account.",
};

/** Human-readable copy for the machine error codes returned by the OAuth flow. */
export function oauthErrorMessage(code: string | null | undefined): string {
  if (code && OAUTH_MESSAGES[code]) return OAUTH_MESSAGES[code];
  return "Google sign-in could not be completed. Please try again.";
}
