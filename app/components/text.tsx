import { Link } from "react-router-dom";
import { FaArrowLeft, FaHome } from "react-icons/fa";
import { PropsWithChildren } from "react";
import { IconType } from "react-icons";
import { classFormat } from "@/utils";

interface GrandTextArgs extends PropsWithChildren {
    deg?: string;
    colors?: string[];
}
export const GradText = (configs: GrandTextArgs) => {
    const back = `linear-gradient(${configs.deg ?? "-45"}deg, ${(configs.colors ?? ["#ae12f7", "#0666f5", "#f0083a", "#ec4b00"]).join(", ")})`;
    return <span className="text-transparent bg-clip-text" style={{
        backgroundImage: back
    }}>{configs.children}</span>;
}

interface IconLinkArgs {
    icon: IconType;
    link: string;
    color?: "black" | "blue" | "red" | "green";
    size?: string | number;
}
export const IconLink = (configs: IconLinkArgs) => <span className="last:mr-0 after:content-['•'] last:after:content-none after:px-3 after:inline-block">
    <a href={configs.link} className="inline-flex justify-center items-center p-2" data-hover-color={configs.color}>
        <configs.icon className={classFormat([
            "inline w-9 h-9 transition-colors ease-in-out",
            (!configs.color || configs.color === "black") && "hover:text-black",
            configs.color === "blue" && "hover:text-blue-500",
            configs.color === "red" && "hover:text-red-500",
        ])} size={36} />
    </a>
</span>;

interface MonoTextArgs extends PropsWithChildren {
    className: string;
}
export const MonoText = (configs: MonoTextArgs) => <span className={classFormat([configs.className])}>{configs.children}</span>;

interface LinkWithIconArgs extends PropsWithChildren {
    icon: IconType;
    path: string;
}
export const LinkWithIcon = (configs: LinkWithIconArgs) => <span className="fnLink">
    <Link to={configs.path}>
        <configs.icon className="mr-1" />
        {configs.children}
    </Link>
</span>;

export const BackToHome = () => <LinkWithIcon path={"/"} icon={FaHome}>返回首頁</LinkWithIcon>;
export const BackToArticle = () => <LinkWithIcon path={"/article"} icon={FaArrowLeft}>返回文章列表</LinkWithIcon>;