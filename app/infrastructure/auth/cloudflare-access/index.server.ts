import { createRemoteJWKSet, jwtVerify } from "jose";
import { createContext } from "react-router";
import {
    AccessIdentity,
    getAccessStatus,
    getAccessToken,
    parseAccessConfig,
} from ".";
import { env } from "@/lib/env.server";

const config = parseAccessConfig(env.accessOrganization, env.accessAudience);

// Lazy: no request is made until the first token is verified, and the set caches the keys
// and refetches them itself, which is what keeps the 6-week key rotation working.
const jwks = config ? createRemoteJWKSet(new URL(config.certsUrl)) : null;

/** How much of the token this deployment is able to check. Surfaced in the dashboard UI. */
export const accessStatus = getAccessStatus(config);

/** The verified identity for the current request, or null when verification is disabled. */
export const accessIdentityContext = createContext<AccessIdentity | null>(null);

function forbidden(): Response {
    // Deliberately uniform: the caller learns that it was rejected, never why.
    return new Response("Forbidden", { status: 403, statusText: "Forbidden" });
}

/**
 * Verifies the Cloudflare Access JWT on a request, throwing a 403 Response if it is missing
 * or invalid.
 *
 * With Access in front of the origin an unauthenticated browser never gets this far —
 * Cloudflare handles the login redirect itself. A request that arrives here without a valid
 * token has reached the origin some other way, so it is refused rather than redirected.
 *
 * Returns null when no organization is configured, in which case nothing is verified and
 * every request is allowed through.
 */
export async function requireCloudflareAccess(
    request: Request,
): Promise<AccessIdentity | null> {
    if (!config || !jwks) return null;

    const token = getAccessToken(request);
    if (!token) throw forbidden();

    try {
        const { payload } = await jwtVerify(token, jwks, {
            issuer: config.teamDomain,
            // undefined skips the check — the "unpinned" state, where any Access
            // application in the organization is accepted.
            audience: config.audience ?? undefined,
            // Pin the algorithm so a token re-headered as `none` or HS256 cannot be
            // substituted for one Cloudflare actually signed.
            algorithms: ["RS256"],
        });

        return {
            email: typeof payload.email === "string" ? payload.email : null,
            subject: payload.sub ?? null,
        };
    } catch (error) {
        // Logged, not returned: a misconfigured team domain and a forged token look
        // identical from outside, and only one of them needs to be debuggable.
        console.warn(
            "Rejected Cloudflare Access token:",
            error instanceof Error ? error.message : error,
        );
        throw forbidden();
    }
}
