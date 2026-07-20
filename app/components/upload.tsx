import { humanFileSize } from "@/utils";
import { MdFileUpload, MdRestartAlt } from "react-icons/md";

interface UploadFileArgs {
    setFiles: (files: File[]) => void;
}

function UploadFile(config: UploadFileArgs) {
    return <label onDrop={(event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);

        if (files.length === 0)
            return;

        config.setFiles(files);
    }} onDragOver={(event) => event.preventDefault()}>
        {/* With drag and drop theme */}
        <div className="rounded-lg h-96 bg-gray-100 p-10 border-2 border-dashed border-gray-400 hover:bg-gray-200 cursor-pointer transition-all grid place-content-center">
            <div className="text-4xl grid place-content-center relative">
                <MdFileUpload />
                <div className="absolute top-0 left-0 right-0 bottom-0 grid place-content-center animate-ping blur-xs m-5">
                    <MdFileUpload />
                </div>
            </div>
            <div className="mt-5"><span className="text-orange-600">拖曳檔案</span>至此或<span className="text-orange-600">點擊</span>上傳</div>
        </div>
        <input type="file" multiple className="hidden" onChange={(event) => {
            const files = Array.from(event.target.files || []);

            if (files.length === 0)
                return;

            config.setFiles(files);
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

interface FileUploadComponentArgs {
    files: File[];
    setFiles: (files: File[]) => void;
}

export default function FileUploadComponent(config: FileUploadComponentArgs) {
    return <div>
        {config.files.length === 0 && <UploadFile setFiles={config.setFiles} />}
        {config.files.map((file) => <FileSelected
            key={`${file.name}:${file.lastModified}`}
            filename={file.name}
            size={file.size}
            mimeType={file.type}
            onReselect={() => config.setFiles([])} />)}
    </div>
}
