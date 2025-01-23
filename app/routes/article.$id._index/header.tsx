import { BackToArticle } from "@/components/text";
import { classFormat } from "@/utils";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import NumberFlow from '@number-flow/react';

interface HeaderProps {
    title: string;
    articleRef: React.RefObject<HTMLDivElement>;
    nextArticleRef: React.RefObject<HTMLDivElement>;
}

interface ItemArgs extends PropsWithChildren {
    className?: string;
}

function Item(props: ItemArgs) {
    return <div className={classFormat([
        "after:content-['•'] after:text-gray-500 after:px-2 last:after:content-none",
        props.className
    ])}>{props.children}</div>;
}

export default function Header(configs: HeaderProps) {
    const [show, setShow] = useState(false);
    const [readPrecentages, setReadPrecentages] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function scroll() {
            if (!configs.articleRef.current
                || !configs.nextArticleRef.current
                || !ref.current)
                return;

            const height = window.scrollY;
            const { height: articleHeight, top: articleY } = configs.articleRef.current.getBoundingClientRect();
            const { height: nextArticleHeight } = configs.nextArticleRef.current.getBoundingClientRect();

            setShow(0 >= articleY && 0 < articleY + articleHeight && readPrecentages < 1 && readPrecentages > 0);
            setReadPrecentages((height - articleY) / (2 * (articleY + height + articleHeight - nextArticleHeight - ref.current.clientHeight)));
        }

        window.addEventListener("scroll", scroll);
        return () => window.removeEventListener("scroll", scroll);
    }, [ref, configs.articleRef, configs.nextArticleRef, readPrecentages]);

    return <div ref={ref} className={classFormat([
        "fixed top-0 left-0 w-full h-max z-50 bg-white/50 backdrop-blur-xl transition-all ease-in-out duration-300 rounded-b-3xl shadow-lg",
        show && "visible transform translate-y-0",
        !show && "invisible fixed transform -translate-y-full"
    ])}>
        <div className="flex justify-center p-5 py-2">
            <div className="w-full max-w-7xl">
                <div className="flex my-2">
                    <Item className="flex justify-center"><BackToArticle /></Item>
                    <Item className="hidden sm:block">
                        已閱讀 <NumberFlow className="font-mono" value={readPrecentages > 0 ? Math.round(readPrecentages * 100) : 0} suffix="%" />
                    </Item>
                    <Item>Muisnow Devs</Item>
                </div>
                <h1 className="text-4xl font-bold truncate w-full my-3">{configs.title}</h1>
            </div>
        </div>

        <div className="absolute top-0 bg-slate-500/20 h-full -z-10 rounded-b-3xl" style={{
            width: readPrecentages > 0 ? `${readPrecentages * 100}%` : 0
        }}></div>
    </div>;
}