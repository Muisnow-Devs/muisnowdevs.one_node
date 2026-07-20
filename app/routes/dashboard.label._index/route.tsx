import db from "@/db/client.server";
import { articleLabels, labels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionFunctionArgs, MetaFunction, useFetcher, useLoaderData } from "react-router";
import { v4 } from "uuid";

export const meta: MetaFunction = () => [{ title: "標籤管理 - Muisnow Devs" }];
const newId = () => v4().replace(/-/g, "");
export async function loader() { return db.query.labels.findMany({ orderBy: (table) => table.title }); }
export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "");
    const id = String(formData.get("id") ?? "");
    if (intent === "delete") {
        await db.transaction(async (tx) => {
            await tx.delete(articleLabels).where(eq(articleLabels.labelId, id));
            await tx.delete(labels).where(eq(labels.id, id));
        });
        return null;
    }
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "標籤名稱為必填。" };
    const values = { title, description: String(formData.get("description") ?? "").trim() || null, enabled: formData.get("enabled") === "on" };
    if (intent === "update") await db.update(labels).set(values).where(eq(labels.id, id));
    else await db.insert(labels).values({ id: newId(), ...values });
    return null;
}
function LabelForm({ label }: { label?: { id: string; title: string; description: string | null; enabled: boolean } }) {
    const fetcher = useFetcher<typeof action>();
    return <fetcher.Form method="post" className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto] items-center"><input type="hidden" name="id" value={label?.id} /><input className="input input-bordered" name="title" required maxLength={64} defaultValue={label?.title} placeholder="標籤名稱" /><input className="input input-bordered" name="description" defaultValue={label?.description ?? ""} placeholder="描述" /><label className="label gap-1"><input className="toggle" type="checkbox" name="enabled" defaultChecked={label?.enabled ?? true} />啟用</label><div className="flex gap-2"><button className="btn btn-primary" name="intent" value={label ? "update" : "create"}>{label ? "儲存" : "新增"}</button>{label && <button className="btn btn-error" name="intent" value="delete">刪除</button>}</div></fetcher.Form>;
}
export default function DashboardLabelsPage() { const data = useLoaderData<typeof loader>(); return <div className="space-y-5"><p>管理文章標籤</p><div className="border rounded-box p-4"><LabelForm /></div>{data.map((label) => <div className="border rounded-box p-4" key={label.id}><LabelForm label={label} /></div>)}</div>; }
