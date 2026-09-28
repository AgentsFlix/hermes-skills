import { prepareVisuals } from './navigation.mjs';

// Hover owns its image readiness; opening a preview is not a route transition.
export const isPreviewVisual = element => Boolean(element?.closest?.('#preview'));
// A parked route is not a dormant subsection: only hidden ancestors inside it count.
export const isDormantRouteVisual = (element, root) => {
  const hidden = element?.closest?.('[hidden]');
  return Boolean(hidden && root.contains(hidden));
};

export function mountPreviewVisuals(preview, life) {
  if (!preview) return;
  const visibility = preview.style.visibility, inert = preview.inert;
  let controller, generation = 0, known = new Map();
  const key = image => image.getAttribute('src') + '|' + image.getAttribute('srcset');
  const restore = () => { preview.style.visibility = visibility; preview.inert = inert; };
  function refresh() {
    const images = [...preview.querySelectorAll('img')].filter(image => image.getAttribute('src') || image.getAttribute('srcset'));
    if (!preview.hidden && images.length === known.size && images.every(image => known.get(image) === key(image))) return;
    controller?.abort();
    const version = ++generation;
    if (preview.hidden || life.signal.aborted) { known.clear(); restore(); return; }
    known = new Map(images.map(image => [image, key(image)]));
    controller = new AbortController();
    const current = controller, abort = () => current.abort();
    life.signal.addEventListener('abort', abort, { once: true });
    preview.style.visibility = 'hidden'; preview.inert = true;
    const valid = () => version === generation && !current.signal.aborted && !life.signal.aborted;
    void prepareVisuals(preview, current.signal).then(() => {
      if (valid() && !preview.hidden) restore();
    }, () => {
      // A broken preview never tears down the catalog or exposes an incomplete image.
      if (valid()) { preview.hidden = true; restore(); }
    }).finally(() => life.signal.removeEventListener('abort', abort));
  }
  const observer = new MutationObserver(refresh);
  life.observe(observer, preview, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset', 'hidden'] });
  life.onDispose(() => { generation++; controller?.abort(); restore(); });
  refresh();
}
