import { Locator, Page } from '@playwright/test';
import { parsePrice } from '../fixtures/money';
import { BasePage } from './BasePage';

/** Checkout step two: the order summary shown before the order is placed. */
export class CheckoutOverviewPage extends BasePage {
  readonly lineItems: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly subtotalLabel: Locator;
  readonly taxLabel: Locator;
  readonly totalLabel: Locator;
  readonly finishButton: Locator;

  constructor(page: Page) {
    super(page);

    this.lineItems = page.getByTestId('inventory-item');
    this.itemNames = page.getByTestId('inventory-item-name');
    this.itemPrices = page.getByTestId('inventory-item-price');

    // These render as "Item total: $55.98", "Tax: $4.48", "Total: $60.46".
    this.subtotalLabel = page.getByTestId('subtotal-label');
    this.taxLabel = page.getByTestId('tax-label');
    this.totalLabel = page.getByTestId('total-label');

    this.finishButton = page.getByRole('button', { name: 'Finish' });
  }

  /** Sum of the individual line-item prices, for cross-checking the subtotal. */
  async getLineItemTotal(): Promise<number> {
    const rendered = await this.itemPrices.allTextContents();
    const sum = rendered.reduce((total, text) => total + parsePrice(text), 0);
    // Floating-point addition of currency drifts (0.1 + 0.2 !== 0.3), so round
    // back to 2 decimals before comparing against a displayed amount.
    return Number(sum.toFixed(2));
  }

  async getSubtotal(): Promise<number> {
    return this.readAmount(this.subtotalLabel);
  }

  async getTax(): Promise<number> {
    return this.readAmount(this.taxLabel);
  }

  async getTotal(): Promise<number> {
    return this.readAmount(this.totalLabel);
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  /** Pulls the money value out of a label like "Tax: $4.48". */
  private async readAmount(label: Locator): Promise<number> {
    return parsePrice(await label.innerText());
  }
}
