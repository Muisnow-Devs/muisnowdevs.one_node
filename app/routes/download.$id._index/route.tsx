import invariant from "tiny-invariant";
import { ActionFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { getItem } from "@/functions/getDownloadableItem.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    return [
        { title: `下載 ${data?.filename} - Muisnow Devs` },
        {
            name: "description",
            content: "登入至東華資源庫。",
        },
    ];
};

export function loader({ params }: LoaderFunctionArgs) {
    invariant(params.id, "id is required");

    return getItem(params.id) ?? new Response(null, { status: 404 });
}

export const action: ActionFunction = async ({ request }) => { };

export default function DownloadPage() {
    return <div>
        <h1>Download Page</h1>
    </div>;
}