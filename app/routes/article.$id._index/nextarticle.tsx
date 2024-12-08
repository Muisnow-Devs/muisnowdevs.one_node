import { classFormat } from "@/utils";
import { Link } from "@remix-run/react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

interface NextArticleComponentArgs {
    id: number;
    title: string;
    rtl?: boolean;
}

export default function NextArticleComponent(configs: NextArticleComponentArgs) {
    return <Link to={"/article/" + configs.id}>
        <div className={classFormat([
            "flex flex-col py-2 group",
            !configs.rtl && "items-end",
            configs.rtl && "items-start"
        ])}>
            <div className="flex items-center">
                {!configs.rtl && <>
                    上一篇文章
                    <FaArrowRight className="inline h-full group-hover:animate-bounce-right" />
                </>}
                {configs.rtl && <>
                    <FaArrowLeft className="inline h-full group-hover:animate-bounce-left" />
                    下一篇文章
                </>}
            </div>
            <h1 className="block text-4xl font-bold group-hover:text-orange-400 transition-colors break-all">{configs.title}</h1>
        </div>
    </Link>;
}