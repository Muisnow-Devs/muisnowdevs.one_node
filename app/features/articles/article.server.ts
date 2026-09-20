import db from "@/infrastructure/db/client.server";
import { articleLabels, articles } from "@/infrastructure/db/schema";
import { and, asc, count, desc, eq, gt, inArray, like, lt } from "drizzle-orm";
import type { ArticleInput } from "./article-form";
import {
    DASHBOARD_ARTICLE_PAGE_SIZE,
    PUBLIC_ARTICLE_PAGE_SIZE,
} from "./article-pagination";

export async function getPublicArticles(page: number) {
    const items = await db.query.articles.findMany({
        where: (table) => eq(table.enabled, true),
        orderBy: (table) => desc(table.id),
        offset: (page - 1) * PUBLIC_ARTICLE_PAGE_SIZE,
        limit: PUBLIC_ARTICLE_PAGE_SIZE + 1,
        with: { articleLabels: { with: { label: true } } },
        columns: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
        },
    });

    return {
        page,
        articles: items
            .slice(0, PUBLIC_ARTICLE_PAGE_SIZE)
            .map(({ articleLabels, ...article }) => ({
                ...article,
                labels: articleLabels.map(({ label }) => label),
            })),
        hasNextPage: items.length > PUBLIC_ARTICLE_PAGE_SIZE,
    };
}

export async function getPublicArticle(id: number) {
    const article = await db.query.articles.findFirst({
        where: (table) => and(eq(table.id, id), eq(table.enabled, true)),
        with: { articleLabels: { with: { label: true } } },
        columns: {
            enabled: false,
            collection: false,
        },
    });

    if (!article) throw new Response(null, { status: 404 });

    const [previous, next] = await Promise.all([
        db.query.articles.findFirst({
            where: (table) => and(lt(table.id, id), eq(table.enabled, true)),
            orderBy: (table) => desc(table.id),
            columns: { id: true, title: true },
        }),
        db.query.articles.findFirst({
            where: (table) => and(gt(table.id, id), eq(table.enabled, true)),
            orderBy: (table) => asc(table.id),
            columns: { id: true, title: true },
        }),
    ]);

    const { articleLabels, ...result } = article;
    return {
        ...result,
        labels: articleLabels.map(({ label }) => label),
        near: { previous, next },
    };
}

export async function getArticlePreview(id: number) {
    return db.query.articles.findFirst({
        where: (table) => and(eq(table.id, id), eq(table.enabled, true)),
        columns: { id: true, title: true, description: true },
    });
}

export async function getDashboardArticles({
    search,
    labelId,
    page,
}: {
    search: string;
    labelId: string;
    page: number;
}) {
    const matchingArticleIds = labelId
        ? db
              .select({ articleId: articleLabels.articleId })
              .from(articleLabels)
              .where(eq(articleLabels.labelId, labelId))
        : undefined;
    const where = and(
        search ? like(articles.title, `%${search}%`) : undefined,
        matchingArticleIds
            ? inArray(articles.id, matchingArticleIds)
            : undefined,
    );
    const [items, labels, [{ total }]] = await Promise.all([
        db.query.articles.findMany({
            where,
            with: { articleLabels: { with: { label: true } } },
            orderBy: (table) => desc(table.id),
            offset: (page - 1) * DASHBOARD_ARTICLE_PAGE_SIZE,
            limit: DASHBOARD_ARTICLE_PAGE_SIZE,
        }),
        db.query.labels.findMany({ orderBy: (table) => table.title }),
        db.select({ total: count() }).from(articles).where(where),
    ]);
    return { items, labels, total };
}

export async function getArticleEditorData(id: number) {
    const [article, labels] = await Promise.all([
        db.query.articles.findFirst({
            where: (table) => eq(table.id, id),
            with: { articleLabels: true },
        }),
        db.query.labels.findMany({ orderBy: (table) => table.title }),
    ]);
    if (!article) throw new Response(null, { status: 404 });
    return { article, labels };
}

export async function getArticleLabels() {
    return db.query.labels.findMany({ orderBy: (table) => table.title });
}

export async function createArticle(input: ArticleInput) {
    await db.transaction(async (tx) => {
        const { labelIds, ...values } = input;
        const [article] = await tx
            .insert(articles)
            .values({ ...values, updatedAt: new Date() })
            .$returningId();
        if (labelIds.length) {
            await tx.insert(articleLabels).values(
                labelIds.map((labelId) => ({
                    articleId: article.id,
                    labelId,
                })),
            );
        }
    });
}

export async function updateArticle(id: number, input: ArticleInput) {
    await db.transaction(async (tx) => {
        const { labelIds, ...values } = input;
        await tx
            .update(articles)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(articles.id, id));
        await tx.delete(articleLabels).where(eq(articleLabels.articleId, id));
        if (labelIds.length) {
            await tx
                .insert(articleLabels)
                .values(
                    labelIds.map((labelId) => ({ articleId: id, labelId })),
                );
        }
    });
}

export async function disableArticle(id: number) {
    await db
        .update(articles)
        .set({ enabled: false })
        .where(eq(articles.id, id));
}
