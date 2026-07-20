import { UploadStatus } from "@/functions/handleFileUpload";
import { MetaFunction, useLoaderData, useNavigate } from "react-router";
import { useReducer } from "react";
import SelectFileSection from "./selectFile";
import reducer, { ActionType } from "./reducer";
import UploadingSection from "@/components/upload/uploadingSection";
import { getMaxUploadSizeBytes } from "@/functions/handleFileUpload/validation";

export function loader() {
    return { maxUploadSizeBytes: getMaxUploadSizeBytes() };
}

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
    const { maxUploadSizeBytes } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const [state, dispatch] = useReducer(reducer, {
        file: [],
        state: UploadStatus.SELECTING,
        uploadInfo: null,
        successfulChunks: [],
    });

    return <div>
        <p>新增媒體</p>

        {state.state === UploadStatus.SELECTING && <SelectFileSection
            setState={(state) => dispatch({ type: ActionType.SET_STATE, payload: state })}
            files={state.file}
            setFiles={(files) => dispatch({ type: ActionType.SET_FILE, payload: files })} />}
        {state.state === UploadStatus.UPLOADING && <UploadingSection
            bucket="media"
            files={state.file}
            maxUploadSizeBytes={maxUploadSizeBytes}
            onComplete={() => undefined}
            onAllComplete={() => navigate("/dashboard/media")} />}
    </div>;
}
