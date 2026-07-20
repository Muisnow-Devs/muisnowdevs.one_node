import assert from "node:assert/strict";
import test from "node:test";

test("markdown editor module can load during server rendering", async () => {
    await assert.doesNotReject(() => import("./markdownEditor"));
});
