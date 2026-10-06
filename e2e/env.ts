// Isolated ports and database so e2e never touches the dev server or dev data
export const SERVER_PORT = 3100;
export const CLIENT_PORT = 5273;
export const BASE_URL = `http://localhost:${CLIENT_PORT}`;

export const ADMIN_EMAIL = "admin@e2e.test";
export const ADMIN_PASSWORD = "e2e-admin-password";

// Env for the server process, migrations and seed (overrides server/.env)
export const serverEnv = {
  PORT: String(SERVER_PORT),
  DATABASE_URL:
    "postgresql://helpdesk_test:helpdesk_test@localhost:5433/helpdesk_test?schema=public",
  BETTER_AUTH_SECRET: "e2e-only-secret-do-not-use-elsewhere-0123456789",
  BETTER_AUTH_URL: `http://localhost:${SERVER_PORT}`,
  TRUSTED_ORIGINS: BASE_URL,
  RATE_LIMIT_ENABLED: "false",
  SEED_ADMIN_EMAIL: ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
};

export const AGENT_EMAIL = "agent@e2e.test";
export const AGENT_PASSWORD = "e2e-agent-password";
export const AGENT_NAME = "E2E Agent";
export const ADMIN_NAME = "Admin";
