// Items page hint: the hint under the "Items" heading, and the page still showing who is signed in and adding items.
// Started from a Skyramp recording of the sign-in and add-item flow; the request-body check of the add is kept.
import { test, checkRequestPayload, expect, getBaseUrl, getValue, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Locator, Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

const HINT_TEXT = 'Add an item to start your list.';
const STATUS_TEXT = 'Signed in as test@example.com';

test.use({ viewport: { width: 1280, height: 900 } });

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (username === undefined || password === undefined) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in as the seeded test user');
  }
  return { username, password };
}

async function signIn(page: Page): Promise<void> {
  const { username, password } = credentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByRole('heading', { name: 'Items', level: 1 })).toBeVisible();
}

/** Asserts the hint sits after the "Items" heading and before the add-item form in the page. */
async function expectHintBetweenHeadingAndForm(page: Page): Promise<void> {
  const hint = page.getByTestId('items-hint');
  const heading = await page.getByRole('heading', { name: 'Items', level: 1 }).elementHandle();
  const form = await page.getByTestId('add-item-form').elementHandle();
  const order = await hint.evaluate((el, [h, f]) => ({
    afterHeading: Boolean(h && h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
    beforeForm: Boolean(f && el.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING),
  }), [heading, form] as const);
  expect(order).toEqual({ afterHeading: true, beforeForm: true });
}

/** Asserts the item named `name` is listed once and is the list's last entry (the list is ordered by id). */
async function expectLastItem(items: Locator, name: string): Promise<void> {
  const named = items.filter({ hasText: name });
  await expect.soft(named).toHaveCount(1);
  await expect.soft(named).toHaveText(name);
  expect.soft(await named.evaluate((el) => el.nextElementSibling === null), 'new item is the last entry').toBe(true);
}

async function addItem(page: Page, name: string): Promise<void> {
  const playwrightRequest0: Record<string, any> = { name };
  const expectedPayload1 = { name };
  await page.getByLabel('New item').fill(getValue(playwrightRequest0, 'name'));
  const responsePromise0 = page.waitForResponse(
    (res) => res.url().endsWith('/api/items') && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add item' }).click();
  const response0 = await responsePromise0;
  // Validate request payload
  checkRequestPayload(response0.request().postDataJSON(), expectedPayload1);
  expect(response0.status()).toBe(201);
}

test('shows the hint under the Items heading and above the add-item form', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await signIn(page);
  const hint = page.getByTestId('items-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(HINT_TEXT);
  await expect(hint).toHaveCount(1);
  await expectHintBetweenHeadingAndForm(page);
});

test('journey: sign in, see the items page hint, and add an item', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const name = `Hint journey ${Date.now()}`;
  const items = page.getByTestId('items-list').getByTestId('item');

  await test.step('1. sign in on /login and land on /items', async () => {
    await signIn(page);
  });

  await test.step('2. see the hint and who is signed in', async () => {
    await expect.soft(page.getByTestId('items-hint')).toBeVisible();
    await expect.soft(page.getByTestId('items-hint')).toHaveText(HINT_TEXT);
    await expectHintBetweenHeadingAndForm(page).catch((err) => expect.soft(err, 'hint position').toBeUndefined());
    await expect.soft(page.getByTestId('user-status')).toHaveText(STATUS_TEXT);
  });

  await test.step('3. add a new item through the form', async () => {
    await addItem(page, name);
    await expectLastItem(items, name);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });

  await test.step('4. reload /items and see the item, hint and status kept', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Items', level: 1 })).toBeVisible();
    await expectLastItem(items, name);
    await expect.soft(page.getByTestId('items-hint')).toHaveText(HINT_TEXT);
    await expect.soft(page.getByTestId('user-status')).toHaveText(STATUS_TEXT);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });
});
