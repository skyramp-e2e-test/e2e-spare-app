// HTTP checks of the Items page the app serves from its page build (dist/, written by `npm run build` in the Dockerfile).
// Written by hand: the Skyramp API generator could not run here (no licence file for this environment).
import { test, expect, getBaseUrl } from '@skyramp/skyramp';

// URL for test requests
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

const HINT_MARKUP = '<p class="hint" data-testid="items-hint">Add an item to start your list.</p>';

test('GET /items serves the built items page with the hint paragraph', async ({ request }) => {
  const response = await request.get(`${baseUrl}/items`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/html\b/);
  const body = await response.text();
  expect(body).toContain(HINT_MARKUP);
  // The hint sits after the Items heading and before the add-item form.
  const heading = body.indexOf('<h1>Items</h1>');
  const hint = body.indexOf(HINT_MARKUP);
  const form = body.indexOf('<form id="add-item-form"');
  expect(heading).toBeGreaterThanOrEqual(0);
  expect(form).toBeGreaterThanOrEqual(0);
  expect(hint).toBeGreaterThan(heading);
  expect(hint).toBeLessThan(form);
  // Only one hint on the page.
  expect(body.split('data-testid="items-hint"').length - 1).toBe(1);
});
