import ArticleForm from "../dashboard.article._index/form";
import { createArticle, getArticleLabels } from "@/features/articles/article.server";
import { parseArticleInput } from "@/features/articles/article-form";
import {
  ActionFunctionArgs,
  MetaFunction,
  redirect,
  useLoaderData,
} from "react-router";

export const meta: MetaFunction = () => [{ title: "新增文章 - Muisnow Devs" }];
export async function loader() {
  return getArticleLabels();
}
export async function action({ request }: ActionFunctionArgs) {
  await createArticle(parseArticleInput(await request.formData()));
  return redirect("/dashboard/article");
}
export default function NewArticlePage() {
  return (
    <div>
      <p className="mb-5">新增文章</p>
      <ArticleForm
        labels={useLoaderData<typeof loader>()}
        submitLabel="建立文章"
      />
    </div>
  );
}
