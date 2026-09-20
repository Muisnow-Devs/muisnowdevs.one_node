# muisnowdevs.one

The site is a React Router SSR application. Routes form the HTTP boundary, feature modules own site behavior, and `app/infrastructure` contains MySQL/Drizzle, Redis, S3-compatible storage, and Cloudflare Access integrations.

## Local development

Install Node 24.19+ with Corepack, then start the local dependencies and copy the sample environment file:

```sh
docker compose up -d
cp .env.example .env
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn migrations:apply
yarn dev
```

Docker Compose provides MySQL on `3306`, Redis on `6379`, and MinIO on `9000` (console `9001`). It also creates the `private` and `public` buckets. The sample credentials are for local development only. Keep `.env` private and replace every secret for a deployed environment.

`start-dependencies.ps1` now delegates to Compose. Existing standalone containers and their data are untouched; stop those containers before starting Compose on the same ports. Compose uses its own named volumes.

## Container deployment

Build the production web image:

```sh
docker build --build-arg VITE_PUBLIC_URL=https://your-public-media-host/ --target runtime -t muisnowdevs.one .
```

Run database migrations from the dedicated target before starting a new application version:

```sh
docker build --build-arg VITE_PUBLIC_URL=https://your-public-media-host/ --target migration -t muisnowdevs.one-migration .
docker run --rm --env-file .env muisnowdevs.one-migration
```

The published runtime image also contains the compiled migration command, so a host can run it directly from GHCR:

```sh
docker run --rm --env-file .env --entrypoint node \
  ghcr.io/muisnow-devs/muisnowdevs.one_node:latest ./build/migrate.mjs
```

The runtime image contains the compiled application, public assets, and privacy-policy source required during bundling. It intentionally excludes `.env` files and local dependency data. Supply MySQL, Redis, S3-compatible storage, `VERIFICATION_KEY`, and Cloudflare Access settings through the deployment environment.

Use database/Redis addresses reachable from the container; `127.0.0.1` inside it refers to the container itself. `S3_ENDPOINT` must also be reachable by browsers using presigned uploads/downloads. For local MinIO use `S3_FORCE_PATH_STYLE=true` and `S3_REGION=us-east-1` as in `.env.example`.

Authenticate and run the private image on your deployment host:

```sh
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
docker pull ghcr.io/muisnow-devs/muisnowdevs.one_node:latest
docker run -d --restart unless-stopped --env-file .env -p 127.0.0.1:6158:3000 \
  ghcr.io/muisnow-devs/muisnowdevs.one_node:latest
```

Use a classic token with `read:packages` and access to this package. Run the migration command before the web container. Prefer the commit-SHA image tag for a reproducible deployment; old image versions are removed by retention.

## SEO and download authorization

`/sitemap.xml` includes public pages, enabled articles, and active downloads. Redis stores the XML for five minutes; article mutations do not invalidate it. XML ETags support conditional requests. The cache falls back to the database if Redis is unavailable. Legacy articles and downloads keep `updatedAt = NULL` because their real edit date is unknown; new publications and later edits record it. Apply migrations `0006_article_updated_at` and `0007_download_updated_at` before starting this version. Submit `https://muisnowdevs.one/sitemap.xml` in Google Search Console after deployment; `/robots.txt` also advertises it.

Download-page tokens expire after 30 minutes and are atomically checked and consumed in Redis, bound to the download and client-IP hash. Token issuance/redemption fails closed when Redis is unavailable, and token-bearing responses use `private, no-store`. The resulting S3 URL remains usable until its one-hour expiry so browser downloads/retries work; it is the application token that is single-use. Configure the origin/proxy to trust only genuine forwarded client-IP headers.

## Validation

```sh
yarn typecheck
yarn test
yarn build
```

Set `TEST_REDIS_URL=redis://127.0.0.1:6379` to include the real Redis concurrency/expiry test. CI applies migrations to a fresh MySQL service, runs the token test using Redis, and builds the container. The legacy `lint` script has no ESLint configuration and is not a CI gate.

## GitHub Container Registry

On `master`, GitHub Actions validates the application and publishes `ghcr.io/muisnow-devs/muisnowdevs.one_node:latest` plus a commit-SHA tag. Set the repository Actions variable `VITE_PUBLIC_URL` to the public-object base URL, including a trailing slash. Publishing is serialized. The image is single-platform and disables provenance/SBOM manifests so retention operates on complete image versions; the workflow always protects the `latest` version and retains one additional version.

New organization container packages default to private. Before publishing, the workflow fails if an existing package is not private. The package must allow the repository's GitHub Actions `GITHUB_TOKEN` to administer it; `packages: write` is granted to the publish job. If the package was created outside this repository, grant this repository admin access in its package settings so retention calls can succeed.

## Dashboard authentication

Everything under `/dashboard` is guarded by a Cloudflare Access JWT check, enforced in the `middleware` export of `app/routes/dashboard.tsx` so that it also covers actions such as `/dashboard/upload`. Cloudflare Access itself handles the login; this check exists so that a request reaching the origin some other way (server IP, an unproxied hostname, or a stale DNS record) cannot skip it. See the [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

| `CF_ACCESS_ORGANIZATION` | `CF_ACCESS_AUD` | Behaviour | Dashboard alert |
| --- | --- | --- | --- |
| unset | — | every request allowed, nothing verified | red: authentication disabled |
| set | unset | signature and issuer verified | yellow: audience not pinned |
| set | set | signature, issuer and audience verified | none |

`CF_ACCESS_ORGANIZATION` accepts `myteam`, `myteam.cloudflareaccess.com`, or `https://myteam.cloudflareaccess.com`. Set `CF_ACCESS_AUD` in production to pin verification to the dashboard Access application. Rejected requests get a bare `403`; the reason is logged on the server only.
