// Items page hint: the hint under the Items heading, and the page still signing in, listing and adding items with it.
// Recorded with the Skyramp walk helper, then fitted to these cases.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");
const HINT = "Add an item to start your list.";

test.use({
    viewport: { width: 1280, height: 900 },
});

function credentials() {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (username === undefined || password === undefined) {
        throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through the login form");
    }
    return { username, password };
}

async function signIn(page: Page, username: string, password: string) {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${baseUrl}/items`);
}

async function itemNames(page: Page): Promise<string[]> {
    const res = await page.request.get(`${baseUrl}/api/items`);
    expect(res.status()).toBe(200);
    return (await res.json()).map((item: { name: string }) => item.name);
}

/** Vertical positions of the heading, hint, status line and add-item form, top to bottom as the page should show them. */
async function layoutTops(page: Page) {
    const top = async (loc: ReturnType<Page["getByTestId"]>) => (await loc.boundingBox())?.y ?? NaN;
    return [
        await top(page.getByRole("heading", { name: "Items", level: 1 })),
        await top(page.getByTestId("items-hint")),
        await top(page.getByTestId("user-status")),
        await top(page.getByTestId("add-item-form")),
    ];
}

function expectTopToBottom(tops: number[]) {
    const [heading, hint, status, form] = tops;
    expect.soft(hint, "hint is below the Items heading").toBeGreaterThan(heading);
    expect.soft(status, "hint is above the sign-in status").toBeGreaterThan(hint);
    expect.soft(form, "hint is above the add-item form").toBeGreaterThan(hint);
}

test('signed-in user sees the hint, adds an item and still sees both after a reload', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = credentials();
    const name = `Hint journey ${Date.now()}`;
    const expectedPayload1 = { "name": name };
    let before: string[] = [];

    await test.step("1. sign in at /login and land on /items", async () => {
        await signIn(page, username, password);
        await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step("2. the items page shows the heading, the hint, the sign-in status and the form in that order", async () => {
        await expect.soft(page.getByRole("heading", { name: "Items", level: 1 })).toBeVisible();
        await expect.soft(page.getByTestId("items-hint")).toBeVisible();
        await expect.soft(page.getByTestId("items-hint")).toHaveText(HINT);
        await expect.soft(page.getByTestId("items-hint")).toHaveCount(1);
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
        await expect.soft(page.getByLabel("New item")).toBeVisible();
        expectTopToBottom(await layoutTops(page));
        before = await itemNames(page);
        await expect.soft(page.getByTestId("items-list").getByTestId("item")).toHaveText(before);
    });

    await test.step("3. add an item through the form", async () => {
        await page.getByLabel("New item").fill(name);
        const responsePromise0 = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
        await page.getByRole("button", { name: "Add item" }).click();
        const response0 = await responsePromise0;
        checkRequestPayload(response0.request().postDataJSON(), expectedPayload1);
        expect.soft(response0.status()).toBe(201);
        await expect.soft(page.getByTestId("items-list").getByTestId("item")).toHaveText([...before, name]);
        await expect.soft(page.getByLabel("New item")).toHaveValue("");
        await expect.soft(page.getByTestId("item-error")).toBeHidden();
        await expect.soft(page.getByTestId("items-hint")).toHaveText(HINT);
        await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step("4. reload /items: the item is still last, the hint and status still shown", async () => {
        await page.reload();
        await expect.soft(page.getByRole("heading", { name: "Items", level: 1 })).toBeVisible();
        await expect.soft(page.getByTestId("items-hint")).toHaveCount(1);
        await expect.soft(page.getByTestId("items-hint")).toHaveText(HINT);
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
        await expect.soft(page.getByLabel("New item")).toHaveValue("");
        await expect.soft(page.getByTestId("item-error")).toBeHidden();
        await expect.soft(page.getByTestId("items-list").getByTestId("item")).toHaveText([...before, name]);
        expectTopToBottom(await layoutTops(page));
    });
});

test('a visitor who is not signed in also sees the hint', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);

    await page.goto(`${baseUrl}/items`);
    await expect.soft(page.getByTestId("items-hint")).toBeVisible();
    await expect.soft(page.getByTestId("items-hint")).toHaveText(HINT);
    await expect.soft(page.getByTestId("user-status")).toHaveText("You are not signed in.");
});
