import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { getItem } from "@/functions/getDownloadableItem.server";

export async function loader({ params }: LoaderFunctionArgs) {
    const { id } = params;

    invariant(id, "id is required");

    const item = await getItem(id);
    return new Response(item ? JSON.stringify(item) : null, {
        status: item ? 200 : 404,
        headers: {
            "Content-Type": "application/json"
        }
    });
}