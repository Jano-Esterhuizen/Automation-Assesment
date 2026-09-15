import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The order confirmation page. */
export class CheckoutCompletePage extends BasePage {
  readonly confirmationHeader: Locator;
  readonly confirmationText: Locator;

  constructor(page: Page) {
    super(page);

    this.confirmationHeader = page.getByTestId('complete-header');
    this.confirmationText = page.getByTestId('complete-text');
  }
}
