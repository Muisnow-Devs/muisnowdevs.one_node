import { relations, sql } from "drizzle-orm";
import { boolean, customType, index, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { v4 } from "uuid";

export const collections = mysqlTable("collections", {
    id: varchar("id", { length: 32 })
        .primaryKey()
        .notNull(),
    title: varchar("title", { length: 64 })
        .notNull()
        .unique(),
    description: text("description"),
    createdAt: timestamp("created_at")
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    enabled: boolean("enabled")
        .notNull()
        .default(true),
});

export const collectionRelations = relations(collections, ({ many }) => ({
    articles: many(articles)
}));

export const articles = mysqlTable("articles", {
    id: int("id")
        .autoincrement()
        .primaryKey()
        .notNull(),
    title: varchar("title", { length: 128 })
        .notNull()
        .unique(),
    description: varchar("description", { length: 512 })
        .notNull(),
    content: text("content")
        .notNull(),
    collection: varchar("collection", { length: 32 })
        .notNull()
        .references(() => collections.id),
    comment: boolean("comment")
        .notNull()
        .default(true),
    createdAt: timestamp("created_at")
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    enabled: boolean("enabled")
        .notNull()
        .default(true),
}, (articles) => ({
    collectionIdx: index("articles_collection_idx").on(articles.collection)
}));

export const articleRelations = relations(articles, ({ one }) => ({
    collection: one(collections, { fields: [articles.collection], references: [collections.id]})
}));

export const downloadableFiles = mysqlTable("downloadable_file", {
    id: varchar("id", { length: 36 })
        .primaryKey()
        .notNull()
        .$defaultFn(() => v4()),
    filename: varchar("filename", { length: 64 })
        .notNull()
        .unique(),
    originalFilename: varchar("original_filename", { length: 36 })
        .notNull()
        .unique()
        .$defaultFn(() => v4()),
    fileImage: varchar("file_image", { length: 40 }),
    fileType: varchar("file_type", { length: 128 })
        .notNull()
        .default("application/octet-stream"),
    fileSize: int("file_size")
        .notNull()
        .default(0),
    hash: varchar("hash", { length: 40 }),
    isS3: boolean("s3")
        .notNull()
        .default(true),
    createdAt: timestamp("created_at")
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    enabled: boolean("enabled")
        .notNull()
        .default(true),
}, (downloadableFiles) => ({
    filenameIdx: index("downloadable_files_filename_idx").on(downloadableFiles.filename),
    originalFilenameIdx: index("downloadable_files_original_filename_idx").on(downloadableFiles.originalFilename),
    hashIdx: index("downloadable_files_hash_idx").on(downloadableFiles.hash),
}));

export interface AdditionalLink {
    type: string;
    link: string;
}
export const links = customType<{ data: AdditionalLink[], driverData: string }>({
    dataType: () => "text",
    toDriver: (data: AdditionalLink[]) => data.map((val) => `${val.type}:${val.link}`).join(","),
    fromDriver: (driverData: string) => {
        return driverData.split(",").map((val) => {
            const [type, link] = val.split(":");
            return { type, link };
        });
    },
});

export const projects = mysqlTable("projects", {
    id: varchar("id", { length: 64 })
        .primaryKey()
        .notNull(),
    title: varchar("title", { length: 64 })
        .notNull()
        .unique(),
    description: varchar("description", { length: 120 })
        .notNull(),
    content: text("content")
        .notNull(),
    additionalLink: links("additional_link")
        .notNull(),
    image: varchar("image", { length: 36 }),
    downloadLink: links("download_link")
        .notNull(),
    createdAt: timestamp("created_at")
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    enabled: boolean("enabled")
        .notNull()
        .default(true),
}, (projects) => ({
    titleIdx: index("projects_title_idx").on(projects.title),
}));