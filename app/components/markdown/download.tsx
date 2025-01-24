import { checkUUID, humanFileSize } from "@/utils";
import { useEffect, useState } from "react";
import { FaDownload, FaFile } from "react-icons/fa";

export interface DownloadResponse {
    id:        string;
    fileImage: null;
    filename:  string;
    fileSize:  number;
    fileType:  string;
}

interface DownloadBoxArgs {
    title: string;
    id: string;
    size: number;
}

function DownloadBox(data: DownloadBoxArgs) {
    return <div className="card bg-gray-100">
        <div className="card-body">
            <h2 className="card-title mt-0 mb-5">檔案下載</h2>
            <div className="flex flex-col sm:flex-row gap-2 max-w-full">
                <div className="grid sm:place-content-center">
                    <FaFile className="text-6xl text-gray-500 w-16 h-16 p-2" />
                </div>
                <div className="flex-auto flex flex-col items-start max-w-full">
                    <h3 className="text-2xl mb-0 mt-0 break-all">{data.title}</h3>
                    <p className="text-gray-500">檔案大小: {humanFileSize(data.size)}</p>
                </div>
                <div>
                    <a href={"/download/" + data.id} className="btn btn-primary w-full mt-2 sm:mt-0 sm:w-fit sm:rounded-full text-white no-underline"><FaDownload /> 前往下載</a>
                </div>
            </div>
        </div>
    </div>
}

interface DownloadComponentArgs {
    id: string;
}

export default function DownloadComponent({ id }: DownloadComponentArgs) {
    const [data, setData] = useState<DownloadResponse | undefined>(undefined);

    useEffect(() => {
        async function fetchItem() {
            if (!checkUUID(id))
                return;

            const response = await fetch("/backend/downloadItem/" + id);
            const json = await response.json() as DownloadResponse;
            setData(json);
        }

        fetchItem();

        return () => setData(undefined);
    }, [id]);

    return <>{checkUUID(id) && data && <DownloadBox title={data.filename} id={data.id} size={data.fileSize} />}</>;
}