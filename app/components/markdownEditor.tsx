import MakrdownComponent from "@/components/markdown";
import { ClientOnly } from "remix-utils/client-only";
import { lazy, Suspense } from "react";

const MDEditor = lazy(() => import("@uiw/react-md-editor"));

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MarkdownEditor({
  value,
  onChange,
}: MarkdownEditorProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2" data-color-mode="light">
      <ClientOnly>
        {() => (
          <Suspense fallback={<div className="skeleton min-h-80" />}>
            <MDEditor
              id="editor"
              value={value}
              onChange={(next) => onChange(next ?? "")}
              className="font-normal font-sans"
              preview="edit"
              height={480}
            />
          </Suspense>
        )}
      </ClientOnly>
      <div className="border rounded-box p-5 min-h-80 overflow-auto">
        <MakrdownComponent>{value}</MakrdownComponent>
      </div>
    </div>
  );
}
