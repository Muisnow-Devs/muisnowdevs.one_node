import { sign, verify } from "@/crypto";
// Type-only: a value import would pull in redis.server.tsx, which opens a Redis
// connection at module load and would hang unit tests.
import type { S3Actions } from "@/storage/aws.server";
import { v4 } from "uuid";
import { CreateUploadResponse, getResourceId, PartUploadResponse, UploadBucket, UploadSession } from ".";
import { getSignaturePayload } from "./signature";
import { getExpectedUploadPartCount, getUploadMode, validateUpload } from "./validation";

export type UploadStorageClient = Pick<S3Actions,
    | "putResourceWithSignedUrl"
    | "createResourceMultipartUpload"
    | "uploadResourcePartWithSignedUrl"
    | "listResourceMultipartUploadParts"
    | "completeResourceMultipartUpload"
    | "abortResourceMultipartUpload"
    | "getResourceSizeDirect"
    | "deleteResource">;

function hasValidSignature(bucket: UploadBucket, session: UploadSession) {
    return verify(getSignaturePayload(bucket, session), session.validate);
}

export async function createFileUploadSession(client: UploadStorageClient, bucket: UploadBucket, size: number, filename?: string, mimetype?: string): Promise<CreateUploadResponse> {
    const resourceId = getResourceId(bucket, filename, v4);
    const mode = getUploadMode(size);
    const contentType = mimetype || "application/octet-stream";

    if (mode === "single") {
        const url = await client.putResourceWithSignedUrl(resourceId, contentType);
        const session = { mode, resourceId, uploadId: "", size };
        return { ...session, validate: sign(getSignaturePayload(bucket, session)), url };
    }

    const created = await client.createResourceMultipartUpload(resourceId, contentType);
    const session = { mode, resourceId, uploadId: created.UploadId || "", size };
    return { ...session, validate: sign(getSignaturePayload(bucket, session)) };
}

export async function getPresignedPartUrl(client: UploadStorageClient, bucket: UploadBucket, part: number, session: UploadSession): Promise<PartUploadResponse | null> {
    if (!hasValidSignature(bucket, session))
        return null;

    const url = await client.uploadResourcePartWithSignedUrl(session.resourceId, part, session.uploadId);

    // Signatures expire 60 minutes after issue, so a multi-gigabyte upload would
    // outlive its own session. Re-issuing here keeps the session alive as long as
    // parts keep flowing, without widening the replay window of any one signature.
    return { url, validate: sign(getSignaturePayload(bucket, session)) };
}

export async function completeFileUploadSession(client: UploadStorageClient, bucket: UploadBucket, session: UploadSession): Promise<boolean> {
    if (!hasValidSignature(bucket, session))
        return false;

    if (session.mode === "multipart") {
        // Retrieve parts (with ETags) from R2 server-side — this avoids the need for
        // the browser to read ETag from the presigned PUT response, which requires
        // CORS Access-Control-Expose-Headers: ETag to be configured on the R2 bucket.
        const listedParts = await client.listResourceMultipartUploadParts(session.resourceId, session.uploadId);

        if (listedParts.length !== getExpectedUploadPartCount(session.size)) {
            // Leaving the upload open would accrue storage cost for parts nobody can finish.
            await client.abortResourceMultipartUpload(session.resourceId, session.uploadId);
            return false;
        }

        await client.completeResourceMultipartUpload(session.resourceId, session.uploadId, listedParts);
    }

    try {
        const actualSize = await client.getResourceSizeDirect(session.resourceId);
        if (actualSize !== session.size || validateUpload(bucket, actualSize)) {
            await client.deleteResource(session.resourceId);
            return false;
        }
    } catch (error) {
        try {
            await client.deleteResource(session.resourceId);
        } catch {
            // Preserve the validation failure; storage logs retain any failed compensation attempt.
        }
        throw error;
    }

    return true;
}

export async function abortFileUploadSession(client: UploadStorageClient, bucket: UploadBucket, session: UploadSession): Promise<boolean> {
    if (!hasValidSignature(bucket, session))
        return false;

    if (session.mode === "single") {
        try {
            await client.deleteResource(session.resourceId);
        } catch {
            // A single PUT that never started leaves nothing to delete.
        }
        return true;
    }

    await client.abortResourceMultipartUpload(session.resourceId, session.uploadId);
    return true;
}
