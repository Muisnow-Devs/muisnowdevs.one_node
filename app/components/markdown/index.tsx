import Markdown from "react-markdown";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import directive from "remark-directive";
import { classFormat } from "@/utils";
import { FaArrowUp, FaCheck, FaCopy, FaEnvelope, FaHashtag, FaLink } from "react-icons/fa";
import React, { useState, ImgHTMLAttributes, AnchorHTMLAttributes, DetailedHTMLProps, PropsWithChildren, useEffect } from "react";
import { Link } from "@remix-run/react";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import DownloadComponent from "./download";

export function Code({ inline, className, children, ...props }: { inline?: boolean } & DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>) {
    const [isClicked, setIsClicked] = useState(false);
    const match = /language-(\w+)/.exec(className || "");

    function copy() {
        navigator.clipboard.writeText(String(children));
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 1000);
    }

    const isPlain = !match || ["shell", "plaintext", "markdown", "text"].includes(match[1]);

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
            className={classFormat([
                "!rounded-none !mt-0 !mb-0",
                isPlain && "!rounded-b-xl",
            ])}
            // @ts-expect-error The type of style is the same as the style of SyntaxHighlighter.
            style={atomDark}
            language={match[1]}
            showLineNumbers={!isPlain}
            {...props}>{String(children).replace(/\n$/, "")}</SyntaxHighlighter>
        
        {!isPlain && <div className="bg-gray-200 p-2 px-4 rounded-b-xl italic">除非特別註明，此程式碼的版權均歸屬於 Muisnow 與 Muisnow Devs 。</div>}
    </div> : (
        <code className={classFormat([className, "font-mono text-purple-600"])} {...props}>
            {children}
        </code>
    );
}

export function Img({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) {
    return <span>
        <img
            src={src}
            alt={alt}
            className="w-full h-auto rounded-t-xl mb-0 border border-gray-200"
        />

        <span className="flex items-center gap-2 text-center text-xl bg-gray-200 p-2 rounded-b-xl"><FaArrowUp className="inline" /> {alt}</span>
    </span>
}

export function LinkComponent({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const isExternal = (href ?? "").startsWith("http");
    const isHash = (href ?? "").startsWith("#");
    const isMail = (href ?? "").startsWith("mailto");

    return <Link to={href ?? ""} className="text-blue-500 no-underline hover:underline" target={isExternal ? "_blank" : ""} rel={isExternal ? "noopener noreferrer" : ""}>
        {isHash && <FaHashtag className="inline mr-1" />}
        {isMail && <FaEnvelope className="inline mr-1" />}
        {children}
        {isExternal && <FaArrowUpRightFromSquare className="inline ml-1" />}
    </Link>
}

export function CopiableTitle({ children }: PropsWithChildren) {
    const [isClicked, setIsClicked] = useState(false);

    function copy() {
        navigator.clipboard.writeText(location.href + "#" + String(children).replace(/\s/g, "-").toLowerCase());
        setIsClicked(true);
    }

    useEffect(() => {
        if (isClicked)
            setTimeout(() => setIsClicked(false), 1000);
    }, [isClicked]);

    return <h1 id={String(children).replace(/\s/g, "-").toLowerCase()} className="group flex">
        {!isClicked && <FaLink className="inline-block invisible group-hover:visible group-hover:mr-2 transition-all w-0 group-hover:w-6" />}
        {isClicked && <FaCheck className="inline-block invisible group-hover:visible group-hover:mr-2 transition-all w-0 group-hover:w-6" />}
        <button
            className="group-hover:text-blue-500 transition-all tooltip"
            data-tip="複製連結"
            onClick={copy}>
            # {children}
        </button>
    </h1>
}

function reactMarkdownRemarkDirective() {
    return (tree: Root) => {
        // @ts-expect-error The method visit is well defined.
        visit(
            tree,
            ["textDirective", "leafDirective", "containerDirective"],
            (node) => {
                node.data = {
                    // @ts-expect-error node name is definded in node.
                    hName: node.name,
                    // @ts-expect-error attributes is definded in node.
                    hProperties: node.attributes,
                    ...node.data
                };
                return node;
            }
        );
    };
}

interface MarkdownComponentArgs {
    children: string;
}

export default function MakrdownComponent(configs: MarkdownComponentArgs) {
    return <article className="prose prose-lg max-w-none">
        <Markdown
            components={{
                pre: ({ children }) => <>{children}</>,
                code: Code,
                img: ({ src, alt }) => <Img src={src} alt={alt} />,
                a: ({ href, children }) => <LinkComponent href={href}>{children}</LinkComponent>,
                h1: ({ children }) => <CopiableTitle>{children}</CopiableTitle>,
                
                // @ts-expect-error Custom components
                download: ({ children }) => <DownloadComponent id={children} />
            }}
            remarkPlugins={[remarkGfm, directive, reactMarkdownRemarkDirective]}
            rehypePlugins={[rehypeRaw]}>
            {configs.children}
        </Markdown>
    </article>
}