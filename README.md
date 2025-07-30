# CustomGPT Payment (Razorpay + Node/Express)

- Serves `public/index.html` (Razorpay Standard Checkout v2)
- Success page: `/payment-success` shows the Order ID with a copy button
- API:
  - POST `/api/payments/razorpay/create_order`
  - POST `/api/payments/razorpay/verify`
  - POST `/payment/callback` → redirects to `/payment-success?order_id=...`
- Start: `npm start`

Set env vars: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
