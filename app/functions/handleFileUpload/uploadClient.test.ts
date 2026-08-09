import assert from "node:assert/strict";
import test from "node:test";
import {
    getRetryDelayMs,
    isRetriableStatus,
    runWithConcurrency,
    UploadDependencies,
    uploadFile,
} from "./uploadClient";
import { SINGLE_PUT_MAX_BYTES } from "./validation";

test("isRetriableStatus retries server faults and backpressure only", () => {
    assert.equal(isRetriableStatus(500), true);
    assert.equal(isRetriableStatus(503), true);
    assert.equal(isRetriableStatus(408), true);
    assert.equal(isRetriableStatus(429), true);
    assert.equal(isRetriableStatus(400), false);
    assert.equal(isRetriableStatus(403), false);
    assert.equal(isRetriableStatus(404), false);
});

test("getRetryDelayMs grows exponentially and stays within its jitter band", () => {
    assert.equal(getRetryDelayMs(0, () => 0), 250);
    assert.equal(getRetryDelayMs(1, () => 0), 500);
    assert.equal(getRetryDelayMs(2, () => 0), 1000);
    assert.equal(getRetryDelayMs(0, () => 1), 375);
    assert.ok(getRetryDelayMs(2) >= 1000 && getRetryDelayMs(2) <= 1500);
});

test("runWithConcurrency runs every index exactly once", async () => {
    const seen: number[] = [];

    await runWithConcurrency(7, 3, async (index) => {
        seen.push(index);
    });

    assert.deepEqual(seen.sort((first, second) => first - second), [0, 1, 2, 3, 4, 5, 6]);
});

test("runWithConcurrency never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;

    await runWithConcurrency(10, 3, async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
    });

    assert.equal(peak, 3);
});

test("runWithConcurrency rejects with the first worker failure", async () => {
    await assert.rejects(
        runWithConcurrency(5, 2, async (index) => {
            if (index === 1) throw new Error("part failed");
        }),
        /part failed/,
    );
});

test("runWithConcurrency handles a count below the concurrency limit", async () => {
    let calls = 0;

    await runWithConcurrency(2, 8, async () => { calls++; });

    assert.equal(calls, 2);
});

function createFile(bytes: number) {
    return new File([new Uint8Array(bytes)], "large.bin", { type: "application/octet-stream" });
}

interface FakeServerOptions {
    failPart?: (part: number, attempt: number) => number | "network" | null;
    delayPart?: (part: number) => number;
    onPut?: (part: number) => void;
    failComplete?: () => number | "network" | null;
}

function createFakeServer(mode: "single" | "multipart", options: FakeServerOptions = {}) {
    const attempts = new Map<number, number>();
    const putOrder: number[] = [];
    const intents: string[] = [];

    // eslint-disable-next-line no-undef -- RequestInfo/RequestInit are DOM lib types, not runtime globals.
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === "/dashboard/upload") {
            const body = init?.body as FormData;
            const intent = String(body.get("intent"));
            intents.push(intent);

            if (intent === "create")
                return Response.json({
                    mode,
                    resourceId: "resource-1",
                    uploadId: mode === "multipart" ? "upload-1" : "",
                    size: Number(body.get("size")),
                    validate: "signature-0",
                    url: mode === "single" ? "https://example.test/put/0" : undefined,
                });

            if (intent === "part") {
                const part = Number(body.get("part"));
                return Response.json({ url: `https://example.test/put/${part}`, validate: `signature-${part}` });
            }

            if (intent === "complete") {
                const failure = options.failComplete?.() ?? null;
                if (failure === "network")
                    throw new TypeError("network failure");
                if (typeof failure === "number")
                    return new Response("rejected", { status: failure });
            }

            return Response.json({ ok: true });
        }

        // The part number rides in the URL so concurrent PUTs stay distinguishable.
        const part = Number(url.slice(url.lastIndexOf("/") + 1));
        const attempt = (attempts.get(part) ?? 0) + 1;
        attempts.set(part, attempt);

        const wait = options.delayPart?.(part) ?? 0;
        if (wait > 0)
            await new Promise((resolve) => setTimeout(resolve, wait));

        options.onPut?.(part);

        const failure = options.failPart?.(part, attempt) ?? null;
        if (failure === "network")
            throw new TypeError("network failure");
        if (typeof failure === "number")
            return new Response("rejected", { status: failure });

        putOrder.push(part);
        return new Response(null, { status: 200 });
    };

    const dependencies: Partial<UploadDependencies> = {
        fetch: fetchImpl as unknown as typeof fetch,
        delay: async () => { /* retry backoff is not worth real time in a test */ },
    };

    return { dependencies, attempts, putOrder, intents };
}

test("a small file uploads with one PUT and never requests a part url", async () => {
    const server = createFakeServer("single");
    const progress: number[] = [];

    const result = await uploadFile(createFile(1024), "media", (value) => progress.push(value), {
        dependencies: server.dependencies,
    });

    assert.equal(result.resourceId, "resource-1");
    assert.deepEqual(server.intents, ["create", "complete"]);
    assert.equal(server.putOrder.length, 1);
    assert.deepEqual(progress, [1]);
});

test("progress tracks uploaded bytes even when parts finish out of order", async () => {
    const server = createFakeServer("multipart", { delayPart: (part) => part === 1 ? 30 : 0 });
    const progress: number[] = [];

    await uploadFile(createFile(SINGLE_PUT_MAX_BYTES * 3), "download", (value) => progress.push(value), {
        dependencies: server.dependencies,
    });

    assert.equal(server.putOrder.length, 3);
    // Part 1 is held back, so a part-index-based tracker would report progress wrong.
    assert.equal(server.putOrder[server.putOrder.length - 1], 1);
    assert.deepEqual(progress, [...progress].sort((first, second) => first - second));
    assert.equal(progress[progress.length - 1], 1);
});

test("a failing part is retried three times and then gives up", async () => {
    const server = createFakeServer("multipart", { failPart: () => 500 });

    await assert.rejects(uploadFile(createFile(SINGLE_PUT_MAX_BYTES + 1), "download", () => { }, {
        concurrency: 1,
        dependencies: server.dependencies,
    }));

    assert.equal(server.attempts.get(1), 3);
    // The failure happened before "complete" was issued, so compensating is still correct.
    assert.ok(server.intents.includes("abort"));
});

test("a single upload whose complete response is lost is never aborted", async () => {
    // The object can be stored and the response still lost. Aborting on that error would
    // delete what was just written, and a media upload leaves no row behind to notice.
    const server = createFakeServer("single", { failComplete: () => "network" });

    await assert.rejects(uploadFile(createFile(1024), "media", () => { }, {
        dependencies: server.dependencies,
    }));

    assert.ok(server.intents.includes("complete"));
    assert.ok(!server.intents.includes("abort"));
});

test("a multipart upload whose complete fails is never aborted", async () => {
    // The client cannot tell a lost response from a genuine failure, so it must not
    // compensate either way. A complete that fails its part-count check already aborts
    // the upload server-side.
    const server = createFakeServer("multipart", { failComplete: () => 500 });

    await assert.rejects(uploadFile(createFile(SINGLE_PUT_MAX_BYTES + 1), "download", () => { }, {
        concurrency: 1,
        dependencies: server.dependencies,
    }));

    assert.ok(server.intents.includes("complete"));
    assert.ok(!server.intents.includes("abort"));
});

test("a 4xx part failure fails immediately without retrying", async () => {
    const server = createFakeServer("multipart", { failPart: () => 403 });

    await assert.rejects(uploadFile(createFile(SINGLE_PUT_MAX_BYTES + 1), "download", () => { }, {
        concurrency: 1,
        dependencies: server.dependencies,
    }));

    assert.equal(server.attempts.get(1), 1);
});

test("a network failure is retried and the upload recovers", async () => {
    const server = createFakeServer("multipart", {
        failPart: (part, attempt) => part === 1 && attempt === 1 ? "network" : null,
    });

    await uploadFile(createFile(SINGLE_PUT_MAX_BYTES + 1), "download", () => { }, {
        concurrency: 1,
        dependencies: server.dependencies,
    });

    assert.equal(server.attempts.get(1), 2);
});

test("an abort mid-upload stops retrying instead of spending its remaining attempts", async () => {
    const controller = new AbortController();
    const server = createFakeServer("multipart", {
        onPut: (part) => { if (part === 1) controller.abort(); },
        failPart: () => 500,
    });

    await assert.rejects(uploadFile(createFile(SINGLE_PUT_MAX_BYTES + 1), "download", () => { }, {
        signal: controller.signal,
        concurrency: 1,
        dependencies: server.dependencies,
    }));

    assert.equal(server.attempts.get(1), 1);
});
