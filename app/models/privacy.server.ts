const PRIVACY_POLICY_MODULES = import.meta.glob("../../privacy/**/*.md", {
    query: "raw",
    import: "default",
    eager: true,
}) satisfies Record<string, string>;
const DEFAULT_LOCALE = "original";

const LOCALE_DIRECTORY_MAP: Record<string, string> = Object.keys(
    PRIVACY_POLICY_MODULES
).reduce((map, filePath) => {
    const segments = filePath.split("/");
    if (segments.length >= 3) {
        const directory = segments[3]?.toLowerCase();
        if (directory) {
            map[directory] = directory;
        }
    }
    return map;
}, {} as Record<string, string>);

export interface PolicyVersion {
    version: string;
    filePath: string;
    isLatest: boolean;
}

export interface PrivacyPolicy {
    locale: string;
    version: string;
    content: string;
    filePath: string;
    availableVersions: PolicyVersion[];
}

interface LoadPrivacyPolicyArgs {
    locale?: string | null;
    version?: string | null;
}

function normalizeLocale(locale?: string | null) {
    if (!locale) return undefined;
    return locale.trim().toLowerCase().replace(/_/, "-");
}

function deriveDirectory(locale: string) {
    const exact = LOCALE_DIRECTORY_MAP[locale];
    if (exact)
        return {
            directory: exact,
            resolvedLocale: locale.startsWith("en") ? "en" : DEFAULT_LOCALE,
        };

    const languageOnly = locale.split("-")[0];
    const fallback = LOCALE_DIRECTORY_MAP[languageOnly];
    if (fallback)
        return {
            directory: fallback,
            resolvedLocale: languageOnly === "en" ? "en" : DEFAULT_LOCALE,
        };

    return null;
}

const VERSION_REGEX = /(\d{8})/;

function normalizeVersion(version?: string | null) {
    if (!version) return undefined;
    const trimmed = version.trim();
    return /^\d{8}$/.test(trimmed) ? trimmed : undefined;
}

function extractVersion(filename: string) {
    const match = filename.match(VERSION_REGEX);
    return match ? match[1] : "00000000";
}

interface PolicyEntry {
    directory: string;
    version: string;
    content: string;
    filePath: string;
}

function buildPolicyEntries(): PolicyEntry[] {
    return Object.entries(PRIVACY_POLICY_MODULES).reduce(
        (acc, [filePath, content]) => {
            const normalizedPath = filePath.replace(/^\.\.\/\.\.\//, "");
            const segments = normalizedPath.split("/");
            if (segments.length < 3) return acc;

            const directory = segments[1]?.toLowerCase();
            const filename = segments[2];
            if (!directory || !filename.endsWith(".md")) return acc;

            acc.push({
                directory,
                version: extractVersion(filename),
                content,
                filePath: normalizedPath,
            });

            return acc;
        },
        [] as PolicyEntry[]
    );
}

const POLICY_ENTRIES = buildPolicyEntries();

const POLICIES_BY_DIRECTORY = POLICY_ENTRIES.reduce((map, entry) => {
    const list = map.get(entry.directory) ?? [];
    list.push(entry);
    list.sort(
        (a, b) =>
            b.version.localeCompare(a.version) ||
            b.filePath.localeCompare(a.filePath)
    );
    map.set(entry.directory, list);
    return map;
}, new Map<string, PolicyEntry[]>());

export async function loadPrivacyPolicy(
    args: LoadPrivacyPolicyArgs = {}
): Promise<PrivacyPolicy> {
    const requested = normalizeLocale(args.locale);
    const requestedVersion = normalizeVersion(args.version);
    const candidates = new Set<string>();

    if (requested) {
        candidates.add(requested);
        const languageOnly = requested.split("-")[0];
        candidates.add(languageOnly);
    }

    candidates.add(DEFAULT_LOCALE);

    let fallbackResult:
        | {
              entry: PolicyEntry;
              entries: PolicyEntry[];
              resolvedLocale: string;
          }
        | null = null;

    for (const candidate of candidates) {
        const mapping = deriveDirectory(candidate);
        if (!mapping) continue;

        const { directory, resolvedLocale } = mapping;
        const entries = POLICIES_BY_DIRECTORY.get(directory);
        if (!entries || !entries.length) continue;

        if (!fallbackResult) {
            fallbackResult = {
                entry: entries[0],
                entries,
                resolvedLocale,
            };
        }

        const matchedEntry = requestedVersion
            ? entries.find((entry) => entry.version === requestedVersion)
            : entries[0];

        if (!matchedEntry) continue;

        return {
            locale: resolvedLocale,
            version: matchedEntry.version,
            content: matchedEntry.content,
            filePath: matchedEntry.filePath,
            availableVersions: entries.map((entry, index) => ({
                version: entry.version,
                filePath: entry.filePath,
                isLatest: index === 0,
            })),
        };
    }

    if (fallbackResult) {
        const { entry, entries, resolvedLocale } = fallbackResult;
        return {
            locale: resolvedLocale,
            version: entry.version,
            content: entry.content,
            filePath: entry.filePath,
            availableVersions: entries.map((item, index) => ({
                version: item.version,
                filePath: item.filePath,
                isLatest: index === 0,
            })),
        };
    }

    throw new Error("Privacy policy content not found");
}
