import db from "@/db/client.server";
import { getResourceMimeType, getResourceSize } from "@/storage/aws.server";
import { and, eq } from "drizzle-orm";



export async function getItem(id: string) {
    const data = await db
        .query
        .downloadableFiles
        .findFirst({
            where: (v) => and(eq(v.id, id), eq(v.enabled, true)),
            columns: {
                id: true,
                fileImage: true,
                filename: true,
                fileSize: true,
                fileType: true,
                hash: true,
                originalFilename: true,
                description: true
            }
        });
    
    if (!data)
        return null;

    data.fileSize = data.fileSize || await getResourceSize(data.originalFilename);
    data.fileType = data.fileType || (await getResourceMimeType(data.originalFilename))?.mime || "unknown";

    return { ...data, originalFilename: undefined };
}

export async function getItemFilenames(id: string) {
    const data = await db
        .query
        .downloadableFiles
        .findFirst({
            where: (v) => and(eq(v.id, id), eq(v.enabled, true)),
            columns: {
                originalFilename: true,
                filename: true
            }
        });

    return data;
}