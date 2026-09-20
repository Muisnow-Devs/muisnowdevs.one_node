import BottomAction from "@/components/bottomAction";
import FileUploadComponent from "@/components/upload";
import UploadingSection from "@/components/upload/uploadingSection";
import { UploadedFileMetadata } from "@/features/uploads/uploadClient";
import { finalizeDownload, cancelDownload } from "@/features/downloads/download.server";
import { parseDownloadForm } from "@/features/downloads/download-form";
import { ActionFunctionArgs, Form, MetaFunction, redirect, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import { getMaxUploadSizeBytes } from "@/features/uploads/validation";

export const meta: MetaFunction = () => [{ title: "新增下載檔案 - Muisnow Devs" }];

export function loader() {
    return { maxUploadSizeBytes: getMaxUploadSizeBytes("download") };
}

export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const originalFilename = form.get("originalFilename");
    if (typeof originalFilename !== "string" || !originalFilename)
        throw new Response("originalFilename is required", { status: 400 });
    if (form.get("intent") === "cancel") await cancelDownload(originalFilename);
    else await finalizeDownload(originalFilename, {
        ...parseDownloadForm(form),
        fileType: String(form.get("fileType") || "") || null,
        hash: String(form.get("hash") || "") || null,
    });
    return redirect("/dashboard/download");
}
export default function DashboardDownloadNewIndex() {
    const { maxUploadSizeBytes } = useLoaderData<typeof loader>();
    const [files, setFiles] = useState<File[]>([]);
    const [uploaded, setUploaded] = useState<{
        resourceId: string;
        metadata: UploadedFileMetadata;
    } | null>(null);
    const [uploading, setUploading] = useState(false);
    const navigation = useNavigation();

    if (uploaded)
        return (
            <Form method="post" className="flex flex-col gap-4">
                <input
                    type="hidden"
                    name="originalFilename"
                    value={uploaded.resourceId}
                />
                <input
                    type="hidden"
                    name="fileType"
                    value={uploaded.metadata.type}
                />
                <input
                    type="hidden"
                    name="hash"
                    value={uploaded.metadata.hash ?? ""}
                />
                <label>
                    顯示名稱
                    <input
                        className="input input-bordered w-full"
                        name="filename"
                        required
                        defaultValue={uploaded.metadata.file.name}
                    />
                </label>
                <label>
                    描述
                    <textarea
                        className="textarea textarea-bordered w-full"
                        name="description"
                    />
                </label>
                <BottomAction>
                    <button className="btn" name="intent" value="cancel">
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        disabled={navigation.state !== "idle"}
                    >
                        建立
                    </button>
                </BottomAction>
            </Form>
        );

    return (
        <div>
            <p>新增下載檔案</p>
            <FileUploadComponent
                files={files}
                setFiles={(next) => setFiles(next.slice(0, 1))}
            />
            {!uploading && files.length > 0 && (
                <button
                    className="btn btn-primary mt-5"
                    onClick={() => setUploading(true)}
                >
                    上傳
                </button>
            )}
            {uploading && (
                <UploadingSection
                    bucket="download"
                    files={files}
                    maxUploadSizeBytes={maxUploadSizeBytes}
                    computeHash
                    onComplete={(resourceId, metadata) =>
                        setUploaded({ resourceId, metadata })
                    }
                />
            )}
        </div>
    );
}
