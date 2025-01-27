import { UploadStatus } from "@/functions/handleFileUpload";
import { MetaFunction } from "@remix-run/react";
import { useReducer } from "react";
import SelectFileSection from "./selectFile";
import reducer, { ActionType } from "./reducer";

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
    const [state, dispatch] = useReducer(reducer, {
        file: null,
        state: UploadStatus.SELECTING,
        uploadInfo: null,
        successfulChunks: [],
    });

    return <div>
        <p>新增媒體</p>

        {state.state === UploadStatus.SELECTING && <SelectFileSection
            state={state.state}
            setState={(state) => dispatch({ type: ActionType.SET_STATE, payload: state })}
            file={state.file}
            setFile={(file) => dispatch({ type: ActionType.SET_FILE, payload: file })} />}
    </div>;
}