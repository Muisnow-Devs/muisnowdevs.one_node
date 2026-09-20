import { randomUUID } from "node:crypto";
import { getRedis } from "@/infrastructure/storage/redis.server";

export const DOWNLOAD_TOKEN_TTL = 30 * 60;
export const CONSUME_DOWNLOAD_TOKEN = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
end
return 0
`;

// One Redis operation validates the resource/IP binding and consumes the token.
// A mismatched request cannot burn another request's valid token.
export interface TokenStore {
    set(
        key: string,
        value: string,
        options: { EX: number; NX: true },
    ): Promise<unknown>;
    eval(
        script: string,
        options: { keys: string[]; arguments: string[] },
    ): Promise<unknown>;
}

export async function createDownloadToken(
    downloadId: string,
    ipHash: string | null,
    store?: TokenStore,
) {
    const token = randomUUID();
    const result = await (store ?? (await getRedis())).set(
        `download:token:${token}`,
        JSON.stringify([downloadId, ipHash]),
        { EX: DOWNLOAD_TOKEN_TTL, NX: true },
    );
    if (result !== "OK") throw new Error("Could not issue download token");
    return token;
}

export async function consumeDownloadToken(
    token: string,
    downloadId: string,
    ipHash: string | null,
    store?: TokenStore,
) {
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            token,
        )
    )
        return false;
    return (
        (await (store ?? (await getRedis())).eval(CONSUME_DOWNLOAD_TOKEN, {
            keys: [`download:token:${token}`],
            arguments: [JSON.stringify([downloadId, ipHash])],
        })) === 1
    );
}
