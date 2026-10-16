import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return json(500, { ok: false, error: 'Order service is not configured.' });
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    // Rate-limit bursts per source IP using a server-side SHA-256 hash; raw IPs are not stored.
    const forwarded = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '';
    const sourceIp = forwarded.split(',')[0].trim();
    if (sourceIp) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('submit-order:' + sourceIp));
      const ipHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      const { data: allowed, error: rateError } = await supabase.rpc('allow_shahi_request', {
        p_ip_hash: ipHash, p_endpoint: 'submit-order', p_limit: 5, p_window_seconds: 600,
      });
      if (rateError) {
        console.error('Rate limit check failed:', rateError.message);
        return json(503, { ok: false, error: 'The service is temporarily unavailable. Please try again shortly.' });
      }
      if (allowed !== true) return json(429, { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    const body = await req.json();

    const name = String(body.name ?? '').trim().slice(0, 100);
    const phone = String(body.phone ?? '').trim().slice(0, 30);
    const address = String(body.address ?? '').trim().slice(0, 500);
    const quantity = Number(body.quantity);
    const paymentMethod = String(body.paymentMethod ?? '');
    const customerPaymentNumber = String(body.customerPaymentNumber ?? '').trim().slice(0, 30);
    const transactionId = String(body.transactionId ?? '').trim().slice(0, 100);
    const amountSent = Number(body.amountSent ?? 0);

    if (name.length < 2) return json(400, { ok: false, error: 'Please enter a valid customer name.' });
    if (phone.replace(/\D/g, '').length < 7) return json(400, { ok: false, error: 'Please enter a valid phone number.' });
    if (address.length < 5) return json(400, { ok: false, error: 'Please enter a complete delivery address.' });
    if (!Number.isInteger(quantity) || quantity < 20 || quantity > 400) {
      return json(400, { ok: false, error: 'Quantity must be between 20 and 400 packets.' });
    }
    if (!['bKash', 'Rocket', 'Upay', 'COD'].includes(paymentMethod)) {
      return json(400, { ok: false, error: 'Select a valid payment method.' });
    }

    // The public site price is checked on the server; browser totals are never trusted.
    const unitPrice = 350;
    const totalAmount = quantity * unitPrice;
    if (paymentMethod !== 'COD') {
      if (customerPaymentNumber.replace(/\D/g, '').length < 7) {
        return json(400, { ok: false, error: 'Enter the number used to send the payment.' });
      }
      if (transactionId.length < 4) return json(400, { ok: false, error: 'Enter a valid transaction ID.' });
      if (!Number.isFinite(amountSent) || amountSent !== totalAmount) {
        return json(400, { ok: false, error: `Amount sent must exactly match the order total of BDT ${totalAmount}.` });
      }
    }

    // Snapshot the currently configured unit cost into the order for historical estimates.
    const { data: costRow } = await supabase
      .from('product_costs').select('cost_per_unit').eq('product', 'Grass Silage').maybeSingle();
    const costPerUnit = Number(costRow?.cost_per_unit ?? 0);
    const { data: saved, error } = await supabase.from('orders').insert({
      customer_name: name,
      phone,
      address,
      product: 'Grass Silage',
      quantity,
      unit_price: unitPrice,
      total_weight_kg: quantity * 50,
      payment_method: paymentMethod,
      customer_payment_number: paymentMethod === 'COD' ? null : customerPaymentNumber,
      transaction_id: paymentMethod === 'COD' ? null : transactionId,
      amount_sent: paymentMethod === 'COD' ? 0 : amountSent,
      payment_status: paymentMethod === 'COD' ? 'Cash on Delivery' : 'Pending',
      order_status: 'Pending',
      cost_per_unit: costPerUnit,
      source: 'Website',
    }).select('id,order_number,created_at').single();
    if (error) {
      console.error('Order insert failed:', error.message);
      return json(500, { ok: false, error: 'We could not save your order to the online dashboard. Please continue using WhatsApp to contact the farm.' });
    }

    return json(200, { ok: true, order_number: saved.order_number, created_at: saved.created_at });
  } catch (_err) {
    return json(400, { ok: false, error: 'Invalid request. Please review your order details.' });
  }
});
