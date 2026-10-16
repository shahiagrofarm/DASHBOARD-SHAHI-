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
    if (!url || !serviceKey) return json(500, { ok: false, error: 'Analytics service is not configured.' });
    const body = await req.json();
    const sessionId = String(body.session_id ?? '').slice(0, 80);
    const pagePath = String(body.page_path ?? '');
    const referrer = String(body.referrer ?? '').slice(0, 500);
    if (!/^[a-zA-Z0-9._-]{8,80}$/.test(sessionId)) return json(400, { ok: false, error: 'Invalid session.' });
    if (!pagePath.startsWith('/') || pagePath.length > 200 || pagePath.startsWith('//')) {
      return json(400, { ok: false, error: 'Invalid page path.' });
    }
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    // Rate-limit bursts per source IP using a server-side SHA-256 hash; raw IPs are not stored.
    const forwarded = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '';
    const sourceIp = forwarded.split(',')[0].trim();
    if (sourceIp) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('track-event:' + sourceIp));
      const ipHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      const { data: allowed, error: rateError } = await supabase.rpc('allow_shahi_request', {
        p_ip_hash: ipHash, p_endpoint: 'track-event', p_limit: 90, p_window_seconds: 600,
      });
      if (rateError) {
        console.error('Rate limit check failed:', rateError.message);
        return json(503, { ok: false, error: 'The service is temporarily unavailable. Please try again shortly.' });
      }
      if (allowed !== true) return json(429, { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    const { error } = await supabase.from('website_events').insert({
      session_id: sessionId, event_type: 'page_view', page_path: pagePath, referrer,
    });
    if (error) {
      console.error('Page view insert failed:', error.message);
      return json(500, { ok: false, error: 'Could not record page view.' });
    }
    return json(200, { ok: true });
  } catch (_err) {
    return json(400, { ok: false, error: 'Invalid analytics request.' });
  }
});
