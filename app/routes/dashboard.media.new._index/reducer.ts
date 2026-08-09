import { UploadStatus } from "@/functions/handleFileUpload";

export enum ActionType {
    SET_FILE,
    SET_STATE,
}

export type Action =
    | { type: ActionType.SET_FILE, payload: File[] }
    | { type: ActionType.SET_STATE, payload: UploadStatus };

export interface UploadInfo {
    file: File[];
    state: UploadStatus;
}

export default function reducer(state: UploadInfo, action: Action) {
    switch (action.type) {
        case ActionType.SET_FILE:
            return { ...state, file: action.payload };
        case ActionType.SET_STATE:
            return { ...state, state: action.payload };
        default:
            return state;
    }
}
