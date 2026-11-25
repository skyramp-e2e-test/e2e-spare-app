// GET /items from the running app (built from the Dockerfile, pages served from dist/ after html-validate):
// the hint markup ships in the served page, once, between the heading and the status line.
import { test, expect, getBaseUrl } from "@skyramp/skyramp";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT_MARKUP = '<p class="hint" data-testid="items-hint">Add an item to start your list.</p>';

test("GET /items serves the page with exactly one items hint between the heading and the status line", async ({ request }) => {
  const res = await request.get(`${baseUrl}/items`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^text\/html/);
  const body = await res.text();

  expect(body.split(HINT_MARKUP).length - 1, "hint paragraph appears exactly once").toBe(1);
  expect(body.split('data-testid="items-hint"').length - 1, "one items-hint element").toBe(1);

  const heading = body.indexOf("<h1>Items</h1>");
  const hint = body.indexOf(HINT_MARKUP);
  const status = body.indexOf('data-testid="user-status"');
  expect(heading).toBeGreaterThanOrEqual(0);
  expect(status).toBeGreaterThanOrEqual(0);
  expect(hint, "hint comes after <h1>Items</h1>").toBeGreaterThan(heading);
  expect(hint, "hint comes before the user-status line").toBeLessThan(status);
});
