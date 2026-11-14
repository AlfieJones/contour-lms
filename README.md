# Run locally

Requires Node.js 24+, pnpm and Docker running. Run commands from the repo root.

```sh
pnpm install
pnpm setup:local
pnpm dev
```

Setup generates auth emails, starts Supabase, writes `.env.local` and applies migrations.

Open http://localhost:3000. Sign up with any email and confirm it using the local
inbox at http://127.0.0.1:55324. Use the same browser to open the confirmation link.

Sign up as `admin@example.com` for admin access. Other accounts are students.
Change `ADMIN_EMAIL_PATTERNS` in `.env.local` and restart the app to change admins.
Admins have teacher access and can make other teachers on the Admin page. Teachers enrol students by email on
Students. Enrolled students can book with their teachers. Teachers can also book consultations for their
verified, enrolled students from My consultations by choosing a student in the booking details. All emails go to the local inbox.

## Consultation calendar prototype

The student overview includes a COSS calendar with date and time selection, timezones,
teacher selection, booking confirmation and `.ics` downloads. Students can reschedule
scheduled consultations or book again from completed and cancelled consultations.
Rebooking copies the previous details into a new booking; rescheduling updates the
existing booking only when confirmed.

Example slots are 30 minutes, Monday–Friday, 9am–5pm in Perth, with one hour's notice
and a 90-day booking window. These availability rules currently run in the browser.
Before launch, add server-side teacher availability and atomic conflict checks,
calendar integrations, booking notifications and reminders. Calendar downloads are
static and do not sync later booking changes.

## Checks

```sh
pnpm test              # Unit tests
pnpm test:integration  # Database/API tests; keep Supabase running
pnpm ready             # Build, types, tests, lint and formatting
```

## Database changes

After editing `packages/db/src/schema.ts`:

```sh
pnpm db:generate --name your_change
pnpm db:migrate
```

## Emails

`packages/email/src/templates/` has one React Email component per template. Shared
layout, text and action components live in `packages/email/src/components/`.
Run `pnpm emails:generate` after changing auth templates, then restart Supabase.
Enrolment emails render when sent; the API delegates delivery to `@lms/email/server`.

Supabase Auth sends authentication emails. Enrolment notifications use SMTP into
Supabase's local Mailpit inbox at `127.0.0.1:55325`, visible at
http://127.0.0.1:55324. This replaces the Mailpit HTTP API call.
Restart Supabase after pulling this change to expose the SMTP port.

The email package validates `APP_URL`, `EMAIL_SMTP_URL`, `EMAIL_FROM` and
`EMAIL_FROM_NAME` through `@lms/env/email`. Local defaults are in `.env.example`;
`pnpm setup:local` writes them while preserving existing email settings.
`APP_URL` controls links in enrolment emails. Set these values for your deployed
app and SMTP server when deploying. SMTP credentials belong in `EMAIL_SMTP_URL`
(use percent encoding for special characters); use `smtps://` for implicit TLS.

Supabase is an auth email sender, not a general transactional email service.
Hosted auth templates must also be configured in the Supabase dashboard, and
production auth delivery needs custom SMTP in Supabase. Point the app's SMTP
configuration at the same provider for enrolment emails. No Supabase admin key
or email HTTP fetch is needed by the email package.

## Stop

Press Ctrl+C to stop the app, then run:

```sh
pnpm supabase:stop
```
