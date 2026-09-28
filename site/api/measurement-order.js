// Verifica uma compra da própria conta antes da medição no navegador.
// IDs da Stripe ficam no corpo autenticado, nunca em URLs do pixel.
import { stripe, admin, json, currentUser, readJson } from "./_lib.js";

export async function POST(request) {
  if (process.env.OPENAI_ADS_ENABLED !== "1") return json({ error: "medição indisponível" }, 404);
  const user = await currentUser(request);
  if (!user) return json({ error: "autenticação necessária" }, 401);
  const { sessionId } = await readJson(request);
  if (typeof sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(sessionId)) return json({ error: "sessão inválida" }, 400);
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.user_id !== user.id || !/^[0-9a-f-]{36}$/i.test(session.metadata?.measurement_event_id || "")) return json({ error: "compra não encontrada" }, 404);
    if (session.status !== "complete" || session.payment_status !== "paid") return json({ pending: true }, 202);
    let event, row;
    if (session.mode === "payment") {
      const result = await admin.from("purchases").select("status,amount,currency,product_id")
        .eq("user_id", user.id).eq("stripe_checkout_session_id", sessionId).maybeSingle();
      if (result.error) throw result.error;
      row = result.data;
      if (!row) return json({ pending: true }, 202);
      if (row.status !== "paid") return json({ ineligible: true });
      event = { name: "order_created", data: { type: "contents", amount: row.amount, currency: row.currency.toUpperCase() } };
    } else if (session.mode === "subscription") {
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const result = await admin.from("subscriptions").select("status,product_id")
        .eq("user_id", user.id).eq("id", subscriptionId).maybeSingle();
      if (result.error) throw result.error;
      row = result.data;
      if (!row) return json({ pending: true }, 202);
      if (row.status !== "active") return json({ ineligible: true });
      event = { name: "subscription_created", data: { type: "plan_enrollment", plan_id: row.product_id,
        amount: session.amount_total, currency: session.currency?.toUpperCase() } };
    } else return json({ ineligible: true });
    if (!Number.isSafeInteger(event.data.amount) || event.data.amount < 0 || !/^[A-Z]{3}$/.test(event.data.currency || "")) throw Error("invalid_amount");
    return json({ ...event, eventId: session.metadata.measurement_event_id });
  } catch {
    // Não devolver payloads, tokens ou mensagens dos provedores.
    return json({ error: "verificação temporariamente indisponível" }, 503);
  }
}
