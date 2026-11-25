// Sign-in page and POST /login: HTTP contract tests against the running app.
import { test, expect, getBaseUrl } from '@skyramp/skyramp';

// URL for test requests
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT_MARKUP = '<p class="hint" data-testid="login-hint">Use the test user from the README.</p>';
const TEST_EMAIL = "test@example.com";

function countOf(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

test("GET /login serves the built page with the hint once and the sign-in form", async ({ request }) => {
    const response = await request.get(`${baseUrl}/login`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^text\/html/);
    const body = await response.text();
    expect.soft(countOf(body, "Use the test user from the README.")).toBe(1);
    expect.soft(countOf(body, HINT_MARKUP)).toBe(1);
    expect.soft(body).toContain('<p id="login-error" class="error" data-testid="login-error" hidden>Invalid email or password.</p>');
    expect.soft(body).toContain('<form method="post" action="/login" data-testid="login-form">');
});

test("POST /login with a wrong password redirects 303 to /login?error=1 without a session", async ({ request }) => {
    const response = await request.post(`${baseUrl}/login`, {
        form: { email: TEST_EMAIL, password: "wrong-password" },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toBe("/login?error=1");
    expect.soft(response.headers()["set-cookie"]).toBeUndefined();
    const me = await request.get(`${baseUrl}/api/me`);
    expect.soft(me.status()).toBe(401);
});

test("POST /login with the README test user redirects 303 to /items signed in", async ({ request }) => {
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (password === undefined) {
        throw new Error("SKYRAMP_UI_PASSWORD is not set: this test signs in and needs that credential in the environment");
    }
    const response = await request.post(`${baseUrl}/login`, {
        form: { email: TEST_EMAIL, password },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toBe("/items");
    expect.soft(response.headers()["set-cookie"] ?? "").toMatch(/HttpOnly/i);
    const me = await request.get(`${baseUrl}/api/me`);
    expect(me.status()).toBe(200);
    expect(await me.json()).toEqual({ email: TEST_EMAIL });
});
