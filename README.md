# SauceDemo — Playwright Test Suite

A small Playwright suite covering the core flows of
[SauceDemo](https://www.saucedemo.com/): login, product sorting, cart and
checkout.

Written as an **MVP / proof of concept** — a working starting point a team could
build on, not a finished enterprise framework. There is no CI, no environment
layering and no config abstraction, because none of that is needed to run these
tests reliably and readably.

- **Part 1 — written test cases:** [TEST-CASES.md](TEST-CASES.md) (27 cases)
- **Part 2 — the automation:** this project
- **Test report:** generated, not committed. Run `npm run test:all` for a full
  cross-browser run (27 cases × Chromium, Firefox and WebKit = 81) and
  `npm run report` to view it. Expect all green, with the three `TC-BUG-*`
  cases reported as *expected failures* — see
  [Injected faults and defects](#injected-faults-and-defects).

  Workers are capped at 4 in the config. Playwright's default (half the logical
  cores) launches more browsers than a typical machine can start across three
  projects at once — Firefox began timing out while *setting up the page*,
  before any test code ran. The cap removed those failures entirely; `retries: 1`
  is kept only as a backstop. See [playwright.config.ts](playwright.config.ts).

  The report is deliberately kept out of version control: it is reproducible
  output, and a committed copy is stale as soon as anyone runs the suite. On a
  project with CI it would be published as a build artefact.

---

## Getting started

Requires **Node 18+** (developed on Node 24).

```bash
npm ci                    # install dependencies
npx playwright install    # download the browser binaries (one-off, ~400MB)
```

## Running the tests

```bash
npm test                  # Chromium only - the fast feedback loop
npm run test:all          # Chromium + Firefox + WebKit
npm run test:headed       # watch it drive a real browser
npm run test:ui           # Playwright's interactive UI mode - best for debugging
npm run report            # open the HTML report from the last run
npm run typecheck         # tsc --noEmit; catches page-object typos
```

Run a single test case by its ID:

```bash
npx playwright test -g "TC-CHK-01"
```

`npm test` defaults to Chromium so the everyday loop stays fast. Cross-browser
is opt-in via `npm run test:all`.

---

## Project structure

```
fixtures/
  users.ts       Accounts, product names, checkout details, tax rate
  money.ts       Price parsing/formatting, shared by two pages and two specs
  pages.ts       Extends Playwright's `test` to inject page objects
pages/
  BasePage.ts    Shared header (page title, cart icon, cart badge)
  LoginPage.ts
  InventoryPage.ts
  CartPage.ts
  CheckoutInfoPage.ts       (step one - customer details)
  CheckoutOverviewPage.ts   (step two - order summary)
  CheckoutCompletePage.ts   (confirmation)
tests/
  login.spec.ts             TC-LOGIN-01..07
  sorting.spec.ts           TC-SORT-01..04  + TC-BUG-01 (paired with TC-SORT-02)
  cart.spec.ts              TC-CART-01..06
  checkout.spec.ts          TC-CHK-01..07   + TC-BUG-02 (paired with TC-CHK-07)
  known-defects.spec.ts     TC-BUG-03       (the one genuine defect)
```

The two `problem_user` faults live beside the feature they break, sharing a
test body with their `standard_user` control, so the contrast is visible in the
report and the assertions cannot drift apart. `known-defects.spec.ts` is
reserved for defects in the application itself.

### Page Object Model

Page objects expose locators and perform actions. They contain **no
assertions** — those live in the specs, so a failure message describes the
test's intent rather than a page object's internals.

Locators are declared as `readonly` fields but resolved lazily by Playwright,
so a page object can be constructed before the page has loaded and its locators
can never go stale the way an eagerly-found Selenium `WebElement` can.

### Fixtures vs `beforeEach`

`fixtures/pages.ts` injects the page objects — lazy (only built for tests that
name them), per-test (nothing shared between parallel tests) and typed.

Logging in is deliberately **not** a fixture. It sits in a `beforeEach` at the
top of each spec, so the precondition is visible in the file and maps one-to-one
to the *Preconditions* column in [TEST-CASES.md](TEST-CASES.md).

### Parallelism and isolation

Every test gets its own browser context — that is Playwright's default, not
something this config adds. `fullyParallel: true` only lifts the *second*
default (tests within one file running serially in one worker) so individual
tests parallelise too.

That isolation is what makes the suite safe despite every test sharing the
`standard_user` account: the session cookie and the cart both live per-context
(the cart in `localStorage`), so nothing is shared server-side and there is
nothing to race over. It is also why the burger menu's **Reset App State** is
not tested and not needed — each test starts from a clean context anyway.

---

## Locator strategy

The brief asks for more than one locator type, each used where it is the
sensible choice. Every strategy below was picked on merit:

| Strategy | Used for | Why it is right here |
|---|---|---|
| `getByRole` | Login, Continue, Finish, Cancel, Add to cart, Remove | Accessibility-first and closest to how a user identifies a control. Also handles the fact that several of these are `<input type="submit">`, not `<button>` — they still map to the ARIA `button` role, named by their `value`. |
| `getByPlaceholder` | Username, password, checkout fields | The only user-visible text on these inputs (see the note on labels below). |
| `getByTestId` | Error banner, sort `<select>`, product rows, order-summary totals | Purpose-built hooks that survive copy and styling changes. Critically, the error banner's *text* is what we assert — so the locator must not depend on it, or a wrong message would report as "element not found" instead of a clear text mismatch. |
| `filter()` + chaining | Per-product Add/Remove buttons | Scoping the row and chaining inside it beats brittle `nth-child` indexes and survives re-ordering. |
| CSS (`.error_icon`) | The invalid-field icon on the login form | Genuinely the only option — it is an `aria-hidden` SVG with no test id, no role and no text. |

### Note: `getByLabel` is not usable on this site

SauceDemo renders **no `<label>` elements and no `aria-label` attributes** at
all — checked against the live DOM on both the login and inventory pages, and
both counts are zero. So `getByLabel()` cannot be used here, and
`getByPlaceholder` is the closest user-visible equivalent.

That is a genuine accessibility defect in the application, not a gap in the
suite. Claiming to have used every locator type would have meant inventing a
use for one that cannot work.

### On per-product test IDs

Every Add/Remove button *does* carry a unique test id, so
`getByTestId('add-to-cart-sauce-labs-backpack')` would work. Row scoping was
still preferred: those ids are slugified product names, and one of them is
literally `add-to-cart-test.allthethings()-t-shirt-(red)`. Rebuilding that
string in test code would be far more brittle than asking for the row
containing the product name.

---

## Assertions

Every check uses Playwright's auto-retrying web-first assertions
(`expect(locator)...`), never a manual read-and-compare.

The sorting tests are worth calling out. Rather than hardcoding the catalogue,
they:

1. read the rendered names/prices (giving the *set* of values),
2. sort a copy in the test, applying the ordering rule independently,
3. assert the page matches with `expect(locator).toHaveText([...])`.

The array form of `toHaveText` asserts a full ordered list in one retrying
assertion. That kills two problems at once: the suite survives Sauce Labs
editing the catalogue, and the retry absorbs React's asynchronous re-render
after the dropdown changes — no wait required.

The money checks in TC-CHK-02 assert **relationships** between displayed values
(subtotal = sum of line items, tax = 8% of subtotal, total = subtotal + tax)
rather than hardcoded amounts, using `toBeCloseTo` because comparing rounded
floating-point currency with `===` is a classic false failure.

## No hard-coded waits

There is no `waitForTimeout` or `sleep` anywhere in this project.

TC-LOGIN-06 is the deliberate proof. `performance_glitch_user` blocks the
browser's main thread for ~5 seconds, and that test passes on auto-waiting
alone — with one raised assertion timeout:

```ts
await expect(page).toHaveURL(/inventory\.html/, { timeout: 20_000 });
```

**A timeout is not a sleep.** It is an upper bound that returns the instant the
condition is true — the same assertion resolves in milliseconds for
`standard_user`. A `waitForTimeout(5000)` would burn five seconds on every run
and still break the day the app got slower.

Where a one-shot read is unavoidable (`allTextContents()` does not auto-wait),
it is gated behind a retrying assertion such as
`expect(products).toHaveCount(6)` first, and the result is asserted with a
web-first assertion afterwards.

---

## Traceability

Every test title is prefixed with its case ID from
[TEST-CASES.md](TEST-CASES.md), so the mapping runs both ways — including in
the HTML report, where the ID is the first thing shown on each row.

```
TC-CHK-01 | happy path: complete an order end to end
```

Where one case runs against two accounts, the account is appended to the title,
so the pair reads as a comparison in the report:

```
TC-SORT-02 | Name (Z to A) reorders the list - standard_user
TC-BUG-01  | expected fail: Name (Z to A) reorders the list - problem_user
```

Every inverted test is prefixed `expected fail:` immediately after its ID.
Only the terminal reporter marks an expected failure distinctly (`x`) — the
HTML report, UI mode and the VS Code test explorer all show one as a plain
green tick, and those views truncate long titles from the right. Without the
marker, a tick beside "Name (Z to A) reorders the list" reads as the exact
opposite of what the test proves.

The `TC-BUG-*` tests also carry an annotation that shows up in the report —
`injected fault` for the two `problem_user` cases, `defect` for TC-BUG-03.

---

## Injected faults and defects

Three tests assert correct behaviour that the site does not deliver, so all
three currently fail. Each is marked with `test.fail()`, which inverts the pass
condition: **while the breakage exists the test fails and the run stays green.**
Rewriting them to assert the broken behaviour would cement it as expected — the
opposite of the job.

They are two different species, and conflating them would misrepresent the site.

**Injected faults — proof the suite has teeth.** `problem_user` is not a bug
report: Sauce Labs ships it deliberately broken as a practice target and will
never fix it. Each fault therefore runs from a **shared body** with its
`standard_user` counterpart — same assertions, only the account differs:

```
✓ TC-SORT-02 | Name (Z to A) reorders the list - standard_user
✗ TC-BUG-01  | expected fail: Name (Z to A) reorders the list - problem_user
```

Identical code, opposite outcomes. If those assertions were ever weakened to
the point of passing against the broken build, the `problem_user` run would go
green, `test.fail()` would invert it, and the suite would turn **red**. So the
inverted result is a check on *this suite*, not a developer's ticket: the
expected failure is the evidence that the passing test is not vacuous.

| ID | Pairs with | Injected fault |
|---|---|---|
| TC-BUG-01 | TC-SORT-02 | `problem_user`: the sort `<select>` value changes but the list never reorders and the label stays on "Name (A to Z)". Silent failure — no error shown. |
| TC-BUG-02 | TC-CHK-07 | `problem_user`: text typed into **Last Name** is written into **First Name**, leaving Last Name empty. Checkout is impossible with this account. |

**A genuine defect** — reproducible on `standard_user`, nothing injected. Here
the inversion really is a bug ticket: it turns the suite red the day it is
fixed, prompting promotion into the main suite.

| ID | Defect |
|---|---|
| TC-BUG-03 | An order can be started and completed with an empty cart, all the way to "Thank you for your order!". No rule prevents a zero-item order. Asserted at the **Checkout** button, because proving "the confirmation never appears" races the navigation — see the comment in `tests/known-defects.spec.ts`. |

### Further findings (not automated)

- **The logged-out route guard does not redirect.** Visiting `/inventory.html`
  while logged out correctly shows the login form and an error, but the address
  bar still reads `/inventory.html`. TC-LOGIN-07 therefore asserts what the
  user is *shown*, not the URL. A real app should redirect.
- **`error_user`** raises a native browser alert on sorting — *"Sorting is
  broken! This error has been reported to Backtrace."* — and skips **Last
  Name** validation at checkout entirely, walking straight through to the
  order summary with the field blank. Both confirmed by hand against the live
  site; not automated, because `problem_user` already covers the same two
  areas of the app.
- **No labels or ARIA attributes anywhere** — the site would fail an
  accessibility audit outright.

---

## Assumptions

- **8% tax** is treated as the business rule. Verified against the app
  (`$29.99` → tax `$2.40` → total `$32.39`), but I had no specification to
  confirm it is *intended*, so it is asserted as a relationship and named once
  in `fixtures/users.ts`.
- **The catalogue is treated as variable.** Product names and prices are used
  as test *inputs*, never as expected results — expected sort order is derived
  from what the page renders. The one exception is the catalogue *size*, named
  once as `PRODUCT_COUNT = 6` in `fixtures/users.ts`: a count is a genuine
  expected result (it proves sorting doesn't drop or duplicate items), and it
  is also the retrying gate that makes the one-shot reads safe. If Sauce Labs
  added a seventh product, that one constant is the only edit needed.
- **SauceDemo is a shared public demo site.** Tests do not depend on
  pre-existing server state, and each one signs in fresh.
- **Credentials in source control are acceptable here** because they are
  published on the site's own login page. On a real project they would come
  from environment variables.

## Things that were tricky

- **`getByTestId` needs configuring.** SauceDemo uses `data-test`, but
  Playwright looks for `data-testid` by default. Without
  `testIdAttribute: 'data-test'` in the config, every `getByTestId` call
  silently finds nothing — one line that breaks the entire suite.
- **No labels at all**, which ruled out `getByLabel` (see above).
- **Two products cost exactly `$15.99`.** Price-sort tests therefore assert the
  *price sequence*, never a derived product order — with a tie, the relative
  order of those two products is not defined by price and asserting it would be
  non-deterministic. This was the single easiest way to write a subtly flaky
  test on this site.
- **The 5-second block vs the 5-second default.** Playwright's default `expect`
  timeout is 5000ms and `performance_glitch_user` blocks for exactly 5000ms, so
  TC-LOGIN-06 sat right on the flake boundary until the timeout was raised.
- **Login is an `<input type="submit">`**, which still works with
  `getByRole('button')` — but it is not obvious until you look at the DOM.
- **I got a locator wrong from reading the app's source** and only caught it by
  probing the live DOM: I expected Add-to-cart buttons to share one test id;
  they are actually per-product. Worth the ten minutes it took to check before
  writing the page objects.

## What I would improve with more time

- **Skip the UI login.** The session is a single `session-username` cookie, so
  `storageState` could seed a logged-in context and cut most tests' setup to
  nothing. Left out here because it hides the login step and this is an MVP.
- **Seed cart state directly** rather than clicking Add-to-cart in every
  checkout test, for the same reason.
- **CI** (GitHub Actions) running the suite on push and publishing the HTML
  report as an artefact — deliberately excluded, since the brief says it is not
  needed.
- **Visual regression** against `visual_user`, which exists precisely to break
  layout.
- **An accessibility scan** with `@axe-core/playwright` — the missing labels
  suggest it would find plenty.
- **API-level setup** if SauceDemo had an API, to get out of the UI for
  preconditions entirely.
