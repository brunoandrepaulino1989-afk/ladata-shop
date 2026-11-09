# ladata.shop

Online shop for Ladata (House of Human Optimisation). Static pages hosted on Netlify,
payments through Stripe Checkout, order emails through Resend.

- `index.html` homepage · `shop.html` all products (`/shop#saunas` etc.) · `product.html` product page (`/product#slug`) · `success.html` order confirmation
- `bag.js` the bag drawer, shared by all pages (kept in localStorage)
- `netlify/lib/products.json` **the price list the server charges** (prices excl. VAT, before the Black Friday discount)
- `netlify/lib/shop.mjs` prices, 15% Black Friday until 1 Dec 2026, €9.90 shipping, 23% VAT on (products + shipping), Stripe and email helpers
- `netlify/functions/checkout.mjs` `POST /api/checkout` creates the Stripe Checkout page
- `netlify/functions/order.mjs` `GET /api/order` feeds the confirmation page
- `netlify/functions/stripe-webhook.mjs` `POST /api/stripe-webhook` sends the confirmation email to the customer and a copy to Ladata

When you change a price, change it in **both** `netlify/lib/products.json` (what is charged) and the `P` lists in the pages (what is shown).

## Netlify environment variables

| Name | Required | What |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Stripe > Developers > API keys > Secret key (`sk_live_…`, or `sk_test_…` to test) |
| `STRIPE_WEBHOOK_SECRET` | yes | Signing secret (`whsec_…`) of the webhook below |
| `RESEND_API_KEY` | yes | resend.com, after verifying the ladata.shop domain |
| `ORDER_NOTIFY_TO` | recommended | Ladata inbox that gets a copy of every order |
| `MAIL_FROM` | no | Default `Ladata <orders@ladata.shop>` |
| `SITE_URL` | no | Default `https://ladata.shop` (used for images in emails) |
| `SHIP_COUNTRIES` | no | Comma-separated country codes. Default: the 27 EU countries |

## Stripe setup

1. Settings > Payment methods: switch on Cards, Apple Pay, Google Pay, MB WAY, Klarna, PayPal.
2. Developers > Webhooks > Add endpoint: `https://ladata.shop/api/stripe-webhook`,
   events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret.
3. Settings > Branding: Ladata logo and colours, so the payment page looks like the shop.
