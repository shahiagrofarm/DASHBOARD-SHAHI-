# SHAHI AGRO FARM — Online Dashboard Setup

This project contains the public SHAHI AGRO FARM website, a private owner dashboard, a shared Supabase/Postgres database schema, and two server-side Edge Functions. It is designed to share data between your phone and computer after you activate the backend.

## What the finished system supports

- Private owner login using Supabase Authentication.
- Sales and paid-revenue summaries, estimated profit/loss, order count, customer count, average order, expenses, and website traffic.
- Date-range reporting, daily/monthly trend charts, product sales comparison, quick checks, and CSV export that opens in Excel.
- Order management: review customer orders, update delivery status, and mark payment status after independently verifying payment.
- Add/delete business expenses and save unit/packet production costs.
- Public order submission saved through a validated server-side function; a customer-provided Transaction ID is **never** treated as proof of payment.
- Page-view events written centrally without saving customer details to browser analytics storage.

## 1. Create the managed database

1. Sign in at <https://supabase.com/> and create a project, for example `shahi-agro-farm-dashboard`.
2. Choose a strong database password and save it privately. Choose a region close to Bangladesh if available.
3. Open **SQL Editor** in the Supabase dashboard.
4. Open `supabase/schema.sql` from this project, paste the entire SQL file into a new query, and run it.
5. The SQL creates the order, expense, product-cost, traffic-event and admin allowlist tables. It enables row-level security and does not allow public browser clients to read or create orders directly.

## 2. Create your owner login

1. In Supabase, open **Authentication → Users** and create your own user with your email and a strong password.
2. Copy that user's UUID (not the email).
3. In SQL Editor, run the following after replacing the UUID with your own user's UUID:

```sql
insert into public.admin_users (user_id)
values ('PASTE-YOUR-AUTH-USER-UUID-HERE')
on conflict (user_id) do nothing;
```

4. Do not add other users to `admin_users` unless they should have full access to customer and business records. Turn off public user sign-ups if you do not need them.

## 3. Configure the public browser key

1. In Supabase **Project Settings → API** (or the **Connect** panel), copy the Project URL and the **publishable key** (or legacy anon key).
2. Open `supabase-config.js` and replace the two placeholder strings:

```js
window.SHAHI_SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY"
};
```

3. The publishable/anon key is intended to be visible in browser code; the row-level security policies protect the database. **Never put the `service_role` key, secret key, or database password in `supabase-config.js`.**

## 4. Deploy the two Edge Functions

The public order form and page-view tracking use Edge Functions, not direct database access.

1. Install the Supabase CLI using the official instructions: <https://supabase.com/docs/guides/cli>.
2. From this project folder, log in and link this folder to your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

3. Deploy the functions:

```bash
supabase functions deploy submit-order --no-verify-jwt
supabase functions deploy track-event --no-verify-jwt
```

`supabase/config.toml` records the intended JWT setting for these public form/tracking endpoints. They are publicly callable, so they validate all important order fields on the server and use a database-backed burst limit (orders: 5 per source IP per 10 minutes; page views: 90 per source IP per 10 minutes). They use Supabase's server-side function secrets; do not copy a service-role key into website files.

## 5. Publish the website

Upload the project files (not the ZIP itself) to your existing GitHub repository or static website host. Keep `supabase-config.js` alongside `index.html`, `order.html`, and `connected-dashboard.html`. The current site links to the GitHub Pages canonical URL in its SEO metadata; use your actual public domain if it changes.

Open `connected-dashboard.html` on your phone and computer, sign in with the owner account, and check that data is shared. `dashboard.html` redirects to the login-protected dashboard.

## 6. Test before using real customer information

- Submit one fictional test order using Cash on Delivery and confirm that it appears in the dashboard.
- Submit a separate fictional online-payment test only with a test/placeholder Transaction ID; confirm it stays **Pending** and is not marked Paid.
- Change an order's status and verify it remains changed after refresh.
- Add a test expense and a product unit cost; verify the estimated profit changes.
- Open the site from a second device and confirm page-view events appear after a refresh.
- Export the report and open it in Excel.
- Verify signed-out users cannot read orders, events, expenses or product costs.
- Delete fictional test records before business use.

## Important accounting and privacy notes

- **Order value is not the same as collected cash.** The dashboard separately shows orders marked Paid.
- **Profit/loss is an estimate**: active order value minus product costs minus recorded operating expenses. Enter accurate unit costs and all operating expenses. Older orders without a saved unit cost use the current configured unit cost as a fallback.
- Online orders remain in Pending payment status until an owner checks the payment account and changes the status.
- Customer names, phone numbers, delivery addresses, and transaction IDs are stored in the database and visible to allowlisted dashboard administrators. Keep access restricted and collect only the details needed to fulfil orders.
- Website analytics counts page-view events and session IDs, not verified unique human beings. Browser extensions, blocked storage, and network failures can make analytics incomplete.
- The private page is login-protected by authentication and row-level security, but deployment, database setup, account allowlisting and end-to-end testing are still required before it is a live shared system.
