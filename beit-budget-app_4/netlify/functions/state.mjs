/* The whole backend: one household's budget, kept in Netlify Blobs.
   GET  /api/state   → { ok:true, data: <the budget, or null> }
   POST /api/state   → { ok:true }   (body is the budget)
   The household code arrives as the x-household header and IS the key.
   Without the code there is nothing to read: no code, no data. */
import { getStore } from "@netlify/blobs";

const CODE = /^[A-Za-z0-9_-]{8,64}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-household",
      "access-control-allow-methods": "GET, POST, OPTIONS"
    }
  });

export default async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const url = new URL(req.url);
  const code = req.headers.get("x-household") || url.searchParams.get("hh") || "";
  if (!CODE.test(code)) {
    return json({ ok: false, error: "Missing or malformed household code." }, 400);
  }

  let store;
  try {
    store = getStore({ name: "beit-budget", consistency: "strong" });
  } catch (e) {
    return json({ ok: false, error: "Blob store unavailable: " + e.message }, 500);
  }

  try {
    if (req.method === "GET") {
      const data = await store.get(code, { type: "json" });
      return json({ ok: true, data: data ?? null });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = await req.json();
      if (!body || typeof body !== "object") return json({ ok: false, error: "Body must be an object." }, 400);
      await store.setJSON(code, body);
      return json({ ok: true, savedAt: new Date().toISOString() });
    }
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }

  return json({ ok: false, error: "Use GET or POST." }, 405);
};

export const config = { path: "/api/state" };
