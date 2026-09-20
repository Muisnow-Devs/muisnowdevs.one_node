import { LoaderFunctionArgs, MiddlewareFunction, Outlet, useLoaderData } from "react-router";
import { AccessStatus } from "@/infrastructure/auth/cloudflare-access";
import { accessIdentityContext, accessStatus, requireCloudflareAccess } from "@/infrastructure/auth/cloudflare-access/index.server";

// Middleware rather than this route's loader: on a document POST the leaf action runs
// before parent loaders, and a single-fetch request can subset which loaders run at all,
// so a loader check would leave /dashboard/upload unguarded. Middleware runs top-down over
// the whole matched chain before any loader or action, which every dashboard route is part of.
export const middleware: MiddlewareFunction<Response>[] = [
    async ({ request, context }) => {
        context.set(accessIdentityContext, await requireCloudflareAccess(request));
    },
];

export async function loader({ context }: LoaderFunctionArgs) {
    return {
        status: accessStatus,
        email: context.get(accessIdentityContext)?.email ?? null,
    };
}

const ACCESS_ALERTS: Partial<Record<AccessStatus, { className: string; title: string; detail: string }>> = {
    disabled: {
        className: "alert alert-error",
        title: "控制台未啟用身分驗證",
        detail: "任何能直接連到來源伺服器的人都可以使用這個控制台。請設定 CF_ACCESS_ORGANIZATION 環境變數以啟用 Cloudflare Access 驗證。",
    },
    unpinned: {
        className: "alert alert-warning",
        title: "尚未指定 Access 應用程式",
        detail: "目前接受組織內任何 Access 應用程式簽發的權杖。請設定 CF_ACCESS_AUD 環境變數，將驗證限定於這個控制台。",
    },
};

export default function DashboardLayout() {
    const { status, email } = useLoaderData<typeof loader>();
    const alert = ACCESS_ALERTS[status];

    return <div className="w-full min-h-screen flex justify-center p-5 overflow-auto">
        <div className="w-full max-w-7xl">
            <div className="flex flex-wrap items-baseline justify-between gap-3 my-5">
                <h1 className="text-4xl font-bold">控制台</h1>
                {email && <span className="text-sm text-gray-500">已登入：{email}</span>}
            </div>

            {alert && <div className={`${alert.className} mb-5`} role="alert">
                <div>
                    <h2 className="font-bold">{alert.title}</h2>
                    <p className="text-sm">{alert.detail}</p>
                </div>
            </div>}

            <Outlet />
        </div>
    </div>
}
