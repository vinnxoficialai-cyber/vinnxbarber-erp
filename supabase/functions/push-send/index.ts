import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push library for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const pushSecret = req.headers.get("x-push-secret");
    const expectedSecret = Deno.env.get("PUSH_SECRET");
    if (pushSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clientId, title, body, url, type } = await req.json();

    if (!clientId || !title || !body) {
      return new Response(JSON.stringify({ error: "clientId, title, body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure web-push
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidEmail = Deno.env.get("VAPID_EMAIL") || "vinnxoficialai@gmail.com";
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate);

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscriptions for this client
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("clientId", clientId);

    if (subErr || !subs || subs.length === 0) {
      // Log the attempt
      await supabase.from("push_log").insert({
        clientId,
        type: type || "manual",
        title,
        body,
        status: "no_subscription",
      });
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        sent++;
      } catch (err: any) {
        failed++;
        // If subscription is expired/invalid, remove it
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    // Log
    await supabase.from("push_log").insert({
      clientId,
      type: type || "manual",
      title,
      body,
      status: sent > 0 ? "sent" : "failed",
      errorDetail: failed > 0 ? `${failed} failed of ${subs.length}` : null,
    });

    return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
