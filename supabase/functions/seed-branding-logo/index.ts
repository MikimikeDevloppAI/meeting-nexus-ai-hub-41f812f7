import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const { source_url, target_path } = await req.json();

    if (!source_url) {
      return new Response(JSON.stringify({ error: 'source_url is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bucket = 'branding';
    const objectPath = target_path || 'logo/ophtacare-logo.png';

    console.log('[SEED-BRANDING-LOGO] Fetching source image:', source_url);
    const fetchRes = await fetch(source_url);
    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch source image: ${fetchRes.status}`);
    }

    const contentType = fetchRes.headers.get('content-type') || 'image/png';
    const arrayBuffer = await fetchRes.arrayBuffer();

    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('[SEED-BRANDING-LOGO] Uploading to storage:', `${bucket}/${objectPath}`);
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, new Uint8Array(arrayBuffer), { contentType, upsert: true });

    if (uploadError) {
      console.error('[SEED-BRANDING-LOGO] Upload error:', uploadError);
      throw uploadError;
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    console.log('[SEED-BRANDING-LOGO] Uploaded successfully. Public URL:', pub.publicUrl);

    return new Response(JSON.stringify({ success: true, publicUrl: pub.publicUrl, path: objectPath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[SEED-BRANDING-LOGO] Error:', err?.message || err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
