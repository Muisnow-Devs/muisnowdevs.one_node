import { UploadStatus } from "@/functions/handleFileUpload";
import { MetaFunction , ActionFunctionArgs } from "react-router";
import { useReducer } from "react";
import SelectFileSection from "./selectFile";
import reducer, { ActionType } from "./reducer";
import UploadingSection from "./uploading";
import invariant from "tiny-invariant";

export const meta: MetaFunction = () => {
    return [
        { title: "上傳媒體 - Muisnow Devs" },
        {
            name: "description",
            content: "上傳你的媒體資源至伺服器",
        },
    ];
};

export async function action({ request }: ActionFunctionArgs) {
    const body = await request.formData();
    const ac = body.get("action");
    invariant(ac, "action is required");

    // const uploadAction = Number(ac) as unknown as UploadStatus;
}

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
            setState={(state) => dispatch({ type: ActionType.SET_STATE, payload: state })}
            file={state.file}
            setFile={(file) => dispatch({ type: ActionType.SET_FILE, payload: file })} />}
        {state.state === UploadStatus.UPLOADING && <UploadingSection
            file={state.file}
            onSuccessfulChunks={(chunks) => dispatch({ type: ActionType.ADD_UPLOAD_SUCCESSFUL_CHUNK, payload: chunks })}
            setState={(state) => dispatch({ type: ActionType.SET_STATE, payload: state })} />}
    </div>;
}