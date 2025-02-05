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
}
