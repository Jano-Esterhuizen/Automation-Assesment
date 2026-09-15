# SauceDemo — Playwright Test Suite

A small Playwright suite over the main flows of
[SauceDemo](https://www.saucedemo.com/): login, sorting, cart and checkout.

It's an MVP — a working starting point, not a finished framework. No CI, no
environment layering, no config abstraction, because none of that is needed to
run these tests reliably.

- Written test cases: [TEST-CASES.md](TEST-CASES.md) (27 cases)
- The automation: this project

## Getting started

Node 18+ (developed on Node 24).

```bash
npm ci
npx playwright install    # browser binaries, one-off, ~400MB
```

```bash
npm test                  # Chromium only - the fast loop
npm run test:all          # Chromium + Firefox + WebKit (27 x 3 = 81)
npm run test:headed       # watch it drive a real browser
npm run test:ui           # UI mode - best for debugging
npm run report            # open the HTML report from the last run
npm run typecheck         # tsc --noEmit
```

Single case by ID: `npx playwright test -g "TC-CHK-01"`.

Expect all green. The three `TC-BUG-*` cases show as *expected failures* —
see [Injected faults and defects](#injected-faults-and-defects).

The HTML report isn't committed. It's reproducible output and goes stale the
moment anyone runs the suite; with CI it'd be a build artefact.

Workers are capped at 4. Playwright's default (half your cores) launches more
browsers than my machine could start across three projects at once — Firefox
was timing out during page setup, before any test code ran. The cap fixed it;
`retries: 1` is just a backstop.

---

## Structure

```
fixtures/
  users.ts       Accounts, product names, checkout details, tax rate
  money.ts       Price parsing/formatting
  pages.ts       Extends Playwright's `test` to inject page objects
pages/
  BasePage.ts    Shared header (title, cart icon, cart badge)
  LoginPage.ts
  InventoryPage.ts
  CartPage.ts
  CheckoutInfoPage.ts       (step one - customer details)
  CheckoutOverviewPage.ts   (step two - order summary)
  CheckoutCompletePage.ts   (confirmation)
tests/
  login.spec.ts             TC-LOGIN-01..07
  sorting.spec.ts           TC-SORT-01..04  + TC-BUG-01 (pairs with TC-SORT-02)
  cart.spec.ts              TC-CART-01..06
  checkout.spec.ts          TC-CHK-01..07   + TC-BUG-02 (pairs with TC-CHK-07)
  known-defects.spec.ts     TC-BUG-03       (the one real defect)
```

The two `problem_user` faults sit next to the feature they break and share a
test body with their `standard_user` control, so the assertions can't drift
apart. `known-defects.spec.ts` is for defects in the app itself.

**Page objects** expose locators and perform actions, but hold no assertions —
those stay in the specs so failure messages describe the test's intent. Locators
are `readonly` fields resolved lazily by Playwright, so they can't go stale the
way an eagerly-found Selenium `WebElement` can.

**Fixtures vs `beforeEach`.** `fixtures/pages.ts` injects the page objects:
lazy, per-test, typed. Logging in is deliberately *not* a fixture — it's a
`beforeEach` at the top of each spec so the precondition is visible in the file
and maps to the Preconditions column in [TEST-CASES.md](TEST-CASES.md).

**Isolation.** Every test gets its own browser context (Playwright's default).
`fullyParallel: true` only lifts the second default, so tests within a file
parallelise too. That's what makes sharing the `standard_user` account safe —
session cookie and cart both live per-context, so there's nothing to race over.
It's also why the burger menu's Reset App State isn't tested: every test already
starts clean.

---

## Locators

The brief asks for more than one locator type. Each one here was picked because
it's the right fit, not to tick the box:

| Strategy | Used for | Why |
|---|---|---|
| `getByRole` | Login, Continue, Finish, Cancel, Add to cart, Remove | Closest to how a user identifies a control. Also handles the fact that several are `<input type="submit">` rather than `<button>` — same ARIA role, named by their `value`. |
| `getByPlaceholder` | Username, password, checkout fields | The only user-visible text on these inputs. |
| `getByTestId` | Error banner, sort `<select>`, product rows, order totals | Survives copy and styling changes. Matters most for the error banner: its *text* is what we assert, so the locator mustn't depend on it or a wrong message reports as "element not found". |
| `filter()` + chaining | Per-product Add/Remove buttons | Scoping the row beats brittle `nth-child` indexes and survives re-ordering. |
| CSS (`.error_icon`) | Invalid-field icon on login | The only option — `aria-hidden` SVG, no test id, no role, no text. |

`getByLabel` isn't usable here. SauceDemo renders no `<label>` elements and no
`aria-label` attributes at all (checked against the live DOM — both counts are
zero), so `getByPlaceholder` is the nearest user-visible equivalent. That's an
accessibility defect in the app, not a gap in the suite.

Add/Remove buttons do each carry a unique test id, so
`getByTestId('add-to-cart-sauce-labs-backpack')` would work. I preferred row
scoping because those ids are slugified product names and one of them is
`add-to-cart-test.allthethings()-t-shirt-(red)` — rebuilding that string in
test code is worse than asking for the row containing the product name.

---

## Assertions

Everything uses auto-retrying web-first assertions (`expect(locator)...`), never
a manual read-and-compare.

The sorting tests don't hardcode the catalogue. They read the rendered
names/prices, sort a copy in the test applying the ordering rule independently,
then assert with `expect(locator).toHaveText([...])`. The array form checks a
full ordered list in one retrying assertion, which both survives Sauce Labs
editing the catalogue and absorbs React's async re-render after the dropdown
changes.

The money checks in TC-CHK-02 assert relationships between displayed values
(subtotal = sum of line items, tax = 8% of subtotal, total = subtotal + tax)
rather than fixed amounts, with `toBeCloseTo` — comparing rounded currency
floats with `===` is a classic false failure.

**No hard-coded waits.** There's no `waitForTimeout` or `sleep` anywhere.
TC-LOGIN-06 is the proof: `performance_glitch_user` blocks the main thread for
~5 seconds and that test passes on auto-waiting alone, with one raised timeout:

```ts
await expect(page).toHaveURL(/inventory\.html/, { timeout: 20_000 });
```

A timeout isn't a sleep — it returns the instant the condition is true, and the
same assertion resolves in milliseconds for `standard_user`. Where a one-shot
read is unavoidable (`allTextContents()` doesn't auto-wait) it's gated behind a
retrying `expect(products).toHaveCount(6)` first.

---

## Traceability

Every test title starts with its case ID from [TEST-CASES.md](TEST-CASES.md),
so the mapping works both ways, including in the HTML report:

```
TC-CHK-01 | happy path: complete an order end to end
```

Where a case runs against two accounts the account is appended, so the pair
reads as a comparison:

```
TC-SORT-02 | Name (Z to A) reorders the list - standard_user
TC-BUG-01  | expected fail: Name (Z to A) reorders the list - problem_user
```

Inverted tests are prefixed `expected fail:` right after the ID. Only the
terminal reporter marks an expected failure distinctly (`x`) — the HTML report,
UI mode and the VS Code explorer all show a plain green tick, and they truncate
long titles from the right. Without the marker, a tick next to "Name (Z to A)
reorders the list" reads as the opposite of what the test proves.

The `TC-BUG-*` tests also carry an annotation visible in the report:
`injected fault` for the `problem_user` cases, `defect` for TC-BUG-03.

---

## Injected faults and defects

Three tests assert correct behaviour the site doesn't deliver, so all three
fail. Each is marked `test.fail()`, which inverts the pass condition: while the
breakage exists the test fails and the run stays green. Rewriting them to assert
the broken behaviour would cement it as expected.

They're two different things, though.

**Injected faults.** `problem_user` isn't a bug report — Sauce Labs ships it
broken on purpose as a practice target and will never fix it. Each fault runs
from a shared body with its `standard_user` counterpart, same assertions, only
the account differs:

```
✓ TC-SORT-02 | Name (Z to A) reorders the list - standard_user
✗ TC-BUG-01  | expected fail: Name (Z to A) reorders the list - problem_user
```

Identical code, opposite outcomes. If those assertions were ever weakened
enough to pass against the broken build, the `problem_user` run would go green,
`test.fail()` would invert it, and the suite would turn red. So the inverted
result is really a check on this suite rather than a developer's ticket.

| ID | Pairs with | Injected fault |
|---|---|---|
| TC-BUG-01 | TC-SORT-02 | The sort `<select>` value changes but the list never reorders and the label stays on "Name (A to Z)". No error shown. |
| TC-BUG-02 | TC-CHK-07 | Text typed into Last Name is written into First Name, leaving Last Name empty. Checkout is impossible with this account. |

**A genuine defect**, reproducible on `standard_user`. Here the inversion really
is a bug ticket — it turns the suite red the day it's fixed, which is the prompt
to promote it into the main suite.

| ID | Defect |
|---|---|
| TC-BUG-03 | An order can be started and completed with an empty cart, right through to "Thank you for your order!". Nothing prevents a zero-item order. Asserted at the Checkout button, because proving "the confirmation never appears" races the navigation — see the comment in `tests/known-defects.spec.ts`. |

Found by hand, not automated:

- **The logged-out route guard doesn't redirect.** Visiting `/inventory.html`
  while logged out shows the login form and an error, but the address bar still
  reads `/inventory.html`. TC-LOGIN-07 asserts what the user is *shown*, not the
  URL. A real app should redirect.
- **`error_user`** throws a native alert on sorting (*"Sorting is broken! This
  error has been reported to Backtrace."*) and skips Last Name validation at
  checkout entirely, walking through to the order summary with the field blank.
  Both confirmed against the live site; not automated because `problem_user`
  already covers those two areas.
- **No labels or ARIA attributes anywhere** — the site would fail an
  accessibility audit outright.

---

## Assumptions

- **8% tax** is the business rule. Verified against the app (`$29.99` → `$2.40`
  → `$32.39`), but with no spec to confirm it's *intended*, so it's asserted as
  a relationship and named once in `fixtures/users.ts`.
- **The catalogue is variable.** Product names and prices are inputs, never
  expected results — expected sort order is derived from what the page renders.
  The exception is catalogue *size*, `PRODUCT_COUNT = 6`: a count is a real
  expected result (it proves sorting doesn't drop or duplicate items) and it's
  the retrying gate that makes the one-shot reads safe. A seventh product would
  mean editing that one constant.
- **SauceDemo is a shared public demo.** No test depends on pre-existing server
  state; each signs in fresh.
- **Credentials in source control are fine here** — they're printed on the login
  page. On a real project they'd come from env vars.

## Things that were tricky

- **`getByTestId` needs configuring.** SauceDemo uses `data-test`; Playwright
  looks for `data-testid`. Without `testIdAttribute: 'data-test'` in the config
  every `getByTestId` call silently finds nothing. One line, entire suite.
- **No labels at all**, which ruled out `getByLabel`.
- **Two products cost exactly `$15.99`.** So the price-sort tests assert the
  price *sequence*, never a derived product order — with a tie, the relative
  order of those two isn't defined by price and asserting it would be flaky.
  Easily the simplest way to write a subtly broken test on this site.
- **The 5-second block vs the 5-second default.** Playwright's default `expect`
  timeout is 5000ms and `performance_glitch_user` blocks for exactly 5000ms, so
  TC-LOGIN-06 sat right on the flake boundary until I raised it.
- **Login is an `<input type="submit">`.** Still works with
  `getByRole('button')`, but not obvious until you look at the DOM.
- **I got a locator wrong by reading the app's source** and only caught it by
  probing the live DOM — I assumed Add-to-cart buttons shared one test id, but
  they're per-product. Worth the ten minutes to check before writing the page
  objects.

## What I'd improve with more time

- **Skip the UI login.** The session is a single `session-username` cookie, so
  `storageState` could seed a logged-in context and cut most setup to nothing.
  Left out because it hides the login step and this is an MVP.
- **Seed cart state directly** instead of clicking Add-to-cart in every checkout
  test, same reasoning.
- **CI** (GitHub Actions) on push, publishing the HTML report as an artefact.
- **Visual regression** against `visual_user`, which exists to break layout.
- **An accessibility scan** with `@axe-core/playwright` — given the missing
  labels it'd find plenty.
- **API-level setup** if SauceDemo had an API, to get out of the UI for
  preconditions entirely.
