import BottomAction from "@/components/bottomAction";
import FileUploadComponent from "@/components/upload";
import { UploadStatus } from "@/functions/handleFileUpload";
import { Link } from "react-router";
import { FaUpload } from "react-icons/fa";
import { FaX } from "react-icons/fa6";

interface SelectFileSectionArgs {
    setState: (state: UploadStatus) => void;
    file: File | null;
    setFile: (file: File | null) => void;
}
    

export default function SelectFileSection(config: SelectFileSectionArgs) {
    return <div>
        <p className="alert bg-yellow-300 text-left">請注意！檔案上傳後會生成新的檔案名稱，您無法使用原始檔案名稱作為讀取路徑。</p>

        <FileUploadComponent file={config.file} setFile={config.setFile} />

        <BottomAction>
            <Link to={"/dashboard/media"} className="btn btn-error text-white"><FaX /> 取消</Link>
            {config.file && <button
                onClick={() => config.setState(UploadStatus.UPLOADING)}
                className="btn btn-primary w-full sm:w-fit text-white">
                <FaUpload /> 上傳
            </button>}
        </BottomAction>
    </div>;
    
}