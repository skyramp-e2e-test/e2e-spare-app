// GET /login as the built app serves it: the page build (html-validate -> dist/) keeps the sign-in hint and form.
import { test, expect, getBaseUrl, SkyrampClient } from "@skyramp/skyramp";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT_ELEMENT = '<p class="hint" data-testid="login-hint">Use the test user from the README.</p>';

function header(headers: { [name: string]: string } | undefined, name: string): string | undefined {
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers![key];
}

test("GET /login serves the built sign-in page with the hint and the form", async () => {
  const client = new SkyrampClient();
  // No cookies: the page any visitor gets.
  const response: any = await client.sendRequest({
    url: baseUrl,
    path: "/login",
    method: "GET",
  });

  expect(response.statusCode).toBe(200);
  expect(header(response.responseHeaders, "content-type")).toMatch(/^text\/html/);
  const body: string = response.responseBody;
  expect(body).toContain(HINT_ELEMENT);
  expect(body).toContain('<form method="post" action="/login" data-testid="login-form">');
  // The hint sits between the heading and the form, as in public/login.html.
  const heading = body.indexOf("<h1>Sign in</h1>");
  const hint = body.indexOf(HINT_ELEMENT);
  const form = body.indexOf('data-testid="login-form"');
  expect(heading).toBeGreaterThan(-1);
  expect(hint).toBeGreaterThan(heading);
  expect(form).toBeGreaterThan(hint);
  // The error stays hidden until the page sees ?error.
  expect(body).toContain('<p id="login-error" class="error" data-testid="login-error" hidden>Invalid email or password.</p>');
});
