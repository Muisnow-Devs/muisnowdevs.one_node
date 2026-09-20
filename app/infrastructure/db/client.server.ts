import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";
import mysql from "mysql2/promise";
import { env } from "@/lib/env.server";

export const connection = mysql.createPool(env.database);

export default drizzle(connection, { schema, mode: "default" });
