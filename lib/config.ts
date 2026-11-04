// Product name. Logo: components/logo.tsx, design/brand/.
export const APP_NAME = "Fixa";

/** The sensor demo panel (/demo): on in development, and in production only with DEMO_PANEL=true. */
export function demoEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_PANEL === "true";
}
