import { Locator, Page } from '@playwright/test';

/**
 * Shared header for every page behind the login.
 *
 * Page objects expose locators and perform actions, never assertions - those
 * belong in the spec, so a failure describes the test's intent rather than a
 * page object's internals.
 */
export abstract class BasePage {
  readonly pageHeading: Locator;
  readonly cartLink: Locator;
  readonly cartBadge: Locator;

  constructor(protected readonly page: Page) {
    this.pageHeading = page.getByTestId('title');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
