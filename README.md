# Contour

A pnpm monorepo with Next.js, React, TypeScript, Tailwind CSS, COSS/Base UI,
oRPC, Zod, Supabase, and Drizzle/Postgres. Turborepo runs tasks, tsdown builds
shared packages, Oxc handles linting and formatting, and Vitest runs unit tests.

## Development

Use Node.js 24+ and pnpm 12.10.1.

```sh
pnpm install
cp .env.example .env.local
pnpm supabase:start
pnpm supabase:status
```

Docker must be running for local Supabase. Put its publishable key in the root
`.env.local`, or replace all three values with your hosted Supabase credentials.
Next.js and Drizzle both load env files from the monorepo root. `DATABASE_URL`
is the Postgres connection string for Drizzle; the Supabase URL and publishable
key are for browser authentication.

```sh
pnpm dev
```

Open the web app at the URL printed by Next.js. `/login` supports sign-up,
sign-in, and sign-out. oRPC runs at `/rpc`; session procedures verify users
through Supabase, and authenticated procedures expose the verified user and DB.

## Workspaces

- `apps/web`: Next.js pages, auth clients, session proxy, and RPC route.
- `apps/api`: oRPC router, typed client, and request handler.
- `packages/db`: Drizzle client and application schema; Supabase owns auth tables.
- `packages/env`: Zod schemas and separate client, server, and database env exports.
- `packages/ui`: shared COSS components and Tailwind theme.
- `packages/config`: shared TypeScript defaults.

Import package subpaths directly, such as `@lms/api/client`, `@lms/env/client`,
and `@lms/ui/button`. Local imports use native `#` subpaths. Shared runtime
modules are built into `dist`; `pnpm dev` rebuilds dependencies when they change.

## Checks and database

```sh
pnpm ready              # Build, typecheck, test, lint, and check formatting
pnpm check:boundaries   # Check workspace dependency boundaries
pnpm format:fix         # Format source and configuration
pnpm db:push            # Apply packages/db/src/schema.ts to the configured database
```

The application schema starts empty. The auth schema mapping is separate so
Drizzle does not manage Supabase's auth tables. Configure access control when
adding application tables; direct Drizzle connections use the database role,
while Supabase's Data API uses the user's JWT and RLS policies.

Add UI components with `pnpm dlx shadcn@latest add @coss/<component> -c packages/ui`.
