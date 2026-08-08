import { UploadStatus } from "@/functions/handleFileUpload";
import { UploadedFileMetadata } from "@/functions/handleFileUpload/useChunkedUpload";
import { MetaFunction, Link, useLoaderData } from "react-router";
import { useReducer, useState } from "react";
import SelectFileSection from "./selectFile";
import reducer, { ActionType } from "./reducer";
import UploadingSection from "@/components/upload/uploadingSection";
import { getMaxUploadSizeBytes } from "@/functions/handleFileUpload/validation";
import {
  FaCopy,
  FaCheck,
  FaExternalLinkAlt,
  FaUpload,
  FaArrowLeft,
} from "react-icons/fa";

export function loader() {
  return { maxUploadSizeBytes: getMaxUploadSizeBytes("media") };
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

interface UploadedItem {
  resourceId: string;
  metadata: UploadedFileMetadata;
  url: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="btn btn-sm btn-ghost gap-1"
      title="複製連結"
    >
      {copied ? <FaCheck className="text-success" /> : <FaCopy />}
      {copied ? "已複製" : "複製"}
    </button>
  );
}

function UploadedResult({
  items,
  onUploadMore,
}: {
  items: UploadedItem[];
  onUploadMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="alert alert-success">上傳成功！共 {items.length} 個檔案</p>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.resourceId}
            className="border rounded-xl p-4 flex flex-col gap-2 bg-base-100 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium truncate">
                {item.metadata.file.name}
              </span>
              <span className="text-sm text-base-content/60">
                {item.metadata.type || "unknown type"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2 flex-wrap">
              <code className="text-sm break-all flex-1">{item.url}</code>
              <div className="flex gap-1 shrink-0">
                <CopyButton text={item.url} />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-ghost gap-1"
                  title="在新分頁開啟"
                >
                  <FaExternalLinkAlt /> 開啟
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <Link to="/dashboard/media" className="btn btn-neutral gap-1">
          <FaArrowLeft /> 媒體管理
        </Link>
        <button onClick={onUploadMore} className="btn btn-primary gap-1">
          <FaUpload /> 繼續上傳
        </button>
      </div>
    </div>
  );
}

export default function DashboardMediaNewIndex() {
  const { maxUploadSizeBytes } = useLoaderData<typeof loader>();
  const [uploadedItems, setUploadedItems] = useState<UploadedItem[]>([]);
  const [state, dispatch] = useReducer(reducer, {
    file: [],
    state: UploadStatus.SELECTING,
    uploadInfo: null,
    successfulChunks: [],
  });

  function handleComplete(resourceId: string, metadata: UploadedFileMetadata) {
    const url = import.meta.env.VITE_PUBLIC_URL + resourceId;
    setUploadedItems((prev) => [...prev, { resourceId, metadata, url }]);
  }

  function handleAllComplete() {
    dispatch({ type: ActionType.SET_STATE, payload: UploadStatus.UPLOADED });
  }

  function handleUploadMore() {
    setUploadedItems([]);
    dispatch({ type: ActionType.SET_FILE, payload: [] });
    dispatch({ type: ActionType.SET_STATE, payload: UploadStatus.SELECTING });
  }

  return (
    <div>
      <p>新增媒體</p>

      {state.state === UploadStatus.SELECTING && (
        <SelectFileSection
          setState={(state) =>
            dispatch({ type: ActionType.SET_STATE, payload: state })
          }
          files={state.file}
          setFiles={(files) =>
            dispatch({ type: ActionType.SET_FILE, payload: files })
          }
        />
      )}

      {state.state === UploadStatus.UPLOADING && (
        <UploadingSection
          bucket="media"
          files={state.file}
          maxUploadSizeBytes={maxUploadSizeBytes}
          onComplete={handleComplete}
          onAllComplete={handleAllComplete}
        />
      )}

      {state.state === UploadStatus.UPLOADED && (
        <UploadedResult items={uploadedItems} onUploadMore={handleUploadMore} />
      )}
    </div>
  );
}
