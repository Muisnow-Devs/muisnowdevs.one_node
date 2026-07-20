import { UploadBucket } from "@/functions/handleFileUpload";
import { UploadedFileMetadata, uploadFileInChunks } from "@/functions/handleFileUpload/useChunkedUpload";
import { scheduleUploadStart } from "@/functions/handleFileUpload/uploadLifecycle";
import { useEffect, useRef, useState } from "react";

interface UploadingSectionArgs {
    bucket: UploadBucket;
    files: File[];
    onComplete: (resourceId: string, metadata: UploadedFileMetadata) => void | Promise<void>;
    onAllComplete?: () => void | Promise<void>;
    onError?: (error: Error) => void;
    maxUploadSizeBytes?: number;
}

export default function UploadingSection({ bucket, files, onComplete, onAllComplete, onError, maxUploadSizeBytes }: UploadingSectionArgs) {
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const callbacks = useRef({ onComplete, onAllComplete, onError });
    callbacks.current = { onComplete, onAllComplete, onError };

    useEffect(() => {
        return scheduleUploadStart(async (signal) => {
            try {
                for (let index = 0; index < files.length; index++) {
                    const result = await uploadFileInChunks(files[index], bucket, (fileProgress) => {
                        if (!signal.aborted)
                            setProgress((index + fileProgress) / files.length);
                    }, signal, maxUploadSizeBytes);
                    if (!signal.aborted)
                        await callbacks.current.onComplete(result.resourceId, result.metadata);
                }
                if (!signal.aborted)
                    await callbacks.current.onAllComplete?.();
            } catch (reason) {
                const uploadError = reason instanceof Error ? reason : new Error("Upload failed");
                if (!signal.aborted) {
                    setError(uploadError.message);
                    callbacks.current.onError?.(uploadError);
                }
            }
        });
    }, [bucket, files, maxUploadSizeBytes]);

    return <div className="card bg-gray-100 p-5">
        <p>上傳中 {Math.round(progress * 100)}%</p>
        <progress className="progress progress-primary w-full" value={progress * 100} max="100" />
        {error && <p className="alert alert-error mt-4">{error}</p>}
    </div>;
}
