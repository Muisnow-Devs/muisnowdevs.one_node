# Size-routed uploads

Date: 2026-08-08
Status: approved, ready for implementation planning

## Problem

Uploads larger than 100 MB are rejected outright. The goal is to lift that limit for
release archives while keeping a modest ceiling on publicly served media, and to stop
paying multipart's round-trip overhead on small files.

### What the code actually does today

The starting premise for this work was that the client sends the whole file in a single
request. It does not. `uploadFileInChunks` (`app/functions/handleFileUpload/useChunkedUpload.ts:26`)
already opens a multipart upload for *every* file, slices it into 8 MiB parts, PUTs each
part to its own presigned URL, and completes server-side. Chunking exists; it is simply
applied unconditionally.

What blocks large files is a policy cap, not a transport limit:

| Location | Behaviour |
| --- | --- |
| `validation.ts:10` `getMaxUploadSizeBytes` | Defaults to 100 MB via `MAX_UPLOAD_SIZE_MB`, currently unset in `.env` |
| `useChunkedUpload.ts:27` | Client rejects the file before any upload starts |
| `dashboard.upload._index.ts:33,47` | Server rejects `create`, `part`, `abort`, `complete` |

A 200 MB file therefore fails validation and never reaches S3. It is not a failed 200 MB PUT.

`putResourceWithSignedUrl` (`app/storage/aws.server.tsx:67`) is a single-shot presign helper
that is defined but never called — the fast path this design wires up.

## Decisions

| Decision | Choice |
| --- | --- |
| Max size | Per bucket: `media` 100 MiB (configurable), `download` bounded only by R2 |
| Large-file path | Parallel parts, per-part retry, adaptive part sizing |
| Resumability | Out of scope — an interrupted upload restarts |
| Single-PUT crossover | 8 MiB, i.e. exactly the files that would be one multipart part |
| Structure | Two explicit strategies over a shared core |
| Session expiry | Rolling signature — each `part` response re-issues `validate` |
| File rename | `useChunkedUpload.ts` → `uploadClient.ts` |

### Why 8 MiB and not 100 MB

`fetch()` cannot report upload progress, and a single PUT has no retry granularity. At a
100 MB crossover the progress bar would jump 0% → 100% and a blip at 99 MB would restart
from zero. At 8 MiB the fast path covers exactly the files that would be a single part
anyway — a typical image drops from four round trips to two — while everything larger keeps
per-chunk progress and per-part retry. No `XMLHttpRequest` needed.

### Why two strategies rather than one unified path

The paths differ in almost every respect: one has an `uploadId`, a part loop, concurrency,
per-part retry and a `CompleteMultipartUpload`; the other has none of that and verifies with
a `HeadObject`. A unified function would thread `if (mode === "single")` through code that
reads as though it were generic. Duplication in the happy path is the cheaper cost.

Streaming bytes through the app server was rejected: it routes every byte through the Node
process and reintroduces the request-body ceiling that presigned URLs exist to avoid.

## Design

### 1. Size policy — `validation.ts` (shared client/server)

```ts
export const SINGLE_PUT_MAX_BYTES = 8 * MiB;    // crossover
export const MIN_PART_SIZE_BYTES  = 8 * MiB;    // S3 floor is 5 MiB
export const MAX_PART_COUNT       = 10_000;     // S3/R2 hard ceiling
export const R2_MAX_OBJECT_BYTES  = 4.995 TiB;  // the "bucket's limit"
```

- `getMaxUploadSizeBytes(bucket)` — `media`: `MAX_UPLOAD_SIZE_MB` env, default 100 MiB.
  `download`: `R2_MAX_OBJECT_BYTES`.
- `validateUpload(bucket, size)` — rejects `size <= 0` and `size > cap`.
- `getUploadPartSize(size)` = `max(MIN_PART_SIZE_BYTES, ceilToMiB(size / MAX_PART_COUNT))`.
- `getExpectedUploadPartCount(size)` = `ceil(size / getUploadPartSize(size))`.

Part size stays 8 MiB up to 80 GB, then grows. At the 5 TiB ceiling a part is ~524 MiB,
comfortably under the 5 GiB per-part limit, and the count can never breach 10,000 by
construction.

Both functions are pure and derive from the **signed** size, so client and server compute an
identical layout and a client cannot misreport it.

`validateUpload` gains a `bucket` parameter. Every caller must be updated:
`dashboard.upload._index.ts:33,47` and the client entry point.

### 2. Session model — `index.server.ts`

`create` returns a discriminated union, with the mode covered by the signature:

```ts
size <= SINGLE_PUT_MAX_BYTES  → { mode: "single",    resourceId, url, size, validate }
otherwise                     → { mode: "multipart", resourceId, uploadId, size, validate }
```

For `single`, `create` issues no S3 mutation — it presigns a `PutObject` URL and returns it,
so the fast path costs one server round trip before the upload and one after.

**Signed payload format changes.** Today it is `[bucket, uploadId, resourceId, size].join(':')`
(`index.server.ts:8`). `resourceId` ends in an extension taken directly from the user's
filename (`index.ts:27`, `filename.split('.').pop()`), so a file named `a.png:0:x` yields a
payload whose fields cannot be unambiguously recovered — two distinct sessions can serialize
to the same string. The new payload is `JSON.stringify([mode, bucket, uploadId, resourceId, size])`.

The extension is additionally sanitized to `[a-z0-9]{1,12}`, lowercased, since it becomes part
of the S3 object key. A rejected extension is dropped, not an error.

`complete`:

- **single** — `HeadObject`, assert `ContentLength === size` and that `validateUpload` passes.
- **multipart** — paginated `ListParts`, assert count equals expected, `CompleteMultipartUpload`,
  then the same `HeadObject` verification.

Both delete the object and return `false` on mismatch. The existing compensation logic at
`index.server.ts:55-68` is preserved unchanged.

`abort`: `DeleteObject` for single (best effort — the object may not exist),
`AbortMultipartUpload` for multipart.

#### Rolling signature

`sign`/`verify` (`app/crypto.ts`) derives its key from a minute-resolution timestamp and
rejects anything older than 60 minutes (`crypto.ts:31`, asserted by `crypto.test.ts:14`).
Because `validate` is issued once at `create` and re-checked on every subsequent intent, an
upload currently has 60 minutes total from start to finish. Invisible under a 100 MB cap;
binding once the private bucket is uncapped — 10 GB would need ~2.8 MB/s sustained, 50 GB
~14 MB/s.

Each successful `part` response therefore returns a freshly signed `validate` over the
**same** payload, and the client swaps it in for subsequent requests. Total upload duration
becomes unbounded while each individual signature keeps its tight 60-minute replay window.
`crypto.ts` is not modified.

Parallel workers need no locking here. The payload is identical across re-issues, so every
signature the server hands out is independently valid for its own 60 minutes; the client
simply keeps the most recent one it has seen.

The remaining ceiling is 60 minutes between two *consecutive* part completions. With parts up
to ~524 MiB that requires a pathologically slow link, and it is accepted rather than handled.

### 3. Latent bugs fixed as part of this work

Each is currently masked by the 100 MB cap and becomes reachable once it is lifted.

**`ListParts` is unpaginated** — `listResourceMultipartUploadParts` (`aws.server.tsx:149`)
reads `data.Parts` from a single response. S3 and R2 cap that at 1,000 parts per page, so past
~8 GB the count check at `index.server.ts:45` rejects a file that uploaded successfully. Fix:
loop on `PartNumberMarker` / `IsTruncated` and accumulate.

**Part numbers rewritten by array position** — `index.server.ts:48` maps
`(part, index) => ({ PartNumber: index + 1 })`, discarding what S3 reported. Correct only
while the listing is a single complete ordered page. Fix: use `part.PartNumber` and sort
ascending.

**Abort signal not passed to part PUTs** — `useChunkedUpload.ts:40` calls
`fetch(url, { method: "PUT", body: chunk })` without `signal`, so cancelling leaves the
in-flight request running. Both new paths pass it.

### 4. Client — `uploadClient.ts`

`uploadFile(file, bucket, onProgress, signal)` dispatches on `file.size`.

- `uploadSingle` — create (returns `url`) → one PUT of the whole body → complete.
  Progress reports 0 then 1.
- `uploadMultipart` — create → a pool of **4 concurrent** workers over part indices. Each
  worker presigns, PUTs, and retries up to **3 times** with jittered exponential backoff
  (250 ms × 2^n). Retries cover network errors and 5xx/408/429 only; other 4xx fail
  immediately. On terminal failure the session is aborted and the first error rethrown.

Progress accumulates **bytes uploaded**, not completed part indices, because parts now finish
out of order.

`getUploadChunkRanges` moves beside the part-sizing logic and takes the adaptive part size
rather than the fixed constant.

`UploadingSection` (`app/components/upload/uploadingSection.tsx:38`) switches to `uploadFile`.

Its `maxUploadSizeBytes` prop is **kept**. `getMaxUploadSizeBytes` reads `process.env` and
guards on `typeof process === "undefined"` (`validation.ts:10`), so the browser cannot resolve
the configured cap itself — the loader→prop path exists precisely to carry it across. Dropping
it would silently fall back to the 100 MiB default and reject valid files whenever
`MAX_UPLOAD_SIZE_MB` is raised.

Both loaders (`dashboard.media.new._index/route.tsx:18`, `dashboard.download.new._index/route.tsx:18`)
call `getMaxUploadSizeBytes()` with no argument and must pass their own bucket.

Client-side validation stays advisory. The server re-validates independently on every intent
and remains the sole authority; the prop only avoids starting an upload that is certain to fail.

### 5. Schema

`file_size` is `int` (`app/db/schema.ts:98`). MySQL signed `INT` tops out at 2,147,483,647
bytes (~2 GB), so every private upload above that fails or silently clamps at the insert in
`dashboard.upload._index.ts:76`. Change to `bigint("file_size", { mode: "number" })` and
generate a migration with `yarn migrations:gen`. JavaScript's safe-integer range (~9 PB) is
not a concern.

### 6. Testing

`package.json` has no `test` script despite three `node:test` files. Add:

```json
"test": "node --env-file=.env --import tsx --test \"app/**/*.test.ts\""
```

`--env-file=.env` is required: `app/crypto.ts` throws at module load without
`VERIFICATION_KEY`, so `crypto.test.ts` fails without it. Verified working on Node v24.16.0.

New coverage, all pure functions with injected fakes — no network:

- Part sizing across the 80 GB inflection; count never exceeds 10,000; only the last part is smaller.
- Per-bucket caps: `media` rejects >100 MB, `download` accepts 10 GB, both reject 0.
- Mode selection exactly at the 8 MiB boundary (8 MiB → single, +1 byte → multipart).
- Signature payload unambiguity, including the `a.png:0:x` case.
- Extension sanitization.
- Progress accumulation with out-of-order part completion.
- Retry: gives up after 3 attempts, does not retry 4xx, stops on abort.
- Paginated `ListParts` assembles parts across page boundaries in the right order.

Existing tests in `validation.test.ts` need updating for the `bucket` parameter and the
adaptive part size.

### 7. Dead code removed

Confirmed unreferenced outside their own tests, and removed as part of this work rather than
left to rot beside the code being restructured:

- `validateUploadParts` and `MultipartUploadPart` (`validation.ts:5,40`) — superseded by the
  `ListParts` count check in `completeFileUploadSession`. Their two tests go with them.
- `UploadPart` (`index.ts:8`).
- `ActionType.SET_UPLOAD_INFO`, `ActionType.ADD_UPLOAD_SUCCESSFUL_CHUNK`, and the
  `uploadInfo` / `successfulChunks` state fields (`dashboard.media.new._index/reducer.ts`).
  Neither action is ever dispatched; the fields are initialised at `route.tsx:120-121` and
  never read. They predate `UploadingSection` owning upload state.
- `UPLOAD_CHUNK_SIZE_BYTES` (`validation.ts:3`) — replaced by `getUploadPartSize`.

`ServerUploadResponse` is renamed `UploadSession` and gains `mode`. `putResourceWithSignedUrl`
(`aws.server.tsx:67`) stops being dead — it becomes the single-PUT path.

## Out of scope

- Resumable uploads across page reloads. Redis is already wired and could persist session
  state, but this is deliberately deferred.
- Per-file concurrency across multiple selected files — `UploadingSection` continues to
  upload files one at a time, with parallelism only within a file's parts.
- Checksums and content-type verification beyond what exists.

## Risks

- **Multipart uploads that are never completed or aborted accrue storage cost.** Lifting the
  cap makes orphaned parts materially more expensive. An R2 lifecycle rule to expire
  incomplete uploads is the standard mitigation; it is configuration rather than code, and is
  not part of this change.
- **The signature payload format change invalidates in-flight sessions.** Any upload in
  progress at deploy time will fail its next request and abort. Acceptable for a dashboard
  tool with a single operator.
