import { MetaFunction, Link } from "react-router";

export const meta: MetaFunction = () => {
    return [
        { title: "控制台 - Muisnow Devs" },
        { name: "description", content: "管理你的服務" },
    ];
};

interface ServiceCardArgs {
    name: string;
    description: string;
    to: string;
}

function ServiceCard(config: ServiceCardArgs) {
    return <Link to={config.to} className="card bg-gray-100 no-underline">
        <div className="card-body">
            <h2 className="card-title">{config.name}</h2>
            <p>{config.description}</p>
        </div>
    </Link>;
}

export default function DashboardPage() {
    return <div>
        <p>選擇服務</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <ServiceCard name="文章" description="管理你的文章" to="article" />
            <ServiceCard name="可下載文件" description="管理你的可下載文件" to="download" />
            <ServiceCard name="媒體" description="管理你的媒體" to="media" />
        </div>
    </div>
}