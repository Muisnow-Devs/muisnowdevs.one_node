import type { Config } from "drizzle-kit";

export default {
    dialect: "mysql",
    schema: "./app/infrastructure/db/schema/index.ts",
    out: "./migrations",
} satisfies Config;