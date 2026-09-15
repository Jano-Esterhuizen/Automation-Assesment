import { Locator, Page } from '@playwright/test';
import { PASSWORD } from '../fixtures/users';

/** Not a BasePage: the header does not exist until you are logged in. */
export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly fieldErrorIcons: Locator;

  constructor(private readonly page: Page) {
    // The site renders no <label> and no aria-label, so getByLabel() is
    // impossible; the placeholder is the closest user-visible equivalent.
    this.usernameInput = page.getByPlaceholder('Username');
    this.passwordInput = page.getByPlaceholder('Password');

    // An <input type="submit">, not a <button> - but it still maps to the
    // ARIA button role, named by its `value`.
    this.loginButton = page.getByRole('button', { name: 'Login' });

    // Test id, not text: the message text is what we assert on, so the locator
    // must not depend on it.
    this.errorMessage = page.getByTestId('error');

    // The only CSS locator here: an aria-hidden SVG with no id, role or text.
    this.fieldErrorIcons = page.locator('.error_icon');
  }

  async goto(): Promise<void> {
    // Relative path - the host comes from `baseURL`.
    await this.page.goto('/');
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** Go to the login page and sign in, in one step. */
  async signIn(username: string, password = PASSWORD): Promise<void> {
    await this.goto();
    await this.login(username, password);
  }
}
