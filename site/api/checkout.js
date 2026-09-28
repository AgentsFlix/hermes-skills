// POST /api/checkout  { product_id, interval? }  → { url }
// Cria a sessão de Checkout do Stripe para um item (compra avulsa) ou para o Passe (assinatura).
// O preço vem do banco (tabela prices, espelho do Stripe), nunca do navegador.
import { stripe, admin, json, currentUser, customerFor, readJson, SITE } from "./_lib.js";
import { randomUUID } from "node:crypto";

export async function POST(request) {
  const user = await currentUser(request);
  if (!user) return json({ error: "faça login para comprar" }, 401);
  const { product_id, interval } = await readJson(request);
  if (!product_id || typeof product_id !== "string") return json({ error: "product_id obrigatório" }, 400);

  const { data: product } = await admin.from("products").select("id, kind, title, active").eq("id", product_id).maybeSingle();
  if (!product || !product.active) return json({ error: "produto indisponível" }, 404);

  let q = admin.from("prices").select("id, unit_amount, currency, interval").eq("product_id", product.id).eq("active", true);
  q = product.kind === "pass" ? q.eq("interval", interval === "year" ? "year" : "month") : q.is("interval", null);
  const { data: price } = await q.order("unit_amount", { ascending: true }).limit(1).maybeSingle();
  if (!price) return json({ error: "sem preço ativo para este produto" }, 409);

  // já tem? não cobra duas vezes (direito direto ou Passe vigente; o cliente admin não tem auth.uid(), então a consulta é explícita)
  const { data: owned } = await admin.from("entitlements").select("id, expires_at").eq("user_id", user.id).in("product_id", [product.id, "pass"]).is("revoked_at", null);
  const now = Date.now();
  if ((owned || []).some((e) => !e.expires_at || new Date(e.expires_at).getTime() > now)) return json({ error: "você já tem acesso a este conteúdo", already: true }, 409);

  const customer = await customerFor(user);
  // volta para a página de onde a compra saiu (site, www ou a demonstração local), nunca para um endereço arbitrário
  const ALLOWED = new Set([SITE, "https://agentsflix.ai", "https://www.agentsflix.ai", "http://127.0.0.1:8765", "http://localhost:8765"]);
  const origin = (request.headers.get("origin") || "").replace(/\/$/, "");
  const back = ALLOWED.has(origin) ? origin : SITE;
  const common = {
    customer,
    client_reference_id: user.id,
    locale: "pt-BR",
    allow_promotion_codes: true,
    success_url: `${back}/?compra=ok&item=${encodeURIComponent(product.id)}#${encodeURIComponent(product.id)}`,
    cancel_url: `${back}/?compra=cancelada#${encodeURIComponent(product.id)}`,
    metadata: { user_id: user.id, product_id: product.id, price_id: price.id },
    line_items: [{ price: price.id, quantity: 1 }],
  };
  const measurementEnabled = process.env.OPENAI_ADS_ENABLED === "1" && /^[A-Za-z0-9_-]{8,128}$/.test(process.env.OPENAI_ADS_PIXEL_ID || "");
  if (measurementEnabled) common.metadata.measurement_event_id = randomUUID();
  const session = product.kind === "pass"
    ? await stripe.checkout.sessions.create({ ...common, mode: "subscription", subscription_data: { metadata: { user_id: user.id, product_id: product.id } } })
    : await stripe.checkout.sessions.create({
        ...common,
        mode: "payment",
        payment_intent_data: { metadata: { user_id: user.id, product_id: product.id } },
        // parcelamento no cartão (Brasil) é parâmetro do Checkout, não tela do painel
        payment_method_options: { card: { installments: { enabled: true } } },
      });

  await admin.from("events").insert({ user_id: user.id, kind: "checkout_start", product_id: product.id, meta: { session: session.id, mode: session.mode } });
  return json({ url: session.url, ...(measurementEnabled ? { measurement: {
    sessionId: session.id, eventId: common.metadata.measurement_event_id,
    productId: product.id, amount: price.unit_amount, currency: price.currency.toUpperCase(),
  } } : {}) });
}
