# Syncaxis Leads Tracker Intelligence Mechanism

Live exhibition lead-tracking dashboard, synced across the team via Firebase Firestore.

## Deploying an update

This page (`index.html`) is served as-is via GitHub Pages — there's no build step.

1. Make your changes to `index.html`.
2. Commit and push to `main`.
3. GitHub Pages redeploys automatically within a minute or two.

Your team's actual lead data lives entirely in Firestore, not in this file, so pushing
a new version of the page never touches or risks the stored data.

## Access

Nobody can view real lead data just by visiting the page — it requires signing in with
an account granted by the Super Admin (`shubham.kale@syncaxis.com`), who manages roles
from the in-app Super Admin panel (Superadmin / Management / Sales / View Only).
