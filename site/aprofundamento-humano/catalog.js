function AgentFlixMountAssessmentGallery(options) {
  const { root = document, life = window.AgentFlixRouteLife.create(), header = document.querySelector('header'), routeURL = new URL(location.href) } = options || {};
  "use strict";

  const gallery = root.querySelector(".assessment-gallery");
  if (!gallery) return;

  const cards = Array.from(gallery.querySelectorAll("[data-card]"));
  const choices = Array.from(gallery.querySelectorAll(".af-gallery-choices [data-preview]"));
  const position = root.getElementById("catalog-position");
  const announcement = root.getElementById("catalog-announcement");
  const targets = ["disc", "aprendizagem", "acao", "big-five", "eneagrama", "jung"];
  const titles = cards.map(function (card) { return card.querySelector("h3").textContent; });
  let galleryIndex = Math.max(0, targets.indexOf(routeURL.hash.slice(1)));

  function wrapped(index) {
    return (index + cards.length) % cards.length;
  }

  function update() {
    const left = wrapped(galleryIndex - 1);
    const right = wrapped(galleryIndex + 1);

    cards.forEach(function (card, index) {
      const active = index === galleryIndex;
      const visible = active || index === left || index === right;
      card.hidden = !visible;
      card.dataset.position = active ? "front" : index === left ? "left" : "right";

      const content = card.querySelector(".af-spatial-content");
      const open = card.querySelector("a");
      const preview = card.querySelector(".af-spatial-preview");
      content.setAttribute("aria-hidden", String(!active));
      open.tabIndex = active ? 0 : -1;
      preview.hidden = active || !visible;
    });

    choices.forEach(function (choice, index) {
      const active = index === galleryIndex;
      choice.setAttribute("aria-pressed", String(active));
      choice.tabIndex = active ? 0 : -1;
    });

    position.textContent = String(galleryIndex + 1) + " de " + String(cards.length);
  }

  function select(index, options) {
    galleryIndex = wrapped(index);
    update();
    if (options && options.focusCard) {
      root.getElementById("catalog-open-" + galleryIndex).focus({ preventScroll: true });
    }
    if (options && options.focusChoice) {
      root.getElementById("catalog-choice-" + galleryIndex).focus({ preventScroll: true });
    }
    if (!options || options.announce !== false) {
      announcement.textContent = "Assessment " + String(galleryIndex + 1) + " de " + String(cards.length) + ": " + titles[galleryIndex];
    }
  }

  life.listen(gallery, "click", function (event) {
    const control = event.target.closest("button");
    if (!control) return;
    if (control.hasAttribute("data-preview")) {
      select(Number(control.dataset.preview), { focusCard: control.classList.contains("af-spatial-preview") });
      return;
    }
    if (control.hasAttribute("data-shift")) select(galleryIndex + Number(control.dataset.shift));
  });

  life.listen(gallery, "keydown", function (event) {
    if (!event.target.closest(".af-gallery-choices, .af-gallery-controls")) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? cards.length - 1 : galleryIndex + (event.key === "ArrowRight" ? 1 : -1);
    select(next, { focusChoice: true });
  });

  life.listen(window, "hashchange", function () {
    const target = targets.indexOf(location.hash.slice(1));
    if (target !== -1 && target !== galleryIndex) select(target, { announce: false });
  });

  update();
}
window.AgentFlixMountAssessmentGallery = AgentFlixMountAssessmentGallery;
if (!window.AgentFlixShellEntry && !window.AgentFlixProductShell && document.getElementById('catalog-position')) AgentFlixMountAssessmentGallery();
