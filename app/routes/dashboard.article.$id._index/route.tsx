import ArticleForm from "../dashboard.article._index/form";
import { disableArticle, getArticleEditorData, updateArticle } from "@/features/articles/article.server";
import { parseArticleInput } from "@/features/articles/article-form";
import invariant from "tiny-invariant";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  redirect,
  useLoaderData,
} from "react-router";

export const meta: MetaFunction = () => [{ title: "編輯文章 - Muisnow Devs" }];
export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  const id = Number(params.id);
  invariant(Number.isInteger(id) && id > 0, "id must be a positive integer");
  return getArticleEditorData(id);
}
export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  const id = Number(params.id);
  invariant(Number.isInteger(id) && id > 0, "id must be a positive integer");
  const formData = await request.formData();
  if (formData.get("intent") === "delete") {
    await disableArticle(id);
    return redirect("/dashboard/article");
  }
  await updateArticle(id, parseArticleInput(formData));
  return redirect("/dashboard/article");
}
export default function EditArticlePage() {
  const { article, labels } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-5">
      <p>編輯文章</p>
      <ArticleForm
        labels={labels}
        submitLabel="儲存文章"
        values={{
          ...article,
          labelIds: article.articleLabels.map((item) => item.labelId),
        }}
      />
    </div>
  );
}
