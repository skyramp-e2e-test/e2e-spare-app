// Items page hint: a signed-in user sees "Add an item to start your list." under the Items heading,
// and the page's user status, item list and add-item form keep working with it.
import { test, checkRequestPayload, expect, getBaseUrl, getValue, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Locator, Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');
const HINT = 'Add an item to start your list.';

test.use({ viewport: { width: 1280, height: 900 } });

function credentials() {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
  }
  return { username, password };
}

function itemsPage(page: Page) {
  return {
    heading: page.getByRole('heading', { name: 'Items' }),
    hint: page.getByTestId('items-hint'),
    userStatus: page.getByTestId('user-status'),
    newItem: page.getByLabel('New item'),
    addItem: page.getByRole('button', { name: 'Add item' }),
    itemsList: page.getByTestId('items-list'),
    items: page.getByTestId('items-list').getByTestId('item'),
    itemError: page.getByTestId('item-error'),
  };
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

/** Bit 4 (DOCUMENT_POSITION_FOLLOWING) of a.compareDocumentPosition(b): b comes after a in the document. */
async function comesAfter(page: Page, first: Locator, second: Locator): Promise<boolean> {
  const a = await first.elementHandle();
  const b = await second.elementHandle();
  const pos = await page.evaluate(([x, y]) => (x as Node).compareDocumentPosition(y as Node), [a, b]);
  return (pos & 4) === 4;
}

async function savedItemNames(page: Page): Promise<string[]> {
  const res = await page.request.get(`${baseUrl}/api/items`);
  expect(res.status()).toBe(200);
  return (await res.json()).map((item: { name: string }) => item.name);
}

test('signed-in user sees the hint between the Items heading and the status line', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const items = itemsPage(page);

  await signIn(page, username, password);
  await expect(items.heading).toBeVisible();
  await expect(items.hint).toBeVisible();
  await expect(items.hint).toHaveText(HINT);
  await expect(items.userStatus).toHaveText(`Signed in as ${username}`);
  expect(await comesAfter(page, items.heading, items.hint), 'hint comes after the Items heading').toBe(true);
  expect(await comesAfter(page, items.hint, items.userStatus), 'user status comes after the hint').toBe(true);
});

test('hint stays on the page after adding an item', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const items = itemsPage(page);
  const playwrightRequest0: Record<string, any> = { name: `Hint stays ${Date.now()}` };
  const expectedPayload1 = { ...playwrightRequest0 };

  await signIn(page, username, password);
  await expect(items.hint).toHaveText(HINT);
  await expect(items.userStatus).toHaveText(`Signed in as ${username}`);

  await items.newItem.fill(getValue(playwrightRequest0, 'name'));
  const responsePromise0 = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
  await items.addItem.click();
  const response0 = await responsePromise0;
  checkRequestPayload(response0.request().postDataJSON(), expectedPayload1);
  expect(response0.status()).toBe(201);

  await expect(items.items.filter({ hasText: playwrightRequest0.name })).toHaveCount(1);
  await expect(items.hint).toBeVisible();
  await expect(items.hint).toHaveText(HINT);
});

test('sign in, see the items hint, and add an item', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const items = itemsPage(page);
  const playwrightRequest0: Record<string, any> = { name: `Hint journey ${Date.now()}` };
  const expectedPayload1 = { ...playwrightRequest0 };
  const newName: string = playwrightRequest0.name;
  let savedBefore: string[] = [];

  await test.step('1. /login: sign in and land on /items', async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('Email').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(items.heading).toBeVisible();
  });

  await test.step('2. /items: see the hint and the status line', async () => {
    await expect.soft(items.hint).toBeVisible();
    await expect.soft(items.hint).toHaveText(HINT);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    expect.soft(await comesAfter(page, items.heading, items.hint), 'hint comes after the Items heading').toBe(true);
    expect.soft(await comesAfter(page, items.hint, items.userStatus), 'user status comes after the hint').toBe(true);
    savedBefore = await savedItemNames(page);
    await expect.soft(items.items).toHaveText(savedBefore);
  });

  await test.step('3. /items: add an item', async () => {
    await items.newItem.fill(getValue(playwrightRequest0, 'name'));
    const responsePromise0 = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
    await items.addItem.click();
    const response0 = await responsePromise0;
    checkRequestPayload(response0.request().postDataJSON(), expectedPayload1);
    expect.soft(response0.status()).toBe(201);
    await expect.soft(items.items).toHaveText([...savedBefore, newName]);
    await expect.soft(items.items.filter({ hasText: newName })).toHaveCount(1);
    await expect.soft(items.newItem).toHaveValue('');
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.hint).toHaveText(HINT);
  });

  await test.step('4. /items: reload and see everything persist', async () => {
    await page.reload();
    await expect.soft(items.heading).toBeVisible();
    await expect.soft(items.hint).toHaveText(HINT);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    await expect.soft(items.items).toHaveText([...savedBefore, newName]);
    await expect.soft(items.items.filter({ hasText: newName })).toHaveCount(1);
    await expect.soft(items.newItem).toHaveValue('');
    await expect.soft(items.itemError).toBeHidden();
  });
});
