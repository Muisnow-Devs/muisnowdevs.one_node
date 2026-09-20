import assert from "node:assert/strict";
import test from "node:test";
import { cached, type StringCache } from "./cache.server";

test("cache hits avoid source work, misses save with TTL", async () => {
    let loads = 0;
    let saved: unknown[] = [];
    const cache: StringCache = {
        get: async () => null,
        set: async (...args) => { saved = args; },
    };
    const load = async () => { loads++; return "xml"; };
    assert.equal(await cached("sitemap", 300, load, async () => cache), "xml");
    assert.deepEqual(saved, ["sitemap", "xml", { EX: 300 }]);
    cache.get = async () => "cached";
    assert.equal(await cached("sitemap", 300, load, async () => cache), "cached");
    assert.equal(loads, 1);
});

test("unavailable cache still serves source, source errors are not cached", async () => {
    assert.equal(await cached("key", 300, async () => "source", async () => { throw new Error("offline"); }), "source");
    let writes = 0;
    await assert.rejects(cached("key", 300, async () => { throw new Error("database failed"); }, async () => ({
        get: async () => null, set: async () => { writes++; },
    })), /database failed/);
    assert.equal(writes, 0);
});
