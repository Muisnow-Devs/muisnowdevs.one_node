import { LoaderFunctionArgs } from "@remix-run/node";
import db from "@/db/client.server";
import { asc, desc, eq, gt, lt } from "drizzle-orm";
import invariant from "tiny-invariant";
import { useLoaderData } from "@remix-run/react";
import MarkdownComponent from "./markdown";
import { BackToArticle } from "@/components/text";
import { FaBookmark, FaClock, FaHashtag } from "react-icons/fa";
import Header from "./header";
import { useRef } from "react";

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
                enabled: false,
                collection: false
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
    const articleRef = useRef<HTMLDivElement>(null);
    const nextArticleRef = useRef<HTMLDivElement>(null);

    return <div>
        <Header title={data.title ?? ""} articleRef={articleRef} nextArticleRef={nextArticleRef} />

        <div className="p-5">
            <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-7xl">
                    <div className="mt-2">
                        <BackToArticle />
                        <h1 className="text-6xl font-bold mt-8">{data.title}</h1>

                        <div className="mt-8 font-bold">
                            <div className="flex my-4 mx-2 items-center"><FaClock className="inline w-9 h-4" /> {data.createdAt?.toLocaleString()}</div>
                            <div className="flex my-4 mx-2 items-center"><FaBookmark className="inline w-9 h-4" /> <span className="badge badge-lg bg-gray-300 py-2 pl-1"><FaHashtag className="mr-1" /> {data.collection?.title}</span></div>
                        </div>
                    </div>

                    <div className="divider mb-10">文章</div>

                    <div ref={articleRef}>
                        <MarkdownComponent>{data.content ?? ""}</MarkdownComponent>
                    </div>

                    <div ref={nextArticleRef}>

                    </div>
                </div>
            </div>
        </div>
    </div>;
}