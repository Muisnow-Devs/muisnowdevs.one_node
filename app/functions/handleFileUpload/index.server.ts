import { sign, verify } from "@/crypto";
import { S3Actions } from "@/storage/aws.server";
import { v4 } from "uuid";
import { ServerUploadResponse, UploadPart } from ".";

export async function createFileUploadSession(client: S3Actions, filename?: string, mimetype?: string): Promise<ServerUploadResponse> {
    const fileID = v4();
    const ext = filename?.split('.').pop();
    const resourceId = fileID + (ext ? '.' + ext : '');

    const session = await client.createResourceMultipartUpload(resourceId, mimetype);
    const signature = sign([session.UploadId, resourceId].join(':'));

    return {
        resourceId,
        uploadId: session.UploadId || "",
        validate: signature,
    };
}

export async function getPresignedPUTUrl(client: S3Actions, part: number, resource: ServerUploadResponse): Promise<string | null> {
    if (!verify([resource.uploadId, resource.resourceId].join(':'), resource.validate))
        return null
    return client.uploadResourcePartWithSignedUrl(resource.resourceId, part, resource.uploadId);
}

export async function completeFileUploadSession(client: S3Actions, resource: ServerUploadResponse, parts: UploadPart[]): Promise<boolean> {
    if (!verify([resource.uploadId, resource.resourceId].join(':'), resource.validate))
        return false

    await client.completeResourceMultipartUpload(resource.resourceId, resource.uploadId, parts);

    return true;
}