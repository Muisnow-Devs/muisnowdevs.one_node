import {
    isRouteErrorResponse,
    Links,
    Meta,
    MetaFunction,
    Outlet,
    Scripts,
    ScrollRestoration,
    useRouteError,
} from "react-router";
import type { LinksFunction } from "react-router";
import { BackToHome, GradText } from "./components/text";
import Logo from "@/components/logos/main.svg?react";

import "./tailwind.css";

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "//media.sz.muisnow.dev" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fira+Code:wght@500;900&family=Noto+Sans+TC:wght@400;900&family=Poppins:wght@100;200;400;800&display=swap",
    },
];

export const meta: MetaFunction = ({ error }) => {
    if (!error)
        return [];

    return [
        { title: "逼逼！錯誤錯誤！ - Muisnow Devs" },
        { name: "robots", content: "noindex" },
        { name: "description", content: "An error occurred" },
    ];
};

export function Copyright() {
    return <div className="w-full h-screen relative bg-black p-5">
        <div className="absolute top-0 left-0 -z-50 -translate-y-10 bg-black w-full h-full"></div>
        <div className="w-full h-full grid place-content-center">
            <Logo width={256} className="mb-12" />

            <div className="text-white text-xl font-bold mb-2">© 2025 <GradText>Muisnow</GradText> and <GradText>Muisnow Devs</GradText>.</div>
            <div className="text-white text-xl font-bold">This site is hosting under SanZi Network&apos;s cloud server.</div>
        </div>
    </div>;
}

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body>
                <div className="rounded-b-3xl bg-white">
                    {children}
                </div>
                <ScrollRestoration />
                <Scripts />

                <Copyright />
            </body>
        </html>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();

    return <div className="w-full h-screen p-10 grid place-content-center">
        <h1 className="text-4xl font-bold">{isRouteErrorResponse(error) ? error.status : "Error"}</h1>
        <p className="text-2xl text-gray-500">{isRouteErrorResponse(error) ? error.statusText : "An error occurred"}</p>

        <div>
            <p>
                讓我們回家好嗎？
            </p>

            <BackToHome />
        </div>
    </div>;
}

export default function App() {
    return <Outlet />;
}
