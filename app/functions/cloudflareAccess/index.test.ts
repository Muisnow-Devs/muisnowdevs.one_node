import assert from "node:assert/strict";
import test from "node:test";
import { ACCESS_JWT_HEADER, getAccessStatus, getAccessToken, parseAccessConfig } from ".";

const TEAM_DOMAIN = "https://myteam.cloudflareaccess.com";

test("parseAccessConfig accepts every spelling of the same team", () => {
    for (const organization of ["myteam", "myteam.cloudflareaccess.com", TEAM_DOMAIN, `${TEAM_DOMAIN}/`, "  MyTeam  "]) {
        const config = parseAccessConfig(organization);
        assert.equal(config?.teamDomain, TEAM_DOMAIN, `failed for ${JSON.stringify(organization)}`);
        assert.equal(config?.certsUrl, `${TEAM_DOMAIN}/cdn-cgi/access/certs`);
    }
});

test("parseAccessConfig treats a missing or blank organization as unconfigured", () => {
    assert.equal(parseAccessConfig(undefined), null);
    assert.equal(parseAccessConfig(""), null);
    assert.equal(parseAccessConfig("   "), null);
    assert.equal(parseAccessConfig("https://"), null);
});

test("parseAccessConfig keeps the audience only when one was actually supplied", () => {
    assert.equal(parseAccessConfig("myteam", "aud-tag")?.audience, "aud-tag");
    assert.equal(parseAccessConfig("myteam", "  ")?.audience, null);
    assert.equal(parseAccessConfig("myteam")?.audience, null);
});

test("getAccessStatus reports how much of the token can be checked", () => {
    assert.equal(getAccessStatus(null), "disabled");
    assert.equal(getAccessStatus(parseAccessConfig("myteam")), "unpinned");
    assert.equal(getAccessStatus(parseAccessConfig("myteam", "aud-tag")), "enforced");
});

function requestWith(headers: Record<string, string>) {
    return new Request("https://muisnow.dev/dashboard", { headers });
}

test("getAccessToken reads the header Cloudflare Access injects", () => {
    assert.equal(getAccessToken(requestWith({ [ACCESS_JWT_HEADER]: "token-from-header" })), "token-from-header");
});

test("getAccessToken falls back to the CF_Authorization cookie", () => {
    const request = requestWith({ Cookie: "other=1; CF_Authorization=token-from-cookie; trailing=2" });
    assert.equal(getAccessToken(request), "token-from-cookie");
});

test("getAccessToken prefers the header, which Cloudflare says is the reliable one", () => {
    const request = requestWith({
        [ACCESS_JWT_HEADER]: "token-from-header",
        Cookie: "CF_Authorization=token-from-cookie",
    });

    assert.equal(getAccessToken(request), "token-from-header");
});

test("getAccessToken returns null when no token is present", () => {
    assert.equal(getAccessToken(requestWith({})), null);
    assert.equal(getAccessToken(requestWith({ Cookie: "session=abc; theme=dark" })), null);
    assert.equal(getAccessToken(requestWith({ Cookie: "CF_Authorization=" })), null);
    assert.equal(getAccessToken(requestWith({ [ACCESS_JWT_HEADER]: "   " })), null);
});

test("getAccessToken does not match a cookie that merely ends with the name", () => {
    // "NOT_CF_Authorization" shares a suffix with the real cookie; a naive
    // endsWith/includes check would hand its value over as an Access token.
    const request = requestWith({ Cookie: "NOT_CF_Authorization=attacker-controlled" });
    assert.equal(getAccessToken(request), null);
});
