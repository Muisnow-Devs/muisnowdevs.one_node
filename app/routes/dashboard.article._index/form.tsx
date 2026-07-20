import MarkdownEditor from "@/components/markdownEditor";
import { Form } from "react-router";
import { useState } from "react";

export interface ArticleFormValues {
  title: string;
  description: string;
  content: string;
  comment: boolean;
  enabled: boolean;
  labelIds: string[];
}

interface ArticleFormProps {
  labels: { id: string; title: string; enabled: boolean }[];
  values?: ArticleFormValues;
  submitLabel: string;
}

export default function ArticleForm({
  labels,
  values,
  submitLabel,
}: ArticleFormProps) {
  const [content, setContent] = useState(values?.content ?? "");
  return (
    <Form method="post" className="space-y-5 flex flex-col">
      <input
        className="input input-bordered input-xl w-full"
        placeholder="標題"
        required
        maxLength={128}
        name="title"
        defaultValue={values?.title}
      />
      <textarea
        className="textarea textarea-bordered w-full"
        placeholder="簡介"
        required
        maxLength={512}
        name="description"
        defaultValue={values?.description}
      />
      <fieldset>
        <legend className="mb-2">標籤</legend>
        <div className="flex flex-wrap gap-3">
          {labels.map((label) => (
            <label className="label cursor-pointer gap-2" key={label.id}>
              <input
                className="checkbox"
                type="checkbox"
                name="labelIds"
                value={label.id}
                defaultChecked={values?.labelIds.includes(label.id)}
              />
              <span>
                {label.title}
                {!label.enabled && "（停用）"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="label cursor-pointer justify-start gap-2">
        <input
          className="toggle"
          type="checkbox"
          name="comment"
          defaultChecked={values?.comment ?? true}
        />
        開啟留言
      </label>
      <label className="label cursor-pointer justify-start gap-2">
        <input
          className="toggle"
          type="checkbox"
          name="enabled"
          defaultChecked={values?.enabled ?? true}
        />
        啟用文章
      </label>
      <input type="hidden" name="content" value={content} />
      <MarkdownEditor value={content} onChange={setContent} />
      <div>
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </Form>
  );
}
