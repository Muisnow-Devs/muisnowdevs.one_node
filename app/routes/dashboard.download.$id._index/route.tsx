import BottomAction from "@/components/bottomAction";
import db from "@/db/client.server";
import { downloadableFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionFunctionArgs, Form, Link, LoaderFunctionArgs, MetaFunction, redirect, useLoaderData, useNavigation } from "react-router";
import invariant from "tiny-invariant";
import { privateS3 } from "@/storage/aws.server";
import { canEditDownload } from "@/functions/downloadLifecycle";

export const meta: MetaFunction = () => [{ title: "編輯下載檔案 - Muisnow Devs" }];

export async function loader({ params }: LoaderFunctionArgs) {
    invariant(params.id, "id is required");
    const item = await db.query.downloadableFiles.findFirst({ where: eq(downloadableFiles.id, params.id) });
    if (!item || !canEditDownload(item.lifecycle))
        throw new Response(null, { status: 404 });
    return item;
}

export async function action({ request, params }: ActionFunctionArgs) {
    invariant(params.id, "id is required");
    const formData = await request.formData();
    const item = await db.query.downloadableFiles.findFirst({ where: eq(downloadableFiles.id, params.id) });
    if (!item || !canEditDownload(item.lifecycle))
        throw new Response(null, { status: 404 });
    if (formData.get("intent") === "delete") {
        await db.update(downloadableFiles).set({ enabled: false, lifecycle: "deleting" }).where(eq(downloadableFiles.id, item.id));
        await privateS3.deleteResource(item.originalFilename);
        await db.delete(downloadableFiles).where(eq(downloadableFiles.id, item.id));
        return redirect("/dashboard/download");
    }
    const filename = formData.get("filename");
    invariant(typeof filename === "string" && filename.trim(), "filename is required");
    const enabled = formData.get("enabled") === "true";
    await db.update(downloadableFiles).set({
        filename: filename.trim(),
        description: String(formData.get("description") || "") || null,
        enabled,
        lifecycle: enabled ? "active" : "disabled",
    }).where(eq(downloadableFiles.id, item.id));
    return redirect("/dashboard/download");
}

export default function DashboardDownloadEditIndex() {
    const item = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    return <Form method="post" className="flex flex-col gap-4">
        <label>顯示名稱<input className="input input-bordered w-full" name="filename" required defaultValue={item.filename} /></label>
        <label>描述<textarea className="textarea textarea-bordered w-full" name="description" defaultValue={item.description || ""} /></label>
        <label className="label cursor-pointer justify-start gap-3"><input type="checkbox" className="toggle" name="enabled" value="true" defaultChecked={item.enabled} />啟用</label>
        <BottomAction><Link className="btn" to="/dashboard/download">取消</Link><button className="btn btn-error text-white" name="intent" value="delete">刪除</button><button className="btn btn-primary" disabled={navigation.state !== "idle"}>儲存</button></BottomAction>
    </Form>;
}
