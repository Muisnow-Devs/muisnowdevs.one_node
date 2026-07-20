const DEFAULT_MAX_UPLOAD_SIZE_MB = 100;
const BYTES_PER_MEGABYTE = 1024 * 1024;
export const UPLOAD_CHUNK_SIZE_BYTES = 8 * BYTES_PER_MEGABYTE;

export interface MultipartUploadPart {
    ETag: string;
    PartNumber: number;
}

export function getMaxUploadSizeBytes(value = typeof process === "undefined" ? undefined : process.env.MAX_UPLOAD_SIZE_MB): number {
    const maxUploadSizeMB = Number(value);

    if (!Number.isFinite(maxUploadSizeMB) || maxUploadSizeMB <= 0)
        return DEFAULT_MAX_UPLOAD_SIZE_MB * BYTES_PER_MEGABYTE;

    return maxUploadSizeMB * BYTES_PER_MEGABYTE;
}

export function validateUpload(size: number, maxUploadSizeMB?: number): string | null {
    const maxSize = maxUploadSizeMB === undefined
        ? getMaxUploadSizeBytes()
        : maxUploadSizeMB * BYTES_PER_MEGABYTE;
    return validateUploadSize(size, maxSize);
}

export function validateUploadSize(size: number, maxSize: number): string | null {
    if (size <= 0)
        return "File must not be empty";

    if (size > maxSize)
        return `File exceeds the ${Math.round(maxSize / BYTES_PER_MEGABYTE)} MB upload limit`;

    return null;
}

export function getExpectedUploadPartCount(size: number) {
    return Math.ceil(size / UPLOAD_CHUNK_SIZE_BYTES);
}

export function validateUploadParts(parts: unknown, expectedSize?: number): parts is MultipartUploadPart[] {
    if (!Array.isArray(parts) || parts.length === 0)
        return false;
    if (expectedSize !== undefined && parts.length !== getExpectedUploadPartCount(expectedSize))
        return false;

    return parts.every((part, index) => {
        if (typeof part !== "object" || part === null)
            return false;
        const candidate = part as Partial<MultipartUploadPart>;
        return typeof candidate.ETag === "string" && candidate.ETag.length > 0 &&
            candidate.PartNumber === index + 1;
    });
}
