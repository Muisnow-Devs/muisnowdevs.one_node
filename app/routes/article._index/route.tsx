import { GradText } from "@/components/text";
import {
    getPublicArticles,
} from "@/features/articles/article.server";
import { parseArticlePage } from "@/features/articles/article-pagination";
import { absoluteUrl } from "@/features/seo/site";
import { classFormat } from "@/utils";
import { getStorage, setStorage } from "@/utils.client";
import { useEffect, useRef, useState } from "react";
import { FaHome } from "react-icons/fa";
import { MdGridView, MdViewAgenda } from "react-icons/md";
import {
    Link,
    LoaderFunctionArgs,
    MetaFunction,
    useFetcher,
    useLoaderData,
} from "react-router";
import ArticleBoxComponent from "./articlebox";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const path =
        data?.page && data.page > 1 ? `/article?page=${data.page}` : "/article";
    return [
        { title: "讀讀些文章吧 - Muisnow Devs" },
        { name: "description", content: "Muisnow 有索有思，皆在此處！" },
        { tagName: "link", rel: "canonical", href: absoluteUrl(path) },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    return getPublicArticles(
        parseArticlePage(new URL(request.url).searchParams.get("page")),
    );
}

export default function Articles() {
    const initialData = useLoaderData<typeof loader>();
    const [articles, setArticles] = useState(initialData.articles);
    const [nextPage, setNextPage] = useState(initialData.page + 1);
    const [hasNextPage, setHasNextPage] = useState(initialData.hasNextPage);
    const [gridView, setGridView] = useState(false);
    const fetcher = useFetcher<typeof loader>();
    const paginationGeneration = useRef(0);
    const requestedPage = useRef<{ page: number; generation: number } | null>(
        null,
    );

    useEffect(() => {
        paginationGeneration.current += 1;
        setArticles(initialData.articles);
        setNextPage(initialData.page + 1);
        setHasNextPage(initialData.hasNextPage);
        requestedPage.current = null;
    }, [initialData]);

    useEffect(() => {
        if (getStorage("gridView") === "true") setGridView(true);
    }, []);

    useEffect(() => {
        function handleScroll() {
            if (
                !hasNextPage ||
                fetcher.state !== "idle" ||
                requestedPage.current !== null ||
                window.innerHeight + window.scrollY <
                    document.body.offsetHeight - window.screen.availHeight
            )
                return;
            requestedPage.current = {
                page: nextPage,
                generation: paginationGeneration.current,
            };
            fetcher.load(`/article?page=${nextPage}`);
        }

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [fetcher, hasNextPage, nextPage]);

    useEffect(() => {
        if (fetcher.state !== "idle" || !fetcher.data) return;
        if (
            requestedPage.current?.generation !== paginationGeneration.current
        ) {
            return;
        }
        const loadedPage = fetcher.data;
        setArticles((current) => {
            const ids = new Set(current.map((article) => article.id));
            return [
                ...current,
                ...loadedPage.articles.filter(
                    (article) => !ids.has(article.id),
                ),
            ];
        });
        setNextPage(loadedPage.page + 1);
        setHasNextPage(loadedPage.hasNextPage);
        requestedPage.current = null;
    }, [fetcher.data, fetcher.state]);

    function gridSet(value: boolean) {
        setStorage("gridView", String(value));
        setGridView(value);
    }

    const previousPath =
        initialData.page > 2 ? `?page=${initialData.page - 1}` : "/article";
    const nextPath = `?page=${initialData.page + 1}`;

    return (
        <div className="w-full min-h-screen">
            <div className="w-full p-4 sm:p-8 rounded-b-3xl shadow-lg sticky top-0 backdrop-blur-lg z-50">
                <div className="w-full flex justify-center">
                    <div className="flex gap-5 sm:gap-10 w-full max-w-7xl items-center">
                        <div className="tooltip" data-tip="返回首頁">
                            <Link
                                to="/"
                                className="btn btn-square btn-outline h-full border-0"
                            >
                                <FaHome className="text-4xl text-gray-500" />
                            </Link>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black">
                            <GradText>文章 Articles</GradText>
                        </h1>
                    </div>
                </div>
            </div>
            <div className="w-full flex justify-center p-8">
                <div className="max-w-7xl w-full">
                    <span className="block mt-2 text-gray-500 text-xl">
                        客官您484很久都沒有讀過文章了？這就來讀讀吧！
                    </span>
                    <div className="mt-10">
                        <div className="join">
                            <div className="tooltip" data-tip="以直列檢視">
                                <button
                                    className={classFormat([
                                        "btn join-item",
                                        !gridView && "btn-info",
                                    ])}
                                    onClick={() => gridSet(false)}
                                >
                                    <MdViewAgenda />
                                </button>
                            </div>
                            <div className="tooltip" data-tip="以網格檢視">
                                <button
                                    className={classFormat([
                                        "btn join-item",
                                        gridView && "btn-info",
                                    ])}
                                    onClick={() => gridSet(true)}
                                >
                                    <MdGridView />
                                </button>
                            </div>
                        </div>
                        <div
                            className={classFormat([
                                "mt-5 gap-5",
                                gridView &&
                                    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                                !gridView && "flex flex-col",
                            ])}
                        >
                            {articles.map((article) => (
                                <ArticleBoxComponent
                                    key={article.id}
                                    {...article}
                                />
                            ))}
                        </div>
                        <nav className="join mt-8" aria-label="文章分頁">
                            {initialData.page > 1 && (
                                <Link
                                    className="btn join-item"
                                    to={previousPath}
                                >
                                    上一頁
                                </Link>
                            )}
                            {initialData.hasNextPage && (
                                <Link className="btn join-item" to={nextPath}>
                                    下一頁
                                </Link>
                            )}
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    );
}
