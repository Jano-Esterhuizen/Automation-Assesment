import { expect, test } from '../fixtures/pages';
import { PASSWORD, PRODUCT_COUNT, USERS } from '../fixtures/users';

/**
 * Login tests - see TEST-CASES.md, "Login".
 *
 * No `beforeEach` here on purpose: these tests are *about* the login page, so
 * each one navigates explicitly. Several also need to interact with the form
 * before submitting, which a shared login step would get in the way of.
 */
test.describe('Login', () => {
  test('TC-LOGIN-01 | standard_user logs in successfully', async ({
    page,
    loginPage,
    inventoryPage,
  }) => {
    await loginPage.signIn(USERS.standard);

    await expect(page).toHaveURL(/inventory\.html/);
    await expect(inventoryPage.pageHeading).toHaveText('Products');
    await expect(inventoryPage.products).toHaveCount(PRODUCT_COUNT);

    // toBeHidden() covers absent as well as invisible - an empty cart renders
    // no badge element at all.
    await expect(inventoryPage.cartBadge).toBeHidden();
  });

  test('TC-LOGIN-02 | locked-out user is refused with the correct message', async ({
    loginPage,
  }) => {
    await loginPage.signIn(USERS.lockedOut);

    // The credentials are valid, so this message proves the block is an
    // account-state check rather than a credential failure.
    await expect(loginPage.errorMessage).toHaveText(
      'Epic sadface: Sorry, this user has been locked out.',
    );
    // Still on the login form - the user was not let through.
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('TC-LOGIN-03 | valid username with the wrong password is refused', async ({
    loginPage,
  }) => {
    await loginPage.signIn(USERS.standard, 'definitely_not_the_password');

    // Must not reveal *which* field was wrong - asserting the exact wording is
    // how that behaviour is protected.
    await expect(loginPage.errorMessage).toHaveText(
      'Epic sadface: Username and password do not match any user in this service',
    );
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('TC-LOGIN-04 | missing username is caught before credentials are checked', async ({
    loginPage,
  }) => {
    await loginPage.goto();

    // Username left blank, password deliberately wrong. If the app checked
    // credentials first we would get the mismatch message instead - so this
    // asserts validation *order*, not just that an error appears.
    await loginPage.passwordInput.fill('definitely_not_the_password');
    await loginPage.loginButton.click();

    await expect(loginPage.errorMessage).toHaveText('Epic sadface: Username is required');
    // Both fields are flagged with the invalid-input icon.
    await expect(loginPage.fieldErrorIcons).toHaveCount(2);
  });

  test('TC-LOGIN-05 | missing password is caught', async ({ loginPage }) => {
    await loginPage.goto();

    await loginPage.usernameInput.fill(USERS.standard);
    await loginPage.loginButton.click();

    await expect(loginPage.errorMessage).toHaveText('Epic sadface: Password is required');
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('TC-LOGIN-06 | slow account still logs in, with no fixed wait', async ({
    page,
    loginPage,
    inventoryPage,
  }) => {
    await loginPage.signIn(USERS.performanceGlitch);

    // Blocks the main thread for ~5s, right on Playwright's default 5s expect
    // timeout, so the ceiling is raised. A timeout is not a sleep: it returns
    // the instant the condition is true - milliseconds, for standard_user.
    const slowPageTimeout = 20_000;
    await expect(page).toHaveURL(/inventory\.html/, { timeout: slowPageTimeout });
    await expect(inventoryPage.products).toHaveCount(PRODUCT_COUNT, {
      timeout: slowPageTimeout,
    });
  });

  test('TC-LOGIN-07 | products page cannot be reached while logged out', async ({
    page,
    loginPage,
    inventoryPage,
  }) => {
    await page.goto('/inventory.html');

    await expect(loginPage.errorMessage).toHaveText(
      "Epic sadface: You can only access '/inventory.html' when you are logged in.",
    );
    // The login form is shown and no catalogue data leaked onto the page.
    await expect(loginPage.loginButton).toBeVisible();
    await expect(inventoryPage.products).toHaveCount(0);

    // The guard is client-side and the app does not redirect, so this asserts
    // what the user is shown, not the URL. Raised as a finding in the README.
  });
});
