import { UploadBucket, UploadMode } from ".";

const BYTES_PER_MEGABYTE = 1024 * 1024;
const DEFAULT_MAX_MEDIA_UPLOAD_SIZE_MB = 100;

/** Files at or below this size are uploaded as a single presigned PUT. */
export const SINGLE_PUT_MAX_BYTES = 8 * BYTES_PER_MEGABYTE;
/** S3 requires every part except the last to be at least 5 MiB; 8 MiB leaves headroom. */
export const MIN_PART_SIZE_BYTES = 8 * BYTES_PER_MEGABYTE;
/** S3 and R2 both refuse a multipart upload with more than 10,000 parts. */
export const MAX_PART_COUNT = 10_000;
/** R2 caps a single object at 4.995 TiB — the effective ceiling for the private bucket. */
export const R2_MAX_OBJECT_BYTES = Math.floor(4.995 * 1024 ** 4);

export function getMaxUploadSizeBytes(bucket: UploadBucket, value = typeof process === "undefined" ? undefined : process.env.MAX_UPLOAD_SIZE_MB): number {
    // The private download bucket holds deliberate release artifacts, so only R2's own limit applies.
    if (bucket === "download")
        return R2_MAX_OBJECT_BYTES;

    const maxUploadSizeMB = Number(value);

    if (!Number.isFinite(maxUploadSizeMB) || maxUploadSizeMB <= 0)
        return DEFAULT_MAX_MEDIA_UPLOAD_SIZE_MB * BYTES_PER_MEGABYTE;

    return maxUploadSizeMB * BYTES_PER_MEGABYTE;
}

export function validateUploadSize(size: number, maxSize: number): string | null {
    // Number(formData.get("size")) yields NaN on junk input, and NaN fails every
    // comparison below, so require an integer explicitly.
    if (!Number.isInteger(size) || size <= 0)
        return "File must not be empty";

    if (size > maxSize)
        return `File exceeds the ${Math.round(maxSize / BYTES_PER_MEGABYTE)} MB upload limit`;

    return null;
}

export function validateUpload(bucket: UploadBucket, size: number, maxUploadSizeBytes?: number): string | null {
    const maxSize = maxUploadSizeBytes === undefined
        ? getMaxUploadSizeBytes(bucket)
        : maxUploadSizeBytes;
    return validateUploadSize(size, maxSize);
}

export function getUploadMode(size: number): UploadMode {
    return size <= SINGLE_PUT_MAX_BYTES ? "single" : "multipart";
}

export function getUploadPartSize(size: number): number {
    const required = Math.ceil(size / MAX_PART_COUNT);

    if (required <= MIN_PART_SIZE_BYTES)
        return MIN_PART_SIZE_BYTES;

    // Round up to whole megabyte ranges so parts stay aligned and readable.
    return Math.ceil(required / BYTES_PER_MEGABYTE) * BYTES_PER_MEGABYTE;
}

export function getExpectedUploadPartCount(size: number): number {
    return Math.ceil(size / getUploadPartSize(size));
}

export function getUploadChunkRanges(size: number): { start: number; end: number }[] {
    const partSize = getUploadPartSize(size);
    const ranges: { start: number; end: number }[] = [];

    for (let start = 0; start < size; start += partSize)
        ranges.push({ start, end: Math.min(start + partSize, size) });

    return ranges;
}
