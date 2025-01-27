import { humanFileSize } from "@/utils";
import { MdFileUpload, MdRestartAlt } from "react-icons/md";

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

interface FileUploadComponentArgs {
    file: File | null;
    setFile: (file: File | null) => void;
}

export default function FileUploadComponent(config: FileUploadComponentArgs) {
    return <div>
        {!config.file && <UploadFile setFile={config.setFile} />}
        {config.file && <FileSelected
            filename={config.file.name}
            size={config.file.size}
            mimeType={config.file.type}
            onReselect={() => config.setFile(null)} />}
    </div>
}