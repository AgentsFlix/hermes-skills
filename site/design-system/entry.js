/* A direct visit enters the persistent host once. Internal routes do not reload. */
(() => {
  const url = new URL(location.href);
  if (!['/assistir/', '/aprender/', '/para-agente/', '/aprofundamento-humano/'].includes(url.pathname) && !/^\/aulas\/[a-z0-9-]+\/t[1-9]\d*\/e[1-9]\d*\/$/.test(url.pathname)) return;
  window.AgentFlixShellEntry = true;
  location.replace('/?af-route=' + encodeURIComponent(url.pathname + url.search + url.hash));
})();
