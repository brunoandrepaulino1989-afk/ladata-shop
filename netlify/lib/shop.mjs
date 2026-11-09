// Shared server-side shop logic: catalogue, prices, Stripe REST calls and order emails.
// Prices always come from products.json here, never from the browser.
import products from "./products.json" with { type: "json" };

export const SITE = (process.env.SITE_URL || "https://ladata.shop").replace(/\/$/, "");
export const SHIP_CENTS = 990; // flat FedEx shipping, excl. VAT
export const VAT_RATE = 0.23; // added on (discounted products + shipping)
const BF_END = Date.parse("2026-12-01T23:59:59Z"); // Black Friday: 15% off until this moment

// EU-27 by default. Override with SHIP_COUNTRIES="PT,ES,FR,..." in Netlify.
const EU = "AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE";
export const COUNTRIES = (process.env.SHIP_COUNTRIES || EU).split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

export const eur = (cents) => "€" + (cents / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const orderNo = (sessionId) => "LD-" + String(sessionId).slice(-8).toUpperCase();
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Same rule as the website: 15% off, rounded to the cent, while Black Friday runs.
export function unitCents(price, now = Date.now()) {
  const p = now < BF_END ? Math.round(price * 85) / 100 : price;
  return Math.round(p * 100);
}

// Turns [{slug, q}] into priced lines. Throws a readable error for unknown or unpriced items.
export function quote(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Your bag is empty.");
  if (items.length > 30) throw new Error("Too many different items in one order.");
  const lines = items.map(({ slug, q }) => {
    const p = products[slug];
    const qty = Math.floor(Number(q));
    if (!p) throw new Error("One of the items in your bag is no longer available.");
    if (!(qty >= 1 && qty <= 20)) throw new Error(`Please choose between 1 and 20 of ${p.name}.`);
    if (p.price == null) throw new Error(`${p.name} has no price yet. Remove it from your bag to continue, and we will send you a quote by email.`);
    return { slug, name: p.name, image: `${SITE}/${p.image}`, unit: unitCents(p.price), qty };
  });
  const sub = lines.reduce((a, l) => a + l.unit * l.qty, 0);
  const vat = Math.round((sub + SHIP_CENTS) * VAT_RATE);
  return { lines, sub, ship: SHIP_CENTS, vat, total: sub + SHIP_CENTS + vat };
}

// Minimal Stripe REST client (form-encoded), so the functions need no npm packages.
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
export async function stripe(path, { method = "GET", params } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Netlify.");
  let url = "https://api.stripe.com/v1/" + path;
  const init = { method, headers: { Authorization: `Bearer ${key}` } };
  if (params && method === "GET") url += "?" + form(params).toString();
  else if (params) { init.body = form(params); init.headers["content-type"] = "application/x-www-form-urlencoded"; }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

export async function getSession(id) {
  return stripe(`checkout/sessions/${encodeURIComponent(id)}`, { params: { expand: ["line_items"] } });
}

// Reads what Stripe collected, across API versions.
export function details(s) {
  const c = s.customer_details || {};
  const sh = s.collected_information?.shipping_details || s.shipping_details || {};
  const a = sh.address || c.address || {};
  const addr = [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean).join(", ");
  return {
    no: orderNo(s.id),
    email: c.email || s.customer_email || "",
    name: sh.name || c.name || "",
    first: (sh.name || c.name || "").split(" ")[0] || "there",
    phone: c.phone || "",
    taxIds: (c.tax_ids || []).map((t) => t.value).join(", "),
    address: addr,
    lines: (s.line_items?.data || []).map((l) => ({ name: l.description, qty: l.quantity, amount: l.amount_total })),
    total: s.amount_total,
    paid: s.payment_status === "paid",
  };
}

const BRAND = `font-family:'Helvetica Neue',Arial,sans-serif;color:#111`;
export function customerEmail(d) {
  const rows = d.lines.map((l) => {
    const isQty = !/^(Shipping|VAT)/.test(l.name);
    return `<tr><td style="padding:10px 0;border-top:1px solid #e3e3e1">${esc(l.name)}${isQty ? ` × ${l.qty}` : ""}</td><td align="right" style="padding:10px 0;border-top:1px solid #e3e3e1;white-space:nowrap">${eur(l.amount)}</td></tr>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f3f0;${BRAND}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff">
<tr><td style="padding:28px 32px 0"><img src="${SITE}/img/ladata-logo.png" alt="Ladata" height="30" style="display:block;height:30px;width:auto;border:0"></td></tr>
<tr><td style="padding:24px 32px 0;font-size:24px;font-weight:700;line-height:1.15">Thank you for your order, ${esc(d.first)}.</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6">We have received your order <b>${d.no}</b> and we are getting it ready. You will get another email with the FedEx tracking link as soon as it ships.</td></tr>
<tr><td style="padding:20px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
<tr><td style="padding:12px 0;border-top:1px solid #111;font-weight:700;font-size:16px">Total paid</td><td align="right" style="padding:12px 0;border-top:1px solid #111;font-weight:700;font-size:16px">${eur(d.total)}</td></tr></table></td></tr>
<tr><td style="padding:16px 32px 0"><div style="background:#f6f1e7;padding:16px;font-size:14px;line-height:1.6"><b>Delivery to</b><br>${esc(d.name)}<br>${esc(d.address)}<br>Shipped with FedEx</div></td></tr>
<tr><td style="padding:20px 32px 0;font-size:15px;line-height:1.6">Questions about your order? Just reply to this email.</td></tr>
<tr><td style="padding:16px 32px 0"><a href="https://www.bookladata.com/appointments" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:600;font-size:14px">Try it at the club · Book a session</a></td></tr>
<tr><td style="padding:20px 32px 28px;font-size:15px;line-height:1.6">See you soon,<br>The Ladata team</td></tr>
</table>
<p style="font-size:12px;color:#6b6b6b;margin:16px 0 0;line-height:1.6">Ladata · House of Human Optimisation · Rua Tomaz Ribeiro 550, Matosinhos, Portugal<br>30-day returns · <a href="${SITE}" style="color:#6b6b6b">ladata.shop</a></p>
</td></tr></table></body></html>`;
}
export function shopEmail(d) {
  return `<div style="${BRAND};font-size:14px;line-height:1.6"><h2 style="margin:0 0 8px">New order ${d.no} · ${eur(d.total)}</h2>
<p><b>${esc(d.name)}</b><br>${esc(d.email)}${d.phone ? "<br>" + esc(d.phone) : ""}${d.taxIds ? "<br>NIF/VAT: " + esc(d.taxIds) : ""}</p>
<p><b>Ship to</b><br>${esc(d.address)}</p>
<ul>${d.lines.map((l) => `<li>${esc(l.name)} × ${l.qty}: ${eur(l.amount)}</li>`).join("")}</ul>
<p>Payment status: ${d.paid ? "paid" : "pending"}. See the payment in the Stripe dashboard.</p></div>`;
}

export async function sendEmail({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set in Netlify.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM || "Ladata <orders@ladata.shop>", to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}
