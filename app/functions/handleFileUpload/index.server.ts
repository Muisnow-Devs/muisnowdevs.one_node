import { S3Actions } from "@/storage/aws.server";
import { v4 } from "uuid";

export async function createFileUploadSession(client: S3Actions, filename?: string, mimetype?: string) {
    const fileID = v4();
    const ext = filename ? "." + filename.split('.').pop() : "";
    const resourceID = fileID + ext;

    const session = await client.createResourceMultipartUpload(resourceID, mimetype);

    return {
        resourceID,
        uploadID: v4(),
        fileID,
        validate: client.getResourceCheckSum(resourceID),
    };
}