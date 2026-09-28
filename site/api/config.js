// Configuração pública para a página (chaves publicáveis por definição; RLS e o Stripe protegem o resto).
// Sai daqui, e não do HTML, para trocar de teste para produção sem commit.
export async function GET() {
  const body = {
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    stripeMode: (process.env.STRIPE_PUBLISHABLE_KEY || "").startsWith("pk_live_") ? "live" : "test",
    storeEnabled: process.env.STORE_ENABLED === "1",   // interruptor da loja: cadeados e botões de compra só aparecem com 1
    openaiAds: {
      enabled: process.env.OPENAI_ADS_ENABLED === "1" && /^[A-Za-z0-9_-]{8,128}$/.test(process.env.OPENAI_ADS_PIXEL_ID || ""),
      pixelId: /^[A-Za-z0-9_-]{8,128}$/.test(process.env.OPENAI_ADS_PIXEL_ID || "") ? process.env.OPENAI_ADS_PIXEL_ID : null,
    },
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
}
