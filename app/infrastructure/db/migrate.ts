import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import db, { connection } from "./client.server";
import path from "node:path";

try {
    await migrate(db, { migrationsFolder: path.resolve("migrations") });
    console.log("[Migration] Applied");
} finally {
    await connection.end();
}
