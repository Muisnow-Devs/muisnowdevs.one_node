import { Link } from "@remix-run/react";
import { FaArrowLeft, FaHome } from "react-icons/fa";
import { PropsWithChildren } from "react";
import { IconType } from "react-icons";
import { classFormat } from "@/utils";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";

export interface GrandTextArgs extends PropsWithChildren {
    deg?: string;
    colors?: string[];
}

export const GradText = (configs: GrandTextArgs) => {
    const back = `linear-gradient(${configs.deg ?? "-45"}deg, ${(configs.colors ?? ["#ae12f7", "#0666f5", "#f0083a", "#ec4b00"]).join(", ")})`;
    return <span className="text-transparent bg-clip-text" style={{
        backgroundImage: back
    }}>{configs.children}</span>;
}

export interface IconLinkArgs {
    icon: IconType;
    link: string;
    name: string;
    color?: "black" | "blue" | "red" | "green" | "yellow";
    size?: string | number;
    className?: string;
}

export const IconLink = (configs: IconLinkArgs) => <div className={classFormat([configs.className])}>
    <Link to={configs.link} className="inline-flex justify-center items-center p-2" title={configs.name}>
        <configs.icon className={classFormat([
            "inline w-9 h-9 transition-colors ease-in-out",
            (!configs.color || configs.color === "black") && "hover:text-black",
            configs.color === "blue" && "hover:text-blue-500",
            configs.color === "red" && "hover:text-red-500",
            configs.color === "green" && "hover:text-green-500",
            configs.color === "yellow" && "hover:text-yellow-500",
        ])} size={36} />
    </Link>
</div>;

export interface MonoTextArgs extends PropsWithChildren {
    className: string;
}

export const MonoText = (configs: MonoTextArgs) => <span className={classFormat([configs.className])}>{configs.children}</span>;

export interface LinkButtonArgs extends PropsWithChildren {
    className?: string;
    icon?: IconType;
    to: string;
}

export const LinkButton = (configs: LinkButtonArgs) => <Link
    to={configs.to}
    className={classFormat([
        "py-3 px-4 flex justify-center items-center rounded-xl border text-2xl",
        "hover:scale-105 hover:shadow-lg transition-all ease-in-out",
        "active:scale-95 active:shadow-none",
        configs.className ?? "border-black",
    ])}>
    {configs.icon && <configs.icon className="mr-1 inline" />}
    {!configs.icon && !configs.to.startsWith("/") && <FaArrowUpRightFromSquare className="mr-1 inline" />}
    {configs.children}
</Link>;

export const BackToHome = () => <LinkButton to={"/"} icon={FaHome} className="bg-blue-500 text-white">返回首頁</LinkButton>;
export const BackToArticle = () => <LinkButton to={"/article"} icon={FaArrowLeft}>返回文章列表</LinkButton>;

export interface HilightsArgs extends PropsWithChildren { }
export const Hilights = (configs: HilightsArgs) => <span className="bg-yellow-200 font-bold">{configs.children}</span>;
