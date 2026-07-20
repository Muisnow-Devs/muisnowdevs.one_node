import db from "@/db/client.server";
import { articleLabels, articles } from "@/db/schema";
import { and, count, desc, eq, inArray, like } from "drizzle-orm";
import {
  Link,
  LoaderFunctionArgs,
  MetaFunction,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { updateDashboardArticleParams } from "./helpers";

const LIMIT = 20;

export const meta: MetaFunction = () => [{ title: "文章管理 - Muisnow Devs" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const labelId = url.searchParams.get("label") ?? "";
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const matchingArticleIds = labelId
    ? db
        .select({ articleId: articleLabels.articleId })
        .from(articleLabels)
        .where(eq(articleLabels.labelId, labelId))
    : undefined;
  const where = and(
    search ? like(articles.title, `%${search}%`) : undefined,
    matchingArticleIds ? inArray(articles.id, matchingArticleIds) : undefined,
  );
  const [items, allLabels, [{ total }]] = await Promise.all([
    db.query.articles.findMany({
      where,
      with: { articleLabels: { with: { label: true } } },
      orderBy: (table) => desc(table.id),
      offset: (page - 1) * LIMIT,
      limit: LIMIT,
    }),
    db.query.labels.findMany({ orderBy: (table) => table.title }),
    db.select({ total: count() }).from(articles).where(where),
  ]);
  return { items, labels: allLabels, search, labelId, page, total };
}

export default function DashboardArticlesPage() {
  const data = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  function update(key: string, value: string) {
    setParams(updateDashboardArticleParams(params, key, value));
  }
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center gap-3">
        <p>管理文章</p>
        <Link className="btn btn-primary" to="new">
          新增文章
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input input-bordered"
          placeholder="搜尋標題"
          value={data.search}
          onChange={(event) => update("search", event.target.value)}
        />
        <select
          className="select select-bordered"
          value={data.labelId}
          onChange={(event) => update("label", event.target.value)}
        >
          <option value="">所有標籤</option>
          {data.labels.map((label) => (
            <option value={label.id} key={label.id}>
              {label.title}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>標題</th>
              <th>標籤</th>
              <th>狀態</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((article) => (
              <tr key={article.id}>
                <td>{article.title}</td>
                <td className="flex flex-wrap gap-1">
                  {article.articleLabels.map(({ label }) => (
                    <span className="badge" key={label.id}>
                      {label.title}
                    </span>
                  ))}
                </td>
                <td>{article.enabled ? "已啟用" : "已停用"}</td>
                <td>
                  <Link className="btn btn-sm" to={String(article.id)}>
                    編輯
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > LIMIT && (
        <div className="join">
          <button
            className="btn join-item"
            disabled={data.page === 1}
            onClick={() => update("page", String(data.page - 1))}
          >
            上一頁
          </button>
          <span className="btn join-item">{data.page}</span>
          <button
            className="btn join-item"
            disabled={data.page * LIMIT >= data.total}
            onClick={() => update("page", String(data.page + 1))}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
