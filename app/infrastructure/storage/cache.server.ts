import { getRedis } from "./redis.server";

export interface StringCache {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options: { EX: number }): Promise<unknown>;
}

export async function cached(
    key: string,
    ttlSeconds: number,
    load: () => Promise<string>,
    connect: () => Promise<StringCache> = getRedis,
): Promise<string> {
    let cache: StringCache | undefined;
    try {
        cache = await connect();
        const value = await cache.get(key);
        if (value !== null) return value;
    } catch (error) {
        console.warn("[Cache] Read failed; loading from source", error);
    }
    const value = await load();
    try {
        await cache?.set(key, value, { EX: ttlSeconds });
    } catch (error) {
        console.warn("[Cache] Write failed", error);
    }
    return value;
}
