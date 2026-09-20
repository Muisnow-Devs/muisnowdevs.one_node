import type { ActionFunctionArgs } from "react-router";
import { handleUpload } from "@/features/uploads/upload.server";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST")
        throw new Response(null, { status: 405, headers: { Allow: "POST" } });
    return handleUpload(await request.formData());
}
