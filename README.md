# Welcome to Remix!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server:

```shellscript
npm run dev
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

- `build/server`
- `build/client`

## Dashboard authentication

Everything under `/dashboard` is guarded by a Cloudflare Access JWT check, enforced in the
`middleware` export of `app/routes/dashboard.tsx` so that it also covers actions such as
`/dashboard/upload`. Cloudflare Access itself handles the login; this check exists so that a
request reaching the origin some other way (server IP, an unproxied hostname, a stale DNS record)
cannot skip it. See the
[Cloudflare docs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Two environment variables control it:

| `CF_ACCESS_ORGANIZATION` | `CF_ACCESS_AUD` | Behaviour | Dashboard alert |
| --- | --- | --- | --- |
| unset | — | every request allowed, nothing verified | red: authentication disabled |
| set | unset | signature and issuer verified | yellow: audience not pinned |
| set | set | signature, issuer and audience verified | none |

- `CF_ACCESS_ORGANIZATION` — your Cloudflare One team. Any of `myteam`,
  `myteam.cloudflareaccess.com`, or `https://myteam.cloudflareaccess.com` works.
- `CF_ACCESS_AUD` — the Application Audience (AUD) tag, from Zero Trust → Access controls →
  Applications → Configure → Additional settings → **Application Audience (AUD) Tag**. Without it
  a token issued for *any* Access application in the organization is accepted, so set it in
  production.

Rejected requests get a bare `403`; the reason is logged on the server only.

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.
