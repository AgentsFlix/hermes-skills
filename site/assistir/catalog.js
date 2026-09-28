/* Acervo de séries: apresentação e interação. Reprodução pertence a player.js. */
(() => {
  "use strict";
  const model = window.AgentFlixWatchModel;
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${
      {
        play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        check: '<path d="m5 12 4 4 10-10"/>',
        left: '<path d="m15 5-7 7 7 7"/>',
        right: '<path d="m9 5 7 7-7 7"/>',
      }[name]
    }</svg>`;
  const duration = (seconds) =>
    seconds < 60 ? `${Math.round(seconds)}s` : `${Math.ceil(seconds / 60)}min`;
  let activeController;

  window.AgentFlixWatchCatalog = {
    create(data, hooks, scope = document, life = window.AgentFlixRouteLife.create()) {
      activeController?.abort();
      const controller = activeController = new AbortController();
      const { signal } = controller;
      life.onDispose(() => controller.abort());
      const root = scope.getElementById("watch-catalog");
      const query = scope.getElementById("watch-query");
      const search = scope.getElementById("watch-search");
      const searchToggle = scope.getElementById("watch-search-toggle");
      const listToggle = scope.getElementById("watch-list");
      const status = scope.getElementById("watch-status");
      const available = model.available(data);
      let saved = hooks.read("agentflix-watch-list-v1", []);
      saved = Array.isArray(saved)
        ? saved.filter((id) => typeof id === "string")
        : [];
      let listOnly = false,
        q = "";

      const url = (series, episode) => {
        return episode ? model.lessonUrl(series, episode.season, episode.ep) : `/assistir/?s=${encodeURIComponent(series.slug)}`;
      };
      const bookmark = (series) =>
        `<button class="watch-bookmark watch-icon" data-save="${esc(series.slug)}" aria-label="${saved.includes(series.slug) ? "Remover" : "Adicionar"} ${esc(series.name)} ${saved.includes(series.slug) ? "da" : "à"} minha lista" aria-pressed="${saved.includes(series.slug)}">${icon(saved.includes(series.slug) ? "check" : "plus")}</button>`;
      const metadata = (series) => {
        const chapters=series.seasons.reduce((total,season)=>total+(season.atividades?.length||0),0);
        return chapters ? `Temporada 1 · ${chapters} ${chapters===1?'capítulo interativo':'capítulos interativos'}` : series.em_breve ? "Temporada 1 · Em breve" : `${series.ano ? esc(series.ano) + " · " : ""}${model.episodes(series).length} episódios`;
      };
      const cover = (series, large = false) => {
        if (series.cover_layout === "editorial-wide") {
          return `<picture class="series-cover"><img src="${esc(large ? series.cover : series.cover_wide)}" alt="" width="1672" height="941" ${large ? 'fetchpriority="high"' : 'loading="lazy"'}></picture>`;
        }
        const image = `<img src="${esc(large ? series.cover : series.cover_wide)}" alt="" ${series.cover_mobile ? 'width="1536" height="1024"' : ""} ${large ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
        return series.cover_mobile
          ? `<picture class="series-cover${series.cover_has_title ? " art-with-title" : ""}"><source media="(max-width: 600px)" srcset="${esc(series.cover_mobile)}" width="1024" height="1536">${image}</picture>`
          : image;
      };

      function seriesCard(series, continuing) {
        const resume = continuing?.resume;
        const episode = resume && series.seasons[resume.season].eps[resume.ep];
        const t =
          episode && !resume.fresh
            ? model.progress(episode, hooks.read)?.t || 0
            : 0;
        const label = episode
          ? `Continuar ${series.name}`
          : `Mais informações sobre ${series.name}`;
        return `<article class="watch-card${series.cover_layout === "editorial-wide" ? " has-editorial-cover" : series.cover_mobile ? " has-responsive-cover" : ""}" data-series-card="${esc(series.slug)}">
          <div class="watch-art">
            <a href="${esc(url(series, episode ? { ...resume, number: series.seasons[resume.season].n } : null))}" data-series="${esc(series.slug)}" ${episode ? "data-play" : ""} aria-label="${esc(label)}">${cover(series)}<span class="watch-cover-fallback">${esc(series.name)}</span><span class="watch-card-play">${icon(episode ? "play" : "info")}</span></a>
            ${bookmark(series)}
            ${episode ? `<div class="watch-progress" aria-label="${Math.round((t / episode.d) * 100)}% do episódio"><i style="width:${(t / episode.d) * 100}%"></i></div>` : ""}
          </div>
          <h3><a href="${esc(url(series))}" data-series="${esc(series.slug)}">${esc(series.name)}</a></h3>
          <p>${episode ? `T${series.seasons[resume.season].n}:E${AgentFlixWatchModel.episodeNumber(episode, resume.ep)} · ${duration(episode.d - t)} restantes` : metadata(series)}</p>
        </article>`;
      }

      function episodeCard(series, item) {
        const episode = item.episode;
        const token = window.AgentFlixWatchAccess?.cachedToken(episode.stream_uid || episode.uid);
        const thumb = token
          ? `https://${series.customer}.cloudflarestream.com/${token}/thumbnails/thumbnail.jpg?height=270`
          : (series.cover_wide || series.cover || "");
        return `<article class="watch-card watch-episode">
          <div class="watch-art"><a href="${esc(url(series, item))}" data-series="${esc(series.slug)}" data-season="${item.season}" data-episode="${item.ep}" aria-label="Assistir ${esc(episode.t)}"><img src="${esc(thumb)}" alt="" loading="lazy"><span class="watch-cover-fallback">${esc(episode.t)}</span><span class="watch-card-play">${icon("play")}</span><span class="watch-duration">${duration(episode.d)}</span></a></div>
          <p class="watch-episode-number">T${item.number}:E${AgentFlixWatchModel.episodeNumber(episode, item.ep)}</p><h3><a href="${esc(url(series, item))}" data-series="${esc(series.slug)}" data-season="${item.season}" data-episode="${item.ep}">${esc(episode.t)}</a></h3>
        </article>`;
      }

      function shelf(id, title, cards) {
        return `<section class="watch-shelf" aria-labelledby="watch-row-${esc(id)}">
          <div class="watch-shelf-head"><h2 id="watch-row-${esc(id)}">${esc(title)}</h2><div class="watch-arrows" hidden><button class="watch-icon" data-scroll="-1" aria-label="Voltar em ${esc(title)}">${icon("left")}</button><button class="watch-icon" data-scroll="1" aria-label="Avançar em ${esc(title)}">${icon("right")}</button></div></div>
          <div class="watch-rail" tabindex="0" aria-label="${esc(title)}">${cards.join("")}</div>
        </section>`;
      }

      function hero(series) {
        const r = model.resume(series, hooks.read);
        const started = model
          .episodes(series)
          .some((item) => model.progress(item.episode, hooks.read));
        return `<section class="watch-hero${series.cover_layout === "editorial-wide" ? " has-editorial-cover" : series.cover_mobile ? " has-responsive-cover" : ""}" aria-labelledby="watch-featured-name">
          <div class="watch-hero-art">${cover(series, true)}</div><div class="watch-hero-shade"></div>
          <div class="watch-hero-copy"><p class="watch-kicker">${esc(series.badge || "AgentFlix")}</p>
            <h1 id="watch-featured-name">${esc(series.name)}</h1>
            <p class="watch-meta">Série <span>·</span> ${esc(series.gen?.[0] || "Passo a passo")} <span>·</span> ${metadata(series)}</p>
            <p class="watch-hero-description">${esc(series.sub || series.syn)}</p>
            <div class="watch-actions">${series.em_breve || series.seasons.some(s => s.atividades?.length) ? `<a class="watch-button primary" href="${esc(url(series))}" data-series="${esc(series.slug)}">Ver temporada 1</a>` : `<a class="watch-button primary" href="${esc(url(series, { ...r, number: series.seasons[r.season].n }))}" data-series="${esc(series.slug)}" data-play>${icon("play")}${started && !r.finished ? `Continuar T${series.seasons[r.season].n}:E${AgentFlixWatchModel.episodeNumber(series.seasons[r.season].eps[r.ep], r.ep)}` : "Assistir"}</a>`}<a class="watch-button secondary" href="${esc(url(series))}" data-series="${esc(series.slug)}">${icon("info")}Mais informações</a></div>
          </div>
          ${series.traits?.length ? `<div class="watch-hero-note">${esc(series.traits.slice(0, 2).join(" · "))}</div>` : ""}
        </section>`;
      }

      function bindImages() {
        root.querySelectorAll("img").forEach((img) => {
          const loaded = () => {
            img.hidden = false;
            (img.closest("a") || img.parentElement).classList.add(
              "image-ready",
            );
          };
          const failed = () => (img.hidden = true);
          if (img.complete && img.naturalWidth) loaded();
          else {
            img.addEventListener("load", loaded, { once: true });
            img.addEventListener("error", failed, { once: true });
          }
        });
      }

      function updateRails() {
        root.querySelectorAll(".watch-rail").forEach((rail) => {
          const arrows = rail.parentElement.querySelector(".watch-arrows");
          const max = rail.scrollWidth - rail.clientWidth;
          arrows.hidden = max < 2;
          arrows.children[0].disabled = rail.scrollLeft < 2;
          arrows.children[1].disabled = rail.scrollLeft >= max - 2;
        });
      }

      function render() {
        listToggle.setAttribute("aria-pressed", String(listOnly));
        const featured =
          available.find((s) => s.slug === data.vitrine?.destaque) ||
          available[0];
        if (!featured) {
          message(
            "As próximas histórias começam aqui",
            "As séries publicadas aparecerão neste acervo.",
          );
          return;
        }
        const filtered = q || listOnly;
        if (filtered) {
          const matches = available.filter(
            (s) =>
              (!listOnly || saved.includes(s.slug)) &&
              [s.name, s.sub, ...(s.gen || [])]
                .join(" ")
                .toLocaleLowerCase("pt-BR")
                .includes(q.toLocaleLowerCase("pt-BR")),
          );
          const heading = listOnly ? "Minha lista" : "Resultados da busca";
          root.innerHTML = `<div class="watch-results"><h1 tabindex="-1">${heading}</h1><p class="watch-result-count" role="status">${matches.length} ${matches.length === 1 ? "série" : "séries"}</p>${matches.length ? `<div class="watch-grid">${matches.map((s) => seriesCard(s)).join("")}</div>` : `<div class="watch-empty"><p>${q ? "Nenhuma série encontrada. Tente outro nome." : "Guarde as séries que você quer assistir por aqui."}</p><button class="watch-button secondary" data-clear-watch>Ver todas as séries</button></div>`}</div>`;
        } else {
          const continuing = model.continuing(data, hooks.read);
          root.innerHTML =
            hero(featured) +
            (continuing.length
              ? shelf(
                  "continue",
                  "Continuar assistindo",
                  continuing.map((item) => seriesCard(item.series, item)),
                )
              : "") +
            model
              .rows(data)
              .map((row) =>
                shelf(
                  row.id,
                  row.titulo,
                  row.series.map((s) => seriesCard(s)),
                ),
              )
              .join("") +
            (model.episodes(featured).length ? shelf(
              "episodes",
              `Episódios · ${featured.badge || featured.name}`,
              model
                .episodes(featured)
                .map((item) => episodeCard(featured, item)),
            ) : "") +
            `<footer class="watch-footer"><span>AgentFlix</span><p>${window.AgentFlixMemory?.status.available ? "O progresso e a sua lista estão sincronizados com sua conta." : "O progresso e a sua lista ficam neste navegador."}</p><a href="/privacidade.html">Privacidade</a></footer>`;
        }
        bindImages();
        root.querySelectorAll(".watch-rail").forEach((rail) =>
          rail.addEventListener("scroll", updateRails, {
            passive: true,
            signal,
          }),
        );
        life.frame(updateRails);
      }

      function message(title, text) {
        root.innerHTML = `<div class="watch-state"><h1 tabindex="-1">${esc(title)}</h1><p>${esc(text)}</p><a class="watch-button secondary" href="/assistir/" data-watch-home>Voltar às séries</a></div>`;
      }
      function reset() {
        listOnly = false;
        q = "";
        query.value = "";
        search.hidden = true;
        searchToggle.setAttribute("aria-expanded", "false");
      }
      function activateCatalog() {
        if (root.hidden) hooks.home();
      }
      function closeSearch() {
        search.hidden = true;
        searchToggle.setAttribute("aria-expanded", "false");
        query.value = "";
        q = "";
        if (!root.hidden) render();
        searchToggle.focus();
      }

      root.addEventListener(
        "click",
        (event) => {
          const control = event.target.closest(
            "[data-series],[data-save],[data-scroll],[data-clear-watch]",
          );
          if (
            !control ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          if (control.hasAttribute("data-save")) {
            const slug = control.dataset.save;
            saved = saved.includes(slug)
              ? saved.filter((id) => id !== slug)
              : [...saved, slug];
            let persisted = true;
            try {
              localStorage.setItem(
                "agentflix-watch-list-v1",
                JSON.stringify(saved),
              );
            } catch {
              persisted = false;
            }
            const selected = saved.includes(slug);
            root.querySelectorAll("[data-save]").forEach((b) => {
              if (b.dataset.save !== slug) return;
              b.setAttribute("aria-pressed", String(selected));
              b.innerHTML = icon(selected ? "check" : "plus");
              const series = available.find((s) => s.slug === slug);
              b.setAttribute(
                "aria-label",
                `${selected ? "Remover" : "Adicionar"} ${series.name} ${selected ? "da" : "à"} minha lista`,
              );
            });
            status.textContent = persisted
              ? selected
                ? `Série adicionada à sua lista${window.AgentFlixMemory?.status.available ? " e à sua conta" : ""}.`
                : `Série removida da sua lista${window.AgentFlixMemory?.status.available ? " e da sua conta" : ""}.`
              : "Sua lista vale nesta visita. Não foi possível salvar no navegador.";
            if (listOnly) {
              render();
              root.querySelector("h1").focus();
            }
          } else if (control.hasAttribute("data-scroll")) {
            const rail = control
              .closest(".watch-shelf")
              .querySelector(".watch-rail");
            rail.scrollBy({
              left: +control.dataset.scroll * rail.clientWidth * 0.9,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
          } else if (control.hasAttribute("data-clear-watch")) {
            reset();
            render();
            root.querySelector("h1").tabIndex = -1;
            root.querySelector("h1").focus();
          } else
            hooks.select(
              control.dataset.series,
              control.hasAttribute("data-play"),
              control.hasAttribute("data-season")
                ? {
                    season: +control.dataset.season,
                    ep: +control.dataset.episode,
                  }
                : null,
            );
        },
        { signal },
      );
      searchToggle.addEventListener(
        "click",
        () => {
          activateCatalog();
          search.hidden = false;
          searchToggle.setAttribute("aria-expanded", "true");
          query.focus();
        },
        { signal },
      );
      scope
        .getElementById("watch-search-close")
        .addEventListener("click", closeSearch, { signal });
      search.addEventListener("submit", (event) => event.preventDefault(), {
        signal,
      });
      query.addEventListener(
        "input",
        () => {
          q = query.value.trim();
          render();
        },
        { signal },
      );
      query.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            closeSearch();
          }
        },
        { signal },
      );
      listToggle.addEventListener(
        "click",
        () => {
          activateCatalog();
          listOnly = !listOnly;
          render();
          window.scrollTo({ top: 0, behavior: "instant" });
        },
        { signal },
      );
      window.addEventListener("resize", updateRails, { signal });
      window.addEventListener(
        "storage",
        (event) => {
          if (event.key === "agentflix-watch-list-v1") {
            const next = hooks.read(event.key, []);
            saved = Array.isArray(next) ? next : [];
          }
          if (
            !root.hidden &&
            (!event.key ||
              event.key.startsWith("agentflix-prog-") ||
              event.key === "agentflix-watch-list-v1")
          )
            render();
        },
        { signal },
      );
      return { render, message, reset, dispose: () => controller.abort(), search: () => searchToggle.click() };
    },
  };
})();
