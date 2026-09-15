import { expect, test } from '../fixtures/pages';
import { PRODUCTS, USERS } from '../fixtures/users';

/** Shopping cart tests - see TEST-CASES.md, "Shopping cart". */
test.describe('Shopping cart', () => {
  // The shared precondition from the test cases: signed in as standard_user,
  // on the products page.
  test.beforeEach(async ({ loginPage, inventoryPage }) => {
    await loginPage.signIn(USERS.standard);
    await expect(inventoryPage.pageHeading).toHaveText('Products');
  });

  test('TC-CART-01 | adding an item updates the badge and the button', async ({
    inventoryPage,
  }) => {
    await inventoryPage.addToCart(PRODUCTS.backpack);

    await expect(inventoryPage.cartBadge).toHaveText('1');
    // The button flipping to "Remove" is the user's only on-page confirmation
    // that the click registered, so it is worth asserting alongside the badge.
    await expect(inventoryPage.removeButton(PRODUCTS.backpack)).toBeVisible();
    await expect(inventoryPage.addToCartButton(PRODUCTS.backpack)).toBeHidden();
  });

  test('TC-CART-02 | cart page lists exactly the items added', async ({
    page,
    inventoryPage,
    cartPage,
  }) => {
    const chosen = [PRODUCTS.backpack, PRODUCTS.bikeLight, PRODUCTS.boltTShirt];
    await inventoryPage.addAllToCart(chosen);

    await expect(inventoryPage.cartBadge).toHaveText('3');
    await inventoryPage.openCart();

    await expect(page).toHaveURL(/cart\.html/);
    await expect(cartPage.pageHeading).toHaveText('Your Cart');

    // Count first, then each item. Asserting the count catches extras that a
    // per-item loop on its own would miss. Rows are checked individually
    // rather than as an ordered list, because the cart's display order is not
    // something the test cases specify.
    await expect(cartPage.cartItems).toHaveCount(chosen.length);
    for (const product of chosen) {
      await expect(cartPage.cartRow(product)).toBeVisible();
    }
    await expect(cartPage.itemQuantities).toHaveText(['1', '1', '1']);
  });

  test('TC-CART-03 | removing from the products page decrements the badge', async ({
    inventoryPage,
  }) => {
    await inventoryPage.addAllToCart([PRODUCTS.backpack, PRODUCTS.bikeLight]);
    await expect(inventoryPage.cartBadge).toHaveText('2');

    await inventoryPage.removeFromCart(PRODUCTS.backpack);

    await expect(inventoryPage.cartBadge).toHaveText('1');
    await expect(inventoryPage.addToCartButton(PRODUCTS.backpack)).toBeVisible();
    // The other item must be untouched - removing one thing should not clear
    // the basket.
    await expect(inventoryPage.removeButton(PRODUCTS.bikeLight)).toBeVisible();
  });

  test('TC-CART-04 | removing from the cart page drops the row', async ({
    inventoryPage,
    cartPage,
  }) => {
    await inventoryPage.addAllToCart([PRODUCTS.backpack, PRODUCTS.bikeLight]);
    await inventoryPage.openCart();
    await expect(cartPage.cartItems).toHaveCount(2);

    await cartPage.removeItem(PRODUCTS.backpack);

    await expect(cartPage.cartItems).toHaveCount(1);
    await expect(cartPage.cartRow(PRODUCTS.backpack)).toHaveCount(0);
    await expect(cartPage.cartRow(PRODUCTS.bikeLight)).toBeVisible();
    await expect(cartPage.cartBadge).toHaveText('1');
  });

  test('TC-CART-05 | an empty cart shows no badge at all', async ({ inventoryPage }) => {
    await inventoryPage.addToCart(PRODUCTS.backpack);
    await expect(inventoryPage.cartBadge).toHaveText('1');

    await inventoryPage.removeFromCart(PRODUCTS.backpack);

    // The badge element is removed from the DOM entirely. A badge showing "0"
    // would be a UI defect, and a test that only checked "not 1" would pass
    // anyway - so this asserts absence, which is the real requirement.
    await expect(inventoryPage.cartBadge).toHaveCount(0);
  });

  test('TC-CART-06 | Continue Shopping preserves the cart', async ({
    page,
    inventoryPage,
    cartPage,
  }) => {
    await inventoryPage.addAllToCart([PRODUCTS.backpack, PRODUCTS.bikeLight]);
    await inventoryPage.openCart();
    await expect(cartPage.cartItems).toHaveCount(2);

    await cartPage.continueShopping();

    await expect(page).toHaveURL(/inventory\.html/);
    await expect(inventoryPage.cartBadge).toHaveText('2');
    // Both products still show as added - state survived the navigation.
    await expect(inventoryPage.removeButton(PRODUCTS.backpack)).toBeVisible();
    await expect(inventoryPage.removeButton(PRODUCTS.bikeLight)).toBeVisible();
  });
});
