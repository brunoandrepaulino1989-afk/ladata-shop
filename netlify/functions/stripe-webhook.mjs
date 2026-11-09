// Stripe calls this after a payment. It emails the order confirmation to the customer
// and a copy of the order to Ladata.
// In Stripe: Developers > Webhooks > Add endpoint  https://ladata.shop/api/stripe-webhook
//   events: checkout.session.completed, checkout.session.async_payment_succeeded
import crypto from "node:crypto";
import { getSession, details, customerEmail, shopEmail, sendEmail, json } from "../lib/shop.mjs";

function verify(raw, header, secret) {
  const parts = Object.fromEntries(String(header || "").split(",").map((p) => p.split("=")));
  const t = parts.t, v1 = String(header || "").split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return v1.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

export default async (req) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, 500);
  const raw = await req.text();
  if (!verify(raw, req.headers.get("stripe-signature"), secret)) return json({ error: "Bad signature" }, 400);
  const event = JSON.parse(raw);
  const obj = event.data?.object || {};
  const send =
    (event.type === "checkout.session.completed" && obj.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!send) return json({ received: true });

  const d = details(await getSession(obj.id));
  const notify = process.env.ORDER_NOTIFY_TO;
  if (d.email) await sendEmail({ to: d.email, subject: `Your Ladata order ${d.no} is confirmed`, html: customerEmail(d), replyTo: notify });
  if (notify) await sendEmail({ to: notify, subject: `New order ${d.no}`, html: shopEmail(d), replyTo: d.email });
  return json({ received: true });
};

export const config = { path: "/api/stripe-webhook" };
