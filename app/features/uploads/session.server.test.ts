import assert from "node:assert/strict";
import test from "node:test";
import {
    abortDownloadUpload,
    abortFileUploadSession,
    completeFileUploadSession,
    createFileUploadSession,
    getPresignedPartUrl,
    registerCompletedDownload,
    UploadStorageClient,
} from "./index.server";
import { SINGLE_PUT_MAX_BYTES } from "./validation";

interface Calls {
    createMultipart: number;
    completeMultipart: number;
    abortMultipart: number;
    deleted: string[];
}

// The AWS SDK output types carry a required $metadata field that a stub has no
// business constructing, so the whole fake is asserted rather than each method.
function createFakeClient(overrides: Partial<UploadStorageClient> = {}) {
    const calls: Calls = {
        createMultipart: 0,
        completeMultipart: 0,
        abortMultipart: 0,
        deleted: [],
    };
    let storedSize = 0;

    const client = {
        putResourceWithSignedUrl: async () => "https://example.test/put",
        createResourceMultipartUpload: async () => {
            calls.createMultipart++;
            return { UploadId: "upload-1" };
        },
        uploadResourcePartWithSignedUrl: async () =>
            "https://example.test/part",
        listResourceMultipartUploadParts: async () => [
            { ETag: "a", PartNumber: 1 },
            { ETag: "b", PartNumber: 2 },
        ],
        completeResourceMultipartUpload: async () => {
            calls.completeMultipart++;
            return {};
        },
        abortResourceMultipartUpload: async () => {
            calls.abortMultipart++;
            return {};
        },
        getResourceSizeDirect: async () => storedSize,
        deleteResource: async (file: string) => {
            calls.deleted.push(file);
            return {};
        },
        ...overrides,
    } as unknown as UploadStorageClient;

    return {
        client,
        calls,
        setStoredSize: (size: number) => {
            storedSize = size;
        },
    };
}

test("a small file gets a single-PUT session with no multipart upload created", async () => {
    const { client, calls } = createFakeClient();

    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
        "image/png",
    );

    assert.equal(session.mode, "single");
    assert.equal(session.uploadId, "");
    assert.equal(session.url, "https://example.test/put");
    assert.equal(calls.createMultipart, 0);
});

test("a large file gets a multipart session and no presigned PUT url", async () => {
    const { client, calls } = createFakeClient();

    const session = await createFileUploadSession(
        client,
        "download",
        SINGLE_PUT_MAX_BYTES + 1,
    );

    assert.equal(session.mode, "multipart");
    assert.equal(session.uploadId, "upload-1");
    assert.equal(session.url, undefined);
    assert.equal(calls.createMultipart, 1);
});

test("a tampered session is rejected on every intent", async () => {
    const { client } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
    );
    const tampered = { ...session, size: 999999 };

    assert.equal(await getPresignedPartUrl(client, "media", 1, tampered), null);
    assert.equal(
        await completeFileUploadSession(client, "media", tampered),
        false,
    );
    assert.equal(
        await abortFileUploadSession(client, "media", tampered),
        false,
    );
});

test("a session signed for one bucket is rejected by the other", async () => {
    const { client } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
    );

    assert.equal(
        await completeFileUploadSession(client, "download", session),
        false,
    );
});

test("a part response re-issues a signature that still validates", async () => {
    const { client } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "download",
        SINGLE_PUT_MAX_BYTES + 1,
    );

    const part = await getPresignedPartUrl(client, "download", 1, session);

    assert.ok(part);
    assert.equal(part.url, "https://example.test/part");
    assert.ok(part.validate.length > 0);

    const rolled = { ...session, validate: part.validate };
    assert.notEqual(
        await getPresignedPartUrl(client, "download", 2, rolled),
        null,
    );
});

test("completing a single upload verifies the stored size and skips multipart completion", async () => {
    const { client, calls, setStoredSize } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
    );
    setStoredSize(1024);

    assert.equal(
        await completeFileUploadSession(client, "media", session),
        true,
    );
    assert.equal(calls.completeMultipart, 0);
    assert.deepEqual(calls.deleted, []);
});

test("a stored size that disagrees with the signed size deletes the object", async () => {
    const { client, calls, setStoredSize } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
    );
    setStoredSize(2048);

    assert.equal(
        await completeFileUploadSession(client, "media", session),
        false,
    );
    assert.deepEqual(calls.deleted, [session.resourceId]);
});

test("a multipart part count mismatch aborts the upload instead of completing it", async () => {
    const { client, calls } = createFakeClient({
        listResourceMultipartUploadParts: async () => [
            { ETag: "a", PartNumber: 1 },
        ],
    });
    const session = await createFileUploadSession(
        client,
        "download",
        SINGLE_PUT_MAX_BYTES * 2 + 1,
    );

    assert.equal(
        await completeFileUploadSession(client, "download", session),
        false,
    );
    assert.equal(calls.completeMultipart, 0);
    assert.equal(calls.abortMultipart, 1);
});

test("aborting a single session deletes the object rather than aborting a multipart upload", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
    );

    assert.equal(await abortFileUploadSession(client, "media", session), true);
    assert.deepEqual(calls.deleted, [session.resourceId]);
    assert.equal(calls.abortMultipart, 0);
});

test("a replayed complete on a single download session is idempotent and does not delete the object", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "download",
        1024,
        "file.pdf",
    );

    // Shaped exactly as mysql2 shapes it: code "ER_DUP_ENTRY" / errno 1062,
    // passed through unwrapped by drizzle-orm/mysql2.
    const duplicateKeyError = Object.assign(
        new Error("Duplicate entry 'x' for key 'downloadable_file.filename'"),
        {
            code: "ER_DUP_ENTRY",
            errno: 1062,
        },
    );
    const insert = async () => {
        throw duplicateKeyError;
    };

    const result = await registerCompletedDownload(client, insert, session);

    assert.deepEqual(result, { completed: true });
    assert.deepEqual(calls.deleted, []);
});

test("a non-duplicate insert failure still triggers the compensating delete and rethrows the original error", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "download",
        1024,
        "file.pdf",
    );

    const dbError = new Error("connection lost");
    const insert = async () => {
        throw dbError;
    };

    await assert.rejects(
        () => registerCompletedDownload(client, insert, session),
        (error: unknown) => error === dbError,
    );
    assert.deepEqual(calls.deleted, [session.resourceId]);
});

test("abort is refused with 409 for a download that already has a completed row, and the object is not deleted", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "download",
        1024,
        "file.pdf",
    );

    await assert.rejects(
        () =>
            abortDownloadUpload(client, "download", session, async () => true),
        (error: unknown) => error instanceof Response && error.status === 409,
    );
    assert.deepEqual(calls.deleted, []);
});

test("abort proceeds normally when no completed row exists for the download", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "download",
        1024,
        "file.pdf",
    );

    assert.equal(
        await abortDownloadUpload(
            client,
            "download",
            session,
            async () => false,
        ),
        true,
    );
    assert.deepEqual(calls.deleted, [session.resourceId]);
});

test("abort never consults the existence check for a media session", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(
        client,
        "media",
        1024,
        "photo.png",
    );
    let existenceChecked = false;

    const aborted = await abortDownloadUpload(
        client,
        "media",
        session,
        async () => {
            existenceChecked = true;
            return true;
        },
    );

    assert.equal(aborted, true);
    assert.equal(existenceChecked, false);
    assert.deepEqual(calls.deleted, [session.resourceId]);
});

test("the single-PUT presign is bound to the signed size via ContentLength", async () => {
    const receivedArgs: [string, string | undefined, number | undefined][] = [];
    const { client } = createFakeClient({
        putResourceWithSignedUrl: async (
            file: string,
            contentType?: string,
            contentLength?: number,
        ) => {
            receivedArgs.push([file, contentType, contentLength]);
            return "https://example.test/put";
        },
    });

    const session = await createFileUploadSession(
        client,
        "media",
        4096,
        "photo.png",
        "image/png",
    );

    assert.equal(session.url, "https://example.test/put");
    assert.deepEqual(receivedArgs, [[session.resourceId, "image/png", 4096]]);
});
