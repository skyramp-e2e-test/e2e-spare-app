// Sign-in page hint: the hint under the "Sign in" heading on /login, with and without a failed sign-in,
// and the README test user it points to.
import * as fs from "fs";
import * as path from "path";
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const pageTimeout = 15000;
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

const HINT = "Use the test user from the README.";
const ERROR = "Invalid email or password.";
const WRONG_PASSWORD = "wrong-password";

test.use({ viewport: { width: 1280, height: 900 } });

/** The sign-in login the run provides, read from the environment. */
function uiLogin(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login");
  }
  return { email, password };
}

/** The test user the README's "Sign in with the test user" section names. */
function readmeTestUser(): { email: string; password: string } {
  const readme = fs.readFileSync(path.resolve(__dirname, "../../../../README.md"), "utf8");
  const email = readme.match(/\*\*Email:\*\*\s*`([^`]+)`/)?.[1];
  const password = readme.match(/\*\*Password:\*\*\s*`([^`]+)`/)?.[1];
  if (!email || !password) throw new Error("README.md does not name a test user (**Email:** / **Password:**)");
  return { email, password };
}

function loginPage(page: Page) {
  return {
    heading: page.getByRole("heading", { name: "Sign in" }),
    hint: page.getByTestId("login-hint"),
    error: page.getByTestId("login-error"),
    form: page.getByTestId("login-form"),
    email: page.getByLabel("Email"),
    password: page.getByLabel("Password"),
    submit: page.getByRole("button", { name: "Sign in" }),
  };
}

async function setUp(page: Page): Promise<Page> {
  page.setDefaultTimeout(pageTimeout);
  return newSkyrampPlaywrightPage(page);
}

test("the sign-in page shows the README hint under the heading, with no error", async ({ page }) => {
  page = await setUp(page);
  const login = loginPage(page);

  await page.goto(`${baseUrl}/login`);
  await expect(login.heading).toBeVisible();
  await expect(login.hint).toBeVisible();
  await expect(login.hint).toHaveText(HINT);
  await expect(login.error).toBeHidden();
  // Placed after the "Sign in" heading and before the sign-in form.
  const elements = [
    await login.heading.elementHandle(),
    await login.hint.elementHandle(),
    await login.form.elementHandle(),
  ];
  const order = await page.evaluate(([h1, hint, form]) => {
    if (!h1 || !hint || !form) return null;
    return {
      afterHeading: !!(h1.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeForm: !!(hint.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  }, elements);
  expect(order).toEqual({ afterHeading: true, beforeForm: true });
});

test("the hint stays on the page next to the error after a failed sign-in", async ({ page }) => {
  page = await setUp(page);
  const login = loginPage(page);
  const { email } = uiLogin();

  await page.goto(`${baseUrl}/login`);
  await login.email.fill(email);
  await login.password.fill(WRONG_PASSWORD);
  await login.submit.click();
  await expect(page).toHaveURL(`${baseUrl}/login?error=1`);
  await expect(login.hint).toBeVisible();
  await expect(login.hint).toHaveText(HINT);
  await expect(login.error).toBeVisible();
  await expect(login.error).toHaveText(ERROR);
});

test("the README test user the hint points to signs in from the sign-in page", async ({ page }) => {
  page = await setUp(page);
  const login = loginPage(page);
  const readmeUser = readmeTestUser();

  await page.goto(`${baseUrl}/login`);
  await expect(login.hint).toHaveText(HINT);
  await login.email.fill(readmeUser.email);
  await login.password.fill(readmeUser.password);
  await login.submit.click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${readmeUser.email}`);
});

test("journey: read the sign-in hint and sign in with the test user", async ({ page }) => {
  page = await setUp(page);
  const login = loginPage(page);
  const { email, password } = uiLogin();

  await test.step("1. open the home page and follow the Login link", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect.soft(page).toHaveURL(`${baseUrl}/login`);
    await expect.soft(login.heading).toBeVisible();
  });

  await test.step("2. read the hint on /login", async () => {
    await expect.soft(login.hint).toBeVisible();
    await expect.soft(login.hint).toHaveText(HINT);
    await expect.soft(login.error).toBeHidden();
  });

  await test.step("3. sign in with the test user", async () => {
    await login.email.fill(email);
    await login.password.fill(password);
    await login.submit.click();
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  const checkItemsPage = async () => {
    await expect.soft(page.getByRole("heading", { name: "Items" })).toBeVisible();
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByTestId("logout-button")).toBeVisible();
    await expect.soft(page.getByTestId("logout-button")).toHaveText("Sign out");
    await expect.soft(page.getByLabel("New item")).toBeVisible();
    await expect.soft(page.getByRole("button", { name: "Add item" })).toBeVisible();
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    const apiRes = await page.request.get(`${baseUrl}/api/items`);
    expect.soft(apiRes.status()).toBe(200);
    const names = ((await apiRes.json()) as Array<{ name: string }>).map((i) => i.name);
    await expect.soft(page.getByTestId("items-list").getByTestId("item")).toHaveText(names);
  };

  await test.step("4. the items page shows the signed-in user and the items", async () => {
    await checkItemsPage();
  });

  await test.step("outcome holds after a reload", async () => {
    await page.reload();
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    await checkItemsPage();
  });
});

test("journey: sign in with a wrong password and still see the hint", async ({ page }) => {
  page = await setUp(page);
  const login = loginPage(page);
  const { email } = uiLogin();

  await test.step("1. open the sign-in page", async () => {
    await page.goto(`${baseUrl}/login`);
    await expect.soft(login.hint).toBeVisible();
    await expect.soft(login.hint).toHaveText(HINT);
    await expect.soft(login.error).toBeHidden();
  });

  await test.step("2. submit the test user with a wrong password", async () => {
    await login.email.fill(email);
    await login.password.fill(WRONG_PASSWORD);
    await login.submit.click();
    await expect.soft(page).toHaveURL(`${baseUrl}/login?error=1`);
  });

  const checkFailedSignIn = async () => {
    await expect.soft(login.heading).toBeVisible();
    await expect.soft(login.hint).toBeVisible();
    await expect.soft(login.hint).toHaveText(HINT);
    await expect.soft(login.error).toBeVisible();
    await expect.soft(login.error).toHaveText(ERROR);
    await expect.soft(login.form).toBeVisible();
    await expect.soft(login.email).toBeVisible();
    await expect.soft(login.password).toBeVisible();
    await expect.soft(login.password).toHaveValue("");
    await expect.soft(login.submit).toBeVisible();
    const me = await page.request.get(`${baseUrl}/api/me`);
    expect.soft(me.status()).toBe(401);
  };

  await test.step("3. the page shows the hint and the error, and the user is not signed in", async () => {
    await checkFailedSignIn();
  });

  await test.step("outcome holds after a reload", async () => {
    await page.reload();
    await expect.soft(page).toHaveURL(`${baseUrl}/login?error=1`);
    await checkFailedSignIn();
  });
});
