import { createClient } from "redis";
import { env } from "@/lib/env.server";

const client = createClient(env.redis);
client.on("error", (error) => console.error("[Redis]", error.message));
let connecting: Promise<unknown> | undefined;

export async function getRedis() {
    if (!client.isReady) {
        connecting ??= client.connect().finally(() => {
            connecting = undefined;
        });
        await connecting;
    }
    return client;
}
