import ArticleForm from "../dashboard.article._index/form";
import { getSelectedLabelIds } from "../dashboard.article._index/helpers";
import db from "@/db/client.server";
import { articleLabels, articles } from "@/db/schema";
import {
  ActionFunctionArgs,
  MetaFunction,
  redirect,
  useLoaderData,
} from "react-router";

export const meta: MetaFunction = () => [{ title: "新增文章 - Muisnow Devs" }];
export async function loader() {
  return db.query.labels.findMany({ orderBy: (table) => table.title });
}
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  console.log();
  if (!title || !description || !content)
    throw new Response("Missing required fields", { status: 400 });
  const labelIds = getSelectedLabelIds(formData);
  await db.transaction(async (tx) => {
    const [article] = await tx
      .insert(articles)
      .values({
        title,
        description,
        content,
        comment: formData.get("comment") === "on",
        enabled: formData.get("enabled") === "on",
      })
      .$returningId();
    if (labelIds.length)
      await tx
        .insert(articleLabels)
        .values(
          labelIds.map((labelId) => ({ articleId: article.id, labelId })),
        );
  });
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
