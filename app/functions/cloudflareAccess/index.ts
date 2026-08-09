/** The header Cloudflare Access injects into every request it proxies to the origin. */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
/** The same token, as set on the browser. Only a fallback — see getAccessToken. */
export const ACCESS_JWT_COOKIE = "CF_Authorization";

const TEAM_DOMAIN_SUFFIX = ".cloudflareaccess.com";

/**
 * How much of the Cloudflare Access token we are able to check, given the configuration.
 *
 * - `disabled`  — no organization configured, every request is let through.
 * - `unpinned`  — signature and issuer are verified, but any Access application in the
 *                 organization is accepted because no audience tag was configured.
 * - `enforced`  — signature, issuer and audience are all verified.
 */
export type AccessStatus = "disabled" | "unpinned" | "enforced";

export interface AccessConfig {
    /** Exactly what the token's `iss` claim must equal. */
    teamDomain: string;
    /** JWKS endpoint the signing keys are fetched from. */
    certsUrl: string;
    /** The Application Audience (AUD) tag, or null when the audience is not pinned. */
    audience: string | null;
}

export interface AccessIdentity {
    email: string | null;
    subject: string | null;
}

/**
 * Builds the verification config from the raw environment values, accepting any of the
 * three spellings a Cloudflare One team gets referred to by — `myteam`,
 * `myteam.cloudflareaccess.com`, or `https://myteam.cloudflareaccess.com`.
 *
 * Returns null when no organization is configured, which is the signal that Cloudflare
 * Access verification is switched off entirely.
 */
export function parseAccessConfig(organization?: string, audience?: string): AccessConfig | null {
    const organizationValue = organization?.trim();
    if (!organizationValue)
        return null;

    // A pasted dashboard URL can carry a scheme and a path; only the host identifies the team.
    const host = organizationValue.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
    if (!host)
        return null;

    const teamDomain = `https://${host.endsWith(TEAM_DOMAIN_SUFFIX) ? host : host + TEAM_DOMAIN_SUFFIX}`;

    return {
        teamDomain,
        certsUrl: `${teamDomain}/cdn-cgi/access/certs`,
        audience: audience?.trim() || null,
    };
}

export function getAccessStatus(config: AccessConfig | null): AccessStatus {
    if (!config)
        return "disabled";

    return config.audience ? "enforced" : "unpinned";
}

/**
 * Reads the Access token off a request.
 *
 * Cloudflare recommends the header over the cookie "since the cookie is not guaranteed to
 * be passed", so the header wins. Neither transport is a trust signal on its own — anything
 * hitting the origin directly can set both — so falling back to the cookie costs nothing:
 * the signature is what actually authorizes the request.
 */
export function getAccessToken(request: Request): string | null {
    const header = request.headers.get(ACCESS_JWT_HEADER)?.trim();
    if (header)
        return header;

    const cookies = request.headers.get("Cookie");
    if (!cookies)
        return null;

    for (const cookie of cookies.split(";")) {
        const separator = cookie.indexOf("=");
        if (separator < 0)
            continue;

        if (cookie.slice(0, separator).trim() !== ACCESS_JWT_COOKIE)
            continue;

        return cookie.slice(separator + 1).trim() || null;
    }

    return null;
}
