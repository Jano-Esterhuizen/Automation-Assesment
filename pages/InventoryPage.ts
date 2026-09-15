import { Locator, Page } from '@playwright/test';
import { parsePrice } from '../fixtures/money';
import { BasePage } from './BasePage';

/** The four values of the sort <select>, as the app defines them. */
export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

/** The label the control displays for each option. */
export const SORT_LABELS: Record<SortOption, string> = {
  az: 'Name (A to Z)',
  za: 'Name (Z to A)',
  lohi: 'Price (low to high)',
  hilo: 'Price (high to low)',
};

export class InventoryPage extends BasePage {
  readonly products: Locator;
  readonly productNames: Locator;
  readonly productPrices: Locator;
  readonly sortDropdown: Locator;
  readonly activeSortLabel: Locator;

  constructor(page: Page) {
    super(page);

    this.products = page.getByTestId('inventory-item');
    this.productNames = page.getByTestId('inventory-item-name');
    this.productPrices = page.getByTestId('inventory-item-price');

    this.sortDropdown = page.getByTestId('product-sort-container');

    // The app renders the chosen label separately, so we can assert what the
    // user sees rather than just the <select> value.
    this.activeSortLabel = page.getByTestId('active-option');
  }

  /**
   * One product's row, found by its name.
   *
   * Every Add/Remove button also carries a per-product test id, but those are
   * slugified names - one is literally
   * `add-to-cart-test.allthethings()-t-shirt-(red)`. Asking for the row that
   * contains the name is far less brittle than rebuilding that string.
   */
  productRow(productName: string): Locator {
    return this.products.filter({ hasText: productName });
  }

  /** Role-based, scoped to the row: reads the way a user describes the action. */
  addToCartButton(productName: string): Locator {
    return this.productRow(productName).getByRole('button', { name: 'Add to cart' });
  }

  removeButton(productName: string): Locator {
    return this.productRow(productName).getByRole('button', { name: 'Remove' });
  }

  async addToCart(productName: string): Promise<void> {
    await this.addToCartButton(productName).click();
  }

  async removeFromCart(productName: string): Promise<void> {
    await this.removeButton(productName).click();
  }

  async addAllToCart(productNames: readonly string[]): Promise<void> {
    for (const name of productNames) {
      await this.addToCart(name);
    }
  }

  /** selectOption() matches the <option> value attribute, not its label. */
  async sortBy(option: SortOption): Promise<void> {
    await this.sortDropdown.selectOption(option);
  }

  /**
   * NOTE: allTextContents() is a one-shot read - it does NOT auto-wait or
   * retry. Callers must gate it behind a retrying assertion (for example
   * `expect(products).toHaveCount(PRODUCT_COUNT)`) and then assert the
   * *result* with a web-first assertion. See tests/sorting.spec.ts.
   */
  async getProductNames(): Promise<string[]> {
    return this.productNames.allTextContents();
  }

  async getProductPrices(): Promise<number[]> {
    const rendered = await this.productPrices.allTextContents();
    return rendered.map(parsePrice);
  }
}
