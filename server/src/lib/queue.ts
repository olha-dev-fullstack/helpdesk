import { PgBoss } from "pg-boss";

// pg-boss keeps its tables in its own `pgboss` schema in the app database
export const boss = new PgBoss(process.env.DATABASE_URL!);

boss.on("error", (err) => {
  console.error("pg-boss error:", err);
});
