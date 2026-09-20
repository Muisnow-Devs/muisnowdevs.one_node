import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "redis";
import { createDownloadToken, consumeDownloadToken, DOWNLOAD_TOKEN_TTL, type TokenStore } from "./download-token.server";

test("tokens are random, expiring and bound to resource and IP", async () => {
    const records = new Map<string, string>();
    const store: TokenStore = {
        set: async (key, value, options) => {
            assert.deepEqual(options, { EX: DOWNLOAD_TOKEN_TTL, NX: true });
            records.set(key, value);
            return "OK";
        },
        eval: async (_script, { keys, arguments: args }) => {
            if (records.get(keys[0]) !== args[0]) return 0;
            records.delete(keys[0]);
            return 1;
        },
    };
    const token = await createDownloadToken("file1", "ip1", store);
    assert.notEqual(token, await createDownloadToken("file1", "ip1", store));
    assert.equal(await consumeDownloadToken(token, "file2", "ip1", store), false);
    assert.equal(await consumeDownloadToken(token, "file1", "ip2", store), false);
    assert.equal(await consumeDownloadToken("malformed", "file1", "ip1", store), false);
    assert.equal(await consumeDownloadToken(token, "file1", "ip1", store), true);
    assert.equal(await consumeDownloadToken(token, "file1", "ip1", store), false);
});

test("Redis errors fail closed for authorization", async () => {
    const store: TokenStore = {
        set: async () => { throw new Error("offline"); },
        eval: async () => { throw new Error("offline"); },
    };
    await assert.rejects(createDownloadToken("file", null, store), /offline/);
    await assert.rejects(consumeDownloadToken("7dc7f951-1867-4a1c-8e3a-9f06f4b84f33", "file", null, store), /offline/);
});

test("real Redis atomically accepts one concurrent redemption and rejects expired tokens", { skip: !process.env.TEST_REDIS_URL }, async () => {
    const client = createClient({ url: process.env.TEST_REDIS_URL });
    client.on("error", () => {});
    await client.connect();
    const keys: string[] = [];
    try {
        const token = await createDownloadToken("file", "ip", client);
        keys.push(`download:token:${token}`);
        assert.ok(await client.ttl(keys[0]) > 0);
        assert.equal(await consumeDownloadToken(token, "other", "ip", client), false);
        const results = await Promise.all(Array.from({ length: 20 }, () => consumeDownloadToken(token, "file", "ip", client)));
        assert.equal(results.filter(Boolean).length, 1);
        const expired = await createDownloadToken("file", null, client);
        keys.push(`download:token:${expired}`);
        await client.pExpire(keys[1], 1);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(await consumeDownloadToken(expired, "file", null, client), false);
    } finally {
        await client.del(keys);
        await client.quit();
    }
});
