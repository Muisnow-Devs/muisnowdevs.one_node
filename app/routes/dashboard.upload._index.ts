import {
    abortFileUploadSession,
    completeFileUploadSession,
    createFileUploadSession,
    getPresignedPUTUrl,
} from "@/functions/handleFileUpload/index.server";
import { UploadBucket } from "@/functions/handleFileUpload";
import { getExpectedUploadPartCount, validateUpload } from "@/functions/handleFileUpload/validation";
import { privateS3, publicS3 } from "@/storage/aws.server";
import db from "@/db/client.server";
import { downloadableFiles } from "@/db/schema";
import { ActionFunctionArgs } from "react-router";

function getBucket(value: FormDataEntryValue | null): UploadBucket | null {
    return value === "media" || value === "download" ? value : null;
}

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST")
        throw new Response(null, { status: 405, headers: { Allow: "POST" } });

    const formData = await request.formData();
    const bucket = getBucket(formData.get("bucket"));
    const intent = formData.get("intent");

    if (!bucket || typeof intent !== "string")
        throw new Response("Invalid upload request", { status: 400 });

    const client = bucket === "media" ? publicS3 : privateS3;

    if (intent === "create") {
        const size = Number(formData.get("size"));
        const error = validateUpload(bucket, size);
        if (error)
            throw new Response(error, { status: 400 });

        return createFileUploadSession(client, bucket, size, String(formData.get("filename") || ""), String(formData.get("mimetype") || ""));
    }

    const resource = {
        resourceId: String(formData.get("resourceId") || ""),
        uploadId: String(formData.get("uploadId") || ""),
        validate: String(formData.get("validate") || ""),
        size: Number(formData.get("size")),
    };

    if (!resource.resourceId || !resource.uploadId || !resource.validate || validateUpload(bucket, resource.size))
        throw new Response("Invalid upload session", { status: 400 });

    if (intent === "abort") {
        const aborted = await abortFileUploadSession(client, bucket, resource);
        if (!aborted)
            throw new Response("Invalid upload session", { status: 403 });
        return { aborted: true };
    }

    if (intent === "part") {
        const part = Number(formData.get("part"));
        const expectedPartCount = getExpectedUploadPartCount(resource.size);
        if (!Number.isInteger(part) || part < 1 || part > expectedPartCount)
            throw new Response("Invalid upload part", { status: 400 });

        const url = await getPresignedPUTUrl(client, bucket, part, resource);
        if (!url)
            throw new Response("Invalid upload session", { status: 403 });
        return { url };
    }

    if (intent === "complete") {
        const completed = await completeFileUploadSession(client, bucket, resource);
        if (!completed)
            throw new Response("Invalid upload session", { status: 403 });

        if (bucket === "download") {
            try {
                await db.insert(downloadableFiles).values({
                    filename: resource.resourceId,
                    originalFilename: resource.resourceId,
                    fileSize: resource.size,
                    enabled: false,
                    lifecycle: "draft",
                });
            } catch (error) {
                try {
                    await privateS3.deleteResource(resource.resourceId);
                } catch {
                    // Preserve the database failure; object cleanup can be retried from storage logs.
                }
                throw error;
            }
        }
        return { completed: true };
    }

    throw new Response("Unknown upload intent", { status: 400 });
}
