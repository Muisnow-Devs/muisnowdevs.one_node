import { GradText } from "@/components/text";
import { LoaderFunctionArgs } from "@remix-run/node";
import db from "@/db/client.server";
import { desc } from "drizzle-orm";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";

export async function loader() {
    const limit = 10;

    const articles = await db
        .query
        .articles
        .findMany({
            orderBy: (v) => desc(v.id),
            limit,
            with: {
                collection: {
                    columns: {
                        enabled: false
                    }
                }
            },
            columns: {
                id: true,
                title: true,
                description: true,
                createdAt: true,
            }
        });
    
    return articles;
}

export async function action({ request }: LoaderFunctionArgs) {
    const page = Number(new URL(request.url).searchParams.get("page")) || 1;
    const limit = 10;

    const articles = await db
        .query
        .articles
        .findMany({
            orderBy: (v) => desc(v.id),
            limit,
            offset: (page - 1) * limit,
            with: {
                collection: {
                    columns: {
                        enabled: false
                    }
                }
            },
            columns: {
                id: true,
                title: true,
                description: true,
                createdAt: true,
            }
        });
    
    return articles;
}

export default function Articles() {
    const articlesLoader = useLoaderData<typeof loader>();
    const [page, setPage] = useState(1);
    const [articles, setArticles] = useState(articlesLoader);
    const fetcher = useFetcher<typeof action>();

    useEffect(() => {
        // scroll to load
        function handleScroll() {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
                setPage(page + 1);
                fetcher.submit({ page });
            }
        }
        
        window.addEventListener("scroll", handleScroll);

        return () => window.removeEventListener("scroll", handleScroll);
    }, [page, fetcher]);

    useEffect(() => {
        setArticles((articles) => [...articles, ...(fetcher.data ?? [])]);
    }, [fetcher.data]);

    console.log(articles);

    return <div className="w-full h-screen">
        <div className="w-full p-8 rounded-b-3xl shadow-lg sticky top-0 backdrop-blur-sm">
            <div className="w-full flex justify-center">
                <h1 className="text-4xl font-black w-full max-w-7xl"><GradText>文章 Articles</GradText></h1>
            </div>
        </div>

        <div className="w-full flex justify-center p-8">
            <div className="max-w-7xl w-full">
                <span className="block mt-2 text-gray-500 text-xl">客官您484很久都沒有讀過文章了？這就來讀讀吧！</span>
            </div>
        </div>
    </div>;
}