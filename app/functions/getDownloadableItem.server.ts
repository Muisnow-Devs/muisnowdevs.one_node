import db from "@/db/client.server";
import { getResourceMimeType, getResourceSize } from "@/storage/aws.server";
import { eq } from "drizzle-orm";



export async function getItem(id: string) {
    const data = await db
        .query
        .downloadableFiles
        .findFirst({
            where: (v) => eq(v.id, id),
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
            where: (v) => eq(v.id, id),
            columns: {
                originalFilename: true,
                filename: true
            }
        });

    return data;
}