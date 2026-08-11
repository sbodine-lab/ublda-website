import type { AuthConfig } from "convex/server";

// Logto handles the hosted sign-in. The same-origin bridge verifies Logto's ID
// token and issues a short-lived RS256 token that Convex can verify.
export default {
  providers: [
    {
      type: "customJwt",
      issuer: process.env.CONVEX_AUTH_ISSUER!,
      applicationID: process.env.CONVEX_AUTH_APP_ID!,
      jwks: process.env.CONVEX_AUTH_JWKS!,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
