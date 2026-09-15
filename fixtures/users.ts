/**
 * Test data. These are demo credentials published on SauceDemo's own login
 * page; on a real project they would come from environment variables.
 */

export const PASSWORD = 'secret_sauce';

export const USERS = {
  standard: 'standard_user',
  lockedOut: 'locked_out_user',
  /** Ships deliberately broken - see the paired blocks in sorting/checkout. */
  problem: 'problem_user',
  /** Stalls the products page for ~5 seconds. TC-LOGIN-06. */
  performanceGlitch: 'performance_glitch_user',
} as const;

/**
 * Product names are test *inputs*, never expected results - the sorting tests
 * derive the expected order from whatever the page renders.
 */
export const PRODUCTS = {
  backpack: 'Sauce Labs Backpack',
  bikeLight: 'Sauce Labs Bike Light',
  boltTShirt: 'Sauce Labs Bolt T-Shirt',
  fleeceJacket: 'Sauce Labs Fleece Jacket',
} as const;

export const CHECKOUT_DETAILS = {
  firstName: 'Jano',
  lastName: 'Esterhuizen',
  postalCode: '0181',
} as const;

/** Tax rate the app applies to the subtotal. See README assumptions. */
export const TAX_RATE = 0.08;

export const PRODUCT_COUNT = 6;
