# SauceDemo — Test Cases

**Application under test:** https://www.saucedemo.com/
**Author:** Jano Esterhuizen
**Scope:** Part 1 of the Playwright automation assessment — written before any
automation code, so the suite traces back to these cases rather than the cases
being reverse-engineered from the code.

---

## How I chose what to cover

Nobody handed me test cases, so I explored the site and worked out what it is
actually *for*: a customer must be able to log in, find a product, put it in a
basket, and pay for it. Everything else is secondary. That gives four core
flows, and I covered each with both a positive and a negative path:

| Flow | Why it matters | Cases |
|---|---|---|
| **Login** | The gate. If it breaks, nothing else is reachable. Also where the most interesting negative cases live. | 7 |
| **Product sorting** | The only real data-manipulation feature on the site, and the easiest place for an off-by-one or string-vs-number bug to hide. | 4 |
| **Cart** | Holds state across pages. State is where e-commerce bugs cluster. | 6 |
| **Checkout** | The revenue path, and the only place with form validation and money arithmetic. | 7 |
| **Injected faults & defects** | Two `problem_user` faults used to prove the suite detects breakage, plus one real bug found on `standard_user`. | 3 |

**27 cases total.** I stopped there deliberately. This is an MVP — the aim is
meaningful coverage of every core flow, not the largest possible case count.

### Deliberately out of scope (and why)

- **Product detail pages** — reachable, but they only re-display inventory data
  already asserted on the listing page. Low marginal value for an MVP.
- **Footer social links** — they navigate off-site to Sauce Labs' own social
  accounts. Testing third-party sites is not our job, and it makes the suite
  dependent on someone else's uptime.
- **The burger menu's "Reset App State"** — a test-support feature, not a user
  feature. Worth noting that Playwright's per-test browser isolation makes it
  unnecessary (see README).
- **Cross-field / boundary validation on checkout** (e.g. numeric-only postal
  codes, name length limits) — the app has no such rules to test. Asserting
  that a rule *doesn't* exist would just document current behaviour, not verify
  a requirement.
- **`visual_user` and `error_user`** — both carry injected faults. I documented
  the `problem_user` faults because they affect core flows; the others are
  noted in the README as further findings rather than padding the suite.

### Test data

| Account | Password | Used for |
|---|---|---|
| `standard_user` | `secret_sauce` | All positive paths, and the control half of TC-SORT-02 / TC-CHK-07 |
| `locked_out_user` | `secret_sauce` | TC-LOGIN-02 |
| `performance_glitch_user` | `secret_sauce` | TC-LOGIN-06 |
| `problem_user` | `secret_sauce` | TC-BUG-01, TC-BUG-02 — a deliberately broken build, used as the negative control |

**A note on product data:** the catalogue has 6 products, and two of them cost
exactly the same (`$15.99`). Any test that sorts by price therefore asserts the
**sequence of prices**, never a derived product order — with a tie, the relative
order of those two products is not defined by price alone and asserting it would
be non-deterministic. For the same reason no test hardcodes product names or
prices; they are read from the page at run time so the suite survives Sauce Labs
editing the catalogue.

---

## Login — `tests/login.spec.ts`

| ID | Title | Preconditions | Steps | Expected result |
|---|---|---|---|---|
| **TC-LOGIN-01** | Standard user logs in successfully | On the login page, logged out | 1. Enter `standard_user`<br>2. Enter `secret_sauce`<br>3. Click **Login** | User lands on `/inventory.html`; page heading reads **Products**; 6 products are listed; cart icon is visible with no badge |
| **TC-LOGIN-02** | Locked-out user is refused | On the login page | 1. Enter `locked_out_user`<br>2. Enter `secret_sauce`<br>3. Click **Login** | Stays on the login page; error reads **"Epic sadface: Sorry, this user has been locked out."** Credentials are valid, so this proves the block is an account-state check, not a credential failure |
| **TC-LOGIN-03** | Valid username with wrong password is refused | On the login page | 1. Enter `standard_user`<br>2. Enter a password that is not `secret_sauce`<br>3. Click **Login** | Stays on the login page; error reads **"Epic sadface: Username and password do not match any user in this service"**. The message must not reveal *which* field was wrong |
| **TC-LOGIN-04** | Missing username is caught before credentials are checked | On the login page | 1. Leave username blank<br>2. Enter a deliberately invalid password<br>3. Click **Login** | Error reads **"Epic sadface: Username is required"** — *not* the credential-mismatch message, proving required-field validation runs first. An error icon appears on both input fields |
| **TC-LOGIN-05** | Missing password is caught | On the login page | 1. Enter `standard_user`<br>2. Leave password blank<br>3. Click **Login** | Error reads **"Epic sadface: Password is required"**; stays on the login page |
| **TC-LOGIN-06** | Slow account still logs in successfully | On the login page | 1. Enter `performance_glitch_user`<br>2. Enter `secret_sauce`<br>3. Click **Login** | User reaches `/inventory.html` and the product list renders. This account deliberately stalls the page for ~5 seconds; the test must pass on waiting for the *outcome*, never on a fixed sleep |
| **TC-LOGIN-07** | Protected page cannot be reached while logged out | Logged out, no session cookie | 1. Navigate directly to `/inventory.html` | The login form is shown instead of the products page, with error **"Epic sadface: You can only access '/inventory.html' when you are logged in."**; no product data is exposed.<br><br>*Note: the guard is client-side and the address bar still reads `/inventory.html` — the app does not redirect. This case therefore asserts what the user is shown, not the URL. Worth raising as a minor finding: a genuine redirect would be the expected behaviour.* |

---

## Product sorting — `tests/sorting.spec.ts`

Precondition for all: logged in as `standard_user`, on the products page.

| ID | Title | Steps | Expected result |
|---|---|---|---|
| **TC-SORT-01** | Default sort is Name (A to Z) | 1. Read the sort control and the product list without changing anything | Sort control displays **"Name (A to Z)"**; product names are in ascending alphabetical order. Verifies the *default state*, which is easy to regress and easy to forget to test |
| **TC-SORT-02** | Name (Z to A) reorders the list | 1. Select **Name (Z to A)** | Product names are in descending alphabetical order; still 6 products (sorting must not drop or duplicate items).<br><br>*Runs from a shared body with **TC-BUG-01**, which executes these exact assertions against `problem_user` — see "Injected faults" below.* |
| **TC-SORT-03** | Price (low to high) orders by numeric value | 1. Select **Price (low to high)** | Prices ascend by **numeric** value. Specifically `$9.99` must appear before `$49.99` — a string sort would get this wrong, so this case exists to catch exactly that bug |
| **TC-SORT-04** | Price (high to low) orders by numeric value | 1. Select **Price (high to low)** | Prices descend by numeric value; the highest-priced product is first |

---

## Shopping cart — `tests/cart.spec.ts`

Precondition for all: logged in as `standard_user`, on the products page.

| ID | Title | Steps | Expected result |
|---|---|---|---|
| **TC-CART-01** | Adding an item updates the badge and the button | 1. Click **Add to cart** on a product | Cart badge appears showing **1**; that product's button changes to **Remove**. The button flip is the user's only on-page confirmation, so it is asserted as well as the badge |
| **TC-CART-02** | Cart page lists exactly the items added | 1. Add 3 named products<br>2. Open the cart | Badge reads **3**; cart shows exactly 3 rows; the rows are the 3 products added — no extras, nothing missing, quantity 1 each |
| **TC-CART-03** | Removing from the products page decrements the badge | 1. Add 2 products<br>2. Click **Remove** on one of them | Badge drops to **1**; that product's button reverts to **Add to cart**; the other product stays in the cart |
| **TC-CART-04** | Removing from the cart page drops the row | 1. Add 2 products<br>2. Open the cart<br>3. Remove one row | That row disappears; 1 row remains; badge reads **1** |
| **TC-CART-05** | An empty cart shows no badge at all | 1. Add a product<br>2. Remove it again | The badge is **absent from the page**, not showing "0". This is a real distinction: a badge reading "0" would be a UI defect, and a test that only checked "not 1" would pass anyway |
| **TC-CART-06** | Continue Shopping preserves the cart | 1. Add 2 products<br>2. Open the cart<br>3. Click **Continue Shopping** | Returns to the products page; badge still reads **2**; both products still show **Remove**. Guards against state being lost on navigation |

---

## Checkout — `tests/checkout.spec.ts`

Precondition for all: logged in as `standard_user`.

| ID | Title | Steps | Expected result |
|---|---|---|---|
| **TC-CHK-01** | Happy path: complete an order end to end | 1. Add 2 products<br>2. Open the cart, click **Checkout**<br>3. Enter first name, last name, postal code<br>4. Click **Continue**<br>5. Verify the overview lists both products<br>6. Click **Finish** | Lands on the confirmation page; heading reads **"Thank you for your order!"**; the dispatch message is shown; the cart badge is cleared. This is the single most important case in the suite — it is the revenue path |
| **TC-CHK-02** | Order summary arithmetic is correct | 1. Add 2 products<br>2. Proceed to the overview page<br>3. Read the line-item prices, Item total, Tax and Total | **Item total** equals the sum of the line-item prices; **Tax** equals 8% of the item total, rounded to 2 decimals; **Total** equals item total + tax. Checked as relationships between the displayed values, so the case stays valid if prices change |
| **TC-CHK-03** | Missing first name blocks progress | 1. Reach the checkout details form<br>2. Leave **First Name** blank, fill the other two<br>3. Click **Continue** | Stays on the details page; error reads **"Error: First Name is required"** |
| **TC-CHK-04** | Missing last name blocks progress | 1. Reach the checkout details form<br>2. Leave **Last Name** blank, fill the other two<br>3. Click **Continue** | Stays on the details page; error reads **"Error: Last Name is required"** |
| **TC-CHK-05** | Missing postal code blocks progress | 1. Reach the checkout details form<br>2. Leave **Zip/Postal Code** blank, fill the other two<br>3. Click **Continue** | Stays on the details page; error reads **"Error: Postal Code is required"** |
| **TC-CHK-06** | Cancel returns to the cart with items intact | 1. Add 2 products, click **Checkout**<br>2. Click **Cancel** | Returns to the cart page; both rows still present; badge still reads **2**. Abandoning checkout must not silently empty the basket |
| **TC-CHK-07** | Typed details land in the field they were typed into | 1. Reach the checkout details form<br>2. Type a surname into **Last Name** | **Last Name** holds the typed value; **First Name** is untouched. Trivially true on a working build — which is the point: it is the control for **TC-BUG-02**, which runs these identical assertions against `problem_user`, where they must fail |

---

## Injected faults & defects

All three cases assert the **correct** behaviour, so all three currently fail —
that is the point. Each is marked as an *expected failure* with `test.fail()`,
which inverts the pass condition so the suite stays green while the breakage
exists. Rewriting them to assert the broken behaviour would cement it as
expected, which is the opposite of the job.

They are **not all the same kind of thing**, though, and the distinction matters:

### Injected faults — `problem_user`

`problem_user` is not a bug report. Sauce Labs ships that account deliberately
broken, as a practice target, and will never "fix" it. It is a known-broken
build — which makes it the control this suite is measured against.

Each fault runs from a **shared body** with its `standard_user` counterpart:
same assertions, same steps, only the account differs. That makes the pair a
controlled comparison, and it is self-checking in both directions:

- `standard_user` must **pass** → the assertions work on a correct build.
- `problem_user` must **fail** → the assertions genuinely detect the fault.

So the inverted result is a check on *this suite*, not a ticket for a developer:
if a `problem_user` run ever goes green, the fault is still there and my
assertions have stopped detecting it. **The expected failure is the evidence
that the passing test is not vacuous.**

| ID | Pairs with | Title | Steps | Expected result | Actual (injected fault) |
|---|---|---|---|---|---|
| **TC-BUG-01** | TC-SORT-02<br>`tests/sorting.spec.ts` | Sorting has no effect for `problem_user` | 1. Log in as `problem_user`<br>2. Note the product order<br>3. Select **Name (Z to A)** | Product list reorders to descending alphabetical, and the control's label reads **"Name (Z to A)"** | The `<select>` value changes but **the list does not reorder at all**, and the displayed label stays on **"Name (A to Z)"**. Silent failure — no error is shown, so a user would simply believe the catalogue is unsorted |
| **TC-BUG-02** | TC-CHK-07<br>`tests/checkout.spec.ts` | Last Name field is broken for `problem_user` | 1. Log in as `problem_user`<br>2. Add a product and reach the checkout details form<br>3. Type `Esterhuizen` into **Last Name** | **Last Name** contains `Esterhuizen`; **First Name** is unaffected | Text typed into **Last Name** is written into **First Name** instead, and Last Name stays empty. Blocks checkout entirely for this account |

### Genuine defect — `tests/known-defects.spec.ts`

Reproducible on `standard_user`, the normal working account. Nothing was
injected — this is a real gap in the application, and here the inverted test
*is* a bug ticket: it turns the suite **red the day someone fixes it**,
prompting the case to be promoted into the main suite.

| ID | Title | Steps | Expected result | Actual result (defect) |
|---|---|---|---|---|
| **TC-BUG-03** | An order can be completed with an empty cart | 1. Log in as `standard_user`<br>2. Open the cart without adding anything<br>3. Observe the **Checkout** button | Checkout cannot be started from an empty cart — the button is disabled, or the attempt is blocked with a message | The button is enabled, and the flow runs all the way to **"Thank you for your order!"** for zero items. No business rule prevents a $0 order.<br><br>*Asserted at the button rather than at the confirmation page: proving "the confirmation never appears" after a click races against the navigation, and gating on the confirmation URL would hide the fix if the defect were ever repaired. See the comment in the spec.* |

---

## Traceability

Every automated test title is prefixed with its case ID from this document, so
the mapping runs both ways:

- **Document → code:** the section heading names the spec file.
- **Code → document:** the ID in the test title and in the HTML report points
  back to the row above.

The three inverted cases (`TC-BUG-*`) also carry `expected fail:` in the title,
immediately after the ID. Only the terminal reporter marks an expected failure
distinctly — every other view shows one as a plain green tick — so the marker
makes the inversion readable at a glance wherever the suite is run.

To run a single case: `npx playwright test -g "TC-CHK-01"`
