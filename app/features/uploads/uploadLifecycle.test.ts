import assert from "node:assert/strict";
import test from "node:test";
import { scheduleUploadStart } from "./uploadLifecycle";

test("StrictMode-style setup cleanup setup starts only the live upload", async () => {
    let starts = 0;
    const firstCleanup = scheduleUploadStart(async () => {
        starts++;
    });
    firstCleanup();
    const secondCleanup = scheduleUploadStart(async () => {
        starts++;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    secondCleanup();

    assert.equal(starts, 1);
});

test("cleanup aborts an upload that has already started", async () => {
    let signal: AbortSignal | undefined;
    const cleanup = scheduleUploadStart(async (nextSignal) => {
        signal = nextSignal;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    cleanup();

    assert.equal(signal?.aborted, true);
});
