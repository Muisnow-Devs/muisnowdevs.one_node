import { UploadPart, UploadStatus } from "@/functions/handleFileUpload";

interface UploadingSectionArgs {
    file: File | null;
    onSuccessfulChunks: (chunks: UploadPart) => void;
    setState: (state: UploadStatus) => void;
}

export default function UploadingSection(config: UploadingSectionArgs) {
    return <div>
        <p>上傳中</p>
    </div>;
}