export enum UploadStatus {
    SELECTING = "SELECTING",
    UPLOADING = "UPLOADING",
    UPLOADED = "UPLOADED",
    FAILED = "FAILED",
}

export type UploadBucket = "media" | "download";

export type UploadMode = "single" | "multipart";

export interface UploadSession {
    mode: UploadMode;
    resourceId: string;
    /** Empty string when mode is "single" — there is no multipart upload to reference. */
    uploadId: string;
    size: number;
    validate: string;
}

export interface CreateUploadResponse extends UploadSession {
    /** The presigned PUT target. Present only when mode is "single". */
    url?: string;
}

export interface PartUploadResponse {
    url: string;
    /** Re-issued signature. The client must send this on all subsequent requests. */
    validate: string;
}

// The extension is concatenated into the S3 object key and into the signature
// payload, so anything outside this set is dropped rather than trusted.
const SAFE_EXTENSION = /^[a-z0-9]{1,12}$/;

export function getFileExtension(filename: string | undefined): string {
    if (!filename) return "";

    const parts = filename.split(".");
    if (parts.length < 2) return "";

    const extension = parts[parts.length - 1].toLowerCase();
    return SAFE_EXTENSION.test(extension) ? extension : "";
}

export function getResourceId(
    bucket: UploadBucket,
    filename: string | undefined,
    generateId: () => string,
): string {
    const fileID = generateId();
    if (bucket === "download") return fileID;

    const extension = getFileExtension(filename);
    return fileID + (extension ? "." + extension : "");
}
