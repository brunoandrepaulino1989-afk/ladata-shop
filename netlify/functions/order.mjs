// GET /api/order?session_id=cs_...  ->  a short summary for the order confirmation page.
import { getSession, details, json } from "../lib/shop.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "Missing order reference." }, 400);
  try {
    const s = await getSession(id);
    if (s.status !== "complete") return json({ error: "This order was not completed." }, 404);
    const d = details(s);
    return json({ no: d.no, first: d.first, email: d.email, address: d.address, lines: d.lines, total: d.total, paid: d.paid });
  } catch (e) {
    console.error("order", e);
    return json({ error: "We could not find this order." }, 404);
  }
};

export const config = { path: "/api/order" };
