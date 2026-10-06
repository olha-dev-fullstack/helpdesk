import { execFileSync } from "node:child_process";
import path from "node:path";
import { serverEnv } from "./env";

const serverDir = path.resolve(import.meta.dirname, "../server");

function run(args: string[]) {
  execFileSync("bun", args, {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env, ...serverEnv },
  });
}

// Safety net: never run migrations against anything but the test database
export default function globalSetup() {
  if (!new URL(serverEnv.DATABASE_URL).pathname.endsWith("_test")) {
    throw new Error("Refusing to run e2e setup against a non-test database");
  }
  run(["--bun", "prisma", "migrate", "deploy"]);
  run(["prisma/seed.ts"]);
}
