import { MonoText, Timestamp } from "@/components/text";
import { listMedia, deleteMedia } from "@/features/media/media.server";
import { humanFileSize } from "@/utils";
import { downloadURIWithBlob } from "@/utils.client";
import {
    Link,
    useFetcher,
    useLoaderData,
    useSearchParams,
    ActionFunctionArgs,
    LoaderFunctionArgs,
    MetaFunction,
} from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
    FaArrowDown,
    FaArrowLeft,
    FaArrowRight,
    FaUpload,
} from "react-icons/fa";
import invariant from "tiny-invariant";

const LIMIT = 10;

export const meta: MetaFunction = () => {
    return [
        { title: "媒體管理 - Muisnow Devs" },
        {
            name: "description",
            content: "管理你的媒體資源",
        },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const continuationToken =
        url.searchParams.get("continuationToken") || undefined;

    return listMedia(continuationToken);
}

export async function action({ request }: ActionFunctionArgs) {
    const body = await request.formData();
    const id = body.get("id");
    invariant(typeof id === "string" && id, "id is required");

    const method = request.method;

    if (method === "DELETE") return await deleteMedia(id).then(() => null);

    return null;
}

interface MediaCardArgs {
    filename: string;
    size: number;
    createAt: Date;
    selected: boolean;
    onSelect: (selected: boolean) => void;
    onDelete: () => void;
}

function MediaCard(config: MediaCardArgs) {
    function copyLink() {
        navigator.clipboard.writeText(
            import.meta.env.VITE_PUBLIC_URL + config.filename,
        );
        alert("已複製連結到剪貼簿");
    }

    function mediaDelete() {
        if (!confirm("確定要刪除此檔案嗎？")) return;

        config.onDelete();
    }

    function open() {
        window.open(import.meta.env.VITE_PUBLIC_URL + config.filename);
    }

    return (
        <tr className="hover:bg-gray-100 transition-colors">
            <td>
                <div className="flex items-center justify-center">
                    <input
                        className="checkbox"
                        type="checkbox"
                        checked={config.selected}
                        onChange={() => config.onSelect(!config.selected)}
                    />
                </div>
            </td>
            <td className="flex-auto">{config.filename}</td>
            <td>{humanFileSize(config.size)}</td>
            <td>
                <Timestamp time={config.createAt} />
            </td>
            <td className="flex gap-2">
                <button className="btn btn-primary" onClick={open}>
                    檢視
                </button>
                <button
                    className="btn btn-neutral text-white"
                    onClick={copyLink}
                >
                    複製連結
                </button>
                <button
                    className="btn hover:btn-error hover:text-white"
                    onClick={mediaDelete}
                >
                    刪除
                </button>
            </td>
        </tr>
    );
}

export default function DashboardMediaPage() {
    const data = useLoaderData<typeof loader>();
    const [continuationToken, setContinuationToken] = useState(
        data.continuationToken,
    );
    const [resources, setResources] = useState(data.content || []);
    const [, setSearchParams] = useSearchParams();
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [isAllSelected, setIsAllSelected] = useState(false);
    const fetcher = useFetcher<typeof action>();

    const searchData = useMemo(() => {
        return search.length > 0
            ? resources?.filter((item) => item.Key?.includes(search)) || []
            : resources || [];
    }, [search, resources]);

    function selectAll() {
        if (isAllSelected) {
            setSelected([]);
            return;
        }

        setSelected(resources.map((item) => item.Key || ""));
    }

    function select(item: string, value: boolean) {
        setSelected((selected) =>
            value ? [...selected, item] : selected.filter((i) => i !== item),
        );
    }

    function downloadSelected() {
        if (selected.length === 0) return;

        console.log(selected);

        for (const item of selected) {
            downloadURIWithBlob(import.meta.env.VITE_PUBLIC_URL + item, item);
        }
    }

    function deleteResources(ids: string[]) {
        for (const item of ids) {
            fetcher.submit({ id: item }, { method: "DELETE" });
        }
        // Optimistically remove from local state so the UI updates immediately.
        setResources((prev) => prev.filter((r) => !ids.includes(r.Key || "")));
        setSelected((prev) => prev.filter((s) => !ids.includes(s)));
    }

    function deleteSelected() {
        if (!confirm(`確定要刪除選取的 ${selected.length} 個檔案嗎？`)) return;

        deleteResources(selected);
    }

    useEffect(() => {
        if (selected.length === resources.length) setIsAllSelected(true);
        else setIsAllSelected(false);
    }, [selected, resources.length]);

    useEffect(() => {
        // check if is at last second page
        if (searchData.length <= (page + 1) * LIMIT && data.continuationToken)
            setSearchParams({ continuationToken: data.continuationToken });
    }, [data.continuationToken, page, searchData, setSearchParams]);

    useEffect(() => {
        if (data.continuationToken === continuationToken) return;
        setContinuationToken(data.continuationToken);
        setResources((res) => [...res, ...(data.content || [])]);
    }, [continuationToken, data]);

    return (
        <div>
            <p>管理已上傳的媒體</p>
            <p className="alert alert-info text-white text-left">
                <span>
                    媒體端點為:{" "}
                    <a href={import.meta.env.VITE_PUBLIC_URL}>
                        <MonoText className="break-all">
                            {import.meta.env.VITE_PUBLIC_URL}
                        </MonoText>
                    </a>
                </span>
            </p>
            <div className="border p-5 rounded-xl w-full">
                <div className="flex justify-between md:flex-row flex-col gap-2">
                    <div className="flex gap-2">
                        <Link to="new" className="btn btn-primary w-fit">
                            <FaUpload /> 上傳媒體
                        </Link>
                        {selected.length > 0 && (
                            <div className="dropdown">
                                <button className="btn" tabIndex={0}>
                                    批次操作 <FaArrowDown />
                                </button>
                                <ul className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm flex flex-col gap-1 mt-2">
                                    <li>
                                        <button onClick={downloadSelected}>
                                            下載
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            className="hover:bg-error hover:text-white"
                                            onClick={deleteSelected}
                                        >
                                            刪除
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="搜尋檔案"
                            className="input input-bordered"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {search.length > 0 && (
                            <button
                                className="btn"
                                onClick={() => setSearch("")}
                            >
                                清除
                            </button>
                        )}
                    </div>
                </div>
                <div className="w-full">
                    <div className="overflow-x-auto">
                        <table className="table w-full min-w-max mt-5">
                            <thead>
                                <tr>
                                    <th>
                                        <div className="flex items-center justify-center">
                                            <input
                                                className="checkbox"
                                                type="checkbox"
                                                onChange={selectAll}
                                                checked={isAllSelected}
                                            />
                                        </div>
                                    </th>
                                    <th>檔案名稱</th>
                                    <th>檔案大小</th>
                                    <th>更新時間</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchData
                                    .slice(page * 10, (page + 1) * 10)
                                    .map((item) => (
                                        <MediaCard
                                            selected={selected.includes(
                                                item.Key || "",
                                            )}
                                            onSelect={(selected) =>
                                                select(item.Key || "", selected)
                                            }
                                            onDelete={() =>
                                                deleteResources([
                                                    item.Key || "",
                                                ])
                                            }
                                            key={"item:" + item.Key}
                                            filename={item.Key || "unknown"}
                                            size={item.Size || 0}
                                            createAt={
                                                item.LastModified || new Date()
                                            }
                                        />
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 flex justify-between items-center">
                        <button
                            className="btn"
                            onClick={() => setPage(page - 1)}
                            disabled={page === 0}
                        >
                            <FaArrowLeft /> 上一頁
                        </button>
                        <span>
                            {page + 1} / {Math.ceil(searchData.length / LIMIT)}
                        </span>
                        <button
                            className="btn"
                            onClick={() => setPage(page + 1)}
                            disabled={searchData.length <= (page + 1) * LIMIT}
                        >
                            下一頁 <FaArrowRight />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
