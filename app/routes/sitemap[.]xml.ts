import type { LoaderFunctionArgs } from "react-router";
import { getSitemap } from "@/features/seo/sitemap.server";
import { sitemapResponse } from "@/features/seo/sitemap-response.server";

export async function loader({ request }: LoaderFunctionArgs) {
    return sitemapResponse(request, await getSitemap());
}
