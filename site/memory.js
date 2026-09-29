/* Memória privada da conta. Mantém o armazenamento local como cache e sincroniza só chaves permitidas. */
((root, factory) => {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else if (!root.AgentFlixMemory) root.AgentFlixMemory = factory(root);
})(typeof window === "undefined" ? globalThis : window, (root) => {
  "use strict";

  const META_KEY = "agentflix-memory-meta-v1";
  const RECOVERY_PREFIX = "agentflix-memory-recovery-v1:";
  const MAX_BYTES = 2400000;
  const ECF_KEY = "agentflix-ecf-base-v2";
  const ECF_PREFIX = "agentflix-ecf-base-v3:";
  const ECF_MANIFEST = ECF_PREFIX + "manifest";
  const exact = new Map([
    ["agentflix-installed-v1", "skill"],
    ["agentflix-list", "saved"],
    ["agentflix-watch-list-v1", "saved"],
    ["agentflix-reading-v1", "preference"],
    ["agentflix-done", "video"],
    ["agentflix-brand-journey-v1", "exercise"],
    ["agentflix-ecf-base-v2", "exercise"],
    ["agentflix-ecf-diagnosis-v1", "exercise"],
    ["agentflix-casa-git-premium-v1", "exercise"],
    ["agentflix-target", "preference"],
    ["agentflix-visit-v1", "preference"],
  ]);
  const prefixes = [
    ["agentflix-prog-", "video"],
    ["agentflix-finished-", "video"],
    ["agentflix-caminho-", "video"],
    ["agentflix-reading-progress-v1:", "reading"],
    ["agentflix-social-media-document-v2:", "exercise"],
    [ECF_PREFIX, "exercise"],
  ];

  const storage = root.localStorage;
  const proto = root.Storage?.prototype;
  const native = proto
    ? {
        get: proto.getItem,
        set: proto.setItem,
        remove: proto.removeItem,
        clear: proto.clear,
      }
    : storage
      ? {
          get: storage.getItem,
          set: storage.setItem,
          remove: storage.removeItem,
          clear: storage.clear,
        }
      : null;
  const nativeGet = (key) => native?.get.call(storage, key) ?? null;
  const nativeSet = (key, value) => native?.set.call(storage, key, value);
  const nativeRemove = (key) => native?.remove.call(storage, key);
  const byteLength = (value) =>
    typeof TextEncoder === "function"
      ? new TextEncoder().encode(value).byteLength
      : unescape(encodeURIComponent(value)).length;
  const categoryOf = (key) =>
    exact.get(key) || prefixes.find(([prefix]) => key.startsWith(prefix))?.[1] || null;
  const hash = (value) => {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return `${value.length}:${(result >>> 0).toString(16)}`;
  };
  const parse = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const serialize = (value) => JSON.stringify(value);

  let metadata = {};
  let ownerId = null;
  try {
    const saved = JSON.parse(nativeGet(META_KEY) || "{}");
    if (saved?.version === 1 && saved.entries && typeof saved.entries === "object") {
      metadata = saved.entries;
      ownerId = typeof saved.ownerId === "string" ? saved.ownerId : null;
    } else if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      metadata = saved;
    }
  } catch {
    metadata = {};
  }

  let client = null;
  let userId = null;
  let connectPromise = null;
  let startPromise = null;
  let applyingCloud = false;
  let flushTimer = null;
  let flushPromise = null;
  let generation = 0;
  let retryDelay = 1000;
  let signingOut = false;
  const pending = new Set();
  const status = { signedIn: false, available: false, oversized: [], conflicts: [], pending: 0, state: "local" };

  function publishStatus(state) {
    status.pending = Object.keys(metadata).filter((key) => metadata[key]?.dirtyAt).length;
    status.conflicts = Object.keys(metadata).filter((key) => metadata[key]?.conflict);
    status.state = state || (status.pending ? "pending" : status.available ? "saved" : "local");
    if (status.conflicts.length && status.state !== "saving") status.state = "conflict";
    root.dispatchEvent?.(new CustomEvent("agentflix:memory-status", {
      detail: { state: status.state, pending: status.pending, signedIn: status.signedIn },
    }));
  }

  function cancelTimer() {
    if (flushTimer !== null) root.clearTimeout?.(flushTimer);
    flushTimer = null;
  }

  function writeMetadata() {
    try {
      nativeSet(META_KEY, JSON.stringify({ version: 1, ownerId, entries: metadata }));
    } catch {
      // A experiência continua local quando o navegador não aceita metadados.
    }
  }

  function preservePendingRecovery() {
    const dirty = Object.keys(metadata).filter((key) => metadata[key]?.dirtyAt && categoryOf(key));
    if (!dirty.length) return;
    if (!ownerId) throw new Error("Memory owner unavailable");
    const recoveryKey = RECOVERY_PREFIX + ownerId;
    const recovery = JSON.stringify({
      entries: dirty.map((key) => ({ key, raw: nativeGet(key), info: metadata[key] })),
    });
    nativeSet(recoveryKey, recovery);
    if (nativeGet(recoveryKey) !== recovery) throw new Error("Memory recovery unavailable");
  }

  function clearOwnedCache() {
    if (!ownerId) return false;
    // Keep unsent edits scoped to the old account, never adopt them into another.
    preservePendingRecovery();
    generation += 1;
    cancelTimer();
    applyingCloud = true;
    try {
      trackedLocalKeys().forEach((key) => nativeRemove(key));
    } finally {
      applyingCloud = false;
    }
    metadata = {};
    ownerId = null;
    pending.clear();
    status.oversized = [];
    writeMetadata();
    publishStatus("local");
    return true;
  }

  function claimOwner(nextOwnerId) {
    if (ownerId && ownerId !== nextOwnerId) clearOwnedCache();
    ownerId = nextOwnerId;
    const recovery = parse(nativeGet(RECOVERY_PREFIX + ownerId) || "null");
    if (Array.isArray(recovery?.entries)) {
      for (const entry of recovery.entries) {
        if (!entry || typeof entry.key !== "string" || !entry.info?.dirtyAt ||
          !(entry.raw === null || typeof entry.raw === "string") || !categoryOf(entry.key) || metadata[entry.key]) continue;
        if (entry.raw === null) nativeRemove(entry.key);
        else nativeSet(entry.key, entry.raw);
        metadata[entry.key] = entry.info;
      }
      // Do not remove the safety copy until the account outbox is acknowledged.
    }
    writeMetadata();
  }

  function trackedLocalKeys() {
    const keys = [];
    if (!storage) return keys;
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && categoryOf(key)) keys.push(key);
      }
    } catch {
      return keys;
    }
    return keys;
  }

  function ecfProjectKey(id, part) {
    const bytes = new TextEncoder().encode(id);
    const encoded = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const key = `${ECF_PREFIX}p:${encoded}:${part}`;
    if (key.length > 240) throw new Error("ECF project identifier exceeds memory key limit");
    return key;
  }

  function shardEcf(raw) {
    let value;
    try { value = JSON.parse(raw); } catch { return false; }
    if (value?.version !== 2 || !value.projects || Array.isArray(value.projects) ||
      typeof value.projects !== "object") return false;
    const shards = new Map();
    const ids = Object.keys(value.projects);
    try {
      for (const id of ids) {
        const project = value.projects[id];
        if (!project || project.id !== id || !project.records ||
          typeof project.records !== "object" || Array.isArray(project.records)) return false;
        const { records, ...meta } = project;
        const stages = Object.keys(records);
        const metaKey = ecfProjectKey(id, "meta");
        shards.set(metaKey, serialize({ ...meta, stages }));
        for (const stage of stages) {
          if (!/^[a-z0-9-]{1,60}$/.test(stage)) return false;
          shards.set(ecfProjectKey(id, `stage:${stage}`), serialize(records[stage]));
        }
      }
      shards.set(ECF_MANIFEST, serialize({ version: 3, active_id: value.active_id, ids }));
      if ([...shards].some(([key, content]) => key.length > 240 || byteLength(content) > MAX_BYTES))
        return false;
    } catch { return false; }
    for (const [key, content] of shards) {
      if (nativeGet(key) !== content) {
        nativeSet(key, content);
        markDirty(key);
      }
    }
    for (const key of trackedLocalKeys()) {
      if (key.startsWith(ECF_PREFIX) && !shards.has(key)) {
        nativeRemove(key);
        markDirty(key, true);
      }
    }
    return true;
  }

  function rebuildEcf() {
    const manifest = parse(nativeGet(ECF_MANIFEST) || "null");
    if (!manifest || manifest.version !== 3 || !Array.isArray(manifest.ids)) return false;
    if (manifest.active_id !== null && !manifest.ids.includes(manifest.active_id)) return false;
    const projects = Object.create(null);
    for (const id of manifest.ids) {
      if (typeof id !== "string" || Object.prototype.hasOwnProperty.call(projects, id)) return false;
      const meta = parse(nativeGet(ecfProjectKey(id, "meta")) || "null");
      if (!meta || meta.id !== id || !Array.isArray(meta.stages)) return false;
      const { stages, ...project } = meta;
      project.records = Object.create(null);
      for (const stage of stages) {
        if (typeof stage !== "string" || !/^[a-z0-9-]{1,60}$/.test(stage)) return false;
        const raw = nativeGet(ecfProjectKey(id, `stage:${stage}`));
        if (raw === null) return false;
        project.records[stage] = parse(raw);
      }
      projects[id] = project;
    }
    applyingCloud = true;
    try { nativeSet(ECF_KEY, serialize({ version: 2, active_id: manifest.active_id, projects })); }
    finally { applyingCloud = false; }
    return true;
  }

  function markDirty(key, deleted = false) {
    if (applyingCloud || !categoryOf(key)) return;
    const raw = deleted ? null : nativeGet(key);
    if (key === ECF_KEY && raw !== null) {
      try {
        if (shardEcf(raw)) {
          markDirty(key, true); // Keep the local projection; retire its old cloud row.
          return;
        }
      } catch { /* A failed shard write leaves the original local draft intact. */ }
    }
    if (!deleted && raw !== null && byteLength(raw) > MAX_BYTES) {
      if (!status.oversized.includes(key)) status.oversized.push(key);
      root.dispatchEvent?.(
        new CustomEvent("agentflix:memory-warning", {
          detail: { reason: "too-large", key },
        }),
      );
    }
    if (raw === null || byteLength(raw) <= MAX_BYTES)
      status.oversized = status.oversized.filter((item) => item !== key);
    const now = Date.now();
    metadata[key] = {
      ...(metadata[key] || {}),
      dirtyAt: now,
      deletedAt: deleted ? now : null,
      hash: raw === null ? null : hash(raw),
    };
    writeMetadata();
    pending.add(key);
    publishStatus();
    scheduleFlush();
  }

  function installCapture() {
    if (!storage || !native) return;
    if (proto) {
      if (proto.__agentflixMemoryCapture) return;
      Object.defineProperty(proto, "__agentflixMemoryCapture", {
        value: true,
        configurable: false,
      });
      proto.setItem = function setItem(key, value) {
        if (this === storage && signingOut && categoryOf(String(key)))
          throw new Error("Aguarde o encerramento seguro da conta.");
        const result = native.set.call(this, key, value);
        if (this === storage) markDirty(String(key));
        return result;
      };
      proto.removeItem = function removeItem(key) {
        const tracked = this === storage && Boolean(categoryOf(String(key)));
        if (tracked && signingOut) throw new Error("Aguarde o encerramento seguro da conta.");
        const result = native.remove.call(this, key);
        if (tracked) markDirty(String(key), true);
        return result;
      };
      proto.clear = function clear() {
        if (this === storage && signingOut) throw new Error("Aguarde o encerramento seguro da conta.");
        const keys = this === storage ? trackedLocalKeys() : [];
        const result = native.clear.call(this);
        keys.forEach((key) => markDirty(key, true));
        return result;
      };
    }
  }

  function scheduleFlush(delay = 800) {
    if (!client || !userId || flushTimer !== null || signingOut) return;
    flushTimer = root.setTimeout(() => {
      flushTimer = null;
      if (status.available) flush();
      else connect(client, { id: userId });
    }, delay);
  }

  async function requestWithDeadline(query) {
    // Abort only this request. A timed-out write may have reached the server;
    // the outbox remains dirty until an acknowledged retry.
    const controller = root.AbortController ? new root.AbortController() : null;
    if (controller && query.abortSignal) query = query.abortSignal(controller.signal);
    let timer;
    try {
      return await Promise.race([query, new Promise((resolve) => {
        timer = root.setTimeout(() => {
          controller?.abort();
          resolve({ error: { code: "memory_timeout" } });
        }, 12000);
      })]);
    } catch {
      return { error: { code: "memory_unavailable" } };
    } finally {
      root.clearTimeout?.(timer);
    }
  }

  async function saveKey(key) {
    const info = metadata[key];
    const category = categoryOf(key);
    if (!client || !userId || !info?.dirtyAt || !category) return false;
    if (info.conflict) return false;
    const requestGeneration = generation;
    const raw = info.deletedAt ? null : nativeGet(key);
    if (!info.deletedAt && raw === null) info.deletedAt = Date.now();
    if (raw !== null && byteLength(raw) > MAX_BYTES) return false;

    if (typeof client.rpc !== "function") return false;
    const response = await requestWithDeadline(client.rpc("save_user_memory", {
      requested_key: key, requested_value: raw === null ? null : parse(raw),
      expected_revision: info.revision || 0, requested_deleted: Boolean(info.deletedAt),
    }));
    const data = Array.isArray(response.data) ? response.data[0] : response.data;
    const { error } = response;
    if (generation !== requestGeneration) return false;
    if (!error && data?.applied === false) {
      metadata[key] = { ...metadata[key], conflict: true };
      writeMetadata();
      return false;
    }
    if (error || !data) return false;
    // A newer edit owns the dirty marker. Never acknowledge it with an older response.
    if (metadata[key] !== info) {
      metadata[key] = { ...metadata[key], revision: data.revision || info.revision || 0 };
      writeMetadata();
      return true;
    }
    metadata[key] = {
      hash: raw === null ? null : hash(raw),
      syncedAt: data.updated_at,
      revision: data.revision || 0,
      deletedAt: data.deleted_at ? Date.parse(data.deleted_at) || info.deletedAt : null,
    };
    writeMetadata();
    return true;
  }

  function flush() {
    if (flushPromise) return flushPromise;
    const active = drain().catch(() => {
      publishStatus("unavailable");
      scheduleFlush(retryDelay);
      return { ok: false, saved: 0 };
    });
    flushPromise = active;
    active.finally(() => { if (flushPromise === active) flushPromise = null; });
    return active;
  }

  async function drain() {
    if (!client || !userId) return { ok: false, saved: 0 };
    const requestGeneration = generation;
    cancelTimer();
    publishStatus("saving");
    let saved = 0;
    // Drain edits made during a request, but yield under continuous typing.
    for (let pass = 0; pass < 5; pass += 1) {
      const priority = (key) => key === ECF_KEY ? 2 : key === ECF_MANIFEST ? 1 : 0;
      const keys = Object.keys(metadata).filter((key) => metadata[key]?.dirtyAt)
        .sort((a, b) => priority(a) - priority(b));
      pending.clear();
      let failed = false;
      for (const key of keys) {
        if (generation !== requestGeneration) return { ok: false, saved };
        if ((key === ECF_MANIFEST || key === ECF_KEY) && failed) continue;
        if (await saveKey(key)) saved += 1;
        else failed = true;
      }
      if (generation !== requestGeneration) return { ok: false, saved };
      Object.keys(metadata).filter((key) => metadata[key]?.dirtyAt).forEach((key) => pending.add(key));
      if (failed || pending.size === 0) break;
    }
    const ok = pending.size === 0;
    publishStatus(ok ? "saved" : "pending");
    if (!ok) {
      scheduleFlush(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    } else {
      retryDelay = 1000;
      if (ownerId) nativeRemove(RECOVERY_PREFIX + ownerId);
    }
    return { ok, saved };
  }

  function applyCloudRow(row) {
    const key = row.memory_key;
    if (!categoryOf(key) || metadata[key]?.dirtyAt) return false;
    const next = row.deleted_at ? null :
      key === "agentflix-social-media-document-v2:last" && typeof row.value === "string"
        ? row.value : serialize(row.value);
    const current = nativeGet(key);
    applyingCloud = true;
    try {
      if (next === null) nativeRemove(key);
      else nativeSet(key, next);
    } finally {
      applyingCloud = false;
    }
    metadata[key] = {
      hash: next === null ? null : hash(next),
      syncedAt: row.updated_at,
      revision: row.revision || 0,
      deletedAt: row.deleted_at ? Date.parse(row.deleted_at) || Date.now() : null,
    };
    return current !== next;
  }

  async function connect(nextClient, user) {
    if (!nextClient || !user?.id) return { ok: false, signedIn: false, changed: false };
    if (connectPromise && userId === user.id) return connectPromise;
    if (userId !== user.id) {
      generation += 1;
      flushPromise = null;
    }
    claimOwner(user.id);
    client = nextClient;
    userId = user.id;
    status.signedIn = true;
    const requestGeneration = generation;
    const connecting = (async () => {
      const rows = [];
      // PostgREST caps responses. Never mistake a truncated result for deleted data.
      for (let offset = 0; ; offset += 100) {
        let query = nextClient.from("user_memory")
          .select("memory_key,category,value,schema_version,revision,updated_at,deleted_at");
        const paginated = typeof query.range === "function";
        if (paginated) query = query.order("memory_key").range(offset, offset + 99);
        const { data, error } = await requestWithDeadline(query);
        if (requestGeneration !== generation) return { ok: false, signedIn: true, changed: false };
        if (error || !Array.isArray(data)) {
          status.available = false;
          publishStatus("unavailable");
          scheduleFlush(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
          return { ok: false, signedIn: true, changed: false };
        }
        rows.push(...data);
        if (!paginated || data.length < 100) break;
      }

      status.available = true;
      const cloudKeys = new Set(rows.map((row) => row.memory_key));
      let changed = false;
      rows.forEach((row) => {
        changed = applyCloudRow(row) || changed;
      });

      if (nativeGet(ECF_MANIFEST)) {
        if (!rebuildEcf()) {
          status.available = false;
          publishStatus("unavailable");
          scheduleFlush(retryDelay);
          return { ok: false, signedIn: true, changed: false };
        }
        changed = true;
        if (rows.some((row) => row.memory_key === ECF_KEY && !row.deleted_at))
          markDirty(ECF_KEY, true);
      } else if (nativeGet(ECF_KEY)) {
        shardEcf(nativeGet(ECF_KEY)) && markDirty(ECF_KEY, true);
      }

      for (const key of trackedLocalKeys()) {
        if (!cloudKeys.has(key) && !metadata[key]?.dirtyAt) markDirty(key);
      }
      Object.keys(metadata).forEach((key) => {
        if (metadata[key]?.dirtyAt) pending.add(key);
      });
      writeMetadata();
      const saved = await flush();
      const detail = { ok: saved.ok, signedIn: true, changed, saved: saved.saved };
      root.dispatchEvent?.(new CustomEvent("agentflix:memory-ready", { detail }));
      return detail;
    })();
    connectPromise = connecting;
    try { return await connecting; }
    catch {
      status.available = false;
      publishStatus("unavailable");
      scheduleFlush(retryDelay);
      return { ok: false, signedIn: true, changed: false };
    }
    finally { if (connectPromise === connecting) connectPromise = null; }
  }

  async function loadSupabase() {
    if (root.supabase?.createClient) return;
    await new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js";
      script.onload = resolve;
      script.onerror = reject;
      root.document.head.append(script);
    });
  }

  async function start() {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      try {
        await loadSupabase();
        const response = await root.fetch("/api/config", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) return { ok: false, signedIn: false, changed: false };
        const config = await response.json();
        if (!config?.supabaseUrl || !config?.supabaseAnonKey)
          return { ok: false, signedIn: false, changed: false };
        const ownClient = root.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        const { data } = await ownClient.auth.getSession();
        if (!data?.session?.user) {
          clearOwnedCache();
          root.dispatchEvent?.(
            new CustomEvent("agentflix:memory-ready", {
              detail: { ok: true, signedIn: false, changed: false },
            }),
          );
          return { ok: true, signedIn: false, changed: false };
        }
        return connect(ownClient, data.session.user);
      } catch {
        return { ok: false, signedIn: false, changed: false };
      }
    })();
    const result = await startPromise;
    if (!result.ok) startPromise = null;
    return result;
  }

  async function signOut() {
    if (!client || !userId) return false;
    if (signingOut) return false;
    signingOut = true;
    try {
      const requestGeneration = generation;
      await flush();
      if (requestGeneration !== generation) return false;
      // Conflicts and failed saves must not trap the user in an authenticated session.
      // Verify a same-account recovery copy before ending authentication or clearing drafts.
      preservePendingRecovery();
      const { error } = await requestWithDeadline(client.auth.signOut());
      if (error || requestGeneration !== generation) return false;
      clearOwnedCache();
      client = null;
      userId = null;
      connectPromise = null;
      startPromise = null;
      status.signedIn = false;
      status.available = false;
      publishStatus("local");
      return true;
    } catch {
      return false;
    } finally {
      signingOut = false;
      if (userId && Object.values(metadata).some((info) => info?.dirtyAt)) scheduleFlush();
    }
  }

  async function resolveConflict(key, choice) {
    if (!client || !userId || !metadata[key]?.conflict || !["local", "cloud"].includes(choice)) return false;
    const requestGeneration = generation;
    const info = metadata[key];
    const { data, error } = await requestWithDeadline(client.from("user_memory")
      .select("memory_key,value,revision,updated_at,deleted_at").eq("memory_key", key).maybeSingle());
    if (error || !data || generation !== requestGeneration || metadata[key] !== info) return false;
    if (choice === "local") metadata[key] = { ...info, revision: data.revision, conflict: false };
    else {
      delete metadata[key];
      applyCloudRow(data);
    }
    writeMetadata();
    return (await flush()).ok;
  }

  async function versions() {
    if (!client || !userId) return { data: [], error: true };
    const requestGeneration = generation;
    const response = await requestWithDeadline(client.from("user_memory_versions")
      .select("memory_key,revision,saved_at").order("saved_at", { ascending: false }).limit(100));
    return generation === requestGeneration ? response : { data: [], error: true };
  }

  async function restoreVersion(key, revision) {
    if (!client || !userId || metadata[key]?.dirtyAt) return false;
    const requestGeneration = generation;
    const { data, error } = await requestWithDeadline(client.from("user_memory_versions")
      .select("value").eq("memory_key", key).eq("revision", revision).single());
    if (error || !data || generation !== requestGeneration || metadata[key]?.dirtyAt) return false;
    storage.setItem(key, serialize(data.value));
    return (await flush()).ok;
  }

  installCapture();
  root.addEventListener?.("online", () => {
    retryDelay = 1000;
    cancelTimer();
    if (client && userId) connect(client, { id: userId });
    else { startPromise = null; start(); }
  });
  root.addEventListener?.("beforeunload", (event) => {
    if (userId && Object.values(metadata).some((info) => info?.dirtyAt)) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  return Object.freeze({
    categoryOf,
    clearSignedOut: () => {
      if (signingOut) return false; // The auth callback must not invalidate our own sign-out.
      const cleared = clearOwnedCache();
      client = null; userId = null; connectPromise = null; startPromise = null;
      status.signedIn = false; status.available = false;
      return cleared;
    },
    connect,
    flush,
    signOut,
    start,
    status,
    resolveConflict,
    versions,
    restoreVersion,
    exportData: () => ({
      format: "agentflix-memory-export-v1",
      exportedAt: new Date().toISOString(),
      pending: Object.keys(metadata).filter((key) => metadata[key]?.dirtyAt).length,
      entries: trackedLocalKeys().map((key) => ({ key, category: categoryOf(key), value: parse(nativeGet(key)) })),
    }),
  });
});
