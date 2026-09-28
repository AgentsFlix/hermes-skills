/* Explicit lifetime for native page controllers. No global monkey-patching. */
(() => {
  window.AgentFlixRouteLife = Object.freeze({ create(parentSignal) {
    const controller = new AbortController(), { signal } = controller;
    const cleanups = [], timeouts = new Set(), intervals = new Set(), frames = new Set();
    const dispose = () => {
      if (signal.aborted) return;
      controller.abort();
      timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); frames.forEach(cancelAnimationFrame);
      const errors = [];
      for (const cleanup of cleanups.reverse()) { try { cleanup(); } catch (error) { errors.push(error); } }
      parentSignal?.removeEventListener('abort', dispose);
      if (errors.length) throw new AggregateError(errors, 'Route cleanup failed');
    };
    parentSignal?.addEventListener('abort', dispose, { once: true });
    if (parentSignal?.aborted) dispose();
    return {
      signal, dispose,
      onDispose(fn) { if (signal.aborted) fn(); else cleanups.push(fn); },
      listen(target, type, callback, options = {}) {
        if (signal.aborted) return;
        const opts = typeof options === 'boolean' ? { capture: options } : options;
        // Preserve a controller's own signal as well as its parent route's lifetime.
        target.addEventListener(type, callback, { ...opts, signal });
        if (opts.signal) {
          const remove = () => target.removeEventListener(type, callback, opts);
          if (opts.signal.aborted) remove();
          else { opts.signal.addEventListener('abort', remove, { once: true }); cleanups.push(() => opts.signal.removeEventListener('abort', remove)); }
        }
      },
      timeout(fn, ms, ...args) {
        if (signal.aborted) return;
        const id = setTimeout(() => { timeouts.delete(id); if (!signal.aborted) fn(...args); }, ms);
        timeouts.add(id); return id;
      },
      interval(fn, ms, ...args) {
        if (signal.aborted) return;
        const id = setInterval(() => { if (!signal.aborted) fn(...args); }, ms);
        intervals.add(id); return id;
      },
      frame(fn) {
        if (signal.aborted) return;
        const id = requestAnimationFrame(t => { frames.delete(id); if (!signal.aborted) fn(t); });
        frames.add(id); return id;
      },
      observe(observer, target, options) { observer.observe(target, options); cleanups.push(() => observer.disconnect()); return observer; },
    };
  } });
})();
