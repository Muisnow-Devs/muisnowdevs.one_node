import BottomAction from "@/components/bottomAction";
import FileUploadComponent from "@/components/upload";
import UploadingSection from "@/components/upload/uploadingSection";
import { UploadedFileMetadata } from "@/functions/handleFileUpload/useChunkedUpload";
import db from "@/db/client.server";
import { downloadableFiles } from "@/db/schema";
import { privateS3 } from "@/storage/aws.server";
import { eq } from "drizzle-orm";
import { ActionFunctionArgs, Form, MetaFunction, redirect, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import invariant from "tiny-invariant";
import { getMaxUploadSizeBytes } from "@/functions/handleFileUpload/validation";
import { canFinalizeDownload } from "@/functions/downloadLifecycle";

export const meta: MetaFunction = () => [{ title: "新增下載檔案 - Muisnow Devs" }];

export function loader() {
    return { maxUploadSizeBytes: getMaxUploadSizeBytes() };
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const originalFilename = formData.get("originalFilename");
    invariant(typeof originalFilename === "string" && originalFilename, "originalFilename is required");

    const draft = await db.query.downloadableFiles.findFirst({ where: eq(downloadableFiles.originalFilename, originalFilename) });
    if (!draft || !canFinalizeDownload(draft.lifecycle))
        throw new Response("Upload draft not found", { status: 404 });

    if (formData.get("intent") === "cancel") {
        await privateS3.deleteResource(draft.originalFilename);
        await db.delete(downloadableFiles).where(eq(downloadableFiles.id, draft.id));
        return redirect("/dashboard/download");
    }

    const filename = formData.get("filename");
    invariant(typeof filename === "string" && filename.trim(), "filename is required");
    await db.update(downloadableFiles).set({
        filename: filename.trim(),
        description: String(formData.get("description") || "") || null,
        fileType: String(formData.get("fileType") || "") || null,
        hash: String(formData.get("hash") || "") || null,
        enabled: true,
        lifecycle: "active",
    }).where(eq(downloadableFiles.id, draft.id));
    return redirect("/dashboard/download");
}

async function sha1(file: File) {
    const hash = await crypto.subtle.digest("SHA-1", await file.arrayBuffer());
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}

export default function DashboardDownloadNewIndex() {
    const { maxUploadSizeBytes } = useLoaderData<typeof loader>();
    const [files, setFiles] = useState<File[]>([]);
    const [uploaded, setUploaded] = useState<{ resourceId: string; metadata: UploadedFileMetadata; hash: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const navigation = useNavigation();

    if (uploaded) return <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="originalFilename" value={uploaded.resourceId} />
        <input type="hidden" name="fileType" value={uploaded.metadata.type} />
        <input type="hidden" name="hash" value={uploaded.hash} />
        <label>顯示名稱<input className="input input-bordered w-full" name="filename" required defaultValue={uploaded.metadata.file.name} /></label>
        <label>描述<textarea className="textarea textarea-bordered w-full" name="description" /></label>
        <BottomAction><button className="btn" name="intent" value="cancel">取消</button><button className="btn btn-primary" disabled={navigation.state !== "idle"}>建立</button></BottomAction>
    </Form>;

    return <div><p>新增下載檔案</p><FileUploadComponent files={files} setFiles={(next) => setFiles(next.slice(0, 1))} />
        {!uploading && files.length > 0 && <button className="btn btn-primary mt-5" onClick={() => setUploading(true)}>上傳</button>}
        {uploading && <UploadingSection bucket="download" files={files} maxUploadSizeBytes={maxUploadSizeBytes} onComplete={async (resourceId, metadata) => setUploaded({ resourceId, metadata, hash: await sha1(metadata.file) })} />}
    </div>;
}
