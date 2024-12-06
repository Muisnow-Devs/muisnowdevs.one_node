import type { MetaFunction } from "@remix-run/node";
import Home from "./Hello";

export const meta: MetaFunction = () => {
    return [
        { title: "Muisnow Devs - 夢的啟航，一切的原點" },
        { name: "description", content: "Muisnow 的官方網站！" },
    ];
};

export default function Index() {
    return (
        <div className="h-screen w-full grid place-content-center p-2">
            <Home />
        </div>
    );
}