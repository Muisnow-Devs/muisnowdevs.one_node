import { humanFileSize } from "@/utils";
import { Link, MetaFunction, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { FaUpload } from "react-icons/fa";
import { FaX } from "react-icons/fa6";
import { MdFileUpload, MdRestartAlt } from "react-icons/md";

export const meta: MetaFunction = () => {
    return [
        { title: "上傳媒體 - Muisnow Devs" },
        {
            name: "description",
            content: "上傳你的媒體資源至伺服器",
        },
    ];
};

interface UploadFileArgs {
    setFile: (file: File) => void;
}

function UploadFile(config: UploadFileArgs) {
    return <label onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];

        if (!file)
            return;

        config.setFile(file);
    }} onDragOver={(event) => event.preventDefault()}>
        {/* With drag and drop theme */}
        <div className="rounded-lg h-96 bg-gray-100 p-10 border-2 border-dashed border-gray-400 hover:bg-gray-200 cursor-pointer transition-all grid place-content-center">
            <div className="text-4xl grid place-content-center relative">
                <MdFileUpload />
                <div className="absolute top-0 left-0 right-0 bottom-0 grid place-content-center animate-ping blur-sm m-5">
                    <MdFileUpload />
                </div>
            </div>
            <div className="mt-5"><span className="text-orange-600">拖曳檔案</span>至此或<span className="text-orange-600">點擊</span>上傳</div>
        </div>
        <input type="file" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];

            if (!file)
                return;

            config.setFile(file);
        }} />
    </label>;
}

interface FileSelectedArgs {
    filename: string,
    size: number,
    mimeType: string,
    onReselect: () => void
}

function FileSelected(config: FileSelectedArgs) {
    return <div className="card bg-gray-100 p-5">
        <div className="flex flex-col sm:flex-row justify-between">
            <div className="flex items-center flex-auto min-w-0">
                <MdFileUpload className="text-4xl hidden sm:block" size={36} />
                <div className="sm:ml-5 min-w-0">
                    <h3 className="text-xl truncate font-bold">{config.filename}</h3>
                    <p className="mb-0 text-gray-500">檔案大小: {humanFileSize(config.size)}</p>
                    <p className="mb-0 text-gray-500">檔案類型: {config.mimeType}</p>

                </div>
            </div>
            <div className="grid sm:place-content-center min-w-fit mt-4 sm:mt-0 sm:ml-5">
                <button className="btn btn-error text-white w-full" onClick={config.onReselect}><MdRestartAlt className="text-xl" /> 重新選擇</button>
            </div>
        </div>
    </div>;
}

export default function DashboardMediaNewIndex() {
    const [file, setFile] = useState<File | null>(null);
    const fetcher = useFetcher();

    return <div>
        <p>新增媒體</p>
        <p className="alert bg-yellow-300 text-left">請注意！檔案上傳後會生成新的檔案名稱，您無法使用原始檔案名稱作為讀取路徑。</p>

        {!file && <UploadFile setFile={setFile} />}
        {file && <FileSelected filename={file.name} size={file.size} mimeType={file.type} onReselect={() => setFile(null)} />}
        <div className="mt-5 flex gap-2 flex-col-reverse sm:flex-row justify-between">
            <Link to={"/dashboard/media"} className="btn btn-error text-white"><FaX /> 取消</Link>
            {file && <button className="btn btn-primary w-full sm:w-fit text-white" disabled={fetcher.state !== "idle"}><FaUpload /> 上傳</button>}
        </div>
    </div>;
}