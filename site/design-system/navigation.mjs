/* Approved persistent shell. A route adapter owns its data, content and cleanup.
 * No HTML-document injection, frames, global-script replay, auth or cache changes.
 */
export function bounded(operation, signal, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => finish(reject, new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => finish(reject, new Error('Preparation timed out')), timeout);
    function finish(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      fn(value);
    }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return operation();
    }).then(value => finish(resolve, value), error => finish(reject, error));
  });
}

export async function decodeImage(image, signal, timeout = 15000) {
  image.loading = 'eager';
  // decode() rejects broken images; complete alone is also true for failures.
  for (let attempt = 0; attempt < 3; attempt++) {
    const src = image.currentSrc || image.src;
    if (!src) throw new Error('Image source missing');
    await bounded(() => image.decode(), signal, timeout);
    if (!image.complete || image.naturalWidth === 0) throw new Error('Image incomplete');
    if (src === (image.currentSrc || image.src)) return image;
  }
  throw new Error('Image source did not stabilize');
}

export async function prepareVisuals(root, signal, { timeout = 15000, concurrency = 6, stylesheets = [], images: extraImages = [] } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError('Invalid concurrency');
  const document = root.ownerDocument;
  await bounded(() => document.fonts.ready, signal, timeout);
  for (const link of stylesheets) {
    if (link.sheet) continue;
    await bounded(() => new Promise((resolve, reject) => {
      const cleanup = () => {
        link.removeEventListener('load', loaded);
        link.removeEventListener('error', failed);
        signal.removeEventListener('abort', aborted);
        clearTimeout(timer);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Stylesheet unavailable')); };
      const aborted = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(failed, timeout);
      link.addEventListener('load', loaded, { once: true });
      link.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();
      else if (link.sheet) loaded();
    }), signal, timeout);
  }
  const sources = () => [...new Set([...root.querySelectorAll('img')].filter(img => img.getAttribute('src') || img.getAttribute('srcset')).concat(extraImages, root.matches?.('img') ? [root] : []))];
  const signature = image => image.src + '|' + image.srcset + '|' + image.currentSrc;
  const decoded = new Map();
  for (let round = 0; round < 5; round++) {
    const images = sources().filter(image => decoded.get(image) !== signature(image));
    if (!images.length) return;
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, async () => {
      while (next < images.length) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const image = images[next++];
        await decodeImage(image, signal, timeout); decoded.set(image, signature(image));
      }
    }));
  }
  // Never expose a page whose images keep changing during preparation.
  if (sources().some(image => decoded.get(image) !== signature(image))) throw new Error('Image set did not stabilize');
}

/**
 * prepare(target, {signal}) -> {element, title, focus?, mount?, dispose?, stylesheets?, images?}
 * mount runs while the screen is hidden. It MUST finish DOM/image construction
 * before resolving. dispose is called once, including abandoned late prepares.
 * Only explicitly resolvable first-party links are intercepted; all others stay native.
 */
export function mountNavigation({ header, viewport, screen, loader, error, retry, marker,
  initial, resolve, parseURL, urlFor, prepare, onRetry = () => {}, onCleanupError = () => {},
  timeout = 15000, videoSources = {
    desktop: '/brand/loading/agentflix-loading-desktop.mp4',
    mobile: '/brand/loading/agentflix-loading-mobile.mp4',
  } }) {
  const document = header.ownerDocument, window = document.defaultView;
  const nav = header.querySelector('[data-main-nav]');
  const video = loader.querySelector('video');
  const events = new AbortController(), { signal: eventsSignal } = events;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 700px), (orientation: portrait)');
  const disposedStages = new WeakSet();
  let current = resolve(initial), pending = current, failedTarget, controller, serial = 0;
  let activeStage, preparingStage, disposed = false;
  if (!current || !nav) throw new TypeError('Invalid initial route or navigation');

  function disposeStage(stage) {
    if (!stage || typeof stage !== 'object' || disposedStages.has(stage)) return;
    disposedStages.add(stage);
    try { stage.dispose?.(); } catch (error) { onCleanupError(error); }
  }
  function moveMarker() {
    viewport.style.minHeight = `calc(100dvh - ${header.offsetHeight}px)`;
    const target = [...nav.querySelectorAll('[data-section]')].find(a => a.dataset.section === pending.section);
    marker.hidden = pending.audience !== 'humano' || !target;
    if (!target) return;
    const box = target.getBoundingClientRect(), parent = nav.getBoundingClientRect();
    marker.style.width = `${box.width}px`;
    marker.style.transform = `translateX(${box.left - parent.left + nav.scrollLeft}px)`;
  }
  function syncVideo() {
    if (!video) return;
    if (viewport.dataset.state !== 'loading' || reduced.matches) { video.pause(); return; }
    const src = mobile.matches ? videoSources.mobile : videoSources.desktop;
    if (video.getAttribute('src') !== src) video.src = src;
    video.play()?.catch(() => {}); // Branded static symbol remains if autoplay fails.
  }
  function showState(state) {
    viewport.dataset.state = state;
    viewport.setAttribute('aria-busy', String(state === 'loading'));
    screen.hidden = state !== 'ready';
    screen.inert = state !== 'ready';
    loader.hidden = state !== 'loading';
    error.hidden = state !== 'error';
    syncVideo();
  }
  function selectReady(value) {
    nav.querySelectorAll('[data-section]').forEach(link => {
      link.removeAttribute('data-pending');
      if (link.dataset.section === value.section && value.audience === 'humano') link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.href = urlFor({ audience: 'humano', section: link.dataset.section, learn: false });
    });
    header.querySelectorAll('[data-audience]').forEach(link => {
      if (link.dataset.audience === value.audience) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.href = urlFor({ ...value, audience: link.dataset.audience });
    });
    moveMarker();
  }

  async function navigate(input, { history = true, focus = true } = {}) {
    const value = resolve(input);
    if (!value || disposed) return false;
    // Selecting the current destination must not remount a lesson or reset its scroll.
    if (activeStage && viewport.dataset.state === 'ready' && urlFor(value) === urlFor(current)) return true;
    controller?.abort();
    disposeStage(activeStage);
    disposeStage(preparingStage);
    activeStage = preparingStage = undefined;
    controller = new AbortController();
    const { signal } = controller, id = ++serial;
    pending = { ...value };
    nav.querySelectorAll('[data-pending]').forEach(link => link.removeAttribute('data-pending'));
    [...nav.querySelectorAll('[data-section]')].find(a => a.dataset.section === value.section)?.setAttribute('data-pending', 'true');
    moveMarker();
    showState('loading');
    const obsolete = () => signal.aborted || id !== serial || disposed;
    try {
      // A cancelled prepare may still resolve: it must not leak resources or commit.
      const preparation = Promise.resolve().then(() => {
        if (obsolete()) throw new DOMException('Aborted', 'AbortError');
        return prepare(value, { signal });
      });
      preparation.then(stage => { if (obsolete()) disposeStage(stage); }, () => {});
      const stage = await bounded(() => preparation, signal, timeout);
      if (obsolete()) { disposeStage(stage); return false; }
      if (!stage?.element || stage.element.ownerDocument !== document) throw new TypeError('Invalid prepared route');
      preparingStage = stage;
      screen.replaceChildren(stage.element);
      await bounded(() => stage.mount?.({ signal }), signal, timeout);
      await prepareVisuals(stage.visualRoot || screen, signal, { timeout, stylesheets: stage.stylesheets, images: stage.images });
      await stage.beforeReady?.({ signal });
      if (obsolete()) { disposeStage(stage); return false; }
      activeStage = stage;
      preparingStage = undefined;
      current = { ...value };
      failedTarget = undefined;
      selectReady(current);
      if (history) window.history.pushState(null, '', urlFor(current));
      if (stage.title) document.title = stage.title;
      showState('ready');
      stage.afterReady?.();
      if (focus) window.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
      if (focus) (stage.focus || screen.querySelector('h1') || screen).focus({ preventScroll: true });
      return true;
    } catch (cause) {
      if (obsolete()) return false;
      controller.abort();
      disposeStage(preparingStage);
      preparingStage = undefined;
      screen.replaceChildren();
      failedTarget = { ...value };
      pending = current;
      selectReady(current);
      showState('error');
      error.querySelector('h1')?.focus({ preventScroll: true });
      return false;
    }
  }
  header.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || link.target && link.target !== '_self') return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const target = resolve(parseURL(url));
    if (!target) return;
    event.preventDefault();
    void navigate(target);
  }, { signal: eventsSignal });
  retry.addEventListener('click', () => {
    if (!failedTarget) return;
    onRetry(failedTarget);
    void navigate(failedTarget);
  }, { signal: eventsSignal });
  window.addEventListener('popstate', () => {
    const target = resolve(parseURL(new URL(window.location.href)));
    if (target) void navigate(target, { history: false });
  }, { signal: eventsSignal });
  nav.addEventListener('scroll', moveMarker, { signal: eventsSignal });
  reduced.addEventListener('change', syncVideo, { signal: eventsSignal });
  mobile.addEventListener('change', syncVideo, { signal: eventsSignal });
  const resize = new ResizeObserver(moveMarker);
  resize.observe(nav);
  resize.observe(header);
  document.fonts.ready.then(() => { if (!disposed) moveMarker(); });
  selectReady(current);
  const ready = navigate(current, { history: false, focus: false });
  let refreshSerial = 0;
  async function refresh() {
    const stage = activeStage, id = serial, refreshId = ++refreshSerial;
    if (!stage || disposed || controller.signal.aborted || viewport.dataset.state !== 'ready') return false;
    const { signal } = controller;
    // An update belongs to the mounted page. Keep its layout, focus and playback alive.
    // Only navigate() may replace the page with the branded loading/error screen.
    try {
      await prepareVisuals(stage.visualRoot || screen, signal, { timeout, images: stage.images });
      return !disposed && !signal.aborted && serial === id && refreshSerial === refreshId;
    } catch (_) {
      // A failed image update cannot dispose a course or erase the current selection.
      return false;
    }
  }
  return { ready, navigate, refresh, get current() { return { ...current }; }, dispose() {
    if (disposed) return;
    disposed = true;
    serial++;
    controller?.abort();
    events.abort();
    resize.disconnect();
    disposeStage(activeStage);
    disposeStage(preparingStage);
    video?.pause();
  } };
}
