import { env } from "@/lib/env.server";
import { sign, verify } from "@/lib/crypto.server";
// Keep storage initialization out of upload protocol tests.
import type { S3Actions } from "@/infrastructure/storage/s3.server";
import { v4 } from "uuid";
import {
    CreateUploadResponse,
    getResourceId,
    PartUploadResponse,
    UploadBucket,
    UploadSession,
} from ".";
import { getSignaturePayload } from "./signature";
import {
    getExpectedUploadPartCount,
    getMaxUploadSizeBytes,
    getUploadMode,
    validateUpload,
} from "./validation";

export type UploadStorageClient = Pick<
    S3Actions,
    | "putResourceWithSignedUrl"
    | "createResourceMultipartUpload"
    | "uploadResourcePartWithSignedUrl"
    | "listResourceMultipartUploadParts"
    | "completeResourceMultipartUpload"
    | "abortResourceMultipartUpload"
    | "getResourceSizeDirect"
    | "deleteResource"
>;

function hasValidSignature(bucket: UploadBucket, session: UploadSession) {
    return verify(getSignaturePayload(bucket, session), session.validate);
}

export async function createFileUploadSession(
    client: UploadStorageClient,
    bucket: UploadBucket,
    size: number,
    filename?: string,
    mimetype?: string,
): Promise<CreateUploadResponse> {
    const resourceId = getResourceId(bucket, filename, v4);
    const mode = getUploadMode(size);
    const contentType = mimetype || "application/octet-stream";

    if (mode === "single") {
        const url = await client.putResourceWithSignedUrl(
            resourceId,
            contentType,
            size,
        );
        const session = { mode, resourceId, uploadId: "", size };
        return {
            ...session,
            validate: sign(getSignaturePayload(bucket, session)),
            url,
        };
    }

    const created = await client.createResourceMultipartUpload(
        resourceId,
        contentType,
    );
    const session = {
        mode,
        resourceId,
        uploadId: created.UploadId || "",
        size,
    };
    return { ...session, validate: sign(getSignaturePayload(bucket, session)) };
}

export async function getPresignedPartUrl(
    client: UploadStorageClient,
    bucket: UploadBucket,
    part: number,
    session: UploadSession,
): Promise<PartUploadResponse | null> {
    if (!hasValidSignature(bucket, session)) return null;

    const url = await client.uploadResourcePartWithSignedUrl(
        session.resourceId,
        part,
        session.uploadId,
    );

    // Signatures expire 60 minutes after issue, so a multi-gigabyte upload would
    // outlive its own session. Re-issuing here keeps the session alive as long as
    // parts keep flowing, without widening the replay window of any one signature.
    return { url, validate: sign(getSignaturePayload(bucket, session)) };
}

export async function completeFileUploadSession(
    client: UploadStorageClient,
    bucket: UploadBucket,
    session: UploadSession,
): Promise<boolean> {
    if (!hasValidSignature(bucket, session)) return false;

    if (session.mode === "multipart") {
        // Retrieve parts (with ETags) from R2 server-side — this avoids the need for
        // the browser to read ETag from the presigned PUT response, which requires
        // CORS Access-Control-Expose-Headers: ETag to be configured on the R2 bucket.
        const listedParts = await client.listResourceMultipartUploadParts(
            session.resourceId,
            session.uploadId,
        );

        if (listedParts.length !== getExpectedUploadPartCount(session.size)) {
            // Leaving the upload open would accrue storage cost for parts nobody can finish.
            await client.abortResourceMultipartUpload(
                session.resourceId,
                session.uploadId,
            );
            return false;
        }

        await client.completeResourceMultipartUpload(
            session.resourceId,
            session.uploadId,
            listedParts,
        );
    }

    try {
        const actualSize = await client.getResourceSizeDirect(
            session.resourceId,
        );
        if (
            actualSize !== session.size ||
            validateUpload(
                bucket,
                actualSize,
                getMaxUploadSizeBytes(bucket, env.maxUploadSizeMB),
            )
        ) {
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

export async function abortFileUploadSession(
    client: UploadStorageClient,
    bucket: UploadBucket,
    session: UploadSession,
): Promise<boolean> {
    if (!hasValidSignature(bucket, session)) return false;

    if (session.mode === "single") {
        try {
            await client.deleteResource(session.resourceId);
        } catch {
            // A single PUT that never started leaves nothing to delete.
        }
        return true;
    }

    await client.abortResourceMultipartUpload(
        session.resourceId,
        session.uploadId,
    );
    return true;
}

// mysql2 attaches `code` ("ER_DUP_ENTRY") and `errno` (1062) directly on the
// error object it rejects with, and drizzle-orm/mysql2 passes that object
// through unwrapped. Checking both keeps this correct even if one is ever
// renamed; anything that doesn't look like this falls through as a real error.
export function isDuplicateKeyError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;

    const { code, errno } = error as { code?: unknown; errno?: unknown };
    return code === "ER_DUP_ENTRY" || errno === 1062;
}

export interface DownloadRegistration {
    filename: string;
    originalFilename: string;
    fileSize: number;
}

// A replayed complete on an already-registered download hits the UNIQUE
// constraint on filename/originalFilename instead of failing for real: the
// row from the first, successful complete already exists. That is a replay,
// not a failure, so it must not delete the object the existing row points at.
export async function registerCompletedDownload(
    client: Pick<UploadStorageClient, "deleteResource">,
    insert: (row: DownloadRegistration) => Promise<unknown>,
    session: UploadSession,
): Promise<{ completed: true }> {
    try {
        await insert({
            filename: session.resourceId,
            originalFilename: session.resourceId,
            fileSize: session.size,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) return { completed: true };

        try {
            await client.deleteResource(session.resourceId);
        } catch {
            // Preserve the database failure; object cleanup can be retried from storage logs.
        }
        throw error;
    }

    return { completed: true };
}

// The abort signature stays valid for up to 60 minutes after a successful
// complete, so a replayed abort must not be allowed to delete a completed,
// DB-registered object. Media uploads have no DB row to consult, so this
// guard only applies to downloads — that is a known, accepted limitation.
//
// The existence check is also best-effort against a concurrent complete: it
// only sees committed rows, so an abort racing a complete whose INSERT has
// not yet landed can still slip through and delete the object. Closing that
// gap would need a transaction or a distributed lock, which is disproportionate
// to the risk — the loser is a compensating delete that registerCompletedDownload
// already treats as recoverable via its duplicate-key replay path.
export async function abortDownloadUpload(
    client: UploadStorageClient,
    bucket: UploadBucket,
    session: UploadSession,
    hasExistingRow: () => Promise<boolean>,
): Promise<boolean> {
    if (bucket === "download" && (await hasExistingRow()))
        throw new Response("Upload already completed", { status: 409 });

    return abortFileUploadSession(client, bucket, session);
}
