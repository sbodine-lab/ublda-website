import type { AuthConfig } from "convex/server";

// Set these in the Convex deployment, not in a browser-visible environment file.
// LOGTO_ISSUER is the exact OIDC issuer (normally https://<tenant>.logto.app/oidc).
export default {
  providers: [
    {
      domain: process.env.LOGTO_ISSUER!,
      applicationID: process.env.LOGTO_APP_ID!,
    },
  ],
} satisfies AuthConfig;
