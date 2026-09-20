import BottomAction from "@/components/bottomAction";
import { getEditableDownload, deleteDownload, updateDownload } from "@/features/downloads/download.server";
import { parseDownloadForm } from "@/features/downloads/download-form";
import { ActionFunctionArgs, Form, Link, LoaderFunctionArgs, MetaFunction, redirect, useLoaderData, useNavigation } from "react-router";
import invariant from "tiny-invariant";

export const meta: MetaFunction = () => [{ title: "編輯下載檔案 - Muisnow Devs" }];

export async function loader({ params }: LoaderFunctionArgs) {
    invariant(params.id, "id is required");
    return getEditableDownload(params.id);
}

export async function action({ request, params }: ActionFunctionArgs) {
    invariant(params.id, "id is required");
    const form = await request.formData();
    if (form.get("intent") === "delete") await deleteDownload(params.id);
    else await updateDownload(params.id, parseDownloadForm(form));
    return redirect("/dashboard/download");
}
export default function DashboardDownloadEditIndex() {
    const item = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    return (
        <Form method="post" className="flex flex-col gap-4">
            <label>
                顯示名稱
                <input
                    className="input input-bordered w-full"
                    name="filename"
                    required
                    defaultValue={item.filename}
                />
            </label>
            <label>
                描述
                <textarea
                    className="textarea textarea-bordered w-full"
                    name="description"
                    defaultValue={item.description || ""}
                />
            </label>
            <label className="label cursor-pointer justify-start gap-3">
                <input
                    type="checkbox"
                    className="toggle"
                    name="enabled"
                    value="true"
                    defaultChecked={item.enabled}
                />
                啟用
            </label>
            <BottomAction>
                <Link className="btn" to="/dashboard/download">
                    取消
                </Link>
                <button
                    className="btn btn-error text-white"
                    name="intent"
                    value="delete"
                >
                    刪除
                </button>
                <button
                    className="btn btn-primary"
                    disabled={navigation.state !== "idle"}
                >
                    儲存
                </button>
            </BottomAction>
        </Form>
    );
}
