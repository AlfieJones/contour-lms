import { createContext } from "#lib/orpc.server.ts";
import { router } from "@lms/api";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});

async function handleRequest(request: Request) {
  // Cookie-authenticated RPC is same-origin and POST-only, including reads.
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }
  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: createContext,
  });

  const result = response ?? new Response("Not found", { status: 404 });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
