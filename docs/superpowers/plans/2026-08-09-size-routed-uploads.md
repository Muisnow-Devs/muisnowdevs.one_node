# Size-Routed Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route uploads by file size — a single presigned PUT at or below 8 MiB, parallel multipart above it — and replace the flat 100 MB rejection with per-bucket caps so the private bucket is bounded only by R2.

**Architecture:** Two explicit client strategies (`uploadSingle`, `uploadMultipart`) over a shared core of pure size-policy functions, a signed session, and one `uploadRequest` transport. The server's `create` intent returns a discriminated union carrying the mode, which is covered by the signature. Part size adapts to the file so the part count never breaches S3's 10,000 ceiling.

**Tech Stack:** TypeScript, React Router 7, `@aws-sdk/client-s3` + `s3-request-presigner`, Drizzle ORM (MySQL), `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-08-size-routed-upload-design.md`

## Global Constraints

- Crossover: files `<= 8 MiB` (`SINGLE_PUT_MAX_BYTES`) use single PUT; larger use multipart.
- Part sizing: minimum 8 MiB, maximum 10,000 parts, R2 object ceiling 4.995 TiB.
- Caps: `media` → `MAX_UPLOAD_SIZE_MB` env, default 100 MiB. `download` → 4.995 TiB.
- Concurrency 4 parts; 3 attempts per part; retry only network errors and 5xx/408/429.
- Signed payload is `JSON.stringify([mode, bucket, uploadId, resourceId, size])`. Never `join(':')`.
- Every `part` response re-issues `validate`; the client always sends the most recent one.
- **Every task must leave `yarn typecheck`, `yarn lint`, and `yarn test` passing.** When a task changes a signature or removes an export, it also updates every call site in the same commit. A type or constant is deleted only in the task that removes its last consumer.
- **Tests must never import `@/storage/aws.server`.** It transitively imports `redis.server.tsx`, which opens a Redis connection at module load (`redis.server.tsx:14-19`). Use `import type` for `S3Actions` so `isolatedModules` elides it at runtime.
- Existing code style: 4-space indent in `app/functions` and `app/storage`, 2-space in `app/components` and `app/routes/**/route.tsx`. Single-statement `if` bodies without braces. Match the file you are editing.

**Known mid-sequence gap:** uploads are runtime-broken between Task 5 and Task 6 — Task 5 makes the route require a `mode` field that the old client does not send. Typecheck, lint, and tests stay green throughout, but do not deploy from a commit inside that window.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `app/functions/handleFileUpload/index.ts` | Shared types, `getResourceId`, extension sanitization. No imports from siblings. | 1, 2, 7 |
| `app/functions/handleFileUpload/validation.ts` | Pure size policy: caps, mode selection, part sizing, chunk ranges. | 1 |
| `app/functions/handleFileUpload/signature.ts` | **New.** The signed payload format, isolated from `@/crypto` so it is testable. | 4 |
| `app/functions/handleFileUpload/index.server.ts` | Session create/part/complete/abort for both modes. | 3, 5 |
| `app/functions/handleFileUpload/uploadClient.ts` | **New.** Client strategies, concurrency pool, retry. Replaces `useChunkedUpload.ts`. | 6 |
| `app/storage/multipartParts.ts` | **New.** Side-effect-free `ListParts` pagination helper. | 3 |
| `app/storage/aws.server.tsx` | S3 command wrappers. Delegates pagination to `multipartParts.ts`. | 3 |
| `app/routes/dashboard.upload._index.ts` | HTTP action dispatching the four intents. | 1, 5 |

---

### Task 1: Size policy and part sizing

**Files:**
- Modify: `package.json`
- Modify: `app/functions/handleFileUpload/index.ts`
- Modify: `app/functions/handleFileUpload/validation.ts` (full rewrite)
- Modify: `app/functions/handleFileUpload/validation.test.ts` (full rewrite)
- Modify: `app/functions/handleFileUpload/useChunkedUpload.ts:1-9,26`
- Modify: `app/routes/dashboard.upload._index.ts:33,47`
- Modify: `app/routes/dashboard.media.new._index/route.tsx:18`
- Modify: `app/routes/dashboard.download.new._index/route.tsx:18`
- Test: `app/functions/handleFileUpload/validation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `UploadMode = "single" | "multipart"`; `getMaxUploadSizeBytes(bucket: UploadBucket, value?: string): number`; `validateUpload(bucket: UploadBucket, size: number, maxUploadSizeBytes?: number): string | null`; `validateUploadSize(size: number, maxSize: number): string | null`; `getUploadMode(size: number): UploadMode`; `getUploadPartSize(size: number): number`; `getExpectedUploadPartCount(size: number): number`; `getUploadChunkRanges(size: number): { start: number; end: number }[]`; constants `SINGLE_PUT_MAX_BYTES`, `MIN_PART_SIZE_BYTES`, `MAX_PART_COUNT`, `R2_MAX_OBJECT_BYTES`.

- [ ] **Step 1: Add the test script**

In `package.json`, add to `"scripts"` after `"lint"`:

```json
    "test": "node --env-file=.env --import tsx --test \"app/**/*.test.ts\"",
```

`--env-file=.env` is required because `app/crypto.ts` throws at module load without `VERIFICATION_KEY`.

- [ ] **Step 2: Run the suite to confirm the script works**

Run: `yarn test`
Expected: PASS, 20 tests. This is the pre-change baseline.

- [ ] **Step 3: Add `UploadMode` to the shared types**

In `app/functions/handleFileUpload/index.ts`, add immediately below the existing `export type UploadBucket` line:

```ts
export type UploadMode = "single" | "multipart";
```

- [ ] **Step 4: Write the failing tests**

Replace the whole of `app/functions/handleFileUpload/validation.test.ts` with:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
    getExpectedUploadPartCount,
    getMaxUploadSizeBytes,
    getUploadChunkRanges,
    getUploadMode,
    getUploadPartSize,
    MAX_PART_COUNT,
    MIN_PART_SIZE_BYTES,
    R2_MAX_OBJECT_BYTES,
    SINGLE_PUT_MAX_BYTES,
    validateUpload,
} from "./validation";

const MEGABYTE = 1024 * 1024;

test("validateUpload rejects empty files", () => {
    assert.equal(validateUpload("media", 0), "File must not be empty");
});

test("validateUpload rejects a non-integer or NaN size", () => {
    assert.equal(validateUpload("media", Number.NaN), "File must not be empty");
    assert.equal(validateUpload("media", 1.5), "File must not be empty");
});

test("validateUpload caps the media bucket at the configured limit", () => {
    assert.equal(getMaxUploadSizeBytes("media", "100"), 100 * MEGABYTE);
    assert.equal(validateUpload("media", 101 * MEGABYTE, 100 * MEGABYTE), "File exceeds the 100 MB upload limit");
    assert.equal(validateUpload("media", 100 * MEGABYTE, 100 * MEGABYTE), null);
});

test("getMaxUploadSizeBytes falls back to 100 MiB for an invalid media environment value", () => {
    assert.equal(getMaxUploadSizeBytes("media", "not-a-number"), 100 * MEGABYTE);
});

test("the download bucket is bounded only by the R2 object ceiling", () => {
    assert.equal(getMaxUploadSizeBytes("download", "100"), R2_MAX_OBJECT_BYTES);
    assert.equal(validateUpload("download", 10 * 1024 * MEGABYTE), null);
    assert.equal(validateUpload("download", 0), "File must not be empty");
});

test("getUploadMode switches to multipart just past the single-PUT ceiling", () => {
    assert.equal(getUploadMode(SINGLE_PUT_MAX_BYTES), "single");
    assert.equal(getUploadMode(SINGLE_PUT_MAX_BYTES + 1), "multipart");
    assert.equal(getUploadMode(1), "single");
});

test("getUploadPartSize holds at the minimum until the part ceiling forces growth", () => {
    assert.equal(getUploadPartSize(9 * MEGABYTE), MIN_PART_SIZE_BYTES);
    assert.equal(getUploadPartSize(MIN_PART_SIZE_BYTES * MAX_PART_COUNT), MIN_PART_SIZE_BYTES);
    assert.ok(getUploadPartSize(MIN_PART_SIZE_BYTES * MAX_PART_COUNT + 1) > MIN_PART_SIZE_BYTES);
});

test("getUploadPartSize keeps the part count within the S3 ceiling at any size", () => {
    for (const size of [MEGABYTE, 80 * 1024 * MEGABYTE, 500 * 1024 * MEGABYTE, R2_MAX_OBJECT_BYTES])
        assert.ok(getExpectedUploadPartCount(size) <= MAX_PART_COUNT, `part count exceeded for ${size}`);
});

test("getUploadPartSize returns whole megabytes so ranges stay aligned", () => {
    assert.equal(getUploadPartSize(R2_MAX_OBJECT_BYTES) % MEGABYTE, 0);
});

test("getUploadChunkRanges covers the file with only the last part smaller", () => {
    assert.deepEqual(getUploadChunkRanges(9 * MEGABYTE), [
        { start: 0, end: 8 * MEGABYTE },
        { start: 8 * MEGABYTE, end: 9 * MEGABYTE },
    ]);

    const ranges = getUploadChunkRanges(20 * MEGABYTE);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[ranges.length - 1].end, 20 * MEGABYTE);
    assert.equal(ranges.length, getExpectedUploadPartCount(20 * MEGABYTE));
});

test("getUploadChunkRanges keeps small uploads in one part", () => {
    assert.deepEqual(getUploadChunkRanges(1024), [{ start: 0, end: 1024 }]);
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn test`
Expected: FAIL — `getUploadMode`, `getUploadPartSize`, `R2_MAX_OBJECT_BYTES`, `SINGLE_PUT_MAX_BYTES`, `MIN_PART_SIZE_BYTES`, `MAX_PART_COUNT` are not exported, and `validateUpload` does not take a bucket.

- [ ] **Step 6: Rewrite `validation.ts`**

Replace the whole of `app/functions/handleFileUpload/validation.ts` with:

```ts
import { UploadBucket, UploadMode } from ".";

const BYTES_PER_MEGABYTE = 1024 * 1024;
const DEFAULT_MAX_MEDIA_UPLOAD_SIZE_MB = 100;

/** Files at or below this size are uploaded with a single presigned PUT. */
export const SINGLE_PUT_MAX_BYTES = 8 * BYTES_PER_MEGABYTE;
/** S3 requires every part except the last to be at least 5 MiB; 8 MiB leaves headroom. */
export const MIN_PART_SIZE_BYTES = 8 * BYTES_PER_MEGABYTE;
/** S3 and R2 both refuse a multipart upload with more than 10,000 parts. */
export const MAX_PART_COUNT = 10_000;
/** R2 caps a single object at 4.995 TiB — the effective ceiling for the private bucket. */
export const R2_MAX_OBJECT_BYTES = Math.floor(4.995 * 1024 ** 4);

export function getMaxUploadSizeBytes(bucket: UploadBucket, value = typeof process === "undefined" ? undefined : process.env.MAX_UPLOAD_SIZE_MB): number {
    // The private bucket holds deliberate release artifacts, so only R2's own limit applies.
    if (bucket === "download")
        return R2_MAX_OBJECT_BYTES;

    const maxUploadSizeMB = Number(value);

    if (!Number.isFinite(maxUploadSizeMB) || maxUploadSizeMB <= 0)
        return DEFAULT_MAX_MEDIA_UPLOAD_SIZE_MB * BYTES_PER_MEGABYTE;

    return maxUploadSizeMB * BYTES_PER_MEGABYTE;
}

export function validateUploadSize(size: number, maxSize: number): string | null {
    // Number(formData.get("size")) yields NaN for junk input, and NaN passes every
    // comparison below, so the integer check has to come first.
    if (!Number.isInteger(size) || size <= 0)
        return "File must not be empty";

    if (size > maxSize)
        return `File exceeds the ${Math.round(maxSize / BYTES_PER_MEGABYTE)} MB upload limit`;

    return null;
}

export function validateUpload(bucket: UploadBucket, size: number, maxUploadSizeBytes?: number): string | null {
    return validateUploadSize(size, maxUploadSizeBytes ?? getMaxUploadSizeBytes(bucket));
}

export function getUploadMode(size: number): UploadMode {
    return size <= SINGLE_PUT_MAX_BYTES ? "single" : "multipart";
}

export function getUploadPartSize(size: number): number {
    const required = Math.ceil(size / MAX_PART_COUNT);

    if (required <= MIN_PART_SIZE_BYTES)
        return MIN_PART_SIZE_BYTES;

    // Round up to a whole megabyte so ranges stay aligned and readable.
    return Math.ceil(required / BYTES_PER_MEGABYTE) * BYTES_PER_MEGABYTE;
}

export function getExpectedUploadPartCount(size: number): number {
    return Math.ceil(size / getUploadPartSize(size));
}

export function getUploadChunkRanges(size: number): { start: number; end: number }[] {
    const partSize = getUploadPartSize(size);
    const ranges: { start: number; end: number }[] = [];

    for (let start = 0; start < size; start += partSize)
        ranges.push({ start, end: Math.min(start + partSize, size) });

    return ranges;
}
```

This drops `UPLOAD_CHUNK_SIZE_BYTES`, `validateUploadParts`, and `MultipartUploadPart`. The only consumers were the two tests just replaced and `useChunkedUpload.ts`, updated next.

- [ ] **Step 7: Update every call site in the same commit**

`getUploadChunkRanges` now lives in `validation.ts`, and both `validateUpload` and `getMaxUploadSizeBytes` take a bucket. Four files reference them.

In `app/functions/handleFileUpload/useChunkedUpload.ts`, replace lines 1-9 (the imports and the local `getUploadChunkRanges`) with:

```ts
import { UploadBucket } from ".";
import { getMaxUploadSizeBytes, getUploadChunkRanges, validateUploadSize } from "./validation";
```

and change the signature on line 26 (now line 19) so the default reads the bucket already in scope:

```ts
export async function uploadFileInChunks(file: File, bucket: UploadBucket, onProgress: (progress: number) => void, signal?: AbortSignal, maxUploadSizeBytes = getMaxUploadSizeBytes(bucket)) {
```

In `app/routes/dashboard.upload._index.ts`, line 33:

```ts
        const error = validateUpload(bucket, size);
```

and line 47:

```ts
    if (!resource.resourceId || !resource.uploadId || !resource.validate || validateUpload(bucket, resource.size))
```

In `app/routes/dashboard.media.new._index/route.tsx`, line 18 (2-space indent):

```ts
  return { maxUploadSizeBytes: getMaxUploadSizeBytes("media") };
```

In `app/routes/dashboard.download.new._index/route.tsx`, line 18 (4-space indent):

```ts
    return { maxUploadSizeBytes: getMaxUploadSizeBytes("download") };
```

- [ ] **Step 8: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck`
Expected: PASS, no errors.

Run: `yarn lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json app/functions/handleFileUpload app/routes/dashboard.upload._index.ts app/routes/dashboard.media.new._index/route.tsx app/routes/dashboard.download.new._index/route.tsx
git commit -m "feat: add per-bucket upload caps and adaptive part sizing"
```

---

### Task 2: Resource id sanitization and session types

**Files:**
- Modify: `app/functions/handleFileUpload/index.ts`
- Test: `app/functions/handleFileUpload/resourceId.test.ts` (create)

**Interfaces:**
- Consumes: `UploadMode`, `UploadBucket` from Task 1.
- Produces: `getFileExtension(filename: string | undefined): string`; `UploadSession`; `CreateUploadResponse`; `PartUploadResponse`.

`ServerUploadResponse` and `UploadPart` stay for now — `index.server.ts` and `reducer.ts` still use them. Task 7 deletes them once their last consumer is gone.

- [ ] **Step 1: Write the failing test**

Create `app/functions/handleFileUpload/resourceId.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getFileExtension, getResourceId } from ".";

const stubId = () => "12345678-1234-1234-1234-123456789012";

test("getFileExtension lowercases a simple extension", () => {
    assert.equal(getFileExtension("Photo.PNG"), "png");
    assert.equal(getFileExtension("archive.tar.gz"), "gz");
});

test("getFileExtension returns empty for a missing or bare filename", () => {
    assert.equal(getFileExtension(undefined), "");
    assert.equal(getFileExtension(""), "");
    assert.equal(getFileExtension("no-extension"), "");
    assert.equal(getFileExtension("trailing."), "");
});

test("getFileExtension rejects anything that could escape or confuse the object key", () => {
    // The extension is concatenated into the S3 key and into the signature payload.
    assert.equal(getFileExtension("evil.png/../../secret"), "");
    assert.equal(getFileExtension("evil.png:0:x"), "");
    assert.equal(getFileExtension("evil.a b"), "");
    assert.equal(getFileExtension(`evil.${"a".repeat(13)}`), "");
});

test("media uploads append only a sanitized extension", () => {
    assert.equal(getResourceId("media", "Photo.PNG", stubId), `${stubId()}.png`);
    assert.equal(getResourceId("media", "evil.png:0:x", stubId), stubId());
    assert.equal(getResourceId("media", undefined, stubId), stubId());
});

test("download uploads never append an extension", () => {
    assert.equal(getResourceId("download", "archive.zip", stubId), stubId());
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — `getFileExtension` is not exported from `.`.

- [ ] **Step 3: Rewrite `index.ts`**

Replace the whole of `app/functions/handleFileUpload/index.ts` with:

```ts
export enum UploadStatus {
    SELECTING = 'SELECTING',
    UPLOADING = 'UPLOADING',
    UPLOADED = 'UPLOADED',
    FAILED = 'FAILED',
}

export type UploadBucket = "media" | "download";
export type UploadMode = "single" | "multipart";

export interface UploadSession {
    mode: UploadMode;
    resourceId: string;
    /** Empty string when mode is "single" — there is no multipart upload to reference. */
    uploadId: string;
    size: number;
    validate: string;
}

export interface CreateUploadResponse extends UploadSession {
    /** The presigned PUT target. Present only when mode is "single". */
    url?: string;
}

export interface PartUploadResponse {
    url: string;
    /** Re-issued signature. The client must send this on all subsequent requests. */
    validate: string;
}

// Superseded by UploadSession / UploadPart's role in multipartParts.ts. Task 7
// removes both once index.server.ts and reducer.ts no longer reference them.
export interface UploadPart {
    ETag: string;
    PartNumber: number;
}

export interface ServerUploadResponse {
    resourceId: string,
    uploadId: string,
    validate: string,
    size: number,
}

// The extension is concatenated into the S3 object key and into the signature
// payload, so anything outside this set is dropped rather than trusted.
const SAFE_EXTENSION = /^[a-z0-9]{1,12}$/;

export function getFileExtension(filename: string | undefined): string {
    if (!filename)
        return "";

    const parts = filename.split('.');
    if (parts.length < 2)
        return "";

    const extension = parts[parts.length - 1].toLowerCase();
    return SAFE_EXTENSION.test(extension) ? extension : "";
}

export function getResourceId(bucket: UploadBucket, filename: string | undefined, generateId: () => string): string {
    const fileID = generateId();
    if (bucket === "download")
        return fileID;

    const extension = getFileExtension(filename);
    return fileID + (extension ? '.' + extension : '');
}
```

- [ ] **Step 4: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/functions/handleFileUpload/index.ts app/functions/handleFileUpload/resourceId.test.ts
git commit -m "feat: sanitize upload extensions and add session types"
```

---

### Task 3: Paginated ListParts

**Files:**
- Create: `app/storage/multipartParts.ts`
- Modify: `app/storage/aws.server.tsx:67-72,146-156`
- Modify: `app/functions/handleFileUpload/index.server.ts:48-53`
- Test: `app/storage/multipartParts.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `MultipartPart { ETag: string; PartNumber: number }`; `PartsPage { parts: MultipartPart[]; nextMarker?: string; isTruncated: boolean }`; `collectMultipartParts(fetchPage: (marker?: string) => Promise<PartsPage>): Promise<MultipartPart[]>`. `S3Actions.listResourceMultipartUploadParts` now returns `Promise<MultipartPart[]>`, sorted ascending. `S3Actions.putResourceWithSignedUrl(file, contentType?)`.

- [ ] **Step 1: Write the failing test**

Create `app/storage/multipartParts.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { collectMultipartParts, PartsPage } from "./multipartParts";

test("collectMultipartParts returns a single page unchanged", async () => {
    const parts = await collectMultipartParts(async () => ({
        parts: [{ ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
        isTruncated: false,
    }));

    assert.deepEqual(parts, [{ ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }]);
});

test("collectMultipartParts follows the marker across pages", async () => {
    const pages: Record<string, PartsPage> = {
        "": { parts: [{ ETag: "a", PartNumber: 1 }], nextMarker: "1", isTruncated: true },
        "1": { parts: [{ ETag: "b", PartNumber: 2 }], nextMarker: "2", isTruncated: true },
        "2": { parts: [{ ETag: "c", PartNumber: 3 }], isTruncated: false },
    };
    const seen: (string | undefined)[] = [];

    const parts = await collectMultipartParts(async (marker) => {
        seen.push(marker);
        return pages[marker ?? ""];
    });

    assert.deepEqual(seen, [undefined, "1", "2"]);
    assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2, 3]);
});

test("collectMultipartParts sorts parts ascending regardless of arrival order", async () => {
    const parts = await collectMultipartParts(async () => ({
        parts: [{ ETag: "c", PartNumber: 3 }, { ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
        isTruncated: false,
    }));

    assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2, 3]);
});

test("collectMultipartParts stops when truncated but no marker is returned", async () => {
    let calls = 0;

    const parts = await collectMultipartParts(async () => {
        calls++;
        return { parts: [{ ETag: "a", PartNumber: 1 }], isTruncated: true };
    });

    assert.equal(calls, 1);
    assert.equal(parts.length, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — cannot find module `./multipartParts`.

- [ ] **Step 3: Create the pagination helper**

Create `app/storage/multipartParts.ts`:

```ts
export interface MultipartPart {
    ETag: string;
    PartNumber: number;
}

export interface PartsPage {
    parts: MultipartPart[];
    nextMarker?: string;
    isTruncated: boolean;
}

// ListParts returns at most 1000 parts per page. A file large enough to need more
// would otherwise fail its completion check after every byte had already uploaded.
export async function collectMultipartParts(
    fetchPage: (marker?: string) => Promise<PartsPage>,
): Promise<MultipartPart[]> {
    const collected: MultipartPart[] = [];
    let marker: string | undefined = undefined;
    let truncated = true;

    while (truncated) {
        const page = await fetchPage(marker);
        collected.push(...page.parts);
        marker = page.nextMarker;
        truncated = page.isTruncated && marker !== undefined;
    }

    return collected.sort((first, second) => first.PartNumber - second.PartNumber);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Wire the helper into `S3Actions` and add a content type to the single PUT**

In `app/storage/aws.server.tsx`, add after line 4:

```ts
import { collectMultipartParts, MultipartPart } from "./multipartParts";
```

Replace `putResourceWithSignedUrl` (lines 67-72) with:

```ts
    async putResourceWithSignedUrl(file: string, contentType: string = "application/octet-stream") {
        return await getSignedUrl(this.client, new PutObjectCommand({
            Bucket: this.bucket,
            Key: file,
            ContentType: contentType,
        }), { expiresIn: EXPIRED_IN });
    }
```

Replace `listResourceMultipartUploadParts` and its comment (lines 146-156) with:

```ts
    // Returns all uploaded parts for a multipart upload, used server-side to
    // complete the upload without requiring the browser to read ETag headers
    // (which would require CORS Access-Control-Expose-Headers: ETag on R2).
    async listResourceMultipartUploadParts(file: string, uploadId: string): Promise<MultipartPart[]> {
        return await collectMultipartParts(async (marker) => {
            const data = await this.client.send(new ListPartsCommand({
                Bucket: this.bucket,
                Key: file,
                UploadId: uploadId,
                PartNumberMarker: marker,
            }));

            return {
                parts: (data.Parts ?? []).flatMap((part) => part.ETag && part.PartNumber !== undefined
                    ? [{ ETag: part.ETag, PartNumber: part.PartNumber }]
                    : []),
                nextMarker: data.NextPartNumberMarker,
                isTruncated: data.IsTruncated ?? false,
            };
        });
    }
```

- [ ] **Step 6: Stop rewriting part numbers by array position**

`collectMultipartParts` now returns parts already sorted and carrying the numbers S3 reported, so the remapping in `index.server.ts` is both redundant and wrong — it renumbered parts by array index, which only ever matched on a single complete page.

In `app/functions/handleFileUpload/index.server.ts`, replace lines 48-53:

```ts
    const parts = listedParts.map((part, index) => ({
        ETag: part.ETag ?? "",
        PartNumber: index + 1,
    }));

    await client.completeResourceMultipartUpload(resource.resourceId, resource.uploadId, parts);
```

with:

```ts
    await client.completeResourceMultipartUpload(resource.resourceId, resource.uploadId, listedParts);
```

- [ ] **Step 7: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/storage/multipartParts.ts app/storage/multipartParts.test.ts app/storage/aws.server.tsx app/functions/handleFileUpload/index.server.ts
git commit -m "fix: paginate ListParts and preserve reported part numbers"
```

---

### Task 4: Signature payload

**Files:**
- Create: `app/functions/handleFileUpload/signature.ts`
- Test: `app/functions/handleFileUpload/signature.test.ts` (create)

**Interfaces:**
- Consumes: `UploadBucket`, `UploadSession` from Task 2.
- Produces: `SignableSession = Pick<UploadSession, "mode" | "uploadId" | "resourceId" | "size">`; `getSignaturePayload(bucket: UploadBucket, session: SignableSession): string`.

Kept separate from `index.server.ts` so it is testable without importing `@/crypto`.

- [ ] **Step 1: Write the failing test**

Create `app/functions/handleFileUpload/signature.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getSignaturePayload } from "./signature";

test("getSignaturePayload includes every field that authorizes the upload", () => {
    const payload = getSignaturePayload("media", {
        mode: "multipart",
        uploadId: "upload-1",
        resourceId: "resource-1",
        size: 1024,
    });

    assert.equal(payload, JSON.stringify(["multipart", "media", "upload-1", "resource-1", 1024]));
});

test("getSignaturePayload distinguishes sessions that a delimiter join would collide", () => {
    // The old [bucket, uploadId, resourceId, size].join(':') format could not tell
    // these two apart, so a signature for one authorized the other. A filename like
    // "a.png:0:x" used to reach resourceId verbatim and made this reachable.
    const first = getSignaturePayload("media", { mode: "single", uploadId: "u", resourceId: "a.png:0:x", size: 2 });
    const second = getSignaturePayload("media", { mode: "single", uploadId: "u:a.png", resourceId: "0:x", size: 2 });

    assert.notEqual(first, second);
});

test("getSignaturePayload separates the two upload modes", () => {
    const session = { uploadId: "", resourceId: "resource-1", size: 1024 };

    assert.notEqual(
        getSignaturePayload("media", { ...session, mode: "single" }),
        getSignaturePayload("media", { ...session, mode: "multipart" }),
    );
});

test("getSignaturePayload separates the two buckets", () => {
    const session = { mode: "single" as const, uploadId: "", resourceId: "resource-1", size: 1024 };

    assert.notEqual(getSignaturePayload("media", session), getSignaturePayload("download", session));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — cannot find module `./signature`.

- [ ] **Step 3: Create the module**

Create `app/functions/handleFileUpload/signature.ts`:

```ts
import { UploadBucket, UploadSession } from ".";

export type SignableSession = Pick<UploadSession, "mode" | "uploadId" | "resourceId" | "size">;

// JSON rather than a delimiter join: resourceId ends in a user-supplied extension,
// so a joined payload could be ambiguous between two different sessions.
export function getSignaturePayload(bucket: UploadBucket, session: SignableSession): string {
    return JSON.stringify([session.mode, bucket, session.uploadId, session.resourceId, session.size]);
}
```

- [ ] **Step 4: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/functions/handleFileUpload/signature.ts app/functions/handleFileUpload/signature.test.ts
git commit -m "feat: make the upload signature payload unambiguous"
```

---

### Task 5: Server sessions and route action for both modes

**Files:**
- Modify: `app/functions/handleFileUpload/index.server.ts` (full rewrite)
- Modify: `app/routes/dashboard.upload._index.ts` (full rewrite)
- Test: `app/functions/handleFileUpload/session.server.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: `UploadStorageClient`; `createFileUploadSession(client, bucket, size, filename?, mimetype?): Promise<CreateUploadResponse>`; `getPresignedPartUrl(client, bucket, part, session): Promise<PartUploadResponse | null>`; `completeFileUploadSession(client, bucket, session): Promise<boolean>`; `abortFileUploadSession(client, bucket, session): Promise<boolean>`.

The route is rewritten here rather than in a later task because it is the only consumer of these functions — splitting them would leave a commit that cannot typecheck.

**The route has no automated test, deliberately.** The repo has no route-level test harness, and standing one up (a `Request`/`FormData` fixture plus a stubbed `db` and S3 module, both of which run side effects at import) is a larger change than this task. Every decision the action makes is covered elsewhere: size policy in Task 1, signature rejection in this task's tests, and the full wire shape in Task 6's fake server. Task 9 exercises it by hand.

- [ ] **Step 1: Write the failing test**

Create `app/functions/handleFileUpload/session.server.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
    abortFileUploadSession,
    completeFileUploadSession,
    createFileUploadSession,
    getPresignedPartUrl,
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
    const calls: Calls = { createMultipart: 0, completeMultipart: 0, abortMultipart: 0, deleted: [] };
    let storedSize = 0;

    const client = {
        putResourceWithSignedUrl: async () => "https://example.test/put",
        createResourceMultipartUpload: async () => {
            calls.createMultipart++;
            return { UploadId: "upload-1" };
        },
        uploadResourcePartWithSignedUrl: async () => "https://example.test/part",
        listResourceMultipartUploadParts: async () => [{ ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
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

    return { client, calls, setStoredSize: (size: number) => { storedSize = size; } };
}

test("a small file gets a single-PUT session with no multipart upload created", async () => {
    const { client, calls } = createFakeClient();

    const session = await createFileUploadSession(client, "media", 1024, "photo.png", "image/png");

    assert.equal(session.mode, "single");
    assert.equal(session.uploadId, "");
    assert.equal(session.url, "https://example.test/put");
    assert.equal(calls.createMultipart, 0);
});

test("a large file gets a multipart session and no presigned PUT url", async () => {
    const { client, calls } = createFakeClient();

    const session = await createFileUploadSession(client, "download", SINGLE_PUT_MAX_BYTES + 1);

    assert.equal(session.mode, "multipart");
    assert.equal(session.uploadId, "upload-1");
    assert.equal(session.url, undefined);
    assert.equal(calls.createMultipart, 1);
});

test("a tampered session is rejected on every intent", async () => {
    const { client } = createFakeClient();
    const session = await createFileUploadSession(client, "media", 1024, "photo.png");
    const tampered = { ...session, size: 999999 };

    assert.equal(await getPresignedPartUrl(client, "media", 1, tampered), null);
    assert.equal(await completeFileUploadSession(client, "media", tampered), false);
    assert.equal(await abortFileUploadSession(client, "media", tampered), false);
});

test("a session signed for one bucket is rejected by the other", async () => {
    const { client } = createFakeClient();
    const session = await createFileUploadSession(client, "media", 1024, "photo.png");

    assert.equal(await completeFileUploadSession(client, "download", session), false);
});

test("a part response re-issues a signature that still validates", async () => {
    const { client } = createFakeClient();
    const session = await createFileUploadSession(client, "download", SINGLE_PUT_MAX_BYTES + 1);

    const part = await getPresignedPartUrl(client, "download", 1, session);

    assert.ok(part);
    assert.equal(part.url, "https://example.test/part");
    assert.ok(part.validate.length > 0);

    const rolled = { ...session, validate: part.validate };
    assert.notEqual(await getPresignedPartUrl(client, "download", 2, rolled), null);
});

test("completing a single upload verifies the stored size and skips multipart completion", async () => {
    const { client, calls, setStoredSize } = createFakeClient();
    const session = await createFileUploadSession(client, "media", 1024, "photo.png");
    setStoredSize(1024);

    assert.equal(await completeFileUploadSession(client, "media", session), true);
    assert.equal(calls.completeMultipart, 0);
    assert.deepEqual(calls.deleted, []);
});

test("a stored size that disagrees with the signed size deletes the object", async () => {
    const { client, calls, setStoredSize } = createFakeClient();
    const session = await createFileUploadSession(client, "media", 1024, "photo.png");
    setStoredSize(2048);

    assert.equal(await completeFileUploadSession(client, "media", session), false);
    assert.deepEqual(calls.deleted, [session.resourceId]);
});

test("a multipart part count mismatch aborts the upload instead of completing it", async () => {
    const { client, calls } = createFakeClient({
        listResourceMultipartUploadParts: async () => [{ ETag: "a", PartNumber: 1 }],
    });
    const session = await createFileUploadSession(client, "download", SINGLE_PUT_MAX_BYTES * 2 + 1);

    assert.equal(await completeFileUploadSession(client, "download", session), false);
    assert.equal(calls.completeMultipart, 0);
    assert.equal(calls.abortMultipart, 1);
});

test("aborting a single session deletes the object rather than aborting a multipart upload", async () => {
    const { client, calls } = createFakeClient();
    const session = await createFileUploadSession(client, "media", 1024, "photo.png");

    assert.equal(await abortFileUploadSession(client, "media", session), true);
    assert.deepEqual(calls.deleted, [session.resourceId]);
    assert.equal(calls.abortMultipart, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — `getPresignedPartUrl` and `UploadStorageClient` are not exported.

- [ ] **Step 3: Rewrite `index.server.ts`**

Replace the whole of `app/functions/handleFileUpload/index.server.ts` with:

```ts
import { sign, verify } from "@/crypto";
// Type-only: a value import would pull in redis.server.tsx, which opens a Redis
// connection at module load and would hang unit tests.
import type { S3Actions } from "@/storage/aws.server";
import { v4 } from "uuid";
import { CreateUploadResponse, getResourceId, PartUploadResponse, UploadBucket, UploadSession } from ".";
import { getSignaturePayload } from "./signature";
import { getExpectedUploadPartCount, getUploadMode, validateUpload } from "./validation";

export type UploadStorageClient = Pick<S3Actions,
    | "putResourceWithSignedUrl"
    | "createResourceMultipartUpload"
    | "uploadResourcePartWithSignedUrl"
    | "listResourceMultipartUploadParts"
    | "completeResourceMultipartUpload"
    | "abortResourceMultipartUpload"
    | "getResourceSizeDirect"
    | "deleteResource">;

function hasValidSignature(bucket: UploadBucket, session: UploadSession) {
    return verify(getSignaturePayload(bucket, session), session.validate);
}

export async function createFileUploadSession(client: UploadStorageClient, bucket: UploadBucket, size: number, filename?: string, mimetype?: string): Promise<CreateUploadResponse> {
    const resourceId = getResourceId(bucket, filename, v4);
    const mode = getUploadMode(size);
    const contentType = mimetype || "application/octet-stream";

    if (mode === "single") {
        const url = await client.putResourceWithSignedUrl(resourceId, contentType);
        const session = { mode, resourceId, uploadId: "", size };
        return { ...session, validate: sign(getSignaturePayload(bucket, session)), url };
    }

    const created = await client.createResourceMultipartUpload(resourceId, contentType);
    const session = { mode, resourceId, uploadId: created.UploadId || "", size };
    return { ...session, validate: sign(getSignaturePayload(bucket, session)) };
}

export async function getPresignedPartUrl(client: UploadStorageClient, bucket: UploadBucket, part: number, session: UploadSession): Promise<PartUploadResponse | null> {
    if (!hasValidSignature(bucket, session))
        return null;

    const url = await client.uploadResourcePartWithSignedUrl(session.resourceId, part, session.uploadId);

    // Signatures expire 60 minutes after issue, so a multi-gigabyte upload would
    // outlive its own session. Re-issuing here keeps the session alive as long as
    // parts keep flowing, without widening the replay window of any one signature.
    return { url, validate: sign(getSignaturePayload(bucket, session)) };
}

export async function completeFileUploadSession(client: UploadStorageClient, bucket: UploadBucket, session: UploadSession): Promise<boolean> {
    if (!hasValidSignature(bucket, session))
        return false;

    if (session.mode === "multipart") {
        // Retrieve parts (with ETags) from R2 server-side — this avoids the need for
        // the browser to read ETag from the presigned PUT response, which requires
        // CORS Access-Control-Expose-Headers: ETag to be configured on the R2 bucket.
        const listedParts = await client.listResourceMultipartUploadParts(session.resourceId, session.uploadId);

        if (listedParts.length !== getExpectedUploadPartCount(session.size)) {
            // Leaving the upload open would accrue storage cost for parts nobody can finish.
            await client.abortResourceMultipartUpload(session.resourceId, session.uploadId);
            return false;
        }

        await client.completeResourceMultipartUpload(session.resourceId, session.uploadId, listedParts);
    }

    try {
        const actualSize = await client.getResourceSizeDirect(session.resourceId);
        if (actualSize !== session.size || validateUpload(bucket, actualSize)) {
            await client.deleteResource(session.resourceId);
            return false;
        }
    } catch (error) {
        try {
            await client.deleteResource(session.resourceId);
        } catch {
            // Preserve the validation failure; storage logs retain any failed compensation attempt.
        }
        throw error;
    }

    return true;
}

export async function abortFileUploadSession(client: UploadStorageClient, bucket: UploadBucket, session: UploadSession): Promise<boolean> {
    if (!hasValidSignature(bucket, session))
        return false;

    if (session.mode === "single") {
        try {
            await client.deleteResource(session.resourceId);
        } catch {
            // A single PUT that never started leaves nothing to delete.
        }
        return true;
    }

    await client.abortResourceMultipartUpload(session.resourceId, session.uploadId);
    return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Rewrite the route action**

`yarn typecheck` fails at this point — the route still calls the removed `getPresignedPUTUrl`. Replace the whole of `app/routes/dashboard.upload._index.ts` with:

```ts
import {
    abortFileUploadSession,
    completeFileUploadSession,
    createFileUploadSession,
    getPresignedPartUrl,
} from "@/functions/handleFileUpload/index.server";
import { UploadBucket, UploadMode, UploadSession } from "@/functions/handleFileUpload";
import { getExpectedUploadPartCount, validateUpload } from "@/functions/handleFileUpload/validation";
import { privateS3, publicS3 } from "@/storage/aws.server";
import db from "@/db/client.server";
import { downloadableFiles } from "@/db/schema";
import { ActionFunctionArgs } from "react-router";

function getBucket(value: FormDataEntryValue | null): UploadBucket | null {
    return value === "media" || value === "download" ? value : null;
}

function getMode(value: FormDataEntryValue | null): UploadMode | null {
    return value === "single" || value === "multipart" ? value : null;
}

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST")
        throw new Response(null, { status: 405, headers: { Allow: "POST" } });

    const formData = await request.formData();
    const bucket = getBucket(formData.get("bucket"));
    const intent = formData.get("intent");

    if (!bucket || typeof intent !== "string")
        throw new Response("Invalid upload request", { status: 400 });

    const client = bucket === "media" ? publicS3 : privateS3;

    if (intent === "create") {
        const size = Number(formData.get("size"));
        const error = validateUpload(bucket, size);
        if (error)
            throw new Response(error, { status: 400 });

        return createFileUploadSession(client, bucket, size, String(formData.get("filename") || ""), String(formData.get("mimetype") || ""));
    }

    const mode = getMode(formData.get("mode"));
    const session: UploadSession | null = mode && {
        mode,
        resourceId: String(formData.get("resourceId") || ""),
        uploadId: String(formData.get("uploadId") || ""),
        validate: String(formData.get("validate") || ""),
        size: Number(formData.get("size")),
    };

    // A multipart session is meaningless without an uploadId; a single one must not carry one.
    if (!session || !session.resourceId || !session.validate || validateUpload(bucket, session.size) ||
        (session.mode === "multipart") !== Boolean(session.uploadId))
        throw new Response("Invalid upload session", { status: 400 });

    if (intent === "abort") {
        const aborted = await abortFileUploadSession(client, bucket, session);
        if (!aborted)
            throw new Response("Invalid upload session", { status: 403 });
        return { aborted: true };
    }

    if (intent === "part") {
        if (session.mode !== "multipart")
            throw new Response("Invalid upload part", { status: 400 });

        const part = Number(formData.get("part"));
        const expectedPartCount = getExpectedUploadPartCount(session.size);
        if (!Number.isInteger(part) || part < 1 || part > expectedPartCount)
            throw new Response("Invalid upload part", { status: 400 });

        const presigned = await getPresignedPartUrl(client, bucket, part, session);
        if (!presigned)
            throw new Response("Invalid upload session", { status: 403 });
        return presigned;
    }

    if (intent === "complete") {
        const completed = await completeFileUploadSession(client, bucket, session);
        if (!completed)
            throw new Response("Invalid upload session", { status: 403 });

        if (bucket === "download") {
            try {
                await db.insert(downloadableFiles).values({
                    filename: session.resourceId,
                    originalFilename: session.resourceId,
                    fileSize: session.size,
                    enabled: false,
                    lifecycle: "draft",
                });
            } catch (error) {
                try {
                    await privateS3.deleteResource(session.resourceId);
                } catch {
                    // Preserve the database failure; object cleanup can be retried from storage logs.
                }
                throw error;
            }
        }
        return { completed: true };
    }

    throw new Response("Unknown upload intent", { status: 400 });
}
```

- [ ] **Step 6: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/functions/handleFileUpload/index.server.ts app/functions/handleFileUpload/session.server.test.ts app/routes/dashboard.upload._index.ts
git commit -m "feat: support single and multipart upload sessions"
```

---

### Task 6: Client upload strategies

**Files:**
- Create: `app/functions/handleFileUpload/uploadClient.ts`
- Delete: `app/functions/handleFileUpload/useChunkedUpload.ts`
- Modify: `app/components/upload/uploadingSection.tsx:1-5,38-47`
- Test: `app/functions/handleFileUpload/uploadClient.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: `UploadedFileMetadata { file: File; size: number; type: string }`; `UploadDependencies { fetch: typeof fetch; delay: (ms: number) => Promise<void> }`; `UploadFileOptions`; `isRetriableStatus(status: number): boolean`; `getRetryDelayMs(attempt: number, random?: () => number): number`; `runWithConcurrency(count: number, limit: number, worker: (index: number) => Promise<void>): Promise<void>`; `uploadFile(file, bucket, onProgress, options?): Promise<{ resourceId: string; metadata: UploadedFileMetadata }>`.

- [ ] **Step 1: Write the failing test**

Create `app/functions/handleFileUpload/uploadClient.test.ts`:

```ts
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
}

function createFakeServer(mode: "single" | "multipart", options: FakeServerOptions = {}) {
    const attempts = new Map<number, number>();
    const putOrder: number[] = [];
    const intents: string[] = [];

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
    assert.ok(server.intents.includes("abort"));
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — cannot find module `./uploadClient`.

- [ ] **Step 3: Create `uploadClient.ts`**

Create `app/functions/handleFileUpload/uploadClient.ts`:

```ts
import { CreateUploadResponse, PartUploadResponse, UploadBucket, UploadSession } from ".";
import { getMaxUploadSizeBytes, getUploadChunkRanges, validateUploadSize } from "./validation";

const MAX_CONCURRENT_PARTS = 4;
const MAX_PART_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

export interface UploadedFileMetadata {
    file: File;
    size: number;
    type: string;
}

export interface UploadDependencies {
    fetch: typeof fetch;
    delay: (ms: number) => Promise<void>;
}

export interface UploadFileOptions {
    signal?: AbortSignal;
    maxUploadSizeBytes?: number;
    concurrency?: number;
    dependencies?: Partial<UploadDependencies>;
}

export function isRetriableStatus(status: number): boolean {
    return status >= 500 || status === 408 || status === 429;
}

export function getRetryDelayMs(attempt: number, random: () => number = Math.random): number {
    // Up to 50% jitter so parallel workers do not retry in lockstep.
    return RETRY_BASE_DELAY_MS * 2 ** attempt * (1 + random() * 0.5);
}

// A fixed pool of workers pulling from one shared cursor: each index runs exactly
// once, and no more than `limit` run at a time.
export async function runWithConcurrency(count: number, limit: number, worker: (index: number) => Promise<void>): Promise<void> {
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, count) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= count)
                return;
            await worker(index);
        }
    });

    await Promise.all(runners);
}

class UploadRequestError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
    }
}

function resolveDependencies(overrides?: Partial<UploadDependencies>): UploadDependencies {
    return {
        fetch: overrides?.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
        delay: overrides?.delay ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
}

async function uploadRequest(dependencies: UploadDependencies, data: Record<string, string | number>, signal?: AbortSignal) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.set(key, String(value)));

    const response = await dependencies.fetch("/dashboard/upload", { method: "POST", body: formData, signal });
    // Carries the status so retry classification treats a rejected session (403)
    // differently from a server hiccup, rather than retrying both three times.
    if (!response.ok)
        throw new UploadRequestError(await response.text() || "Upload request failed", response.status);

    return response.json();
}

function toSessionFields(session: UploadSession) {
    return {
        mode: session.mode,
        resourceId: session.resourceId,
        uploadId: session.uploadId,
        size: session.size,
        validate: session.validate,
    };
}

async function putBody(dependencies: UploadDependencies, url: string, body: Blob, signal?: AbortSignal, contentType?: string) {
    const response = await dependencies.fetch(url, {
        method: "PUT",
        body,
        signal,
        headers: contentType ? { "Content-Type": contentType } : undefined,
    });

    if (!response.ok)
        throw new UploadRequestError("Unable to upload file data.", response.status);
}

async function uploadSingle(file: File, bucket: UploadBucket, session: CreateUploadResponse, onProgress: (progress: number) => void, dependencies: UploadDependencies, signal?: AbortSignal) {
    if (!session.url)
        throw new Error("Upload session did not provide an upload target.");

    // The server signed this exact content type into the presigned URL, so the
    // header has to match or S3 rejects the request.
    await putBody(dependencies, session.url, file, signal, file.type || "application/octet-stream");
    onProgress(1);
    await uploadRequest(dependencies, { intent: "complete", bucket, ...toSessionFields(session) }, signal);
}

async function uploadMultipart(file: File, bucket: UploadBucket, session: UploadSession, onProgress: (progress: number) => void, dependencies: UploadDependencies, concurrency: number, signal?: AbortSignal) {
    const ranges = getUploadChunkRanges(file.size);
    // Every re-issued signature stays valid for its own 60 minutes, so parallel
    // workers can simply keep the most recent one they have seen.
    let validate = session.validate;
    let uploadedBytes = 0;

    await runWithConcurrency(ranges.length, concurrency, async (index) => {
        const range = ranges[index];
        const chunk = file.slice(range.start, range.end);

        for (let attempt = 0; attempt < MAX_PART_ATTEMPTS; attempt++) {
            if (signal?.aborted)
                throw new DOMException("Aborted", "AbortError");

            try {
                const part: PartUploadResponse = await uploadRequest(dependencies, {
                    intent: "part",
                    bucket,
                    part: index + 1,
                    ...toSessionFields({ ...session, validate }),
                }, signal);

                validate = part.validate;
                await putBody(dependencies, part.url, chunk, signal);

                uploadedBytes += chunk.size;
                onProgress(uploadedBytes / file.size);
                return;
            } catch (error) {
                const isLastAttempt = attempt === MAX_PART_ATTEMPTS - 1;
                const status = error instanceof UploadRequestError ? error.status : undefined;
                const isRetriable = status === undefined || isRetriableStatus(status);

                if (isLastAttempt || !isRetriable || signal?.aborted)
                    throw error;

                await dependencies.delay(getRetryDelayMs(attempt));
            }
        }
    });

    await uploadRequest(dependencies, { intent: "complete", bucket, ...toSessionFields({ ...session, validate }) }, signal);
}

export async function uploadFile(file: File, bucket: UploadBucket, onProgress: (progress: number) => void, options: UploadFileOptions = {}) {
    const maxUploadSizeBytes = options.maxUploadSizeBytes ?? getMaxUploadSizeBytes(bucket);
    const validationError = validateUploadSize(file.size, maxUploadSizeBytes);
    if (validationError)
        throw new Error(validationError);

    const dependencies = resolveDependencies(options.dependencies);
    const { signal } = options;

    const session: CreateUploadResponse = await uploadRequest(dependencies, {
        intent: "create",
        bucket,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
    }, signal);

    try {
        if (session.mode === "single")
            await uploadSingle(file, bucket, session, onProgress, dependencies, signal);
        else
            await uploadMultipart(file, bucket, session, onProgress, dependencies, options.concurrency ?? MAX_CONCURRENT_PARTS, signal);

        return { resourceId: session.resourceId, metadata: { file, size: file.size, type: file.type } satisfies UploadedFileMetadata };
    } catch (error) {
        try {
            await uploadRequest(dependencies, { intent: "abort", bucket, ...toSessionFields(session) });
        } catch {
            // The original failure is more useful; an expired/completed upload may no longer be abortable.
        }
        throw error;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Point `UploadingSection` at `uploadFile` and delete the old module**

In `app/components/upload/uploadingSection.tsx`, replace the import on lines 2-5 with:

```ts
import {
  UploadedFileMetadata,
  uploadFile,
} from "@/functions/handleFileUpload/uploadClient";
```

and replace the call on lines 38-47 with:

```ts
          const result = await uploadFile(
            files[index],
            bucket,
            (fileProgress) => {
              if (!signal.aborted)
                setProgress((index + fileProgress) / files.length);
            },
            { signal, maxUploadSizeBytes },
          );
```

The `maxUploadSizeBytes` prop stays: `getMaxUploadSizeBytes` reads `process.env` and guards on `typeof process === "undefined"`, so the browser cannot resolve the configured cap without the loader passing it. Client validation is advisory — the server re-validates on every intent.

Then remove the superseded module:

```bash
git rm app/functions/handleFileUpload/useChunkedUpload.ts
```

- [ ] **Step 6: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/functions/handleFileUpload app/components/upload/uploadingSection.tsx
git commit -m "feat: route client uploads by size with parallel retrying parts"
```

---

### Task 7: Remove the superseded upload state

**Files:**
- Modify: `app/routes/dashboard.media.new._index/reducer.ts`
- Modify: `app/routes/dashboard.media.new._index/route.tsx:120-121`
- Modify: `app/functions/handleFileUpload/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: removes `ServerUploadResponse` and `UploadPart` from `index.ts`.

`SET_UPLOAD_INFO` and `ADD_UPLOAD_SUCCESSFUL_CHUNK` are never dispatched; `uploadInfo` and `successfulChunks` are initialised at `route.tsx:120-121` and never read. They predate `UploadingSection` owning upload state. The reducer is the last consumer of `ServerUploadResponse` and `UploadPart`, so both types go with it.

- [ ] **Step 1: Strip the reducer**

Replace the whole of `app/routes/dashboard.media.new._index/reducer.ts` with:

```ts
import { UploadStatus } from "@/functions/handleFileUpload";

export enum ActionType {
    SET_FILE,
    SET_STATE,
}

export type Action =
    | { type: ActionType.SET_FILE, payload: File[] }
    | { type: ActionType.SET_STATE, payload: UploadStatus };

export interface UploadInfo {
    file: File[];
    state: UploadStatus;
}

export default function reducer(state: UploadInfo, action: Action) {
    switch (action.type) {
        case ActionType.SET_FILE:
            return { ...state, file: action.payload };
        case ActionType.SET_STATE:
            return { ...state, state: action.payload };
        default:
            return state;
    }
}
```

- [ ] **Step 2: Drop the dead initial state**

In `app/routes/dashboard.media.new._index/route.tsx`, delete lines 120-121:

```ts
    uploadInfo: null,
    successfulChunks: [],
```

- [ ] **Step 3: Remove the superseded types**

In `app/functions/handleFileUpload/index.ts`, delete the `UploadPart` and `ServerUploadResponse` interfaces along with the comment introducing them.

- [ ] **Step 4: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/dashboard.media.new._index app/functions/handleFileUpload/index.ts
git commit -m "refactor: drop upload state superseded by UploadingSection"
```

---

### Task 8: Widen `file_size` to BIGINT

**Files:**
- Modify: `app/db/schema.ts:98`
- Create: `migrations/<generated>.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

MySQL signed `INT` stops at 2,147,483,647 bytes (~2 GB), so without this every private upload above 2 GB fails or clamps at the insert in `dashboard.upload._index.ts`.

- [ ] **Step 1: Confirm `bigint` is imported**

In `app/db/schema.ts`, check the `drizzle-orm/mysql-core` import list includes `bigint`. If not, add it.

- [ ] **Step 2: Widen the column**

Replace line 98:

```ts
    fileSize: bigint("file_size", { mode: "number" }),
```

`mode: "number"` is correct here — JavaScript's safe integer range (~9 PB) far exceeds any object R2 can hold.

- [ ] **Step 3: Generate the migration**

Run: `yarn migrations:gen`
Expected: a new `.sql` file under `migrations/` containing
`ALTER TABLE \`downloadable_file\` MODIFY COLUMN \`file_size\` bigint;`

Read the generated file and confirm it only touches `file_size`. If it contains unrelated drift, discard it and regenerate after reconciling the schema.

- [ ] **Step 4: Run the full gate**

Run: `yarn test`
Expected: PASS.

Run: `yarn typecheck` and `yarn lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/db/schema.ts migrations
git commit -m "feat: widen downloadable_file.file_size to bigint"
```

---

### Task 9: Manual verification

**Files:** none.

- [ ] **Step 1: Apply the migration**

Run: `yarn migrations:apply`
Expected: completes without error.

- [ ] **Step 2: Start the dev server**

Run: `yarn dev`

- [ ] **Step 3: Verify the single-PUT path**

Upload an image under 8 MiB at `/dashboard/media/new`. In the browser Network tab, expect exactly two requests to `/dashboard/upload` (`create`, `complete`) plus one PUT to R2 — and **no** `part` request. Confirm the object appears in the media list and renders.

- [ ] **Step 4: Verify the multipart path**

Upload a file between 8 and 32 MiB. Expect a `create`, several `part` requests, PUTs running up to four at a time, then `complete`. The progress bar should advance smoothly rather than jumping.

- [ ] **Step 5: Verify the cap split**

Attempt a >100 MiB upload at `/dashboard/media/new` — expect rejection with "File exceeds the 100 MB upload limit". Upload the same file at `/dashboard/download/new` — expect success, and confirm `file_size` in `downloadable_file` matches the byte count.

- [ ] **Step 6: Verify abort**

Start a large upload and navigate away mid-flight. Confirm in-flight PUTs are cancelled in the Network tab and an `abort` request fires.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address manual verification findings"
```

---

## Notes for the implementer

- **Do not add an R2 lifecycle rule in code.** Orphaned multipart parts accrue storage cost, and the mitigation is bucket configuration, deliberately outside this plan. Flag it to the user at the end instead.
- **`getUploadChunkRanges` moved** from `useChunkedUpload.ts` to `validation.ts` in Task 1, and now derives its part size from the file rather than a fixed constant.
- **The 60-minute ceiling is not fully gone.** Rolling signatures remove the total-duration limit but not the limit *between two consecutive part completions*. With parts up to ~524 MiB that needs a pathologically slow link, and it is accepted.
- **Deploying this invalidates in-flight sessions.** The signature payload format changes, so any upload in progress at deploy time fails its next request and aborts. Accepted: this is a dashboard tool with a single operator. Deploy when nothing is uploading.
- If `yarn test` reports an open handle or hangs, something in the import graph reached `@/storage/aws.server`. Check for a value import that should be `import type`.
