import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Same-origin requests: Vite proxies /api/* to the server
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: { role: { type: ["admin", "agent"] } },
    }),
  ],
});

export const { useSession } = authClient;
