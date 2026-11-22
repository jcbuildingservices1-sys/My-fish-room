# Fish Room — final setup and verification

## Current state
The GitHub Pages Fish Room app includes the dark dashboard, 2D wall layout, stock/sales, breeding, water testing, maintenance, dated tank photos, local daily snapshot history, and existing Supabase cloud sync. The M&L trade portal and SQL policies are committed but are **not activated** until the steps below are completed. Do not call this production-complete without verifying them.

## Secure M&L setup (account owner action required)
1. Open your existing Fish Room Supabase project in the Supabase dashboard.
2. In SQL Editor, review and run `supabase/trade-stock-setup.sql`. It creates `fishroom_trade_stock` and `fishroom_trade_access` with RLS policies.
3. In Supabase Authentication, invite or create a **separate** user for Martin, using his own email address and a private password. Do **not** share the owner's login. Martin can reset his own password via Supabase Auth account recovery.
4. Find the actual UUIDs for the owner and Martin in Supabase Authentication → Users.
5. In SQL Editor, run:
   ```sql
   insert into public.fishroom_trade_access(owner_user_id,viewer_user_id)
   values ('REPLACE_WITH_OWNER_UUID','REPLACE_WITH_MARTIN_UUID')
   on conflict do nothing;
   ```
6. In the owner's Fish Room app, sign into cloud saving and use **Ready to sell → Publish trade stock to M&L**.
7. Martin opens `/trade/`, enters the SAME Supabase project URL and publishable (public) key as the owner's cloud setup, and signs in using his **own** credentials. He sees only explicitly published available stock, quantities and trade prices.
8. Verify with Martin's account that reading `fishroom_data` is forbidden by the existing project's RLS policy. Do not enable the portal if that test fails. Never put a service-role key in either website.

## Mandatory verification on the actual iPhone
- Check dark dashboard appearance against the approved mockup.
- Open all 18 tanks and all three wall views; edit a tank, drag/resize, test dividers, and confirm the saved layout survives reload.
- Add/delete a photo and confirm it survives reload and export.
- Add a dated water change, water test, breeding entry and maintenance entry. Check status colours and timeline.
- Record a fish sale and verify saleable quantity decreases.
- Export a backup; import into a test browser and confirm all data remains intact.
- Make a local change, confirm Supabase cloud sync is ON, reload and confirm cloud data. Do not replace existing cloud records with empty local data.
- Confirm the 30-day snapshots appear only after a saved change and download/restore one.
- Test Martin's account can read only manually published available trade stock and cannot change records.
- Check Safari iPhone Home Screen mode and small-screen navigation.

## Backup caveats
Daily snapshots are part of the Fish Room JSON data and may be uploaded with cloud sync; they are not separate database point-in-time backups. A single lost/overwritten remote row could still lose those snapshots. Download JSON exports to an independent location regularly. Embedded photos can increase JSON size and may exceed storage limits on some devices.

## Security caveat
The owner's in-browser unlock screen is a convenience lock, not strong server-side authentication. Do not treat it as protection against someone who can inspect the public source code. Supabase authentication and correctly configured row-level security protect private cloud records.
