import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Monorepo-wide env vars live in the repo root .env, not apps/backend/.env.
config({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
