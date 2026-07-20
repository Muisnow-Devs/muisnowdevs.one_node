import { GradText } from "@/components/text";
import db from "@/db/client.server";
import { desc, eq } from "drizzle-orm";
import {
    Link,
    MetaFunction,
    useFetcher,
    useLoaderData,
    LoaderFunctionArgs,
} from "react-router";
import { useEffect, useState } from "react";
import ArticleBoxComponent from "./articlebox";
import { FaHome } from "react-icons/fa";
import { MdGridView, MdViewAgenda } from "react-icons/md";
import { classFormat } from "@/utils";
import { getStorage, setStorage } from "@/utils.client";

export const meta: MetaFunction = () => {
    return [
        { title: "讀讀些文章吧 - Muisnow Devs" },
        { name: "description", content: "Muisnow 有索有思，皆在此處！" },
    ];
};

const limit = 10;

export async function loader({ request }: LoaderFunctionArgs) {
    const page = Number(new URL(request.url).searchParams.get("page")) || 1;

    const articles = await db
        .query
        .articles
        .findMany({
            where: (v) => eq(v.enabled, true),
            orderBy: (v) => desc(v.id),
            offset: (page - 1) * limit,
            limit,
            with: { articleLabels: { with: { label: true } } },
            columns: {
                id: true,
                title: true,
                description: true,
                createdAt: true,
            }
        });
    
    return articles.map(({ articleLabels, ...article }) => ({
        ...article,
        labels: articleLabels.map(({ label }) => label),
    }));
}

export default function Articles() {
    const articlesLoader = useLoaderData<typeof loader>();
    const [page, setPage] = useState(2);
    const [isLast, setIsLast] = useState(false);
    const [articles, setArticles] = useState(articlesLoader);
    const [gridView, setGridView] = useState(false);
    const fetcher = useFetcher<typeof loader>();

    useEffect(() => {
        const gridView = getStorage("gridView");
        if (gridView === "true")
            setGridView(true);
    }, []);

    useEffect(() => {
        // scroll to load
        function handleScroll() {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - window.screen.availHeight && !isLast && fetcher.state !== "loading") {
                setPage(page + 1);
                fetcher.submit({ page });

                console.log(`[Articles] Load page ${page}, from ${(page - 1) * limit} to ${page * limit}`);
            }
        }
        
        window.addEventListener("scroll", handleScroll);

        return () => window.removeEventListener("scroll", handleScroll);
    }, [page, fetcher, isLast]);

    useEffect(() => {
        if (fetcher.state === "loading") return;
        if (page !== 2 && (fetcher.data?.length === 0 || (fetcher.data?.length ?? 0) < limit))
            setIsLast(true);

        setArticles((articles) => [...articles, ...(fetcher.data ?? [])]);
    }, [fetcher.data, fetcher.state, page]);

    function gridSet(value: boolean) {
        setStorage("gridView", String(value));
        setGridView(value);
    }

    return <div className="w-full min-h-screen">
        <div className="w-full p-4 sm:p-8 rounded-b-3xl shadow-lg sticky top-0 backdrop-blur-lg z-50">
            <div className="w-full flex justify-center">
                <div className="flex gap-5 sm:gap-10 w-full max-w-7xl items-center">
                    <div className="tooltip" data-tip="返回首頁">
                        <Link to={"/"} className="btn btn-square btn-outline h-full border-0"><FaHome className="text-4xl text-gray-500" /></Link>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black"><GradText>文章 Articles</GradText></h1>
                </div>
            </div>
        </div>

        <div className="w-full flex justify-center p-8">
            <div className="max-w-7xl w-full">
                <span className="block mt-2 text-gray-500 text-xl">客官您484很久都沒有讀過文章了？這就來讀讀吧！</span>
                
                <div className="mt-10">
                    <div className="join">
                        <div className="tooltip" data-tip="以直列檢視"><button className={classFormat(["btn join-item", !gridView && "btn-info"])} onClick={() => gridSet(false)}><MdViewAgenda /></button></div>
                        <div className="tooltip" data-tip="以網格檢視"><button className={classFormat(["btn join-item", gridView && "btn-info"])} onClick={() => gridSet(true)}><MdGridView /></button></div>
                    </div>

                    <div className={classFormat([
                        "mt-5 gap-5",
                        gridView && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                        !gridView && "flex flex-col"
                    ])}>
                        {articles.map((article) => <ArticleBoxComponent key={article.id} {...article} />)}
                    </div>
                </div>
            </div>
        </div>
    </div>;
}
