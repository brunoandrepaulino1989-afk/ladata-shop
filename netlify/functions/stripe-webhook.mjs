// Stripe calls this after a payment. It emails the order confirmation to the customer
// and a copy of the order to Ladata.
// In Stripe: Developers > Webhooks > Add endpoint  https://ladata.shop/api/stripe-webhook
//   events: checkout.session.completed, checkout.session.async_payment_succeeded
import crypto from "node:crypto";
import { stripe, getSession, details, customerEmail, shopEmail, sendEmail, json } from "../lib/shop.mjs";

function verify(raw, header, secret) {
  const parts = Object.fromEntries(String(header || "").split(",").map((p) => p.split("=")));
  const t = parts.t, v1 = String(header || "").split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return v1.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

// Confirms the event really comes from Stripe. First by its signature (STRIPE_WEBHOOK_SECRET);
// if that is missing or does not match, by fetching the same event straight from the Stripe API
// with STRIPE_SECRET_KEY, and using Stripe's copy instead of what was posted.
async function trustedEvent(raw, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret && verify(raw, header, secret)) return JSON.parse(raw);
  let id;
  try { id = JSON.parse(raw)?.id; } catch { return null; }
  if (!/^evt_[A-Za-z0-9_]+$/.test(String(id || ""))) return null;
  try { return await stripe(`events/${id}`); } catch (e) { console.error("stripe-webhook: event lookup failed", e.message); return null; }
}

export default async (req) => {
  const raw = await req.text();
  const event = await trustedEvent(raw, req.headers.get("stripe-signature"));
  if (!event) return json({ error: "Could not confirm this event with Stripe" }, 400);
  const obj = event.data?.object || {};
  const send =
    (event.type === "checkout.session.completed" && obj.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!send) return json({ received: true });

  try {
    const session = await getSession(obj.id);
    const d = details(session);
    // Put the order number in front of the payment description in Stripe, so it matches the emails.
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (pi) {
      const items = d.lines.filter((l) => !/^(Shipping|VAT)/.test(l.name)).map((l) => `${l.qty}x ${l.name}`).join(", ");
      await stripe(`payment_intents/${pi}`, { method: "POST", params: { description: `${d.no} · ${items}`.slice(0, 900), metadata: { order: d.no } } })
        .catch((e) => console.error("stripe-webhook: could not label payment", e.message));
    }
    const notify = process.env.ORDER_NOTIFY_TO;
    if (d.email) await sendEmail({ to: d.email, subject: `Your Ladata order ${d.no} is confirmed`, html: customerEmail(d), replyTo: notify });
    if (notify) await sendEmail({ to: notify, subject: `New order ${d.no}`, html: shopEmail(d), replyTo: d.email });
  } catch (e) {
    console.error("stripe-webhook", e.message);
    return json({ error: e.message }, 500);
  }
  return json({ received: true });
};

export const config = { path: "/api/stripe-webhook" };
