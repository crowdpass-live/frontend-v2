# Expenses sheet — Apps Script

`/admin/expenses` writes to the finance Google Sheet through `expenses.gs`,
deployed as an Apps Script web app. The browser never calls the script: the
Next route `/api/admin/expenses` checks the user is an ADMIN and forwards with
a shared secret.

```
/admin/expenses → /api/admin/expenses (ADMIN + secret) → Apps Script → Sheet
```

## Sheet layout

A tab named **Expenses** (or set `SHEET_NAME`), headers in row 1:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Date | Description | Category | Amount ($) | Paid by | Method | Receipt link | Running total |

Amounts are **US dollars**. The script formats each new amount as `$#,##0.00`.

The script writes A–G. Column H belongs to the sheet: each new row copies the
formula from the row above (or picks up an `ARRAYFORMULA`), and only writes
`=SUM(D$2:Dn)` when there is nothing to copy. Change the calculation in the
sheet and the admin page shows the new figure. No deploy is needed.

Category and Method values come from `src/lib/expenses.ts`. If the sheet has
dropdown validation on C or F, keep the two lists the same.

Each row gets a note on its Date cell saying which admin entered it and when.

## Summary tab (the calculations)

The first time the admin page loads, the script creates a **Summary** tab (or
`SUMMARY_NAME`). It's all formulas over the expenses tab, and the page reads
every figure from it:

| Cells | What |
|---|---|
| A–F, one row per category + **Total** | Category · **Monthly budget** · Spent this month · Remaining · % used · Spent all time |
| H2:I13 | The last 12 months, newest first |
| K1:L4 | This month · Last month · Change · Change % |

- **Budgets:** type a monthly budget per category into column B. Leave it
  blank for no budget. The page shows each category against its budget, and
  the overall % used.
- Restyle it freely, but **don't move cells**. The script reads by position.
  Put extra work in other columns or another tab.
- To rebuild it from scratch, delete the tab and reload the page. Any budgets
  typed into it are deleted with the tab.
- The categories are fixed in the script (`CATEGORIES`) and in
  `src/lib/expenses.ts`. Keep the two lists the same. The Total row counts
  every row, including categories typed by hand outside the list.

## Deploy

1. Open the sheet → **Extensions → Apps Script**. Paste `expenses.gs` into
   `Code.gs` and save.
2. **Project Settings → Script properties**:
   - `SECRET`: a long random string (`openssl rand -hex 32`)
   - `SHEET_NAME`: only if the tab isn't called `Expenses`
   - `SUMMARY_NAME`: only if you want the calculations tab named something other than `Summary`
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me** (the script writes as you, so you need edit access)
   - Who has access: **Anyone** (anonymous access is required for a server
     call; the secret is the lock)
4. Authorize when prompted, then copy the **Web app URL** (ends in `/exec`).
5. Set on Vercel (and in `.env.local` to test locally). These are server-only,
   so **no** `NEXT_PUBLIC_` prefix:
   ```
   EXPENSES_SCRIPT_URL=https://script.google.com/macros/s/…/exec
   EXPENSES_SCRIPT_SECRET=<the same SECRET>
   ```

Opening the `/exec` URL in a browser should show
`{"ok":true,"service":"crowdpass-expenses"}`.

## Updating the script

Saving the code does **not** change a live deployment. Use **Deploy → Manage
deployments → ✏️ → Version: New version**. This keeps the same URL. A new
deployment gives a new URL, and then the env var must change too.

To rotate the secret, change `SECRET` in Script properties and
`EXPENSES_SCRIPT_SECRET` on Vercel together. Property changes take effect
without redeploying.
