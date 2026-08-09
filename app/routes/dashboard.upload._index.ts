import {
    abortFileUploadSession,
    completeFileUploadSession,
    createFileUploadSession,
    getPresignedPartUrl,
} from "@/functions/handleFileUpload/index.server";
import { UploadBucket, UploadMode, UploadSession } from "@/functions/handleFileUpload";
import { getExpectedUploadPartCount, validateUpload } from "@/functions/handleFileUpload/validation";
import { privateS3, publicS3 } from "@/storage/aws.server";
import db from "@/db/client.server";
import { downloadableFiles } from "@/db/schema";
import { ActionFunctionArgs } from "react-router";

function getBucket(value: FormDataEntryValue | null): UploadBucket | null {
    return value === "media" || value === "download" ? value : null;
}

function getMode(value: FormDataEntryValue | null): UploadMode | null {
    return value === "single" || value === "multipart" ? value : null;
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

    const mode = getMode(formData.get("mode"));
    const session: UploadSession | null = mode && {
        mode,
        resourceId: String(formData.get("resourceId") || ""),
        uploadId: String(formData.get("uploadId") || ""),
        validate: String(formData.get("validate") || ""),
        size: Number(formData.get("size")),
    };

    // A multipart session is meaningless without an uploadId; a single one must not carry one.
    if (!session || !session.resourceId || !session.validate || validateUpload(bucket, session.size) ||
        (session.mode === "multipart") !== Boolean(session.uploadId))
        throw new Response("Invalid upload session", { status: 400 });

    if (intent === "abort") {
        const aborted = await abortFileUploadSession(client, bucket, session);
        if (!aborted)
            throw new Response("Invalid upload session", { status: 403 });
        return { aborted: true };
    }

    if (intent === "part") {
        if (session.mode !== "multipart")
            throw new Response("Invalid upload part", { status: 400 });

        const part = Number(formData.get("part"));
        const expectedPartCount = getExpectedUploadPartCount(session.size);
        if (!Number.isInteger(part) || part < 1 || part > expectedPartCount)
            throw new Response("Invalid upload part", { status: 400 });

        const presigned = await getPresignedPartUrl(client, bucket, part, session);
        if (!presigned)
            throw new Response("Invalid upload session", { status: 403 });
        return presigned;
    }

    if (intent === "complete") {
        const completed = await completeFileUploadSession(client, bucket, session);
        if (!completed)
            throw new Response("Invalid upload session", { status: 403 });

        if (bucket === "download") {
            try {
                await db.insert(downloadableFiles).values({
                    filename: session.resourceId,
                    originalFilename: session.resourceId,
                    fileSize: session.size,
                    enabled: false,
                    lifecycle: "draft",
                });
            } catch (error) {
                try {
                    await privateS3.deleteResource(session.resourceId);
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
