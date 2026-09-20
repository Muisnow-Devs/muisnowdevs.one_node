import { sql } from "drizzle-orm";
import {
    boolean,
    customType,
    index,
    mysqlTable,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/mysql-core";
export interface AdditionalLink {
    type: string;
    link: string;
}
export const links = customType<{ data: AdditionalLink[]; driverData: string }>(
    {
        dataType: () => "text",
        toDriver: (data: AdditionalLink[]) =>
            data.map((val) => `${val.type}:${val.link}`).join(","),
        fromDriver: (driverData: string) => {
            return driverData.split(",").map((val) => {
                const [type, link] = val.split(":");
                return { type, link };
            });
        },
    },
);

export const projects = mysqlTable(
    "projects",
    {
        id: varchar("id", { length: 64 }).primaryKey().notNull(),
        title: varchar("title", { length: 64 }).notNull().unique(),
        description: varchar("description", { length: 120 }).notNull(),
        content: text("content").notNull(),
        additionalLink: links("additional_link").notNull(),
        image: varchar("image", { length: 36 }),
        downloadLink: links("download_link").notNull(),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        enabled: boolean("enabled").notNull().default(true),
    },
    (projects) => ({
        titleIdx: index("projects_title_idx").on(projects.title),
    }),
);
