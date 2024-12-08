import Markdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import directive from "remark-directive";
import { classFormat } from "@/utils";
import { FaCheck, FaCopy } from "react-icons/fa";
import { useState } from "react";

interface MarkdownComponentArgs {
    children: string;
}

function Code({ inline, className, children, ...props }: { inline?: boolean, className?: string, children?: React.ReactNode }) {
    const [isClicked, setIsClicked] = useState(false);
    const match = /language-(\w+)/.exec(className || "");

    function copy() {
        navigator.clipboard.writeText(String(children));
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 1000);
    }

    return !inline && match ? <div className="mb-5 last:mb-0">
        <div className="bg-purple-800 text-white py-2 px-4 rounded-t-xl">
            {/* Match first letter uppercase */}
            {match[1][0].toUpperCase() + match[1].slice(1)}
            <button
                className="float-right inline-flex justify-center items-center gap-1"
                onClick={copy}>
                {!isClicked && <FaCopy className="inline max-w-none" />}
                {isClicked && <FaCheck className="inline max-w-none" />}
                複製程式碼
            </button>
        </div>

        <SyntaxHighlighter
            className="!rounded-b-xl !rounded-t-none !mt-0"
            style={atomDark}
            language={match[1]}
            {...props}>{String(children).replace(/\n$/, "")}</SyntaxHighlighter>
    </div> : (
        <code className={classFormat([className, "font-mono text-purple-600"])} {...props}>
            {children}
        </code>
    );
}

export default function MakrdownComponent(configs: MarkdownComponentArgs) {
    return <article className="prose prose-lg max-w-none">
        <Markdown
            components={{
                pre: ({ children }) => <>{children}</>,
                code: Code,
                h1: ({ children }) => <h1 id={String(children).replace(/\s/g, "-").toLowerCase()}>
                    <button
                        onClick={() => navigator.clipboard.writeText(location.href + "#" + String(children).replace(/\s/g, "-").toLowerCase())}>
                        {children}
                    </button>
                </h1>,
            }}
            remarkPlugins={[remarkGfm, directive]}
            rehypePlugins={[rehypeRaw]}>
            {configs.children}
        </Markdown>
    </article>
}