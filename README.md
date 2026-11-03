# Budget

A minimal shared monthly budget, with Supabase storage and an installable offline PWA. Plain HTML, CSS and JavaScript; no build step or third-party scripts.

## Run locally

Run `npm start` and open http://localhost:4173. Run `npm test` for the month, recurrence, money and offline replay checks.

## Hosting

GitHub Pages: deploy the `main` branch, root folder. `.nojekyll` bypasses Jekyll. All asset URLs are relative so project Pages works.

## Database

`config.js` contains only the Supabase project URL and its public publishable key. Run `supabase/setup.sql` once in the project's SQL editor. The private schema has no direct client access. The RPC functions require a random session token before reading or changing the budget. Passwords use bcrypt; session tokens are hashed at rest. Login attempts are limited. Sessions last one year and can be revoked with sign out.

The shared login is stored only in the private database. `setup.sql` seeds temporary development credentials for a fresh installation; rotate them before real use. `supabase/change-login.sql` adds a credential-change RPC that requires a valid session and the current password, hashes the new password, and expires other sessions. Never put current credentials, a service role key, or a database password in the website.

## Behavior

- Add custom categories and set their limits in the app. The overall limit is the sum of active category limits. No carryover.
- Category edits apply to the selected and later initialized months. Earlier months keep their snapshots. New months copy the closest earlier month.
- Recurring amounts post on the first. Missed months are generated on next launch, not by a scheduled background process. Editing a recurring amount after its entry has posted does not change that entry; edit it separately in Activity.
- Income is a separate informational total. It does not change budget limits or remaining amounts.
- Data is cached on each signed-in device. Changes queue offline and merge by operation over the latest server revision. Concurrent additions are preserved; concurrent edits to the same entry use the last synced edit. Sync happens on changes, reconnect, focus and every 30 seconds while open.
- Initial login requires internet. Browser storage must remain available for offline data. Sync pending changes before clearing browser data. Sign out clears this device's cached budget after syncing. Export backup downloads the current budget as JSON.
- Install on iPhone through Safari → Share → Add to Home Screen. The in-app Install link gives instructions. On Chrome, use the installation prompt or browser menu.

The required home-screen icon is a simple letter B and appears only as the device app icon; the interface has no logo or tagline.

## Interaction and updates

- Tap a category row to start an expense with that category selected. Its ellipsis opens category options, including View expenses.
- Activity shows the five most recent entries, with View all activity for the complete month.
- Only deleted expenses show an Undo action, for eight seconds. Adds and edits use a short confirmation with no Undo. Undo uses the same offline queue as other changes.
- Background sync renders only changed data and reuses existing elements, preserving focus, draft inputs, scroll position and progress bars. Press feedback and progress changes respect reduced-motion preferences.
- Settings → App updates shows the running version and provides Check for updates / Update app. Updates are checked on launch and when returning online or reopening the app. A new worker waits for the user to apply it; background checks never reload the screen. Local changes must finish syncing before an update is applied.
- Release procedure: change VERSION in updates.js and version.json, the worker cache name, all versioned imports, index asset URLs and worker FILES together.

- The app surface allows vertical touch scrolling and blocks page pinch zoom, horizontal overflow and horizontal overscroll. Gesture-event and multi-touch fallbacks cover WebKit; trackpad pinch represented as Ctrl+wheel is also suppressed. Browser/OS navigation and accessibility magnification remain controlled by the platform.

## Comfort and entry

- On phones, Add expense stays at the bottom of the Budget tab and hides while a dialog is open. Desktop keeps the heading action.
- Expense and income entry use a borderless amount. Clicking Add expense or a category synchronously focuses the decimal input, allowing the phone to present its number keyboard. The dialog follows the visible viewport when the keyboard is open.
- Unfinished entry drafts, including edits, are stored separately on the current device. They restore after reopening. Save clears the matching draft; Discard removes it without adding spending. Closing or pressing Escape keeps unfinished input.
- Settings offers Light, Dark or Auto theme, and Normal or Larger text. These preferences are per device.
- Category order is shared through Supabase and reused on the budget and category pills. Reordering changes presentation and preserves all monthly limits and history.
- Summary amounts omit zero cents; fractional amounts and transaction rows keep cent precision.

## History and future planning

History lists only saved months strictly earlier than the current calendar month. Its month controls stop at the current month. Budget can still preview and edit future months. A future preview inherits the nearest earlier category limits without creating a saved month; saving an expense or category change creates the snapshot. Existing saved future budgets are preserved. Future snapshots do not prevent catch-up initialization of missing elapsed months.

## Full-screen entry and budget setup

- Entry uses a flat full-screen canvas without a card border, backdrop blur, or button scaling. The description and confirmation actions are pinned in the visible viewport above the keyboard; only the category/amount area can scroll when space is limited.
- Settings → Build budget walks through active categories in order, allows new categories and amounts during the walkthrough or review, and shows the projected total before Save budget. Closing preserves the device-local builder draft. No financial changes are queued until final confirmation.
- Saving a builder applies category limits together in one revision-controlled update. Existing recurring amounts, names, archived flags and earlier months are preserved. Concurrently added categories remain part of the projected total.
