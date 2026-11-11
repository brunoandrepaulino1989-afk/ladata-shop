// POST /api/checkout  {items:[{slug,q}]}  ->  {url} of a Stripe Checkout page.
// Prices, shipping and VAT are calculated here from products.json, never trusted from the browser.
// Payment methods (cards, MB WAY, Apple Pay, Google Pay, Klarna, PayPal) are the ones switched on in the Stripe dashboard.
import { SITE, COUNTRIES, quote, stripe, json } from "../lib/shop.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let q;
  try {
    const body = await req.json();
    q = quote(body.items);
  } catch (e) {
    return json({ error: e.message || "Invalid bag." }, 400);
  }
  const origin = new URL(req.url).origin || SITE;
  const line_items = q.lines.map((l) => ({
    quantity: l.qty,
    price_data: { currency: "eur", unit_amount: l.unit, product_data: { name: l.name, images: [l.image], metadata: { slug: l.slug } } },
  }));
  line_items.push({ quantity: 1, price_data: { currency: "eur", unit_amount: q.ship, product_data: { name: "Shipping · FedEx" } } });
  line_items.push({ quantity: 1, price_data: { currency: "eur", unit_amount: q.vat, product_data: { name: "VAT (23%)" } } });
  const cart = q.lines.map((l) => `${l.slug}:${l.qty}`).join(",").slice(0, 490);
  const summary = ("Ladata shop: " + q.lines.map((l) => `${l.qty}x ${l.name}`).join(", ")).slice(0, 900);
  try {
    const session = await stripe("checkout/sessions", {
      method: "POST",
      params: {
        mode: "payment",
        line_items,
        customer_creation: "always",
        billing_address_collection: "auto",
        shipping_address_collection: { allowed_countries: COUNTRIES },
        phone_number_collection: { enabled: true },
        tax_id_collection: { enabled: true },
        locale: "auto",
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/shop?bag=open`,
        metadata: { cart },
        // Shown in the Stripe dashboard (Payments list) so every payment says what was bought.
        payment_intent_data: { description: summary, metadata: { cart } },
      },
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("checkout", e);
    return json({ error: "We could not start the payment. Please try again in a moment." }, 502);
  }
};

export const config = { path: "/api/checkout" };
