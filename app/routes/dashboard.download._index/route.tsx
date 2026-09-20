import { listDownloads, deleteDownload, toggleDownload } from "@/features/downloads/download.server";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, MetaFunction, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { humanFileSize } from "@/utils";
import { canEditDownload } from "@/features/downloads/lifecycle";

const LIMIT = 10;
export const meta: MetaFunction = () => [{ title: "下載檔案管理 - Muisnow Devs" }];

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const rawPage = Number(url.searchParams.get("page") || 1);
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    return listDownloads(page, url.searchParams.get("search") || "", LIMIT);
}

export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const id = form.get("id");
    if (typeof id !== "string" || !id) throw new Response("id is required", { status: 400 });
    if (form.get("intent") === "delete") await deleteDownload(id);
    else if (form.get("intent") === "toggle") await toggleDownload(id);
    else throw new Response("Unknown action", { status: 400 });
    return null;
}
export default function DashboardDownloadIndex() {
    const data = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();
    const [searchParams, setSearchParams] = useSearchParams();
    const pages = Math.max(Math.ceil(data.total / LIMIT), 1);
    const submit = (values: Record<string, string>) =>
        fetcher.submit(values, { method: "POST" });

    return (
        <div>
            <p>管理下載檔案</p>
            <div className="border p-5 rounded-xl">
                <div className="flex justify-between gap-2 flex-col sm:flex-row">
                    <Link className="btn btn-primary w-fit" to="new">
                        新增下載檔案
                    </Link>
                    <input
                        className="input input-bordered"
                        placeholder="搜尋檔案"
                        defaultValue={data.search}
                        onChange={(event) => {
                            const next = new URLSearchParams(searchParams);
                            next.set("search", event.target.value);
                            next.set("page", "1");
                            setSearchParams(next);
                        }}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="table mt-5">
                        <thead>
                            <tr>
                                <th>名稱</th>
                                <th>大小</th>
                                <th>狀態</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.filename}</td>
                                    <td>{humanFileSize(item.fileSize || 0)}</td>
                                    <td>
                                        {
                                            {
                                                draft: "草稿",
                                                active: "啟用",
                                                disabled: "停用",
                                                deleting: "刪除中",
                                            }[item.lifecycle]
                                        }
                                    </td>
                                    <td className="flex gap-2">
                                        {canEditDownload(item.lifecycle) && (
                                            <Link
                                                className="btn btn-sm"
                                                to={item.id}
                                            >
                                                編輯
                                            </Link>
                                        )}
                                        {canEditDownload(item.lifecycle) && (
                                            <button
                                                className="btn btn-sm"
                                                onClick={() =>
                                                    submit({
                                                        intent: "toggle",
                                                        id: item.id,
                                                    })
                                                }
                                            >
                                                {item.lifecycle === "active"
                                                    ? "停用"
                                                    : "啟用"}
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-error text-white"
                                            onClick={() => {
                                                if (
                                                    confirm(
                                                        "確定要刪除此檔案嗎？",
                                                    )
                                                )
                                                    submit({
                                                        intent: "delete",
                                                        id: item.id,
                                                    });
                                            }}
                                        >
                                            刪除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-between mt-5">
                    <button
                        className="btn"
                        disabled={data.page <= 1}
                        onClick={() =>
                            setSearchParams({
                                search: data.search,
                                page: String(data.page - 1),
                            })
                        }
                    >
                        上一頁
                    </button>
                    <span>
                        {data.page} / {pages}
                    </span>
                    <button
                        className="btn"
                        disabled={data.page >= pages}
                        onClick={() =>
                            setSearchParams({
                                search: data.search,
                                page: String(data.page + 1),
                            })
                        }
                    >
                        下一頁
                    </button>
                </div>
            </div>
        </div>
    );
}
