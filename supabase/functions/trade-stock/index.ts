// Supabase Edge Function: trade-stock
// Set TRADE_VIEW_PASSWORD and TRADE_OWNER_USER_ID as Edge Function secrets.
// The service-role key remains server-side; never add it to the web page.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const origin = "https://jcbuildingservices1-sys.github.io";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Vary": "Origin",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
function response(status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: cors });
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return response(405, { error: "Method not allowed" });
  if (req.headers.get("origin") !== origin) return response(403, { error: "Origin not allowed" });
  const expected = Deno.env.get("TRADE_VIEW_PASSWORD") || "";
  const owner = Deno.env.get("TRADE_OWNER_USER_ID") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!expected || !owner || !url || !serviceKey) return response(503, { error: "Trade page not configured" });
  let submitted: unknown;
  try {
    if (Number(req.headers.get("content-length") || "0") > 1024) return response(413, { error: "Request too large" });
    submitted = (await req.json()).password;
  } catch {
    return response(400, { error: "Invalid request" });
  }
  if (typeof submitted !== "string" || submitted.length > 200) return response(400, { error: "Invalid password" });
  const encoder = new TextEncoder();
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  const valid = constantTimeEqual(await digest(submitted), await digest(expected));
  if (!valid) return response(401, { error: "Incorrect password" });
  const query = new URL(url + "/rest/v1/fishroom_trade_stock");
  query.searchParams.set("select", "species,quantity,trade_price,updated_at");
  query.searchParams.set("owner_user_id", "eq." + owner);
  query.searchParams.set("available", "eq.true");
  query.searchParams.set("order", "species.asc");
  try {
    const result = await fetch(query, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
      cache: "no-store",
    });
    if (!result.ok) return response(502, { error: "Unable to load trade stock" });
    const rows = await result.json();
    return response(200, { stock: rows });
  } catch {
    return response(502, { error: "Unable to load trade stock" });
  }
});
