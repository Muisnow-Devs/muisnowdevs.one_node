import { sign, verify } from "@/crypto";
import { S3Actions } from "@/storage/aws.server";
import { v4 } from "uuid";
import { getResourceId, ServerUploadResponse, UploadBucket } from ".";
import { getExpectedUploadPartCount, validateUpload } from "./validation";

function getSignaturePayload(bucket: UploadBucket, uploadId: string, resourceId: string, size: number) {
    return [bucket, uploadId, resourceId, size].join(':');
}

function hasValidSignature(bucket: UploadBucket, resource: ServerUploadResponse) {
    return verify(getSignaturePayload(bucket, resource.uploadId, resource.resourceId, resource.size), resource.validate);
}

export async function createFileUploadSession(client: S3Actions, bucket: UploadBucket, size: number, filename?: string, mimetype?: string): Promise<ServerUploadResponse> {
    const resourceId = getResourceId(bucket, filename, v4);

    const session = await client.createResourceMultipartUpload(resourceId, mimetype);
    const signature = sign(getSignaturePayload(bucket, session.UploadId || "", resourceId, size));

    return {
        resourceId,
        uploadId: session.UploadId || "",
        validate: signature,
        size,
    };
}

export async function getPresignedPUTUrl(client: S3Actions, bucket: UploadBucket, part: number, resource: ServerUploadResponse): Promise<string | null> {
    if (!hasValidSignature(bucket, resource))
        return null
    return client.uploadResourcePartWithSignedUrl(resource.resourceId, part, resource.uploadId);
}

export async function completeFileUploadSession(client: S3Actions, bucket: UploadBucket, resource: ServerUploadResponse): Promise<boolean> {
    if (!hasValidSignature(bucket, resource))
        return false;

    // Retrieve parts (with ETags) from R2 server-side — this avoids the need for
    // the browser to read ETag from the presigned PUT response, which requires
    // CORS Access-Control-Expose-Headers: ETag to be configured on the R2 bucket.
    const listedParts = await client.listResourceMultipartUploadParts(resource.resourceId, resource.uploadId);
    const expectedPartCount = getExpectedUploadPartCount(resource.size);

    if (listedParts.length !== expectedPartCount)
        return false;

    const parts = listedParts.map((part, index) => ({
        ETag: part.ETag ?? "",
        PartNumber: index + 1,
    }));

    await client.completeResourceMultipartUpload(resource.resourceId, resource.uploadId, parts);

    try {
        const actualSize = await client.getResourceSizeDirect(resource.resourceId);
        if (actualSize !== resource.size || validateUpload(actualSize)) {
            await client.deleteResource(resource.resourceId);
            return false;
        }
    } catch (error) {
        try {
            await client.deleteResource(resource.resourceId);
        } catch {
            // Preserve the validation failure; storage logs retain any failed compensation attempt.
        }
        throw error;
    }

    return true;
}

export async function abortFileUploadSession(client: S3Actions, bucket: UploadBucket, resource: ServerUploadResponse): Promise<boolean> {
    if (!hasValidSignature(bucket, resource))
        return false;

    await client.abortResourceMultipartUpload(resource.resourceId, resource.uploadId);
    return true;
}
