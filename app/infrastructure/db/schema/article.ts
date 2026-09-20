import { relations, sql } from "drizzle-orm";
import {
    boolean,
    index,
    int,
    mysqlTable,
    primaryKey,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/mysql-core";
export const collections = mysqlTable("collections", {
    id: varchar("id", { length: 32 }).primaryKey().notNull(),
    title: varchar("title", { length: 64 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at")
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    enabled: boolean("enabled").notNull().default(true),
});

export const collectionRelations = relations(collections, ({ many }) => ({
    articles: many(articles),
}));

export const articles = mysqlTable(
    "articles",
    {
        id: int("id").autoincrement().primaryKey().notNull(),
        title: varchar("title", { length: 128 }).notNull().unique(),
        description: varchar("description", { length: 512 }).notNull(),
        content: text("content").notNull(),
        updatedAt: timestamp("updated_at").onUpdateNow(),
        collection: varchar("collection", { length: 32 }).references(
            () => collections.id,
        ),
        comment: boolean("comment").notNull().default(true),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        enabled: boolean("enabled").notNull().default(true),
    },
    (articles) => ({
        collectionIdx: index("articles_collection_idx").on(articles.collection),
    }),
);

export const labels = mysqlTable("labels", {
    id: varchar("id", { length: 32 }).primaryKey().notNull(),
    title: varchar("title", { length: 64 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at")
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    enabled: boolean("enabled").notNull().default(true),
});

export const articleLabels = mysqlTable(
    "article_labels",
    {
        articleId: int("article_id")
            .notNull()
            .references(() => articles.id),
        labelId: varchar("label_id", { length: 32 })
            .notNull()
            .references(() => labels.id),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.articleId, table.labelId] }),
        labelIdx: index("article_labels_label_idx").on(table.labelId),
    }),
);

export const articleRelations = relations(articles, ({ one, many }) => ({
    collection: one(collections, {
        fields: [articles.collection],
        references: [collections.id],
    }),
    articleLabels: many(articleLabels),
}));

export const articleLabelsRelations = relations(articleLabels, ({ one }) => ({
    article: one(articles, {
        fields: [articleLabels.articleId],
        references: [articles.id],
    }),
    label: one(labels, {
        fields: [articleLabels.labelId],
        references: [labels.id],
    }),
}));

export const labelRelations = relations(labels, ({ many }) => ({
    articleLabels: many(articleLabels),
}));
