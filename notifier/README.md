# Syncaxis Leads Notifier

A small serverless service that emails whoever a lead gets assigned to, with
**Accept / Decline / Reschedule** links, and records their response back into the
main dashboard's Firestore data (a note, and — for Reschedule — an updated
Next Follow-up Date).

It exists because the main app ([`../index.html`](../index.html)) is a static site
with no backend of its own (see the root [README](../README.md)) — sending real
email and handling a click from someone's inbox (often before they've signed into
the app at all) both need a server. This is that server, deployed separately from
the dashboard itself.

## How it fits together

1. Someone in the app changes a lead's **Enquiry Assigned To** field.
2. `index.html`'s `notifyAssignmentChange()` calls `POST /api/notify-assignment`
   here, with the lead's details and the assignee's name, authenticated with the
   caller's Firebase ID token.
3. This service looks up the assignee's email from Firestore's `users` collection
   (server-side only — that collection is deliberately NOT readable by regular
   teammates from the app itself), creates a one-time token document in a new
   `assignmentActions` collection, and emails them via [Resend](https://resend.com)
   with three links: `/a?token=...` (Accept), `/d?token=...` (Decline),
   `/r?token=...` (Reschedule).
4. Accept is a single click. Decline and Reschedule open a small hosted form (this
   service serves plain HTML for these — no JS framework) asking for a reason
   (Reschedule also asks for the new date).
5. Submitting writes a note into the lead (same shape as a note added from inside
   the app) and, for Reschedule, updates the lead's Next Follow-up Date — using the
   Firebase Admin SDK, which writes directly and isn't subject to the app's normal
   Firestore security rules (this service IS the trusted server those rules assume
   exists).

Nothing here changes the main site's deployment (still plain GitHub Pages) — this
is an entirely separate deployment that the main site calls over HTTPS.

## One-time setup

You'll need three things this assistant can't create on your behalf: a Firebase
service account key, a Resend account with a verified sending domain, and a Vercel
project. Each involves either a credential or a billing/account decision, so these
are yours to do.

### 1. Generate a Firebase service account key

This gives full admin access to your Firestore — treat it like a password, never
commit it to git (the `.gitignore` here already excludes the usual places).

1. [Firebase Console](https://console.firebase.google.com) → your project
   (**Exhibition Lead Dashboard**) → ⚙ **Project Settings** → **Service Accounts**.
2. Click **Generate New Private Key** → confirm. A JSON file downloads.
3. Open it — you'll need three values from it in step 4 below:
   `project_id`, `client_email`, `private_key`.

### 2. Set up Resend (or another transactional email provider)

1. Create an account at [resend.com](https://resend.com) (free tier: 3,000
   emails/month, 100/day — plenty for lead assignments).
2. Add and verify the domain you want to send from (e.g. `syncaxis.com`) — Resend
   gives you DNS records (SPF/DKIM) to add wherever `syncaxis.com`'s DNS is managed.
   Mail from an unverified domain either won't send or lands in spam.
3. Create an API key (Resend dashboard → API Keys).

If you'd rather use SendGrid/Mailgun/another provider instead, only
[`lib/email.js`](lib/email.js) needs to change — everything else is provider-agnostic.

### 3. Deploy this folder to Vercel

1. Push this repo to GitHub (already done) and [import it on
   vercel.com](https://vercel.com/new) — when picking the project, set **Root
   Directory** to `notifier` (this subfolder), since the repo root is the separate
   static dashboard.
2. Before the first deploy finishes you won't know the final URL yet — that's fine,
   deploy once, note the URL Vercel gives you (e.g.
   `https://syncaxis-leads-notifier.vercel.app`), then continue to step 4.

### 4. Set environment variables (Vercel project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `project_id` from the service account JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the service account JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` from the service account JSON, pasted as-is (Vercel's env var editor handles the embedded newlines fine) |
| `RESEND_API_KEY` | from Resend |
| `EMAIL_FROM` | e.g. `Syncaxis Leads <leads@syncaxis.com>` — must be on the domain you verified in Resend |
| `ALLOWED_ORIGIN` | `https://inquiry.syncaxis.com` (CORS — who's allowed to call `/api/notify-assignment`) |
| `PUBLIC_BASE_URL` | the Vercel URL from step 3, e.g. `https://syncaxis-leads-notifier.vercel.app` (no trailing slash) — used to build the Accept/Decline/Reschedule links in the email |

Redeploy after adding these (Vercel → Deployments → ⋯ → Redeploy), since env vars
only take effect on a fresh deployment.

### 5. Point the dashboard at this service

In [`../index.html`](../index.html), find:

```js
const NOTIFIER_BASE_URL = 'PASTE_YOUR_NOTIFIER_URL_HERE';
```

and replace the placeholder with your Vercel URL from step 3 (same value as
`PUBLIC_BASE_URL` above), e.g.:

```js
const NOTIFIER_BASE_URL = 'https://syncaxis-leads-notifier.vercel.app';
```

Commit and push — assigning a lead now sends the email. Until this is filled in,
`notifyAssignmentChange()` silently no-ops, so the rest of the app is completely
unaffected.

### 6. Test it

Assign a lead (in the app) to a real teammate who has an actual login (Super Admin
→ Super Admin panel → their account must exist there with an email — a name that's
only ever been typed into "Assigned To" as free text, with no real account, can't
be emailed; see Troubleshooting). Confirm the email arrives and all three links
work end-to-end.

## Data model

New Firestore collection, written and read only by this service (never by the
client app — there's no security rule for it because there's no client access to
guard):

```
assignmentActions/{token}
  srNo, lead (snapshot of the enquiry details at assignment time)
  assignedToName, assignedToEmail
  assignedByName, assignedByUid
  createdAt, expiresAt   (30-day expiry)
  used, action (null | 'accept' | 'decline' | 'reschedule')
  reason, rescheduleDate, respondedAt
```

## Security notes

- **`/api/notify-assignment`** requires a valid Firebase ID token from a signed-in
  app user (verified server-side) — an outsider can't trigger arbitrary assignment
  emails.
- **The Accept/Decline/Reschedule links** are one-time, unauthenticated tokens —
  intentionally, so the recipient doesn't have to be logged into the app to
  respond from their phone. That means the link itself is the credential: anyone
  with it can act on that one assignment, once. The email explicitly says not to
  forward it. A token is marked `used` after the first response and can't be
  replayed; it also expires after 30 days.
- This service's Firebase credentials bypass the dashboard's normal Firestore
  security rules entirely (that's what the Admin SDK is) — keep `FIREBASE_PRIVATE_KEY`
  out of git and out of any client-visible code.

## Troubleshooting

- **"No registered account found for '<name>'"** — the "Assigned To" dropdown in
  the app is populated from `teamDirectory` (display names only), which can include
  someone who was never actually given a login. This service can only email people
  with a real account in the `users` collection (Super Admin panel → their record
  needs an `email`). Have a Super Admin add them there first.
- **Email doesn't arrive** — check the Resend dashboard's log first (bounces, spam
  rejections, unverified domain). Check Vercel's function logs for this project
  next.
- **Links say "expired" immediately** — check the server's clock is treated as UTC
  consistently; `expiresAt` is set 30 days out from `createdAt` at token-creation
  time, so this would only misfire from a bug, not normal use.
