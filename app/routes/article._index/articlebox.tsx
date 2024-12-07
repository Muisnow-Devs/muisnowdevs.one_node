import { Link } from "@remix-run/react";

interface ArticleBoxComonentArgs {
    id: number;
    title: string;
    description: string;
    createdAt: Date;
}

export default function ArticleBoxComponent(configs: ArticleBoxComonentArgs) {
    return <Link to={String(configs.id)} className="card rounded-xl shadow-lg border border-gray-500 p-5 hover:shadow-2xl transition-all hover:scale-105">
        <div>
            <h1 className="text-4xl font-black text-black break-all leading-[3rem]">{configs.title}</h1>
            <span className="block text-gray-500 mt-2">{configs.createdAt.toLocaleString()}</span>
        </div>
        <div className="w-full border mt-2"></div>
        <p className="p-4 text-gray-700">{configs.description}</p>
    </Link>
}