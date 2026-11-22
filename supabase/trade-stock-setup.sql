-- M&L Aquatics: run in the SAME Supabase project as Fish Room.
-- IMPORTANT: owner_user_id must be set to the actual Fish Room account's auth.users UUID.
-- Martin must be created as a separate Supabase Auth user, with his own email/password.
-- Never expose the owner's fishroom_data row or service_role key to Martin.
create table if not exists public.fishroom_trade_stock (
 owner_user_id uuid not null references auth.users(id),
 species text not null,
 quantity integer not null check (quantity >= 0),
 trade_price numeric(10,2) not null check (trade_price >= 0),
 available boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(owner_user_id,species)
);
create table if not exists public.fishroom_trade_access (
 owner_user_id uuid not null references auth.users(id),
 viewer_user_id uuid not null references auth.users(id),
 primary key(owner_user_id,viewer_user_id)
);
alter table public.fishroom_trade_stock enable row level security;
alter table public.fishroom_trade_access enable row level security;
revoke all on public.fishroom_trade_stock from anon;
revoke all on public.fishroom_trade_access from anon;
grant select,insert,update,delete on public.fishroom_trade_stock to authenticated;
grant select,insert,update,delete on public.fishroom_trade_access to authenticated;
drop policy if exists "Trade stock owner can manage" on public.fishroom_trade_stock;
create policy "Trade stock owner can manage" on public.fishroom_trade_stock for all to authenticated
 using (owner_user_id=(select auth.uid())) with check (owner_user_id=(select auth.uid()));
drop policy if exists "Approved viewer can read available stock" on public.fishroom_trade_stock;
create policy "Approved viewer can read available stock" on public.fishroom_trade_stock for select to authenticated
 using (available=true and exists (select 1 from public.fishroom_trade_access a where a.owner_user_id=fishroom_trade_stock.owner_user_id and a.viewer_user_id=(select auth.uid())));
drop policy if exists "Owner manages access" on public.fishroom_trade_access;
create policy "Owner manages access" on public.fishroom_trade_access for all to authenticated
 using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));
drop policy if exists "Viewer sees own access" on public.fishroom_trade_access;
create policy "Viewer sees own access" on public.fishroom_trade_access for select to authenticated
 using(viewer_user_id=(select auth.uid()));
-- Once accounts exist, grant Martin access:
-- insert into public.fishroom_trade_access(owner_user_id,viewer_user_id) values ('OWNER_UUID','MARTIN_UUID');
-- Owner writes only manually marked available stock to fishroom_trade_stock.
