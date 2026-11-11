// Shared server-side shop logic: catalogue, prices, Stripe REST calls and order emails.
// Prices always come from products.json here, never from the browser.
import products from "./products.json" with { type: "json" };

export const SITE = (process.env.SITE_URL || process.env.URL || "https://ladata.shop").replace(/\/$/, "");
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
    if (p.out) throw new Error(`${p.name} is sold out. Remove it from your bag to continue.`);
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
const BY_NAME = Object.fromEntries(Object.values(products).map((p) => [p.name, p]));
export function details(s) {
  const c = s.customer_details || {};
  const sh = s.collected_information?.shipping_details || s.shipping_details || {};
  const a = sh.address || c.address || {};
  const line2 = a.line2 && a.line2.trim() !== String(a.line1 || "").trim() ? a.line2 : "";
  const addrLines = [a.line1, line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean);
  const addr = addrLines.join(", ");
  // Greet by the name the customer typed, unless it looks like a street (some people type the address there).
  const pick = [c.name, sh.name].find((n) => n && !/^(rua|av\.?|avenida|travessa|largo|praça|street|st\.|via|calle)\b/i.test(n.trim())) || "";
  const lines = (s.line_items?.data || []).map((l) => ({ name: l.description, qty: l.quantity, amount: l.amount_total }));
  const items = lines.filter((l) => !/^(Shipping|VAT)/.test(l.name)).map((l) => {
    const p = BY_NAME[l.name];
    const full = p?.price != null ? Math.round(p.price * 100) * l.qty : null;
    return { ...l, image: p?.image ? `${SITE}/${p.image}` : "", full: full && full > l.amount ? full : null };
  });
  const amt = (re) => lines.filter((l) => re.test(l.name)).reduce((x, l) => x + l.amount, 0);
  return {
    no: orderNo(s.id),
    email: c.email || s.customer_email || "",
    name: sh.name || c.name || "",
    first: pick.split(" ")[0] || "",
    phone: c.phone || "",
    taxIds: (c.tax_ids || []).map((t) => t.value).join(", "),
    address: addr,
    addrLines,
    lines,
    items,
    sub: items.reduce((x, l) => x + l.amount, 0),
    saved: items.reduce((x, l) => x + (l.full ? l.full - l.amount : 0), 0),
    ship: amt(/^Shipping/),
    vat: amt(/^VAT/),
    date: new Date((s.created || Date.now() / 1000) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon" }),
    total: s.amount_total,
    paid: s.payment_status === "paid",
  };
}

const FONT = `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif`;
const BRAND = `${FONT};color:#111`;
const INK = "#111111", MUTED = "#6b6b6b", LINE = "#e6e3dc", CREAM = "#f6f1e7", BG = "#f4f2ee";
export function customerEmail(d) {
  const item = (l) => `<tr>
<td width="76" valign="top" style="padding:16px 0;border-top:1px solid ${LINE}">${l.image ? `<img src="${l.image}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;background:${BG};border-radius:10px;border:0">` : `<div style="width:64px;height:64px;background:${BG};border-radius:10px"></div>`}</td>
<td valign="middle" style="padding:16px 12px 16px 0;border-top:1px solid ${LINE};font-size:15px;line-height:1.35"><b>${esc(l.name)}</b><br><span style="color:${MUTED};font-size:13px">Qty ${l.qty}</span></td>
<td align="right" valign="middle" style="padding:16px 0;border-top:1px solid ${LINE};font-size:15px;white-space:nowrap">${l.full ? `<span style="color:${MUTED};text-decoration:line-through;font-size:13px">${eur(l.full)}</span><br>` : ""}<b>${eur(l.amount)}</b></td></tr>`;
  const sum = (k, v, strong) => `<tr><td style="padding:5px 0;font-size:${strong ? "17px" : "14px"};${strong ? "font-weight:700;padding-top:14px;border-top:1px solid " + INK : "color:" + MUTED}">${k}</td><td align="right" style="padding:5px 0;font-size:${strong ? "17px" : "14px"};white-space:nowrap;${strong ? "font-weight:700;padding-top:14px;border-top:1px solid " + INK : ""}">${v}</td></tr>`;
  const step = (label, on) => `<td align="center" width="25%" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${on ? INK : "#a9a6a0"};font-weight:${on ? 700 : 500};padding-top:8px"><div style="height:4px;border-radius:4px;background:${on ? INK : LINE};margin:0 3px 10px"></div>${label}</td>`;
  const link = (href, t) => `<a href="${href}" style="color:${INK};text-decoration:underline">${t}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Your Ladata order ${d.no}</title></head>
<body style="margin:0;padding:0;background:${BG};${BRAND}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Order ${d.no} is confirmed. We are getting it ready to ship with FedEx.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td align="center" style="padding:6px 0 22px"><a href="${SITE}"><img src="${SITE}/img/ladata-logo.png" alt="Ladata · House of Human Optimisation" height="34" style="display:block;height:34px;width:auto;border:0"></a></td></tr>
<tr><td style="background:#ffffff;border-radius:18px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="background:${INK};padding:36px 36px 32px;color:#ffffff">
<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#cfcac0">Order confirmed</div>
<div style="font-size:32px;line-height:1.1;font-weight:700;letter-spacing:-.02em;margin-top:12px">Thank you${d.first ? `, ${esc(d.first)}` : ""}.</div>
<div style="font-size:15px;line-height:1.6;color:#e7e3db;margin-top:12px">Your recovery gear is on its way to being packed. We will email you the FedEx tracking link as soon as it ships.</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>
<td style="background:#ffffff;color:${INK};border-radius:999px;padding:9px 16px;font-size:13px;font-weight:700;letter-spacing:.04em">${d.no}</td>
<td style="padding-left:14px;font-size:13px;color:#cfcac0">${esc(d.date)}</td></tr></table>
</td></tr>
<tr><td style="padding:26px 36px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${step("Confirmed", true)}${step("Preparing", false)}${step("Shipped", false)}${step("Delivered", false)}</tr></table></td></tr>
<tr><td style="padding:22px 36px 0"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:4px">Your order</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.items.map(item).join("")}</table></td></tr>
<tr><td style="padding:6px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};padding-top:10px">
${sum("Subtotal", eur(d.sub))}${sum("Shipping · FedEx", eur(d.ship))}${sum("VAT (23%)", eur(d.vat))}${sum("Total paid", eur(d.total), true)}
</table>${d.saved > 0 ? `<div style="margin-top:14px;background:#eef6ee;color:#245c36;border-radius:10px;padding:11px 14px;font-size:14px">You saved <b>${eur(d.saved)}</b> with our Black Friday offer.</div>` : ""}</td></tr>
<tr><td style="padding:26px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top" width="50%" style="background:${CREAM};border-radius:12px;padding:18px 18px;font-size:14px;line-height:1.6"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:6px">Delivery to</div>${d.name ? `<b>${esc(d.name)}</b><br>` : ""}${d.addrLines.map(esc).join("<br>")}</td>
<td width="12" style="width:12px;min-width:12px;font-size:0;line-height:0">&nbsp;</td>
<td valign="top" width="50%" style="background:${CREAM};border-radius:12px;padding:18px 18px;font-size:14px;line-height:1.6"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:6px">What happens next</div>We pack your order and hand it to <b>FedEx</b>. You get the tracking link by email the day it ships.</td>
</tr></table></td></tr>
<tr><td align="center" style="padding:30px 36px 8px">
<a href="https://www.bookladata.com/appointments" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 26px;font-weight:700;font-size:14px">Try it at the club · Book a session</a>
<div style="margin-top:12px"><a href="${SITE}/shop#all" style="color:${INK};font-size:14px;text-decoration:underline">Continue shopping</a></div></td></tr>
<tr><td style="padding:24px 36px 32px"><div style="border-top:1px solid ${LINE};padding-top:20px;font-size:14px;line-height:1.7;color:#333">Questions about your order? Just reply to this email, or message us on ${link("https://wa.me/351937329049", "WhatsApp")}.<br><span style="color:${MUTED}">See you soon, the Ladata team.</span></div></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:22px 12px 6px;font-size:13px">${link(SITE + "/shipping", "Shipping")} &nbsp;·&nbsp; ${link(SITE + "/returns", "30-day returns")} &nbsp;·&nbsp; ${link(SITE + "/warranty", "Warranty")} &nbsp;·&nbsp; ${link("https://www.instagram.com/ladata_humanoptimisation/", "Instagram")}</td></tr>
<tr><td align="center" style="padding:8px 12px 0;font-size:12px;line-height:1.6;color:${MUTED}">Ladata Portugal, Lda · House of Human Optimisation<br>Rua Tomaz Ribeiro 550, Matosinhos, Portugal</td></tr>
</table></td></tr></table></body></html>`;
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
