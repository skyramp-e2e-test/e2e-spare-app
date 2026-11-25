// GET /items: the items page the app image serves from dist/ carries the hint once, beside the page's own parts.
import { test, expect, getBaseUrl } from '@skyramp/skyramp';

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");
const HINT_PARAGRAPH = '<p class="hint" data-testid="items-hint">Add an item to start your list.</p>';

const occurrences = (text: string, part: string) => text.split(part).length - 1;

test('GET /items serves the built items page with the hint exactly once', async ({ request }) => {
    const response = await request.get(`${baseUrl}/items`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^text\/html/);
    const body = await response.text();
    expect.soft(occurrences(body, HINT_PARAGRAPH)).toBe(1);
    expect.soft(occurrences(body, 'data-testid="items-hint"')).toBe(1);
    expect.soft(occurrences(body, "Add an item to start your list.")).toBe(1);
    expect.soft(body).toContain('data-testid="add-item-form"');
    expect.soft(body).toContain('data-testid="items-list"');
    // The hint sits between the heading and the sign-in status line in the served markup.
    const heading = body.indexOf("<h1>Items</h1>");
    const hint = body.indexOf(HINT_PARAGRAPH);
    const status = body.indexOf('data-testid="user-status"');
    expect.soft(heading).toBeGreaterThan(-1);
    expect.soft(hint).toBeGreaterThan(heading);
    expect.soft(status).toBeGreaterThan(hint);
});
