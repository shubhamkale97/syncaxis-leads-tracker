# Syncaxis Leads Tracker Intelligence Mechanism

Live exhibition lead-tracking dashboard, synced across the team via Firebase Firestore.

**Live URL:** [inquiry.syncaxis.com](https://inquiry.syncaxis.com)

## Architecture

This is a **single-page app with no build step**. The entire dashboard lives in `index.html` (served as-is via GitHub Pages). Firebase Firestore handles real-time data sync across all signed-in teammates.

### Tab Navigation UI (Bootstrap 5.3.3)

The dashboard uses **Bootstrap 5.3.3** (loaded from jsDelivr CDN) for its tab navigation:

- **Overview** — KPI cards, Pipeline Health charts (Priority, Inquiry Source, Brand Comparison), Where-the-demand-is charts (State, Application, Follow-Up Status), Area × Application Matrix
- **Follow-Up Activity** — Follow-up KPIs + follow-up list (badge shows count of leads needing attention today; turns amber when there are overdue/due-soon items)
- **All Leads** — Full lead detail table with filters and toolbar (badge shows total lead count)

Tab badges update live whenever the underlying render functions fire (`renderFollowUpKPIs` and `applyFilters` are monkey-patched to also call `updateTabBadges`). The active tab persists across page reloads via `localStorage` (`syncaxis_active_tab` key), using Bootstrap's `shown.bs.tab` event.

### Mobile Compatibility

- Sticky tab bar (sticks to top when scrolling, full-width on mobile)
- Toolbar buttons (Save Now, CSV, Excel, PDF, Import, Add Lead) scroll horizontally instead of wrapping
- Filter bar scrolls horizontally on narrow screens
- KPI grid: 6 columns desktop → 2 columns tablet → 1 column phone
- Charts: 3 columns desktop → 1 column mobile
- Leads table converts to stacked cards on mobile (existing behaviour)
- Pinch-zoom enabled (viewport `maximum-scale` removed)

### File Layout

| File | Purpose |
|------|---------|
| `index.html` | Main dashboard — all HTML, CSS, and JS inline (~390KB). Logo data URI extracted to `logo.js` to keep under 1MB GitHub Contents API limit. |
| `logo.js` | Brand logo as a `window.LOGO_DATA_URI` data URI, loaded via `<script>` tag before the main app script (~475KB). |
| `sw.js` | Service worker (network-first, cache v3). Caches `index.html`, `manifest.json`, `logo.js` for offline fallback. Bootstrap CSS/JS loaded from CDN, cached by browser HTTP cache. |
| `manifest.json` | PWA manifest — installable on Android/iOS/desktop. |
| `prospect-finder.html` | **Deprecated.** Redirects to `./` (main dashboard). Previously a standalone prospect search tool; now merged into the Leads Tracker. |
| `icons/` | PWA icons (192px, 512px, maskable, apple-touch-icon, favicons). |
| `CNAME` | Custom domain: `inquiry.syncaxis.com` |

### Bootstrap Loading

Bootstrap is loaded from jsDelivr CDN (not bundled locally):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
```
```javascript
var s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
document.head.appendChild(s);
```

The service worker is network-first, so CDN resources are fetched fresh when online and fall back to the browser's HTTP cache when offline.

## Deploying an update

1. Make your changes to `index.html` (and/or `logo.js`).
2. Commit and push to `main`.
3. GitHub Pages redeploys automatically within a minute or two.

**Note:** If `index.html` exceeds 1MB, the GitHub Contents API cannot push it. The logo data URI was extracted to `logo.js` specifically to keep `index.html` under this limit. If you need to add large inline content, consider extracting it to a separate file like `logo.js`.

Your team's actual lead data lives entirely in Firestore, not in this file, so pushing a new version of the page never touches or risks the stored data.

## Access

Nobody can view real lead data just by visiting the page — it requires signing in with an account granted by the Super Admin (`shubham.kale@syncaxis.com`), who manages roles from the in-app Super Admin panel (Superadmin / Management / Sales / View Only).

## Recent Changes (2026-08-28)

1. **Restored `index.html`** — the file had been accidentally corrupted to `INDEX_PLACEHOLDER` (17 bytes) during a failed upload. Recovered from the last good commit (`eeff507`) and rebuilt on top of that.

2. **Added Bootstrap tab navigation** — replaced the stacked single-page layout with 3 tabs (Overview, Follow-Up Activity, All Leads) using Bootstrap 5.3.3 nav-pills + tab-content.

3. **Extracted logo to `logo.js`** — the `LOGO_DATA_URI` (474KB base64 PNG) was moved out of `index.html` into `logo.js` to keep `index.html` under the 1MB GitHub API limit. Loaded via `<script src="logo.js">` before the main app script.

4. **Deprecated `prospect-finder.html`** — replaced with a redirect to the main dashboard. Previously a standalone prospect search tool with its own Firebase integration.

5. **Bumped service worker to v3** — added `logo.js` to `SHELL_FILES`, purges old v2 cache on activate.

6. **Mobile enhancements** — sticky tab bar, horizontal-scrolling toolbars/filters, responsive grids, pinch-zoom enabled.

## Recent Changes (2026-08-29)

1. **Fixed Area × Application Matrix click → All Leads tab navigation** — clicking a matrix cell applied the State/City + Application Category filters correctly, but the result was invisible because the leads table lives in the separate "All Leads" tab (`#panel-leads`) introduced with the Bootstrap tab layout. The old `scrollIntoView` on the last `.section` no longer switched tabs. Replaced it with a Bootstrap `Tab.show()` call on `#tab-leads` (same pattern used for tab restore on page load), with a `.click()` fallback if Bootstrap's JS hasn't loaded yet. The section subtitle was also updated from "Click a cell to filter the lead list below" to "Click a cell to filter the lead list in the All Leads tab" to match the new behaviour.