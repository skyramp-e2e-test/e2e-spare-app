// Sign-in page hint: the login page points the user at the README test user, and the sign-in form keeps working.
// Recorded with the Skyramp walk helper, then strengthened to each case's expected outcome.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Locator, Page } from "@playwright/test";

const pageTimeout = 15000;
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT_TEXT = "Use the test user from the README.";
const ERROR_TEXT = "Invalid email or password.";
const WRONG_PASSWORD = "wrong-password";

// The README test user; the run supplies it, never written here.
function testUser(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to the README test user");
  }
  return { email, password };
}

function loginPage(page: Page) {
  return {
    heading: page.getByRole("heading", { level: 1, name: "Sign in" }),
    hint: page.getByTestId("login-hint"),
    error: page.getByTestId("login-error"),
    form: page.getByTestId("login-form"),
    email: page.getByLabel("Email"),
    password: page.getByLabel("Password"),
    submit: page.getByRole("button", { name: "Sign in" }),
  };
}

// True when `first` comes before `second` in the document.
async function precedes(first: Locator, second: Locator): Promise<boolean> {
  const other = await second.elementHandle();
  return first.evaluate((el, o) => !!o && !!(el.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING), other);
}

// Submits the form and returns the POST /login response the browser got (the redirect itself).
async function submitLogin(page: Page, email: string, password: string) {
  const login = loginPage(page);
  await login.email.fill(email);
  await login.password.fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"),
    login.submit.click(),
  ]);
  return response;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
});

test("login page shows the README hint under the Sign in heading and before the form", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const login = loginPage(page);

  await page.goto(`${baseUrl}/`);
  await page.getByTestId("nav-login").click();
  await expect(page).toHaveURL(`${baseUrl}/login`);
  await expect(login.heading).toHaveText("Sign in");
  await expect(login.hint).toBeVisible();
  await expect(login.hint).toHaveText(HINT_TEXT);
  await expect(login.hint).toHaveCount(1);
  expect(await precedes(login.heading, login.hint)).toBe(true);
  expect(await precedes(login.hint, login.form)).toBe(true);
  await expect(login.error).toBeHidden();
});

test("failed sign-in returns to /login?error=1 showing the error and still the hint", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email } = testUser();
  const login = loginPage(page);

  await page.goto(`${baseUrl}/login`);
  const response = await submitLogin(page, email, WRONG_PASSWORD);
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/login?error=1");
  await expect(page).toHaveURL(`${baseUrl}/login?error=1`);
  await expect(login.error).toBeVisible();
  await expect(login.error).toHaveText(ERROR_TEXT);
  await expect(login.hint).toBeVisible();
  await expect(login.hint).toHaveText(HINT_TEXT);
  await expect(login.hint).not.toHaveClass(/\berror\b/);
});

test("opening /login?error=1 directly shows the error and the hint", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const login = loginPage(page);

  await page.goto(`${baseUrl}/login?error=1`);
  await expect(login.error).toBeVisible();
  await expect(login.error).toHaveText(ERROR_TEXT);
  await expect(login.hint).toBeVisible();
  await expect(login.hint).toHaveText(HINT_TEXT);
});

test("the README test user signs in from the login page and lands on /items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = testUser();

  await page.goto(`${baseUrl}/login`);
  const response = await submitLogin(page, email, password);
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/items");
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
});

test("sign in with the test user the login page hint points to", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = testUser();
  const login = loginPage(page);

  await test.step("1. open / and follow the Login nav link", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect.soft(page).toHaveURL(`${baseUrl}/login`);
    await expect.soft(login.heading).toBeVisible();
  });

  await test.step("2. the login page shows the hint before the form and no error", async () => {
    await expect.soft(login.hint).toBeVisible();
    await expect.soft(login.hint).toHaveText(HINT_TEXT);
    expect.soft(await precedes(login.hint, login.form)).toBe(true);
    await expect.soft(login.error).toBeHidden();
  });

  await test.step("3. a wrong password returns to /login?error=1 with the error and the hint", async () => {
    await submitLogin(page, email, WRONG_PASSWORD);
    await expect.soft(page).toHaveURL(`${baseUrl}/login?error=1`);
    await expect.soft(login.error).toBeVisible();
    await expect.soft(login.error).toHaveText(ERROR_TEXT);
    await expect.soft(login.hint).toBeVisible();
    await expect.soft(login.hint).toHaveText(HINT_TEXT);
  });

  await test.step("4. the README test user signs in from /login?error=1", async () => {
    await submitLogin(page, email, password);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("5. /items shows who is signed in, also after a reload", async () => {
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await page.reload();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });
});
