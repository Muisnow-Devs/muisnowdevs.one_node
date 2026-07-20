import { ServerUploadResponse, UploadPart, UploadStatus } from "@/functions/handleFileUpload";

export enum ActionType {
    SET_FILE,
    SET_STATE,
    SET_UPLOAD_INFO,
    ADD_UPLOAD_SUCCESSFUL_CHUNK,
}

export type Action =
    | { type: ActionType.SET_FILE, payload: File[] }
    | { type: ActionType.SET_STATE, payload: UploadStatus }
    | { type: ActionType.SET_UPLOAD_INFO, payload: ServerUploadResponse }
    | { type: ActionType.ADD_UPLOAD_SUCCESSFUL_CHUNK, payload: UploadPart };

export interface UploadInfo {
    file: File[];
    state: UploadStatus;
    uploadInfo: ServerUploadResponse | null;
    successfulChunks: UploadPart[];
}

export default function reducer(state: UploadInfo, action: Action) {
    switch (action.type) {
        case ActionType.SET_FILE:
            return { ...state, file: action.payload };
        case ActionType.SET_STATE:
            return { ...state, state: action.payload };
        case ActionType.SET_UPLOAD_INFO:
            return { ...state, uploadInfo: action.payload };
        case ActionType.ADD_UPLOAD_SUCCESSFUL_CHUNK:
            return { ...state, successfulChunks: [...state.successfulChunks, action.payload] };
        default:
            return state;
    }
}
