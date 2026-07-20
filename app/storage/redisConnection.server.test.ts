import assert from "node:assert/strict";
import test from "node:test";
import { connectRedisClient } from "./redisConnection.server";

test("connectRedisClient handles connection rejection without crashing startup", async () => {
    const connectionError = new Error("redis unavailable");
    const reported: unknown[] = [];
    const client = {
        on: () => client,
        connect: async () => { throw connectionError; },
    };

    await connectRedisClient(client, (error) => reported.push(error));

    assert.deepEqual(reported, [connectionError]);
});

test("connectRedisClient registers the error listener before connecting", async () => {
    const events: string[] = [];
    const client = {
        on: () => {
            events.push("listener");
            return client;
        },
        connect: async () => {
            events.push("connect");
        },
    };

    await connectRedisClient(client, () => undefined);

    assert.deepEqual(events, ["listener", "connect"]);
});
