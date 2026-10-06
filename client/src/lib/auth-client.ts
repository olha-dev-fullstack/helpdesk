import { createAuthClient } from "better-auth/react";

// Same-origin requests: Vite proxies /api/* to the server
export const authClient = createAuthClient();

export const { useSession } = authClient;
