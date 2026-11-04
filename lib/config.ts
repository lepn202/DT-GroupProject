// Product name. Logo: components/logo.tsx, design/brand/.
export const APP_NAME = "Fixa";

/** The sensor demo panel (/demo): on in development, and in production only with DEMO_PANEL=true. */
export function demoEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_PANEL === "true";
}

/**
 * Email confirmation before the first sign-in. Off by default: sign-up creates the account
 * already confirmed and signs the user straight in. Set REQUIRE_EMAIL_CONFIRMATION=true to
 * go back to the confirmation email (it needs working email on the Supabase project).
 */
export function emailConfirmationRequired() {
  return process.env.REQUIRE_EMAIL_CONFIRMATION === "true";
}
