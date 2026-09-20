import { sql } from "drizzle-orm";
import {
    bigint,
    boolean,
    index,
    mysqlTable,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/mysql-core";
import { v4 } from "uuid";
export type DownloadLifecycle = "draft" | "active" | "disabled" | "deleting";
export const downloadableFiles = mysqlTable(
    "downloadable_file",
    {
        id: varchar("id", { length: 36 })
            .primaryKey()
            .notNull()
            .$defaultFn(() => v4()),
        filename: varchar("filename", { length: 64 }).notNull().unique(),
        description: text("description"),
        originalFilename: varchar("original_filename", { length: 36 })
            .notNull()
            .unique()
            .$defaultFn(() => v4()),
        fileImage: varchar("file_image", { length: 40 }),
        fileType: varchar("file_type", { length: 128 }),
        fileSize: bigint("file_size", { mode: "number" }),
        hash: varchar("hash", { length: 40 }),
        isS3: boolean("s3").notNull().default(true),
        updatedAt: timestamp("updated_at").onUpdateNow(),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        enabled: boolean("enabled").notNull().default(true),
        lifecycle: varchar("lifecycle", { length: 16 })
            .$type<DownloadLifecycle>()
            .notNull()
            .default("active"),
    },
    (downloadableFiles) => ({
        filenameIdx: index("downloadable_files_filename_idx").on(
            downloadableFiles.filename,
        ),
        originalFilenameIdx: index(
            "downloadable_files_original_filename_idx",
        ).on(downloadableFiles.originalFilename),
        hashIdx: index("downloadable_files_hash_idx").on(
            downloadableFiles.hash,
        ),
    }),
);
