import assert from "node:assert/strict";
import test from "node:test";
import { sign, verify } from "./crypto.server";

test("verify accepts a current valid signature", () => {
    assert.equal(verify("payload", sign("payload")), true);
});

test("verify safely rejects malformed and mismatched signatures", () => {
    assert.equal(verify("payload", "not-a-signature"), false);
    assert.equal(verify("different", sign("payload")), false);
});

test("verify rejects signatures older than the upload window", () => {
    const originalNow = Date.now;
    Date.now = () => originalNow() - 61 * 60 * 1000;
    const expiredSignature = sign("payload");
    Date.now = originalNow;

    assert.equal(verify("payload", expiredSignature), false);
});
