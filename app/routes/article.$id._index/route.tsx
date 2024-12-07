import { LoaderFunctionArgs } from "@remix-run/node";
import db from "@/db/client.server";
import { asc, desc, eq, gt, lt } from "drizzle-orm";
import invariant from "tiny-invariant";
import { useLoaderData } from "@remix-run/react";

async function getArticle(id: string) {
    const response = await db
        .query
        .articles
        .findFirst({
            where: (v) => eq(v.id, Number(id)),
            with: {
                collection: {
                    columns: {
                        enabled: false
                    }
                }
            },
            columns: {
                enabled: false
            }
        });
    
    // get previous and next article
    const previous = await db
        .query
        .articles
        .findFirst({
            where: (v) => lt(v.id, Number(id)),
            orderBy: (v) => desc(v.id),
            columns: {
                id: true,
                title: true
            }
        });
    
    const next = await db
        .query
        .articles
        .findFirst({
            where: (v) => gt(v.id, Number(id)),
            orderBy: (v) => asc(v.id),
            columns: {
                id: true,
                title: true
            }
        });
    
    return {
        ...response,
        near: {
            previous,
            next
        }
    };
}

export async function loader({ params }: LoaderFunctionArgs) {
    const { id } = params;

    invariant(id, "id is required");

    const article = await getArticle(id);
    return article;
}

export default function ArticlePage() {
    const data = useLoaderData<typeof loader>();

    console.log(data);

    return <div>{JSON.stringify(data ?? {})}</div>;
}