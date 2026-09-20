import { UploadBucket, UploadSession } from ".";

export type SignableSession = Pick<
    UploadSession,
    "mode" | "uploadId" | "resourceId" | "size"
>;

// JSON rather than a delimiter join: resourceId ends in a user-supplied extension,
// so a joined payload could be ambiguous between two different sessions.
export function getSignaturePayload(
    bucket: UploadBucket,
    session: SignableSession,
): string {
    return JSON.stringify([
        session.mode,
        bucket,
        session.uploadId,
        session.resourceId,
        session.size,
    ]);
}
