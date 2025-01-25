import { Outlet } from "@remix-run/react";

export default function DashboardLayout() {
    return <div className="w-full min-h-screen flex justify-center p-5 overflow-auto">
        <div className="w-full max-w-7xl">
            <h1 className="text-4xl font-bold my-5">控制台</h1>
            <Outlet />
        </div>
    </div>
}