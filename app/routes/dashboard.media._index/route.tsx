import { publicS3 } from "@/storage/aws.server";
import { humanFileSize } from "@/utils";
import { ActionFunction, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaArrowDown, FaUpload } from "react-icons/fa";
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

export async function loader() {
    return [
    // test data
        {
            Key: "test.jpg",
            Size: 1024,
            LastModified: new Date()
        },
        {
            Key: "test2.jpg",
            Size: 2048,
            LastModified: new Date()
        },
        {
            Key: "test3.jpg",
            Size: 4096,
            LastModified: new Date()
        },
        {
            Key: "test4.jpg",
            Size: 8192,
            LastModified: new Date()
        },
        {
            Key: "test5.jpg",
            Size: 16384,
            LastModified: new Date()
        },
        {
            Key: "test6.jpg",
            Size: 32768,
            LastModified: new Date()
        },
        {
            Key: "test7.jpg",
            Size: 65536,
            LastModified: new Date()
        },
        {
            Key: "test8.jpg",
            Size: 131072,
            LastModified: new Date()
        },
        {
            Key: "test9.jpg",
            Size: 262144,
            LastModified: new Date()
        },
        {
            Key: "test10.jpg",
            Size: 524288,
            LastModified: new Date()
        },
    ]
    return publicS3.getResources();
}

export const action: ActionFunction = async ({ request }) => {
    const body = await request.formData();
    const id = body.get("id");
    invariant(id, "id is required");

    const action = request.method;

    if (action === "DELETE") {
        await publicS3.deleteResource(id as string);
    }

    return null;
};

interface MediaCardArgs {
    filename: string;
    size: number;
    createAt: Date;
    selected: boolean;
    onSelect: (selected: boolean) => void;
}

function MediaCard(config: MediaCardArgs) {
    function copyLink() {
        navigator.clipboard.writeText(import.meta.env.VITE_PUBLIC_URL + config.filename);
        alert("已複製連結到剪貼簿");
    }

    function open() {
        window.open(import.meta.env.VITE_PUBLIC_URL + config.filename);
    }

    return <tr className="hover:bg-gray-100 transition-colors">
        <td>
            <div className="flex items-center justify-center">
                <input className="checkbox" type="checkbox" checked={config.selected} onChange={() => config.onSelect(!config.selected)} />
            </div>
        </td>
        <td className="flex-auto">{config.filename}</td>
        <td>{humanFileSize(config.size)}</td>
        <td>{config.createAt.toLocaleString()}</td>
        <td className="flex gap-2">
            <button className="btn btn-primary" onClick={open}>檢視</button>
            <button className="btn btn-neutral text-white" onClick={copyLink}>複製連結</button>
            <button className="btn">編輯</button>
            <button className="btn hover:btn-error hover:text-white">刪除</button>
        </td>
    </tr>;
}

export default function DashboardMediaPage() {
    const data = useLoaderData<typeof loader>();
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [isAllSelected, setIsAllSelected] = useState(false);

    const searchData = search.length > 0 ? data.filter((item) => item.Key?.includes(search)) : data;

    function selectAll() {
        if (isAllSelected) {
            setSelected([]);
            return;
        }

        setSelected(data.map((item) => item.Key || ""));
    }

    function select(item: string, value: boolean) {
        setSelected((selected) => value ? [...selected, item] : selected.filter((i) => i !== item));
    }

    useEffect(() => {
        if (selected.length === data.length)
            setIsAllSelected(true);
        else
            setIsAllSelected(false);
    }, [selected, data]);

    return <div>
        <p>管理已上傳的媒體</p>
        <div className="border p-5 rounded-xl w-full">
            <div className="flex justify-between md:flex-row flex-col gap-2">
                <div className="flex gap-2">
                    <Link to="new" className="btn btn-primary w-fit"><FaUpload /> 上傳媒體</Link>
                    {selected.length > 0 && <div className="dropdown">
                        <button className="btn" tabIndex={0}>批次操作 <FaArrowDown /></button>
                        <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow flex flex-col gap-1 mt-2">
                            <li><button>下載</button></li>
                            <li><button className="hover:bg-error hover:text-white">刪除</button></li>
                        </ul>
                    </div>}
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="搜尋檔案" className="input input-bordered" value={search} onChange={(event) => setSearch(event.target.value)} />
                    {search.length > 0 && <button className="btn" onClick={() => setSearch("")}>清除</button>}
                </div>
            </div>
            <div className="w-full">
                <div className="overflow-x-auto">
                    <table className="table w-full min-w-max mt-5">
                        <thead>
                            <tr>
                                <th>
                                    <div className="flex items-center justify-center">
                                        <input className="checkbox" type="checkbox" onChange={selectAll} checked={isAllSelected} />
                                    </div>
                                </th>
                                <th>檔案名稱</th>
                                <th>檔案大小</th>
                                <th>更新時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchData.slice(page * 10, (page + 1) * 10).map((item, index) => <MediaCard
                                selected={selected.includes(item.Key || "")}
                                onSelect={(selected) => select(item.Key || "", selected)}
                                key={"item:" + index}
                                filename={item.Key || "N"}
                                size={item.Size || 0}
                                createAt={item.LastModified || new Date()} />)}
                        </tbody>
                    </table>
                </div>

                <div className="mt-5 flex justify-between items-center">
                    <button className="btn" onClick={() => setPage(page - 1)} disabled={page === 0}>上一頁</button>
                    <span>{page + 1} / {Math.ceil(searchData.length / LIMIT)}</span>
                    <button className="btn" onClick={() => setPage(page + 1)} disabled={searchData.length <= (page + 1) * LIMIT}>下一頁</button>
                </div>
            </div>
        </div>
    </div>
}