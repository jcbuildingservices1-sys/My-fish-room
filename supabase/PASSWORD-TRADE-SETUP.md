# Activate Martin's password-only trade page

The GitHub Pages trade portal at https://jcbuildingservices1-sys.github.io/My-fish-room/trade/ now requests a single password. No email, invitation or Supabase user account is required for Martin.

## Activate the server-side function

1. Open the existing Supabase project.
2. Open **Edge Functions** and create a new function named exactly `trade-stock`.
3. Paste the contents of `supabase/functions/trade-stock/index.ts` into the function editor and deploy it.
4. **Disable Verify JWT** for this function, because Martin does not have a Supabase account. The function independently validates the password before any stock is returned. This function must NEVER expose the service-role key to the browser.
5. In Edge Functions → Secrets set:
   - `TRADE_VIEW_PASSWORD`: a long, unique private password to give Martin in person. Do not use the owner's Fish Room password.
   - `TRADE_OWNER_USER_ID`: the exact UUID of the owner's Supabase Auth user (Authentication → Users). This must be the account used for Fish Room cloud saving.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally provided automatically to Supabase functions. Check their presence; do not put them in GitHub or in the browser.
6. The SQL in `supabase/trade-stock-setup.sql` must already have been run. It creates the stock table and RLS rules.
7. Sign in to the owner's Fish Room cloud account and open Ready to Sell. Mark the stock you want to share and press Publish trade stock to M&L.
8. Test the trade URL in a private Safari tab: wrong password must fail; correct password must return only published species, quantities and trade prices. Test after publishing no stock. Check no other Fish Room records are accessible.

## Important security limitations

- Anyone who knows the password can access the trade list. Changing the Edge Function secret revokes the old password for future requests.
- Configure request-rate limiting or bot protection at the Supabase gateway or upstream before sharing publicly. The Edge Function itself does **not** enforce per-IP rate limiting, so brute-force protection is incomplete. A long random password is essential.
- The password is submitted only in an HTTPS POST request, not in the URL or browser localStorage.
- The browser never receives a service-role key. The Edge Function uses that key only server-side to read an explicitly filtered subset of published stock.
- A separate Supabase Auth account for Martin is **not** required and the prior `fishroom_trade_access` table is unused by this password-only flow.
- A successful SQL run does not deploy this Edge Function. It must be deployed separately.

## Troubleshooting

- `404`: function not deployed or wrong function name.
- `401` from gateway: disable Verify JWT for this specific function.
- `Incorrect password`: check `TRADE_VIEW_PASSWORD`.
- `Trade page not configured`: missing secret.
- `Unable to load trade stock`: check the SQL table, secrets and owner UUID.
- CORS errors: verify that the trade page is opened on the GitHub Pages origin.
