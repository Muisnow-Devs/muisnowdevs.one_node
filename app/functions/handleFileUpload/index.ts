export enum UploadStatus {
    SELECTING = 'SELECTING',
    UPLOADING = 'UPLOADING',
    UPLOADED = 'UPLOADED',
    FAILED = 'FAILED',
}

export interface UploadPart {
    ETag: string;
    PartNumber: number;
}

export interface ServerUploadResponse {
    resourceId: string,
    uploadId: string,
    validate: string,
    size: number,
}

export type UploadBucket = "media" | "download";

export type UploadMode = "single" | "multipart";

export function getResourceId(bucket: UploadBucket, filename: string | undefined, generateId: () => string): string {
    const fileID = generateId();
    if (bucket === "download")
        return fileID;

    const ext = filename?.split('.').pop();
    return fileID + (ext ? '.' + ext : '');
}
