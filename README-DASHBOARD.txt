SHAHI AGRO FARM — OWNER ANALYTICS DASHBOARD

FILES
- connected-dashboard.html: owner login and business analytics dashboard (private records require Supabase authentication).
- dashboard.html: redirects to connected-dashboard.html; do not use the old browser-local report page.
- supabase-config.js: browser Project URL + publishable/anon key placeholders.
- supabase/schema.sql: shared PostgreSQL tables, row-level security and least-privilege grants.
- supabase/functions/submit-order/index.ts: validates and stores public website orders server-side.
- supabase/functions/track-event/index.ts: records page-view events server-side.
- supabase/config.toml: Edge Function configuration.
- analytics.js: page-view tracking without storing customer details locally.
- order.html + script.js: the existing order form now attempts to submit through the server-side order function when configured, while preserving the WhatsApp flow.

DASHBOARD FEATURES
- Date filters: last 7 days, last 30 days, current month, current year, all time, or custom range.
- Metrics: non-cancelled order value, estimated profit/loss, paid revenue, orders, expenses, customers and average order.
- Trend charts, product sales comparison, website visits/sessions, and operational checks.
- Order status/payment status updates, expense management, product unit costs and CSV export for Excel.

IMPORTANT
This project is prepared for online use but is not live until you connect your own Supabase project, run the schema, create/allowlist an owner account, deploy both Edge Functions, publish the files, and test on a second device. No Supabase credentials have been supplied in this package.

START HERE
Follow SUPABASE-SETUP.md in order. Never put a Supabase service-role/secret key or database password into browser files. Customer-entered Transaction IDs are always Pending until verified against the actual payment account.
