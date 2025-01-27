import { UploadStatus } from "@/functions/handleFileUpload";
import { MetaFunction } from "@remix-run/react";
import { useState } from "react";
import SelectFileSection from "./selectFile";

export const meta: MetaFunction = () => {
    return [
        { title: "上傳媒體 - Muisnow Devs" },
        {
            name: "description",
            content: "上傳你的媒體資源至伺服器",
        },
    ];
};

export default function DashboardMediaNewIndex() {
    const [file, setFile] = useState<File | null>(null);
    const [state, setState] = useState<UploadStatus>(UploadStatus.SELECTING);

    return <div>
        <p>新增媒體</p>
        
        {state === UploadStatus.SELECTING && <SelectFileSection
            state={state}
            setState={setState}
            file={file}
            setFile={setFile} />}
    </div>;
}