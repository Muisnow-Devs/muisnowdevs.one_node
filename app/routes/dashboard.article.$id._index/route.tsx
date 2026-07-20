import ArticleForm from "../dashboard.article._index/form";
import { getSelectedLabelIds } from "../dashboard.article._index/helpers";
import db from "@/db/client.server";
import { articleLabels, articles } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  const [article, allLabels] = await Promise.all([
    db.query.articles.findFirst({
      where: (table) => eq(table.id, id),
      with: { articleLabels: true },
    }),
    db.query.labels.findMany({ orderBy: (table) => table.title }),
  ]);
  if (!article) throw new Response(null, { status: 404 });
  return { article, labels: allLabels };
}
export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  const id = Number(params.id);
  invariant(Number.isInteger(id) && id > 0, "id must be a positive integer");
  const formData = await request.formData();
  if (formData.get("intent") === "delete") {
    await db
      .update(articles)
      .set({ enabled: false })
      .where(eq(articles.id, id));
    return redirect("/dashboard/article");
  }
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  if (!title || !description || !content)
      throw new Response("Missing required fields", { status: 400 });
  const labelIds = getSelectedLabelIds(formData);
  await db.transaction(async (tx) => {
    await tx
      .update(articles)
      .set({
        title,
        description,
        content,
        comment: formData.get("comment") === "on",
        enabled: formData.get("enabled") === "on",
      })
      .where(eq(articles.id, id));
    await tx.delete(articleLabels).where(eq(articleLabels.articleId, id));
    if (labelIds.length)
      await tx
        .insert(articleLabels)
        .values(labelIds.map((labelId) => ({ articleId: id, labelId })));
  });
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
