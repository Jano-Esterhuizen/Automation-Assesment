import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CheckoutDetails {
  firstName?: string;
  lastName?: string;
  postalCode?: string;
}

/** Checkout step one: the customer information form. */
export class CheckoutInfoPage extends BasePage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Placeholders again, for the same reason as the login form: no labels
    // exist. Note these fields' test ids are camelCase (`firstName`) while the
    // app's container test ids are kebab-case - an inconsistency in the app,
    // and a good reason to prefer the user-visible placeholder here.
    this.firstNameInput = page.getByPlaceholder('First Name');
    this.lastNameInput = page.getByPlaceholder('Last Name');
    this.postalCodeInput = page.getByPlaceholder('Zip/Postal Code');

    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.errorMessage = page.getByTestId('error');
  }

  /**
   * Fills only the fields provided, so the negative cases can omit one field
   * and still reuse this method.
   */
  async fillDetails({ firstName, lastName, postalCode }: CheckoutDetails): Promise<void> {
    if (firstName !== undefined) await this.firstNameInput.fill(firstName);
    if (lastName !== undefined) await this.lastNameInput.fill(lastName);
    if (postalCode !== undefined) await this.postalCodeInput.fill(postalCode);
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
