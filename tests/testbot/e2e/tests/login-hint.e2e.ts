// Sign-in page hint: browser tests against the running app.
// Recorded with the Skyramp walk helper, then strengthened.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page, Request } from '@playwright/test';

const pageTimeout = 15000;

// URL for test requests
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT_TEXT = "Use the test user from the README.";
const ERROR_TEXT = "Invalid email or password.";
// The test user the README documents (README.md: "Email: test@example.com").
const TEST_EMAIL = "test@example.com";

test.use({
    viewport: { width: 1280, height: 900 },
});

function loginPassword(): string {
    // Credential read from the environment, never written into this file.
    const value = process.env.SKYRAMP_UI_PASSWORD;
    if (value === undefined) {
        throw new Error("SKYRAMP_UI_PASSWORD is not set: this test signs in and needs that credential in the environment");
    }
    return value;
}

function setUp(page: Page): Page {
    page.setDefaultTimeout(pageTimeout);
    // Wrap playwright page with Skyramp page
    return newSkyrampPlaywrightPage(page);
}

// Fills the sign-in form, submits it and checks the form body the browser posts to POST /login.
async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    const posted: Promise<Request> = page.waitForRequest(
        (r) => r.method() === "POST" && new URL(r.url()).pathname === "/login",
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    const body = new URLSearchParams((await posted).postData() ?? "");
    expect.soft(body.get("email")).toBe(email);
    expect.soft(body.get("password")).toBe(password);
}

async function expectHintBetweenHeadingAndForm(page: Page): Promise<void> {
    // The hint comes after the h1 "Sign in" and before the sign-in form.
    const heading = await page.getByRole("heading", { name: "Sign in" }).elementHandle();
    const form = await page.getByTestId("login-form").elementHandle();
    const order = await page.getByTestId("login-hint").evaluate((hint, [h1, form]) => {
        if (!h1 || !form) return null;
        return {
            afterHeading: Boolean(h1.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING),
            beforeForm: Boolean(hint.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING),
        };
    }, [heading, form] as const);
    expect.soft(order).toEqual({ afterHeading: true, beforeForm: true });
}

test("sign-in page shows the README hint below the heading and above the form, with the error hidden", async ({ page }) => {
    page = setUp(page);

    await test.step("open / and follow the Login nav link", async () => {
        await page.goto(`${baseUrl}/`);
        await page.getByTestId("nav-login").click();
        await expect(page).toHaveURL(`${baseUrl}/login`);
    });

    await test.step("the hint is shown and the error is hidden", async () => {
        await expect.soft(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
        await expect.soft(page.getByTestId("login-hint")).toBeVisible();
        await expect.soft(page.getByTestId("login-hint")).toHaveText(HINT_TEXT);
        await expect.soft(page.getByTestId("login-hint")).toHaveCount(1);
        await expectHintBetweenHeadingAndForm(page);
        await expect.soft(page.getByTestId("login-error")).toBeHidden();
    });
});

test("after a failed sign-in the hint is shown together with the error", async ({ page }) => {
    page = setUp(page);

    await test.step("submit wrong credentials on /login", async () => {
        await page.goto(`${baseUrl}/login`);
        await submitSignIn(page, TEST_EMAIL, "wrong-password");
        await expect(page).toHaveURL(`${baseUrl}/login?error=1`);
    });

    await test.step("the hint and the error are both visible", async () => {
        await expect.soft(page.getByTestId("login-error")).toBeVisible();
        await expect.soft(page.getByTestId("login-error")).toHaveText(ERROR_TEXT);
        await expect.soft(page.getByTestId("login-hint")).toBeVisible();
        await expect.soft(page.getByTestId("login-hint")).toHaveText(HINT_TEXT);
    });

    await test.step("the user is not signed in", async () => {
        const me = await page.request.get(`${baseUrl}/api/me`);
        expect.soft(me.status()).toBe(401);
    });
});

test("the README test user named by the hint signs in from the sign-in page", async ({ page }) => {
    page = setUp(page);

    await test.step("open /login with the hint shown", async () => {
        await page.goto(`${baseUrl}/login`);
        await expect.soft(page.getByTestId("login-hint")).toHaveText(HINT_TEXT);
    });

    await test.step("sign in as the README test user", async () => {
        await submitSignIn(page, TEST_EMAIL, loginPassword());
        await expect(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step("the items page shows the signed-in user", async () => {
        await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${TEST_EMAIL}`);
    });
});

test("journey: sign in with the test user named by the hint", async ({ page }) => {
    page = setUp(page);

    await test.step("step 1: / - click the Login nav link", async () => {
        await page.goto(`${baseUrl}/`);
        await page.getByTestId("nav-login").click();
        await expect(page).toHaveURL(`${baseUrl}/login`);
    });

    await test.step("step 2: /login - heading, hint shown, error hidden", async () => {
        await expect.soft(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
        await expect.soft(page.getByTestId("login-hint")).toBeVisible();
        await expect.soft(page.getByTestId("login-hint")).toHaveText(HINT_TEXT);
        await expect.soft(page.getByTestId("login-error")).toBeHidden();
    });

    await test.step("step 3: /login - sign in with the README credentials", async () => {
        await submitSignIn(page, TEST_EMAIL, loginPassword());
        await expect(page).toHaveURL(`${baseUrl}/items`);
        await expect.soft(page.getByText(ERROR_TEXT)).toHaveCount(0);
    });

    await test.step("step 4: /items - signed in as the test user", async () => {
        await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${TEST_EMAIL}`);
        await expect.soft(page.getByTestId("logout-button")).toBeVisible();
        await expect.soft(page.getByTestId("logout-button")).toHaveText("Sign out");
        await expect.soft(page.getByLabel("New item")).toBeVisible();
        await expect.soft(page.getByRole("button", { name: "Add item" })).toBeVisible();
    });

    await test.step("outcome persists after a reload", async () => {
        await page.reload();
        await expect.soft(page).toHaveURL(`${baseUrl}/items`);
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${TEST_EMAIL}`);
        await expect.soft(page.getByTestId("logout-button")).toHaveText("Sign out");
    });
});

test("journey: mistype the password, see the hint and the error, then sign in", async ({ page }) => {
    page = setUp(page);

    await test.step("step 1: /login - submit a wrong password", async () => {
        await page.goto(`${baseUrl}/login`);
        await submitSignIn(page, TEST_EMAIL, "wrong-password");
        await expect(page).toHaveURL(`${baseUrl}/login?error=1`);
        const me = await page.request.get(`${baseUrl}/api/me`);
        expect.soft(me.status()).toBe(401);
    });

    await test.step("step 2: /login?error=1 - the error and the hint are both shown", async () => {
        await expect.soft(page.getByTestId("login-error")).toBeVisible();
        await expect.soft(page.getByTestId("login-error")).toHaveText(ERROR_TEXT);
        await expect.soft(page.getByTestId("login-hint")).toBeVisible();
        await expect.soft(page.getByTestId("login-hint")).toHaveText(HINT_TEXT);
    });

    await test.step("step 3: /login?error=1 - retry with the README credentials", async () => {
        await submitSignIn(page, TEST_EMAIL, loginPassword());
        await expect(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step("step 4: /items - signed in as the test user", async () => {
        await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${TEST_EMAIL}`);
    });

    await test.step("outcome persists after a reload", async () => {
        await page.reload();
        await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${TEST_EMAIL}`);
    });
});
