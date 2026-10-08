import { MIN_PASSWORD_LENGTH } from "@core";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const trustedOrigins = (
  process.env.TRUSTED_ORIGINS ?? "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters");
}
const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
  session: { expiresIn: 60 * 60 * 24 * 7 },
  advanced: { useSecureCookies: isProduction },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    disableSignUp: true,
  },
  rateLimit: {
    // On in every environment; e2e turns it off via RATE_LIMIT_ENABLED=false
    enabled: process.env.RATE_LIMIT_ENABLED !== "false",
    window: 60,
    max: 100,
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
  user: {
    additionalFields: {
      role: { type: ["admin", "agent"], defaultValue: "agent", input: false },
    },
  },
  trustedOrigins,
});
