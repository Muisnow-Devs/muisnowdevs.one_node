import { UploadBucket } from ".";
import { getMaxUploadSizeBytes, UPLOAD_CHUNK_SIZE_BYTES, validateUploadSize } from "./validation";

export function getUploadChunkRanges(size: number) {
    const ranges: { start: number; end: number }[] = [];
    for (let start = 0; start < size; start += UPLOAD_CHUNK_SIZE_BYTES)
        ranges.push({ start, end: Math.min(start + UPLOAD_CHUNK_SIZE_BYTES, size) });
    return ranges;
}

export interface UploadedFileMetadata {
    file: File;
    size: number;
    type: string;
}

async function uploadRequest(data: Record<string, string | number>, signal?: AbortSignal) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.set(key, String(value)));
    const response = await fetch("/dashboard/upload", { method: "POST", body: formData, signal });
    if (!response.ok)
        throw new Error(await response.text() || "Upload request failed");
    return response.json();
}

export async function uploadFileInChunks(file: File, bucket: UploadBucket, onProgress: (progress: number) => void, signal?: AbortSignal, maxUploadSizeBytes = getMaxUploadSizeBytes()) {
    const validationError = validateUploadSize(file.size, maxUploadSizeBytes);
    if (validationError)
        throw new Error(validationError);

    const session = await uploadRequest({ intent: "create", bucket, filename: file.name, mimetype: file.type, size: file.size }, signal);
    let uploadedBytes = 0;

    try {
        for (const [index, range] of getUploadChunkRanges(file.size).entries()) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const part = index + 1;
            const chunk = file.slice(range.start, range.end);
            const { url } = await uploadRequest({ intent: "part", bucket, part, ...session }, signal);
            const response = await fetch(url, { method: "PUT", body: chunk });
            if (!response.ok)
                throw new Error("Unable to upload file part.");
            uploadedBytes += chunk.size;
            onProgress(uploadedBytes / file.size);
        }

        await uploadRequest({ intent: "complete", bucket, ...session }, signal);
        return { resourceId: session.resourceId, metadata: { file, size: file.size, type: file.type } satisfies UploadedFileMetadata };
    } catch (error) {
        try {
            await uploadRequest({ intent: "abort", bucket, ...session });
        } catch {
            // The original failure is more useful; an expired/completed upload may no longer be abortable.
        }
        throw error;
    }
}
