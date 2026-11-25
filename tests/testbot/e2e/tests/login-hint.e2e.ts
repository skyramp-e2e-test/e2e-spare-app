// Sign-in page hint: the hint under the "Sign in" heading, and sign-in from /login working as before.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT = "Use the test user from the README.";
const ERROR = "Invalid email or password.";
const WRONG_PASSWORD = "wrong-password";

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to the seeded test user");
  }
  return { username, password };
}

function loginPage(page: Page) {
  return {
    navLogin: page.getByTestId("nav-login"),
    heading: page.getByRole("heading", { name: "Sign in" }),
    hint: page.getByTestId("login-hint"),
    error: page.getByTestId("login-error"),
    form: page.getByTestId("login-form"),
    email: page.getByLabel("Email"),
    password: page.getByLabel("Password"),
    submit: page.getByRole("button", { name: "Sign in" }),
  };
}

/** Submits the form and checks the POST /login request carried what was typed. */
async function submitLogin(page: Page, email: string, password: string) {
  const login = loginPage(page);
  await login.email.fill(email);
  await login.password.fill(password);
  const request = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/login");
  await login.submit.click();
  const body = new URLSearchParams((await request).postData() ?? "");
  expect.soft(body.get("email")).toBe(email);
  expect.soft(body.get("password")).toBe(password);
}

/** Where the hint sits relative to the heading and the form, in document order. */
async function hintPosition(page: Page) {
  const login = loginPage(page);
  const heading = await login.heading.elementHandle();
  const form = await login.form.elementHandle();
  return login.hint.evaluate(
    (hint, [h, f]) => ({
      afterHeading: !!(h!.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeForm: !!(hint.compareDocumentPosition(f!) & Node.DOCUMENT_POSITION_FOLLOWING),
    }),
    [heading, form] as const,
  );
}

test.describe("sign-in page hint", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
  });

  test("login page shows the README hint between the Sign in heading and the form", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const login = loginPage(page);
    await page.goto(`${baseUrl}/login`);
    await expect(login.heading).toBeVisible();
    await expect(login.hint).toBeVisible();
    await expect(login.hint).toHaveText(HINT, { useInnerText: true });
    await expect(login.form).toBeVisible();
    expect(await hintPosition(page)).toEqual({ afterHeading: true, beforeForm: true });
  });

  test("hint stays shown alongside the error after a failed sign-in", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { username } = credentials();
    const login = loginPage(page);
    await page.goto(`${baseUrl}/login`);
    await submitLogin(page, username, WRONG_PASSWORD);
    await expect(page).toHaveURL(`${baseUrl}/login?error=1`);
    await expect(login.hint).toBeVisible();
    await expect(login.hint).toHaveText(HINT, { useInnerText: true });
    await expect(login.error).toBeVisible();
    await expect(login.error).toHaveText(ERROR, { useInnerText: true });
  });

  test("signing in with the test user redirects to /items showing the signed-in user", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = credentials();
    await page.goto(`${baseUrl}/login`);
    await submitLogin(page, username, password);
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(page.getByText(`Signed in as ${username}`, { exact: true })).toBeVisible();
  });

  test("journey: read the hint, fail once, then sign in with the test user", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = credentials();
    const login = loginPage(page);

    await test.step("1. open / and click the Login link", async () => {
      await page.goto(`${baseUrl}/`);
      await login.navLogin.click();
      await expect.soft(page).toHaveURL(`${baseUrl}/login`);
      await expect.soft(login.heading).toBeVisible();
    });

    await test.step("2. read the login page: hint shown, error hidden", async () => {
      await expect.soft(login.heading).toBeVisible();
      await expect.soft(login.hint).toBeVisible();
      await expect.soft(login.hint).toHaveText(HINT, { useInnerText: true });
      await expect.soft(login.error).toBeHidden();
      expect.soft(await hintPosition(page)).toEqual({ afterHeading: true, beforeForm: true });
    });

    await test.step("3. sign in with a wrong password", async () => {
      await submitLogin(page, username, WRONG_PASSWORD);
      await expect.soft(page).toHaveURL(`${baseUrl}/login?error=1`);
      await expect.soft(login.hint).toBeVisible();
      await expect.soft(login.hint).toHaveText(HINT, { useInnerText: true });
      await expect.soft(login.error).toBeVisible();
      await expect.soft(login.error).toHaveText(ERROR, { useInnerText: true });
    });

    await test.step("4. sign in with the test user", async () => {
      await submitLogin(page, username, password);
      await expect.soft(page).toHaveURL(`${baseUrl}/items`);
      await expect.soft(page.getByText(`Signed in as ${username}`, { exact: true })).toBeVisible();
    });

    await test.step("outcome persists after a reload", async () => {
      await page.reload();
      await expect(page).toHaveURL(`${baseUrl}/items`);
      await expect(page.getByText(`Signed in as ${username}`, { exact: true })).toBeVisible();
    });
  });
});
