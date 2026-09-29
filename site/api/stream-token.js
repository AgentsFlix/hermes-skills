// GET /api/stream-token?uid=<Cloudflare Stream UID>
// Emite um token Cloudflare Stream de curta duração apenas para quem tem direito ao material.
import { createPrivateKey, createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { admin, currentUser, json } from "./_lib.js";
import publicLessons from "../assistir/public-lessons.json" with { type: "json" };

const TTL_SECONDS = 60 * 60;
const UID = /^[a-f0-9]{32}$/;

const base64Url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function signedStreamToken(streamUid) {
  const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  const encodedJwk = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK_BASE64;
  if (!keyId || !encodedJwk) return null;

  let privateKey;
  try {
    privateKey = createPrivateKey({
      key: JSON.parse(Buffer.from(encodedJwk, "base64").toString("utf8")),
      format: "jwk",
    });
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "RS256", kid: keyId });
  const payload = base64Url({
    sub: streamUid,
    kid: keyId,
    nbf: now - 15,
    exp: now + TTL_SECONDS,
    downloadable: false,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  return { token: `${header}.${payload}.${signer.sign(privateKey).toString("base64url")}`, expires_at: now + TTL_SECONDS };
}

export async function GET(request) {
  const streamUid = new URL(request.url).searchParams.get("uid") || "";
  if (!UID.test(streamUid)) return json({ error: "vídeo inválido" }, 400);

  const publicLesson = publicLessons.lessons.find((lesson) => lesson.uid === streamUid);
  const user = publicLesson ? null : await currentUser(request);
  if (!publicLesson && !user) return json({ error: "faça login" }, 401);

  const { data: video } = await admin
    .from("protected_stream_videos")
    .select("stream_uid, product_id, series_slug")
    .eq("stream_uid", streamUid)
    .eq("active", true)
    .maybeSingle();
  if (!video) return json({ error: "vídeo indisponível" }, 404);

  if (publicLesson) {
    if (video.series_slug !== publicLesson.series || video.product_id !== `assistir:${publicLesson.series}`)
      return json({ error: "vídeo indisponível" }, 404);
  } else {
    const bearer = request.headers.get("authorization") || "";
    const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (!token) return json({ error: "faça login" }, 401);
    const asUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error } = await asUser.rpc("has_access", { p_product_id: video.product_id });
    if (error || allowed !== true) return json({ error: "sem acesso a este conteúdo" }, 403);
  }

  const signed = signedStreamToken(video.stream_uid);
  if (!signed) return json({ error: "proteção de vídeo ainda não configurada" }, 503);
  return json(signed);
}
