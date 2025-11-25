import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import type { ChangeEvent } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import Markdown from "@/components/markdown";
import { loadPrivacyPolicy } from "@/models/privacy.server";

function resolveLocaleFromHeader(header: string | null) {
    if (!header) return undefined;

    for (const segment of header.split(",")) {
        const [language] = segment.trim().split(";");
        if (language) return language;
    }

    return undefined;
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
    const isEnglish = loaderData?.locale.startsWith("en");

    return [
        {
            title: isEnglish
                ? "Privacy Policy - Muisnow Devs"
                : "隱私權政策 - Muisnow Devs",
        },
        {
            name: "description",
            content: isEnglish
                ? "Muisnow Devs privacy policy."
                : "Muisnow Devs 的隱私權政策",
        },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const queryLocale = url.searchParams.get("lang");
    const queryVersion = url.searchParams.get("version");
    const headerLocale = resolveLocaleFromHeader(
        request.headers.get("accept-language")
    );
    const preferredLocale = queryLocale ?? headerLocale ?? undefined;

    try {
        const policy = await loadPrivacyPolicy({
            locale: preferredLocale,
            version: queryVersion,
        });
        return policy;
    } catch (error) {
        console.error("Failed to load privacy policy:", error);
        throw new Response("Privacy policy not found", { status: 404 });
    }
}

export default function PrivacyIndex() {
    const data = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentLang = searchParams.get("lang") ?? undefined;
    const versionOptions = data.availableVersions;

    function handleVersionChange(event: ChangeEvent<HTMLSelectElement>) {
        const selectedVersion = event.target.value;
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set("version", selectedVersion);
        setSearchParams(newSearchParams);
    }

    function handleLocaleChange(event: ChangeEvent<HTMLSelectElement>) {
        const selectedLocale = event.target.value;
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set("lang", selectedLocale);
        setSearchParams(newSearchParams);
    }

    function formatVersionLabel(version: string, isLatest: boolean) {
        if (version.length === 8) {
            const year = version.slice(0, 4);
            const month = version.slice(4, 6);
            const day = version.slice(6, 8);
            const formatted = `${year}-${month}-${day}`;
            return isLatest ? `${formatted} (Latest)` : formatted;
        }

        return isLatest ? `${version} (Latest)` : version;
    }

    return (
        <div className="min-h-screen w-full grid place-items-center p-12">
            <div className="max-w-7xl w-full">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    {currentLang ? (
                        <input type="hidden" name="lang" value={currentLang} />
                    ) : null}
                    <label
                        htmlFor="policy-version"
                        className="text-sm font-medium text-neutral-600"
                    >
                        Policy version
                    </label>
                    <select
                        defaultValue={data.version}
                        onChange={handleVersionChange}
                        className="select"
                    >
                        {versionOptions.map((option) => (
                            <option key={option.version} value={option.version}>
                                {formatVersionLabel(
                                    option.version,
                                    option.isLatest
                                )}
                            </option>
                        ))}
                    </select>
                    <select
                        defaultValue={currentLang ?? data.locale}
                        className="select"
                        onChange={handleLocaleChange}
                    >
                        <option value="en">English</option>
                        <option value="zh">正體中文 (original)</option>
                    </select>
                </div>

                <Markdown>{data.content}</Markdown>
            </div>
        </div>
    );
}
