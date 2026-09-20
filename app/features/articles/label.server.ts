import db from "@/infrastructure/db/client.server";
import { articleLabels, labels } from "@/infrastructure/db/schema";
import { eq } from "drizzle-orm";
import { v4 } from "uuid";

export async function getLabels() {
    return db.query.labels.findMany({ orderBy: (table) => table.title });
}

export async function saveLabel(formData: FormData) {
    const intent = String(formData.get("intent") ?? "");
    const id = String(formData.get("id") ?? "");

    if (intent === "delete") {
        await db.transaction(async (tx) => {
            await tx.delete(articleLabels).where(eq(articleLabels.labelId, id));
            await tx.delete(labels).where(eq(labels.id, id));
        });
        return;
    }

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "標籤名稱為必填。" };

    const values = {
        title,
        description: String(formData.get("description") ?? "").trim() || null,
        enabled: formData.get("enabled") === "on",
    };
    if (intent === "update") {
        await db.update(labels).set(values).where(eq(labels.id, id));
    } else {
        await db
            .insert(labels)
            .values({ id: v4().replace(/-/g, ""), ...values });
    }
}
