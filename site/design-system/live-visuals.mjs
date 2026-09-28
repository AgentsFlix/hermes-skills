import { decodeImage } from './navigation.mjs';
import { isPreviewVisual, isDormantRouteVisual } from './preview-visuals.mjs';

/** Images added after navigation prepare locally; the mounted route stays visible. */
export function mountLiveVisuals(root, life) {
  const images = () => [...root.querySelectorAll('img')].filter(image =>
    !isPreviewVisual(image) && !isDormantRouteVisual(image, root) &&
    (image.getAttribute('src') || image.getAttribute('srcset')));
  const key = image => [image.src, image.srcset, image.currentSrc,
    ...Array.from(image.closest('picture')?.querySelectorAll('source') || [], source => source.srcset + '|' + source.media)].join('|');
  const known = new WeakMap(images().map(image => [image, key(image)]));
  const visibility = new WeakMap();
  const pending = new Map();
  const restore = (image, entry) => { image.style.visibility = entry.visibility; };
  function changed() {
    if (life.signal.aborted) return;
    for (const [image, entry] of pending) {
      if (!root.contains(image) || isDormantRouteVisual(image, root)) {
        entry.controller.abort(); restore(image, entry); pending.delete(image);
      }
    }
    for (const image of images()) {
      const source = key(image);
      if (known.get(image) === source || pending.get(image)?.source === source) continue;
      const old = pending.get(image);
      if (old) { old.controller.abort(); restore(image, old); }
      if (!visibility.has(image)) visibility.set(image, image.style.visibility);
      const entry = { source, controller: new AbortController(), visibility: visibility.get(image) };
      pending.set(image, entry);
      image.dataset.afVisualState = 'loading';
      // Cached/predecoded replacements can remain visible; new resources reserve their box.
      if (!image.complete || !image.naturalWidth) image.style.visibility = 'hidden';
      const valid = () => !life.signal.aborted && pending.get(image) === entry && root.contains(image);
      void decodeImage(image, entry.controller.signal).then(() => {
        if (!valid()) return;
        known.set(image, key(image)); restore(image, entry);
        image.dataset.afVisualState = 'ready'; pending.delete(image);
      }, () => {
        if (!valid()) return;
        known.set(image, source); image.style.visibility = 'hidden';
        image.dataset.afVisualState = 'error'; pending.delete(image);
      });
    }
  }
  life.observe(new MutationObserver(changed), root, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['src', 'srcset', 'sizes', 'media', 'hidden'],
  });
  life.listen(root.ownerDocument.defaultView, 'resize', changed);
  life.onDispose(() => {
    for (const [image, entry] of pending) { entry.controller.abort(); restore(image, entry); }
    pending.clear();
  });
}
