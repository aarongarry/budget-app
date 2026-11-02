# Budget

A minimal shared monthly budget, with Supabase storage and an installable offline PWA. Plain HTML, CSS and JavaScript; no build step or third-party scripts.

## Run locally

Run `npm start` and open http://localhost:4173. Run `npm test` for the month, recurrence, money and offline replay checks.

## Hosting

GitHub Pages: deploy the `main` branch, root folder. `.nojekyll` bypasses Jekyll. All asset URLs are relative so project Pages works.

## Database

`config.js` contains only the Supabase project URL and its public publishable key. Run `supabase/setup.sql` once in the project's SQL editor. The private schema has no direct client access. The RPC functions require a random session token before reading or changing the budget. Passwords use bcrypt; session tokens are hashed at rest. Login attempts are limited. Sessions last one year and can be revoked with sign out.

The initial shared login requested for development is admin / admin. Replace this weak password before entering real financial data. A database administrator can update `budget_private.account.password_hash` using `extensions.crypt(new_password, extensions.gen_salt('bf',12))` and revoke existing sessions. Never put a service role key or database password in the website.

## Behavior

- Add custom categories and set their limits in the app. The overall limit is the sum of active category limits. No carryover.
- Category edits apply to the selected and later initialized months. Earlier months keep their snapshots. New months copy the closest earlier month.
- Recurring amounts post on the first. Missed months are generated on next launch, not by a scheduled background process. Editing a recurring amount after its entry has posted does not change that entry; edit it separately in Activity.
- Income is a separate informational total. It does not change budget limits or remaining amounts.
- Data is cached on each signed-in device. Changes queue offline and merge by operation over the latest server revision. Concurrent additions are preserved; concurrent edits to the same entry use the last synced edit. Sync happens on changes, reconnect, focus and every 30 seconds while open.
- Initial login requires internet. Browser storage must remain available for offline data. Sync pending changes before clearing browser data. Sign out clears this device's cached budget after syncing. Export backup downloads the current budget as JSON.
- Install on iPhone through Safari → Share → Add to Home Screen. The in-app Install link gives instructions. On Chrome, use the installation prompt or browser menu.

The required home-screen icon is a simple letter B and appears only as the device app icon; the interface has no logo or tagline.
