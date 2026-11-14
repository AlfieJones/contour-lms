# Contour mini-LMS

## Run

Requires [Node.js](https://nodejs.org/) 24+, [pnpm](https://pnpm.io/) 12.18.0, and
[Docker](https://www.docker.com/). From the repository root:

```sh
pnpm install
pnpm supabase:start
pnpm db:migrate
pnpm seed
pnpm dev
```

App: **http://localhost:3000**

`supabase:start` starts Supabase and creates `apps/web/.env.local` from
`.env.example`, filling in the local database URL and Supabase key. Existing
settings are preserved. `db:migrate` applies the schema. `seed` creates the demo
accounts, enrolments, teacher availability, and sample consultations.

### Demo accounts

| Role           | Email                  | Password          |
| -------------- | ---------------------- | ----------------- |
| Student        | `student@example.com`  | `ContourDemo123!` |
| Second student | `student2@example.com` | `ContourDemo123!` |
| Teacher        | `teacher@example.com`  | `ContourDemo123!` |
| Admin          | `admin@example.com`    | `ContourDemo123!` |

Emails are confirmed. Both students are enrolled with the teacher. Availability
is Monday–Friday, 9am–5pm Perth time. There are two upcoming consultations, one
completed, and one cancelled.

1. As the first student, book, reschedule, mark complete/incomplete, and cancel a
   consultation. Actions are in the consultation menu.
2. As the second student, check that the first student's consultations are hidden.
3. As admin, open **Admin → Consultations** to see all consultations.
4. To test signup, create an account and confirm it at http://127.0.0.1:55324 using
   the same browser. Enrol that email from the teacher's account before booking.

Run `pnpm seed` again to restore the demo passwords and fixtures. Other accounts
and additional bookings are preserved. Log in again after reseeding.

## Implementation and choices

The required stack is [Next.js](https://nextjs.org/) 16 with the App Router,
[TypeScript](https://www.typescriptlang.org/), and
[Supabase](https://supabase.com/docs)/[PostgreSQL](https://www.postgresql.org/).

### API contract

[oRPC](https://orpc.dev/) is the contract between the frontend and backend.
[Zod](https://zod.dev/) validates inputs at runtime; TypeScript infers the client inputs and return
values from the router.

Browser calls go through `/api/rpc`. Database queries and business rules live in
backend procedures with shared authentication and role checks, plus record-level
ownership checks. This gives me one boundary to audit instead of database access
scattered across pages and Server Actions. Type safety helps during development;
validation and authorization protect requests at runtime.

### Drizzle

I chose [Drizzle](https://orm.drizzle.team/docs/overview) because I know it well. It gives me typed queries, explicit SQL
migrations, and direct access to PostgreSQL features. The
[schema](packages/db/src/schema.ts) and [migrations](packages/db/drizzle/) are in
`packages/db`.

Foreign keys and check constraints protect stored data. Lists are paginated,
calendar reads have bounded date ranges, and common queries have indexes.
Booking writes lock the teacher's schedule within a transaction and recheck
availability before saving, preventing overlapping bookings through the API.

### Authorization

Application tables use API-level authorization rather than RLS. They sit in a
private `app` schema with access revoked from browser database roles. The local
Supabase Data API is disabled. Procedures verify the user, role, and record access.
Avatar uploads use separate owner-scoped Storage RLS policies.

Admin access requires a verified email matching this server-only setting in
`apps/web/.env.local`:

```dotenv
ADMIN_EMAIL_PATTERNS='["admin@example.com"]'
```

Student and teacher roles are stored in the database. Admins also have teacher
access. The allowlist keeps assessment setup simple; in production, I would store
admin as a database role with controlled assignment and an audit trail.

### React Query and SSR

[TanStack React Query](https://tanstack.com/query/latest/docs/framework/react/overview)
handles caching, loading/error states, mutations, and
invalidation. Completion updates are optimistic and roll back on failure.

Server pages prefetch by calling the oRPC router directly, with the same validation
and authorization. This avoids an HTTP round trip to the app's own API. Independent
prefetches run in parallel.

Results hydrate React Query with matching browser query keys. A 60-second stale
time avoids immediately fetching the same data again. New calendar ranges and
interactions still fetch through the API. Server caches are request-scoped;
oRPC serialization preserves values such as `Date` across hydration.

### UI

[coss UI](https://coss.com/ui/docs) uses [Base UI](https://base-ui.com/) and
[Tailwind](https://tailwindcss.com/) with a [shadcn](https://ui.shadcn.com/)-style
approach to owning component source. I chose it for accessible components and a
consistent design without spending the assessment on custom CSS.

### Email templates

I use [React Email](https://react.email/docs/introduction) for the templates in
`packages/email`. Typed props and shared React components make them easier to
maintain than hand-written HTML strings. Auth, enrolment, and consultation emails
share a layout; application emails include HTML and plain-text versions.

The core flows work, including calendar invitations and updates. With more time,
I would refine the design and copy, and test rendering across Gmail, Outlook,
and mobile email clients.

### Monorepo

`apps/web` hosts Next.js and the HTTP endpoint. `apps/api` contains the oRPC backend.
Shared packages hold the database, UI, emails, environment validation, and
TypeScript configuration.

This layout is more than the assessment needs. I've found it works well with
larger teams: ownership is clear and dependencies are explicit.
[Turborepo](https://turborepo.dev/docs) runs tasks in dependency order, parallelizes
independent work, and caches results.

### Testing

[Vitest](https://vitest.dev/) covers availability rules, environment validation,
and email delivery with SMTP mocked. [Node's test runner](https://nodejs.org/api/test.html)
covers browser date and slot helpers.

```sh
pnpm test   # Unit tests
pnpm ready  # Build, types, tests, lint, and formatting
```

I also ran local integration checks for login/roles, student isolation, admin
visibility, booking changes, calendar emails, and repeatable seeding against real
Supabase. With more time, I would commit an automated integration suite, run it in
CI, and add browser tests for the assessment walkthrough.

### Assumptions and remaining work

- Names come from the student's saved profile rather than being re-entered for
  each booking. Students book with teachers who have enrolled them.
- Sessions last 30, 60, or 120 minutes, with half-hour starts, one hour's notice,
  and a 90-day booking window. Availability uses Perth time; bookings are stored
  as absolute timestamps and displayed in the viewer's timezone.
- Cancellation retains the record and releases the time. Completed consultations
  can be marked incomplete; cancelled consultations cannot be reopened.
- Email failures do not undo bookings. Delivery records support manual retries.
  Background retries, reminders, and external calendar checks remain future work.
- Production would also need a restricted runtime database role, hosted Supabase,
  SMTP, and deployment configuration.
