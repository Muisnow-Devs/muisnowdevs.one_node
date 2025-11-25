import invariant from "tiny-invariant";
import {
    ActionFunction,
    LoaderFunctionArgs,
    MetaFunction,
    useFetcher,
    useLoaderData,
} from "react-router";
import { getItem, getItemFilenames } from "@/functions/getDownloadableItem.server";
import { generateUUID, getIPHash } from "@/utils.server";
import redis from "@/storage/redis.server";
import { BackToHome, MonoText } from "@/components/text";
import { FaDownload, FaFile } from "react-icons/fa";
import { humanFileSize } from "@/utils";
import MakrdownComponent, { Code } from "@/components/markdown";
import { FaTriangleExclamation } from "react-icons/fa6";
import { privateS3 } from "@/storage/aws.server";
import { useEffect } from "react";
import { downloadURI } from "@/utils.client";

const ACCESS_EXPIRE = 1800;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    return [
        { title: `下載 ${data?.filename} - Muisnow Devs` },
        {
            name: "description",
            content: "下載我們提供的資源",
        },
    ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
    invariant(params.id, "id is required");

    const item = await getItem(params.id);

    if (!item)
        throw new Response(null, { status: 404 });

    const accessUUID = generateUUID();
    const userIP = getIPHash(request);

    await redis.set(`download:${accessUUID}:${userIP}`, params.id, { EX: ACCESS_EXPIRE });

    return {
        ...item,
        access: accessUUID,
    };
}

export const action: ActionFunction = async ({ request, params }) => {
    const body = await request.formData();
    const access = body.get("access");
    invariant(access, "access is required");

    const { id } = params;
    invariant(id, "id is required");

    const userIP = getIPHash(request);
    const record = await redis.get(`download:${access}:${userIP}`);

    if (!record || record !== id)
        throw new Response(null, { status: 404 });

    const item = await getItemFilenames(id);
    if (!item)
        throw new Response(null, { status: 404 });

    return privateS3.getResourceSignedUrl(item.originalFilename, item.filename);
};

export default function DownloadPage() {
    const data = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    function handleDownload() {
        fetcher.submit({ access: data.access }, { method: "POST" });
    }

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data)
            downloadURI(fetcher.data);
    }, [fetcher.data, fetcher.state]);

    return <div className="w-full min-h-screen flex justify-center">
        <div className="max-w-7xl w-full p-5 h-full">
            <h1 className="text-2xl font-bold my-6">檔案下載</h1>
            <div className="card bg-gray-100 w-full rounded-b-none">
                <div className="card-body gap-0 flex flex-col sm:flex-row max-w-full">
                    <div className="flex-auto">
                        {data.fileImage && <img src={data.fileImage} alt={data.filename} className="h-24 w-24 object-cover rounded-full bg-white" />}
                        {!data.fileImage && <div className="h-24 w-24 grid place-items-center p-5 rounded-full bg-white"><FaFile className="w-full h-full" /></div>}
                        <h2 className="card-title mt-0 mb-5 py-5 text-4xl break-all">{data.filename}</h2>
                        <p className="text-gray-800 my-0">檔案大小: <MonoText>{humanFileSize(data.fileSize)}</MonoText></p>
                        <p className="text-gray-800 my-0">檔案類型: <MonoText>{data.fileType}</MonoText></p>
                    </div>
                    <div className="grid sm:place-content-center mt-8 sm:mt-0">
                        <button
                            className="btn btn-primary w-full h-fit sm:w-fit sm:rounded-full text-white text-lg px-8 py-4"
                            onClick={handleDownload}>
                            立即下載 <FaDownload />
                        </button>
                    </div>
                </div>
            </div>

            <div className="card border rounded-t-none">
                <div className="card-body">
                    <div className="mb-5 bg-yellow-200 p-8 rounded-xl">
                        <h2 className="flex items-center mb-5"><FaTriangleExclamation className="inline mr-2 w-4 h-4" /> 重要提醒</h2>
                        {data.hash && <p>請於下載檔案後確認該檔案的 SHA1 是否為 <Code className="break-all">{data.hash}</Code> 若檔案的 SHA1 值並非為此，請與我們聯絡。您可能下載到錯誤的檔案，錯誤的檔案可能導致您的裝置損毀。</p>}
                        {!data.hash && <p>此檔案沒有 SHA1 驗證碼。請注意您的裝置安全。</p>}
                    </div>

                    {data.description && <MakrdownComponent>{data.description}</MakrdownComponent>}
                    {!data.description && <p>此檔案沒有任何描述。</p>}
                </div>
            </div>
        </div>
    </div>;
}

export function ErrorBoundary() {
    return <div className="w-full h-screen grid place-items-center">
        <div>
            <h1 className="text-4xl font-bold mb-5">檔案不存在 😭</h1> 
            <p className="max-w-xl">糟糕了！文件庫中沒有您希望找到的檔案！</p>
            <BackToHome />
        </div>
    </div>;
}