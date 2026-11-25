// Browser tests of the hint on the Items page (public/items.html), run against the app built from dist/.
// Recorded with the Skyramp walk helper, then strengthened to check every part of each case's outcome.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Locator, Page } from '@playwright/test';

const pageTimeout = 15000;
const HINT = 'Add an item to start your list.';

// URL for test requests
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (email === undefined || password === undefined) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
  }
  return { email, password };
}

async function preparePage(page: Page): Promise<Page> {
  page.setDefaultTimeout(pageTimeout);
  // Wrap playwright page with Skyramp page
  return newSkyrampPlaywrightPage(page);
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** True when `later` comes after `earlier` in document order. */
async function follows(earlier: Locator, later: Locator): Promise<boolean> {
  const laterHandle = await later.elementHandle();
  return earlier.evaluate(
    (a, b) => !!b && !!(a.compareDocumentPosition(b as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    laterHandle,
  );
}

function itemsPage(page: Page) {
  return {
    heading: page.getByRole('heading', { name: 'Items', level: 1 }),
    hint: page.getByTestId('items-hint'),
    userStatus: page.getByTestId('user-status'),
    addForm: page.getByTestId('add-item-form'),
    newItem: page.getByLabel('New item'),
    addButton: page.getByRole('button', { name: 'Add item' }),
    error: page.getByTestId('item-error'),
    items: page.getByTestId('item'),
  };
}

/** Adds an item through the form, checking the request body sent to POST /api/items. */
async function addItem(page: Page, name: string): Promise<void> {
  const p = itemsPage(page);
  await p.newItem.fill(name);
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST',
  );
  await p.addButton.click();
  const response = await responsePromise;
  // Validate request payload
  checkRequestPayload(response.request().postDataJSON(), { name });
  expect.soft(response.status()).toBe(201);
}

test('signed-in user sees the hint between the Items heading and the add-item form', async ({ page }) => {
  page = await preparePage(page);
  const { email, password } = credentials();
  await signIn(page, email, password);
  await expect(page).toHaveURL(`${baseUrl}/items`);
  const p = itemsPage(page);
  await expect(p.heading).toHaveText('Items');
  await expect(p.hint).toBeVisible();
  await expect(p.hint).toHaveText(HINT);
  await expect(p.hint).toHaveJSProperty('tagName', 'P');
  await expect(p.userStatus).toHaveText(`Signed in as ${email}`);
  expect(await follows(p.heading, p.hint), 'hint follows the Items heading').toBe(true);
  expect(await follows(p.hint, p.addForm), 'hint precedes the add-item form').toBe(true);
});

test('visitor who is not signed in sees the same hint', async ({ page }) => {
  page = await preparePage(page);
  await page.context().clearCookies();
  await page.goto(`${baseUrl}/items`);
  const p = itemsPage(page);
  await expect(p.hint).toBeVisible();
  await expect(p.hint).toHaveText(HINT);
  await expect(p.userStatus).toHaveText('You are not signed in.');
});

test('with an empty item list the hint tells the user how to start the list', async ({ page }) => {
  page = await preparePage(page);
  // A fresh app: GET /api/items answers [] (the shared app may already hold items).
  await page.route('**/api/items', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      : route.continue(),
  );
  const { email, password } = credentials();
  const listLoaded = page.waitForResponse(
    (r) => r.url().endsWith('/api/items') && r.request().method() === 'GET',
  );
  await signIn(page, email, password);
  await listLoaded;
  const p = itemsPage(page);
  await expect(p.hint).toBeVisible();
  await expect(p.hint).toHaveText(HINT);
  await expect(p.items).toHaveCount(0);
  await expect(page.getByTestId('items-list')).toBeEmpty();
});

test('sign in, read the hint on the items page and add a first item', async ({ page }) => {
  page = await preparePage(page);
  const { email, password } = credentials();
  const p = itemsPage(page);
  const name = `Hint journey item ${Date.now()}`;
  let countBefore = 0;

  await test.step('1. sign in through /login and land on /items', async () => {
    await signIn(page, email, password);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('2. read the hint under the Items heading', async () => {
    await expect.soft(p.heading).toHaveText('Items');
    await expect.soft(p.hint).toBeVisible();
    await expect.soft(p.hint).toHaveText(HINT);
    expect.soft(await follows(p.heading, p.hint), 'hint follows the Items heading').toBe(true);
    expect.soft(await follows(p.hint, p.addForm), 'hint precedes the add-item form').toBe(true);
    await expect.soft(p.userStatus).toHaveText(`Signed in as ${email}`);
    countBefore = await p.items.count();
  });

  await test.step('3. add an item through the form', async () => {
    await addItem(page, name);
    await expect.soft(p.newItem).toHaveValue('');
    await expect.soft(p.error).toBeHidden();
    await expect.soft(p.items).toHaveCount(countBefore + 1);
    await expect.soft(p.items.filter({ hasText: name })).toHaveText([name]);
    expect.soft((await p.items.allTextContents()).at(-1), 'added item is the last entry').toBe(name);
  });

  await test.step('4. reload /items and check the page', async () => {
    await page.reload();
    await expect.soft(p.heading).toHaveText('Items');
    await expect.soft(p.hint).toBeVisible();
    await expect.soft(p.hint).toHaveText(HINT);
    expect.soft(await follows(p.heading, p.hint), 'hint follows the Items heading').toBe(true);
    expect.soft(await follows(p.hint, p.addForm), 'hint precedes the add-item form').toBe(true);
    await expect.soft(p.userStatus).toHaveText(`Signed in as ${email}`);
    await expect.soft(p.newItem).toHaveValue('');
    await expect.soft(p.addButton).toBeVisible();
    await expect.soft(p.error).toBeHidden();
    await expect.soft(p.items).toHaveCount(countBefore + 1);
    await expect.soft(p.items.filter({ hasText: name })).toHaveText([name]);
    expect.soft((await p.items.allTextContents()).at(-1), 'added item is the last entry').toBe(name);
  });
});

test('open the items page without signing in, read the hint and add an item', async ({ page }) => {
  page = await preparePage(page);
  await page.context().clearCookies();
  const p = itemsPage(page);
  const name = `Signed-out hint item ${Date.now()}`;
  let countBefore = 0;

  await test.step('1. open / and follow the Items nav link', async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId('nav-items').click();
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('2. read the hint and the signed-out status', async () => {
    await expect.soft(p.heading).toHaveText('Items');
    await expect.soft(p.hint).toBeVisible();
    await expect.soft(p.hint).toHaveText(HINT);
    await expect.soft(p.userStatus).toHaveText('You are not signed in.');
    countBefore = await p.items.count();
  });

  await test.step('3. add an item through the form', async () => {
    await addItem(page, name);
    await expect.soft(p.newItem).toHaveValue('');
    await expect.soft(p.error).toBeHidden();
    await expect.soft(p.items).toHaveCount(countBefore + 1);
    await expect.soft(p.items.filter({ hasText: name })).toHaveText([name]);
    expect.soft((await p.items.allTextContents()).at(-1), 'added item is the last entry').toBe(name);
    await expect.soft(p.heading).toHaveText('Items');
    await expect.soft(p.hint).toHaveText(HINT);
    expect.soft(await follows(p.heading, p.hint), 'hint follows the Items heading').toBe(true);
    expect.soft(await follows(p.hint, p.addForm), 'hint precedes the add-item form').toBe(true);
    await expect.soft(p.userStatus).toHaveText('You are not signed in.');
    await expect.soft(p.addButton).toBeVisible();
  });
});
