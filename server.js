require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const path = require('path');

const app = express();
app.use(express.json());
// 👇 Razorpay posts x-www-form-urlencoded to the callback_url
app.use(express.urlencoded({ extended: false }));

// (optional) request logger
app.use((req, _res, next) => { console.log('▶', req.method, req.url); next(); });

// Serve /public
app.use(express.static(path.join(__dirname, 'public')));

// Razorpay init
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// In-memory order timestamps (unchanged)
const orders = new Map();

// Create order (unchanged)
app.post('/api/payments/razorpay/create_order', async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;
    const order = await razorpay.orders.create({
      amount, currency, receipt, payment_capture: 1, notes
    });
    orders.set(order.id, Date.now());
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error('create_order error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/payments/razorpay/verify', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });

    // 1) Fetch order details from Razorpay (works even if your server restarted)
    const order = await razorpay.orders.fetch(order_id); // throws if invalid

    // 2) Enforce validity window using Razorpay's own timestamp (seconds -> ms)
    const createdAtMs = (order.created_at || 0) * 1000;
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (createdAtMs && Date.now() - createdAtMs > twoHoursMs) {
      return res.status(400).json({ error: 'Order expired.' });
    }

    // 3) Check if any payment against this order is captured
    const payments = await razorpay.orders.fetchPayments(order_id);
    const captured = payments.items.find(p => p.status === 'captured');

    res.json({
      paid: Boolean(captured),
      // optional extras you may want the GPT to see:
      payment_id: captured?.id || null,
      amount: captured?.amount || order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error('💥 verify error:', err);
    // If Razorpay says the order is invalid, surface a clear message
    if (err.statusCode && err.error) {
      return res.status(err.statusCode).json({ error: err.error.description || 'Verification failed' });
    }
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// ✅ Razorpay Checkout v2 will POST here on success, then we redirect to a clean URL
app.post('/payment/callback', (req, res) => {
  // Razorpay sends: razorpay_payment_id, razorpay_order_id, razorpay_signature
  const { razorpay_order_id } = req.body || {};
  // (Optional) you can validate signature here before redirecting
  const dest = `/payment-success?order_id=${encodeURIComponent(razorpay_order_id || '')}`;
  return res.redirect(dest);
});

// Serve success page
app.get('/payment-success', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));