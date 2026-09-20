import db from "@/infrastructure/db/client.server";
import { privateS3 } from "@/infrastructure/storage/s3.server";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { downloadableFiles } from "@/infrastructure/db/schema";
import { cached } from "@/infrastructure/storage/cache.server";
import { canEditDownload, toggleDownloadLifecycle } from "./lifecycle";
import { env } from "@/lib/env.server";
import { consumeDownloadToken } from "./download-token.server";

export async function redeemDownload(token: string, id: string, ipHash: string | null) {
    const item = await getItemFilenames(id);
    if (!item || !await consumeDownloadToken(token, id, ipHash))
        throw new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return privateS3.getResourceSignedUrl(item.originalFilename, item.filename);
}

export async function getItem(id: string) {
    const data = await db.query.downloadableFiles.findFirst({
        where: (v) =>
            and(eq(v.id, id), eq(v.enabled, true), eq(v.lifecycle, "active")),
        columns: {
            id: true,
            fileImage: true,
            filename: true,
            fileSize: true,
            fileType: true,
            hash: true,
            originalFilename: true,
            description: true,
        },
    });

    if (!data) return null;

    data.fileSize =
        data.fileSize ??
        Number(
            await cached(
                `download:size:${env.privateBucket}:${data.originalFilename}`,
                7 * 24 * 60 * 60,
                async () =>
                    String(
                        await privateS3.getResourceSizeDirect(
                            data.originalFilename,
                        ),
                    ),
            ),
        );
    data.fileType =
        data.fileType ||
        (await privateS3.getResourceMimeType(data.originalFilename))?.mime ||
        "unknown";

    return { ...data, originalFilename: undefined };
}

export async function getItemFilenames(id: string) {
    const data = await db.query.downloadableFiles.findFirst({
        where: (v) =>
            and(eq(v.id, id), eq(v.enabled, true), eq(v.lifecycle, "active")),
        columns: {
            originalFilename: true,
            filename: true,
        },
    });

    return data;
}

export async function listDownloads(page: number, search: string, limit = 10) {
    const where = search
        ? or(
              like(downloadableFiles.filename, `%${search}%`),
              like(downloadableFiles.originalFilename, `%${search}%`),
          )
        : undefined;
    const [items, count] = await Promise.all([
        db
            .select()
            .from(downloadableFiles)
            .where(where)
            .orderBy(desc(downloadableFiles.createdAt))
            .limit(limit)
            .offset((page - 1) * limit),
        db
            .select({ count: sql<number>`count(*)` })
            .from(downloadableFiles)
            .where(where),
    ]);
    return { items, page, search, total: Number(count[0]?.count || 0) };
}

export async function getEditableDownload(id: string) {
    const item = await db.query.downloadableFiles.findFirst({
        where: eq(downloadableFiles.id, id),
    });
    if (!item || !canEditDownload(item.lifecycle))
        throw new Response(null, { status: 404 });
    return item;
}

export async function deleteDownload(id: string) {
    const item = await db.query.downloadableFiles.findFirst({
        where: eq(downloadableFiles.id, id),
    });
    if (!item) throw new Response(null, { status: 404 });
    await db
        .update(downloadableFiles)
        .set({ enabled: false, lifecycle: "deleting" })
        .where(eq(downloadableFiles.id, id));
    // Keep the deleting row on storage failure so the dashboard can retry.
    await privateS3.deleteResource(item.originalFilename);
    await db.delete(downloadableFiles).where(eq(downloadableFiles.id, id));
}

export async function toggleDownload(id: string) {
    const item = await getEditableDownload(id);
    const lifecycle = toggleDownloadLifecycle(item.lifecycle)!;
    const [result] = await db
        .update(downloadableFiles)
        .set({ enabled: lifecycle === "active", lifecycle })
        .where(
            and(
                eq(downloadableFiles.id, id),
                eq(downloadableFiles.lifecycle, item.lifecycle),
            ),
        );
    if (!result.affectedRows)
        throw new Response("Download state changed", { status: 409 });
}

export interface DownloadInput {
    filename: string;
    description: string | null;
    enabled: boolean;
}

export async function updateDownload(id: string, input: DownloadInput) {
    const [result] = await db
        .update(downloadableFiles)
        .set({ ...input, lifecycle: input.enabled ? "active" : "disabled", updatedAt: new Date() })
        .where(
            and(
                eq(downloadableFiles.id, id),
                inArray(downloadableFiles.lifecycle, ["active", "disabled"]),
            ),
        );
    if (!result.affectedRows)
        throw new Response("Download not editable", { status: 409 });
}

export async function finalizeDownload(
    originalFilename: string,
    input: DownloadInput & { fileType: string | null; hash: string | null },
) {
    const [result] = await db
        .update(downloadableFiles)
        .set({ ...input, enabled: true, lifecycle: "active", updatedAt: new Date() })
        .where(
            and(
                eq(downloadableFiles.originalFilename, originalFilename),
                eq(downloadableFiles.lifecycle, "draft"),
            ),
        );
    if (!result.affectedRows)
        throw new Response("Upload draft not found", { status: 404 });
}

export async function cancelDownload(originalFilename: string) {
    const draft = await db.query.downloadableFiles.findFirst({
        where: and(
            eq(downloadableFiles.originalFilename, originalFilename),
            eq(downloadableFiles.lifecycle, "draft"),
        ),
    });
    if (!draft) throw new Response("Upload draft not found", { status: 404 });
    const [result] = await db
        .update(downloadableFiles)
        .set({ enabled: false, lifecycle: "deleting" })
        .where(
            and(
                eq(downloadableFiles.id, draft.id),
                eq(downloadableFiles.lifecycle, "draft"),
            ),
        );
    if (!result.affectedRows)
        throw new Response("Download state changed", { status: 409 });
    await privateS3.deleteResource(originalFilename);
    await db
        .delete(downloadableFiles)
        .where(eq(downloadableFiles.id, draft.id));
}
