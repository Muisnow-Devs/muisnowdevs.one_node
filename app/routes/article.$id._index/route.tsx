import { LoaderFunctionArgs } from "@remix-run/node";
import db from "@/db/client.server";
import { asc, desc, eq, gt, lt } from "drizzle-orm";
import invariant from "tiny-invariant";
import { MetaFunction, useLoaderData } from "@remix-run/react";
import MarkdownComponent from "@/components/markdown";
import { BackToArticle } from "@/components/text";
import { FaBookmark, FaClock, FaHashtag } from "react-icons/fa";
import Header from "./header";
import { useRef } from "react";
import NextArticleComponent from "./nextarticle";
import Comments from "./comments";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    return [
        { title: data && data.title ? `${data.title} - Muisnow Devs` : "找不到文章 - Muisnow Devs" },
        { name: "description", content: data && data.description ? data.description : "你迷失了自我。從起點開始你新的旅途吧！" },
    ];
};

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
    
    if (!response) 
        throw new Response(null, { status: 404 });
    
    // get previous and next article
    const previousSQL = db
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
    
    const nextSQL = db
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

    const [previous, next] = await Promise.all([previousSQL, nextSQL]);
    
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

                    <div className="flex justify-between gap-2 mt-20 flex-col md:flex-row p-4 rounded-xl bg-gray-200" ref={nextArticleRef}>
                        <div className="flex-1">{data.near.next && <NextArticleComponent id={data.near.next?.id ?? 0} title={data.near.next?.title ?? ""} rtl={true} />}</div>
                        <div className="divider md:divider-horizontal m-0"></div>
                        <div className="flex-1">
                            {data.near.previous && <NextArticleComponent id={data.near.previous?.id ?? 0} title={data.near.previous?.title ?? ""} />}
                            {!data.near.previous && <div className="h-full gird place-content-center text-center text-gray-500">恭喜！您發現了首篇文章了！</div>}
                        </div>
                    </div>

                    <div className="divider"></div>

                    <div>
                        {data.comment && <Comments id={data.id ?? 0} />}
                        {!data.comment && <div className="text-center text-gray-500">此文章暫時關閉評論</div>}
                    </div>
                </div>
            </div>
        </div>
    </div>;
}

export function ErrorBoundary() {
    return <div className="w-full h-screen grid place-items-center">
        <div>
            <h1 className="text-4xl font-bold mb-5">文章不存在 😭</h1> 
            <p className="max-w-xl">抱歉！你可能來晚了，在這個無垠的宇宙之中，這篇無名的文章如同塵埃般消失在永無止境的時光之中。</p>
            <BackToArticle />
        </div>
    </div>;
}