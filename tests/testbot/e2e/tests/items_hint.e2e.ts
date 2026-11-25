// Items page hint: shown to signed-in users and visitors, and kept on the page through adding an item.
// Recorded with the Skyramp walk helper, then strengthened.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");
const HINT_TEXT = "Add an item to start your list.";

test.use({
    viewport: { width: 1280, height: 900 },
});

function credentials(): { username: string; password: string } {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (username === undefined || password === undefined) {
        throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in with that account");
    }
    return { username, password };
}

async function signIn(page: Page, username: string, password: string) {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
}

test('signed-in user sees the hint on the Items page', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = credentials();

    await signIn(page, username, password);

    await expect(page.getByTestId("items-hint")).toBeVisible();
    await expect(page.getByTestId("items-hint")).toHaveText(HINT_TEXT);
    await expect(page.getByRole("heading", { name: "Items" })).toBeVisible();
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    await expect(page.getByTestId("add-item-form")).toBeVisible();
    await expect(page.getByLabel("New item")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
});

test('visitor who is not signed in sees the hint on the Items page', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
        expect(await context.cookies()).toHaveLength(0);
        let page = await context.newPage();
        page.setDefaultTimeout(pageTimeout);
        page = newSkyrampPlaywrightPage(page);

        await page.goto(`${baseUrl}/items`);
        await expect(page).toHaveURL(`${baseUrl}/items`);
        await expect(page.getByTestId("user-status")).toHaveText("You are not signed in.");
        await expect(page.getByTestId("items-hint")).toBeVisible();
        await expect(page.getByTestId("items-hint")).toHaveText(HINT_TEXT);
        await expect(page.getByRole("heading", { name: "Items" })).toBeVisible();
    } finally {
        await context.close();
    }
});

test('sign in, see the items hint, and add an item', async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = credentials();
    const itemName = `Hint journey ${Date.now()}`;
    const items = page.getByTestId("items-list").getByTestId("item");

    await test.step("1. sign in at /login", async () => {
        await signIn(page, username, password);
    });

    await test.step("2. look at the Items page", async () => {
        await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
        await expect.soft(page.getByTestId("items-hint")).toBeVisible();
        await expect.soft(page.getByTestId("items-hint")).toHaveText(HINT_TEXT);
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    });

    await test.step("3. add an item", async () => {
        await page.getByLabel("New item").fill(itemName);
        const responsePromise = page.waitForResponse((res) =>
            res.url().endsWith("/api/items") && res.request().method() === "POST");
        await page.getByRole("button", { name: "Add item" }).click();
        const response = await responsePromise;
        checkRequestPayload(response.request().postDataJSON(), { name: itemName });
        expect.soft(response.status()).toBe(201);
        await expect.soft(page.getByLabel("New item")).toHaveValue("");
        await expect.soft(page.getByTestId("item-error")).toBeHidden();
        await expect.soft(items.filter({ has: page.getByText(itemName, { exact: true }) })).toHaveCount(1);
        await expect.soft(items.filter({ hasText: itemName })).toHaveText(itemName);
    });

    await test.step("4. reload the Items page", async () => {
        await page.reload();
        await expect.soft(items.filter({ has: page.getByText(itemName, { exact: true }) })).toHaveCount(1);
        await expect.soft(items.filter({ hasText: itemName })).toHaveText(itemName);
        await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
        await expect.soft(page.getByLabel("New item")).toHaveValue("");
        await expect.soft(page.getByTestId("item-error")).toBeHidden();
    });
});
