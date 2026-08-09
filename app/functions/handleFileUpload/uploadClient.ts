import { CreateUploadResponse, PartUploadResponse, UploadBucket, UploadSession } from ".";
import { getMaxUploadSizeBytes, getUploadChunkRanges, validateUploadSize } from "./validation";

const MAX_CONCURRENT_PARTS = 4;
const MAX_PART_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

export interface UploadedFileMetadata {
    file: File;
    size: number;
    type: string;
}

export interface UploadDependencies {
    fetch: typeof fetch;
    delay: (ms: number) => Promise<void>;
}

export interface UploadFileOptions {
    signal?: AbortSignal;
    maxUploadSizeBytes?: number;
    concurrency?: number;
    dependencies?: Partial<UploadDependencies>;
}

export function isRetriableStatus(status: number): boolean {
    return status >= 500 || status === 408 || status === 429;
}

export function getRetryDelayMs(attempt: number, random: () => number = Math.random): number {
    // Up to 50% jitter so parallel workers do not retry in lockstep.
    return RETRY_BASE_DELAY_MS * 2 ** attempt * (1 + random() * 0.5);
}

// A fixed pool of workers pulling from one shared cursor: each index runs exactly
// once, and no more than `limit` run at a time.
export async function runWithConcurrency(count: number, limit: number, worker: (index: number) => Promise<void>): Promise<void> {
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, count) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= count)
                return;
            await worker(index);
        }
    });

    await Promise.all(runners);
}

class UploadRequestError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
    }
}

function resolveDependencies(overrides?: Partial<UploadDependencies>): UploadDependencies {
    return {
        fetch: overrides?.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
        delay: overrides?.delay ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
}

async function uploadRequest(dependencies: UploadDependencies, data: Record<string, string | number>, signal?: AbortSignal) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.set(key, String(value)));

    const response = await dependencies.fetch("/dashboard/upload", { method: "POST", body: formData, signal });
    // Carries the status so retry classification treats a rejected session (403)
    // differently from a server hiccup, rather than retrying both three times.
    if (!response.ok)
        throw new UploadRequestError(await response.text() || "Upload request failed", response.status);

    return response.json();
}

function toSessionFields(session: UploadSession) {
    return {
        mode: session.mode,
        resourceId: session.resourceId,
        uploadId: session.uploadId,
        size: session.size,
        validate: session.validate,
    };
}

async function putBody(dependencies: UploadDependencies, url: string, body: Blob, signal?: AbortSignal, contentType?: string) {
    const response = await dependencies.fetch(url, {
        method: "PUT",
        body,
        signal,
        headers: contentType ? { "Content-Type": contentType } : undefined,
    });

    if (!response.ok)
        throw new UploadRequestError("Unable to upload file data.", response.status);
}

// Set the instant before "complete" leaves the client, so a lost response cannot be
// mistaken for an upload that never landed. See uploadFile for why that matters.
interface UploadCompletionState {
    issued: boolean;
}

async function uploadSingle(file: File, bucket: UploadBucket, session: CreateUploadResponse, onProgress: (progress: number) => void, dependencies: UploadDependencies, completion: UploadCompletionState, signal?: AbortSignal) {
    if (!session.url)
        throw new Error("Upload session did not provide an upload target.");

    // The server signed this exact content type and length into the presigned URL, so
    // the header and the body size both have to match or R2 rejects the request.
    await putBody(dependencies, session.url, file, signal, file.type || "application/octet-stream");
    onProgress(1);
    completion.issued = true;
    await uploadRequest(dependencies, { intent: "complete", bucket, ...toSessionFields(session) }, signal);
}

async function uploadMultipart(file: File, bucket: UploadBucket, session: UploadSession, onProgress: (progress: number) => void, dependencies: UploadDependencies, concurrency: number, completion: UploadCompletionState, signal?: AbortSignal) {
    const ranges = getUploadChunkRanges(file.size);
    let uploadedBytes = 0;

    await runWithConcurrency(ranges.length, concurrency, async (index) => {
        const range = ranges[index];
        const chunk = file.slice(range.start, range.end);

        for (let attempt = 0; attempt < MAX_PART_ATTEMPTS; attempt++) {
            if (signal?.aborted)
                throw new DOMException("Aborted", "AbortError");

            try {
                const part: PartUploadResponse = await uploadRequest(dependencies, {
                    intent: "part",
                    bucket,
                    part: index + 1,
                    ...toSessionFields(session),
                }, signal);

                // Every re-issued signature stays valid for its own 60 minutes, so parallel
                // workers can simply keep the most recent one they have seen. Writing it back
                // onto the session keeps both "complete" and a compensating "abort" current.
                session.validate = part.validate;
                await putBody(dependencies, part.url, chunk, signal);

                uploadedBytes += chunk.size;
                onProgress(uploadedBytes / file.size);
                return;
            } catch (error) {
                const isLastAttempt = attempt === MAX_PART_ATTEMPTS - 1;
                const status = error instanceof UploadRequestError ? error.status : undefined;
                const isRetriable = status === undefined || isRetriableStatus(status);

                if (isLastAttempt || !isRetriable || signal?.aborted)
                    throw error;

                await dependencies.delay(getRetryDelayMs(attempt));
            }
        }
    });

    completion.issued = true;
    await uploadRequest(dependencies, { intent: "complete", bucket, ...toSessionFields(session) }, signal);
}

export async function uploadFile(file: File, bucket: UploadBucket, onProgress: (progress: number) => void, options: UploadFileOptions = {}) {
    const maxUploadSizeBytes = options.maxUploadSizeBytes ?? getMaxUploadSizeBytes(bucket);
    const validationError = validateUploadSize(file.size, maxUploadSizeBytes);
    if (validationError)
        throw new Error(validationError);

    const dependencies = resolveDependencies(options.dependencies);
    const { signal } = options;

    const session: CreateUploadResponse = await uploadRequest(dependencies, {
        intent: "create",
        bucket,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
    }, signal);

    const completion: UploadCompletionState = { issued: false };

    try {
        if (session.mode === "single")
            await uploadSingle(file, bucket, session, onProgress, dependencies, completion, signal);
        else
            await uploadMultipart(file, bucket, session, onProgress, dependencies, options.concurrency ?? MAX_CONCURRENT_PARTS, completion, signal);

        return { resourceId: session.resourceId, metadata: { file, size: file.size, type: file.type } satisfies UploadedFileMetadata };
    } catch (error) {
        // Never abort once "complete" has left the client. A complete can succeed on the
        // server and still throw here — a dropped connection or a timeout loses the
        // response, not the upload — and aborting then deletes the object that was just
        // stored. A media upload leaves no database row behind, so nothing would notice.
        //
        // Skipping the abort cannot strand a multipart upload either: a complete that
        // fails its part-count check already aborts the upload server-side before returning.
        if (!completion.issued)
            try {
                await uploadRequest(dependencies, { intent: "abort", bucket, ...toSessionFields(session) });
            } catch {
                // The original failure is more useful; an expired session may no longer be abortable.
            }

        throw error;
    }
}
