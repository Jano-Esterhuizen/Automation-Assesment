import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly cartItems: Locator;
  readonly itemQuantities: Locator;
  readonly checkoutButton: Locator;
  readonly continueShoppingButton: Locator;

  constructor(page: Page) {
    super(page);

    // The cart reuses the same `inventory-item` test id as the products page.
    // No conflict, because they are different pages.
    this.cartItems = page.getByTestId('inventory-item');
    this.itemQuantities = page.getByTestId('item-quantity');

    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
    this.continueShoppingButton = page.getByRole('button', { name: 'Continue Shopping' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart.html');
  }

  cartRow(productName: string): Locator {
    return this.cartItems.filter({ hasText: productName });
  }

  removeButton(productName: string): Locator {
    return this.cartRow(productName).getByRole('button', { name: 'Remove' });
  }

  async removeItem(productName: string): Promise<void> {
    await this.removeButton(productName).click();
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }

  async continueShopping(): Promise<void> {
    await this.continueShoppingButton.click();
  }
}
