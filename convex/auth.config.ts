import type { AuthConfig } from "convex/server";

// Set this in the Convex deployment, not in a browser-visible environment file.
// In Clerk, activate the Convex integration (or its legacy "convex" JWT
// template). Clerk may use Google sign-in and/or verified email-code sign-in.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
