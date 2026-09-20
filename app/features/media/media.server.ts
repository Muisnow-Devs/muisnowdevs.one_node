import { publicS3 } from "@/infrastructure/storage/s3.server";

export const listMedia = (continuationToken?: string) =>
    publicS3.getResources(continuationToken);
export async function deleteMedia(id: string) {
    await publicS3.deleteResource(id);
}
