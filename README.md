# Contour mini-LMS

I built this for the technical test using [Next.js 16](https://nextjs.org/), [TypeScript](https://www.typescriptlang.org/),
and [Supabase](https://supabase.com/)/[PostgreSQL](https://www.postgresql.org/). It lets students book consultations with their teachers.

- **Auth:** [Supabase Auth](https://supabase.com/docs/guides/auth) handles signup, login, and logout. I use [supabase-js](https://github.com/supabase/supabase-js) with [@supabase/ssr](https://github.com/supabase/ssr) to keep sessions working across the browser and server using cookies.
- **Students:** book, reschedule, complete, and cancel consultations; view them in a list or calendar.
- **Teachers:** enrol students and manage weekly availability.
- **Admins:** view all consultations and manage student/teacher roles.
- **Email:** account verification, enrolment notifications, and consultation calendar invitations/updates.

## Run locally

You'll need [Node.js 24+](https://nodejs.org/), [pnpm 12.18.0](https://pnpm.io/), and [Docker](https://www.docker.com/) running.
Then run these from the repo root:

```sh
pnpm install
pnpm supabase:start
pnpm db:migrate
pnpm seed
pnpm dev
```

| Service           | URL                    |
| ----------------- | ---------------------- |
| App               | http://localhost:3000  |
| Local email inbox | http://127.0.0.1:55324 |
| Supabase Studio   | http://127.0.0.1:55323 |

- `supabase:start` sets up `apps/web/.env.local` from [.env.example](.env.example) for you. It fills in the local Supabase credentials and keeps your other settings.
- `db:migrate` sets up the database and avatar Storage policies. `seed` adds the demo accounts and bookings.
- Emails go to the local inbox above, so you don't need to set up an email provider.
- Use `pnpm supabase:status` to inspect services and `pnpm supabase:stop` to stop them. Stop the dev server with `Ctrl+C`.

## Try it

You can log straight in with any of these accounts. Their emails are already confirmed.

| Role           | Email                  | Password          |
| -------------- | ---------------------- | ----------------- |
| Student        | `student@example.com`  | `ContourDemo123!` |
| Second student | `student2@example.com` | `ContourDemo123!` |
| Teacher        | `teacher@example.com`  | `ContourDemo123!` |
| Admin          | `admin@example.com`    | `ContourDemo123!` |

Both students are already enrolled with the teacher, who's available Monday–Friday,
9am–5pm Melbourne time. There are two upcoming consultations, one completed, and one
cancelled to try things out with.

1. **Student:** book a consultation, then use its menu to reschedule, mark complete/incomplete, or cancel. Check the local inbox for calendar emails.
2. **Second student:** confirm that the first student's consultations are hidden. Use a separate browser profile or sign out between accounts.
3. **Teacher:** enrol a student under **Students** and edit **Settings → Availability**.
4. **Admin:** open **Admin → Consultations** to see all bookings, or **Admin → Users** to change student/teacher roles.
5. **New account:** sign up and open the confirmation email in the local inbox using the same browser. Enrol that email from the teacher's account before booking.

If you want to start over with the demo data, run `pnpm seed` again. It resets the
demo passwords and sample bookings, but keeps any extra accounts and bookings
you've added. Log in again afterwards.

## How it works

| Location                          | Responsibility                                                |
| --------------------------------- | ------------------------------------------------------------- |
| [apps/web](apps/web)              | Next.js App Router UI and `/api/rpc` endpoint                 |
| [apps/api](apps/api)              | oRPC procedures, validation, authorization, and booking rules |
| [packages/db](packages/db)        | Drizzle schema, SQL migrations, and seed data                 |
| [packages/ui](packages/ui)        | Shared coss UI components (Base UI + Tailwind)                |
| [packages/email](packages/email)  | React Email templates and delivery                            |
| `packages/env`, `packages/config` | Environment validation and shared TypeScript config           |

### Why I used these

- **[oRPC](https://orpc.dev/) + [Zod](https://zod.dev/):** I like having one gateway into the API. Shared auth and permission checks are enforced across the protected procedures, which makes security easier to manage. The frontend and backend also share types, and Zod checks inputs at runtime.
- **[Drizzle](https://orm.drizzle.team/):** I've used it before, and I like being able to review the SQL it generates.
- **[React Query](https://tanstack.com/query/latest):** handles fetching and caching data, so I don't have to manage that myself.
- **[React Hook Form](https://react-hook-form.com/):** keeps form values, validation errors, and submission state together.
- **[coss UI](https://coss.com/ui):** ready-made components so I could spend more time on the booking flow and less on CSS. It uses [Base UI](https://base-ui.com/) and [Tailwind CSS](https://tailwindcss.com/).
- **[React Email](https://react.email/):** lets me write emails as [React](https://react.dev/) components and reuse the layout.
- **[pnpm](https://pnpm.io/) + [Turborepo](https://turborepo.dev/):** more structure than this test needs, but I've found it useful for keeping the app, API, and shared code organised on larger teams.

### Access control

- Each protected API call checks who you're logged in as and whether you're allowed to access that record. Student and teacher roles are stored in the database.
- I didn't use RLS for the app tables because I'm used to handling permissions in the API, so I stuck with that approach here. The tables sit in a private `app` schema, and the local Supabase Data API is turned off.
- Avatars go through Supabase Storage, so those use RLS policies to make sure users can only change their own uploads.
- Admins can also do everything a teacher can. For this test, a verified email gets admin access if it matches `ADMIN_EMAIL_PATTERNS` in `apps/web/.env.local`:

```dotenv
ADMIN_EMAIL_PATTERNS='["admin@example.com"]'
```

### Booking rules

- Students can book with teachers who have enrolled them. I use the name from their profile so they don't have to enter it for every booking.
- Sessions last **30, 60, or 120 minutes**, start on the half-hour, and require **one hour's notice**, up to **90 days ahead**.
- Teachers' availability uses their browser's local timezone automatically when they save their hours. The demo teacher uses **Melbourne time**. Bookings are shown in your local timezone.
- Cancelling frees up the slot but keeps the booking in the history. You can mark a completed consultation incomplete again, but you can't reopen a cancelled one.
- Booking changes lock the teacher's schedule and check availability again before saving, so two API requests can't book the same slot.
- If an email fails, the booking still goes through. Failed emails can be retried manually.

## Checks

```sh
pnpm test   # Unit tests
pnpm ready  # Package boundaries, build, types, tests, lint, and formatting
```

- **[Vitest](https://vitest.dev/):** availability rules, environment validation, and email delivery with mocked SMTP.
- **[Node test runner](https://nodejs.org/api/test.html):** browser date and slot helpers.
- **[GitHub Actions](https://docs.github.com/en/actions):** runs these checks on pushes and pull requests. It uses placeholder environment values, so it doesn't need Supabase running or any secrets.

## What I'd do next

- Improve test coverage, especially integration and end-to-end tests.
- Sync teachers' calendars and automatically block booking slots when they already have something on.
- Try [Supabase Realtime](https://supabase.com/docs/guides/realtime) to show booking changes without refreshing.
- Add rate limiting to auth and API requests.
- Add automatic email retries and reminders.
- Tidy up the emails and check how they look in Gmail, Outlook, and on mobile.
- Before putting this into production, move admin roles into the database with a record of who changed them. Hosted Supabase, SMTP, and deployment setup would also need to be sorted out.
