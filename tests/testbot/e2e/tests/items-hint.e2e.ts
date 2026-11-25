// Browser tests of the Items page hint ("Add an item to start your list.") and the page around it.
// Recorded with the Skyramp walk helper, then strengthened. They expect a fresh app (no items yet);
// remove-hint-journey-items.sh removes the item the journey adds.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Locator, Page } from "@playwright/test";

const pageTimeout = 15000;
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT_TEXT = "Add an item to start your list.";
const JOURNEY_ITEM = "Hint journey item";

test.use({ viewport: { width: 1280, height: 900 } });

function loginFromEnv(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login");
  }
  return { username, password };
}

function itemsPage(page: Page) {
  return {
    heading: page.getByRole("heading", { name: "Items", level: 1 }),
    hint: page.getByTestId("items-hint"),
    userStatus: page.getByTestId("user-status"),
    list: page.getByTestId("items-list"),
    entries: page.getByTestId("items-list").getByTestId("item"),
    newItem: page.getByLabel("New item"),
    addItem: page.getByRole("button", { name: "Add item" }),
    itemError: page.getByTestId("item-error"),
  };
}

/** True when `first` comes before `second` in document order. */
async function precedes(page: Page, first: Locator, second: Locator): Promise<boolean> {
  const a = await first.elementHandle();
  const b = await second.elementHandle();
  return page.evaluate(
    ([x, y]) => !!(x && y && x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING),
    [a, b] as const,
  );
}

async function signIn(page: Page) {
  const { username, password } = loginFromEnv();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  return username;
}

test("signed-in user on an empty list sees the hint between the Items heading and the status line", async ({ page, request }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  // Precondition: a fresh app with no items.
  const itemsRes = await request.get(`${baseUrl}/api/items`);
  expect(itemsRes.status()).toBe(200);
  expect(await itemsRes.json(), "precondition: GET /api/items must return [] on a fresh app").toEqual([]);

  const username = await signIn(page);
  const p = itemsPage(page);
  await expect(p.heading).toHaveText("Items");
  await expect(p.userStatus).toHaveText(`Signed in as ${username}`);
  await expect(p.hint).toBeVisible();
  await expect(p.hint).toHaveText(HINT_TEXT);
  await expect(p.hint).toHaveCount(1);
  expect(await precedes(page, p.heading, p.hint), "hint follows the 'Items' heading").toBe(true);
  expect(await precedes(page, p.hint, p.userStatus), "hint precedes the user-status line").toBe(true);
  await expect(p.entries).toHaveCount(0);
});

test("signed-out visitor sees the hint and the not-signed-in status", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await page.goto(`${baseUrl}/items`);
  const p = itemsPage(page);
  await expect(p.heading).toHaveText("Items");
  await expect(p.hint).toBeVisible();
  await expect(p.hint).toHaveText(HINT_TEXT);
  await expect(p.userStatus).toHaveText("You are not signed in.");
});

test("sign in, see the hint on the Items page, and add a first item", async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const p = itemsPage(page);
  let username = "";

  await test.step("1. /login: sign in and land on /items", async () => {
    username = await signIn(page);
  });

  await test.step("2. /items: heading, hint, status line and an empty list", async () => {
    await expect.soft(p.heading).toHaveText("Items");
    await expect.soft(p.hint).toBeVisible();
    await expect.soft(p.hint).toHaveText(HINT_TEXT);
    expect.soft(await precedes(page, p.heading, p.hint), "hint follows the 'Items' heading").toBe(true);
    expect.soft(await precedes(page, p.hint, p.userStatus), "hint precedes the user-status line").toBe(true);
    await expect.soft(p.userStatus).toHaveText(`Signed in as ${username}`);
    await expect.soft(p.entries).toHaveCount(0);
  });

  await test.step("3. /items: add 'Hint journey item'", async () => {
    await p.newItem.fill(JOURNEY_ITEM);
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items"),
      p.addItem.click(),
    ]);
    expect.soft(req.postDataJSON()).toEqual({ name: JOURNEY_ITEM });
    const res = await req.response();
    expect.soft(res?.status()).toBe(201);
    await expect.soft(p.entries).toHaveCount(1);
    await expect.soft(p.entries).toHaveText([JOURNEY_ITEM]);
    await expect.soft(p.newItem).toHaveValue("");
    await expect.soft(p.itemError).toBeHidden();
  });

  await test.step("4. /items: reload keeps the item, the sign-in and one hint", async () => {
    await page.reload();
    await expect(p.entries).toHaveCount(1);
    await expect(p.entries).toHaveText([JOURNEY_ITEM]);
    await expect(p.userStatus).toHaveText(`Signed in as ${username}`);
    await expect(p.heading).toHaveText("Items");
    await expect(p.hint).toHaveCount(1);
    await expect(p.newItem).toHaveValue("");
    await expect(p.itemError).toBeHidden();
  });
});
