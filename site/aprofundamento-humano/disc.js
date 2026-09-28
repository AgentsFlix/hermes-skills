function AgentFlixMountDisc(options) {
  const { root = document, life = window.AgentFlixRouteLife.create(), header = document.querySelector('header'), routeURL = new URL(location.href) } = options || {};
  "use strict";

  const data = window.AgentFlixDiscData;
  const model = window.AgentFlixDiscModel;
  let storageKey;
  const dimensions = ["D", "I", "S", "C"];

  const elements = {
    intro: root.getElementById("disc-intro"),
    quiz: root.getElementById("disc-quiz"),
    result: root.getElementById("disc-result"),
    start: root.getElementById("start-disc"),
    form: root.getElementById("disc-form"),
    questionList: root.getElementById("question-list"),
    roundKicker: root.getElementById("round-kicker"),
    roundTitle: root.getElementById("round-title"),
    roundHelpShell: root.getElementById("round-help"),
    roundHelp: root.getElementById("round-help-copy"),
    answeredCount: root.getElementById("answered-count"),
    questionProgress: root.getElementById("question-progress"),
    formMessage: root.getElementById("form-message"),
    previous: root.getElementById("previous-round"),
    next: root.getElementById("next-round"),
    resultTitle: root.getElementById("result-title"),
    resultLede: root.getElementById("result-lede"),
    scoreGrid: root.getElementById("score-grid"),
    profileReading: root.getElementById("profile-reading"),
    copy: root.getElementById("copy-result"),
    copyStatus: root.getElementById("copy-status"),
    restart: root.getElementById("restart-disc")
  };

  let state;

  function setButtonText(button, text) {
    const textNode = Array.from(button.childNodes).find(function (child) { return child.nodeType === Node.TEXT_NODE; });
    if (textNode) textNode.textContent = text + " ";
    else button.prepend(document.createTextNode(text + " "));
  }

  function emptyState() {
    return { started: false, roundIndex: 0, questionIndex: 0, answers: {}, result: null };
  }

  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (!saved || typeof saved !== "object" || typeof saved.answers !== "object") return emptyState();
      saved.roundIndex = Math.max(0, Math.min(2, Number(saved.roundIndex) || 0));
      saved.questionIndex = Math.max(0, Math.min(data.questions.length - 1, Number(saved.questionIndex) || 0));
      return Object.assign(emptyState(), saved);
    } catch (_) {
      return emptyState();
    }
  }

  function saveState() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {
      // O assessment continua funcional quando o navegador bloqueia armazenamento local.
    }
  }

  function scrollToShell() {
    root.getElementById("disc").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startAssessment() {
    state.started = true;
    state.result = null;
    saveState();
    elements.intro.hidden = true;
    elements.result.hidden = true;
    elements.quiz.hidden = false;
    renderRound();
    scrollToShell();
  }

  function createQuestion(question, questionIndex, roundId) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "question";
    fieldset.dataset.question = String(questionIndex);

    const legend = document.createElement("legend");
    const number = document.createElement("span");
    number.className = "question-number";
    number.textContent = String(questionIndex + 1).padStart(2, "0");
    const questionText = document.createElement("strong");
    questionText.className = "question-copy";
    questionText.tabIndex = -1;
    questionText.textContent = question.text;
    const instruction = document.createElement("span");
    instruction.className = "question-instruction";
    instruction.textContent = "Selecione apenas uma alternativa";
    legend.append(number, questionText);
    fieldset.append(legend, instruction);

    const choices = document.createElement("div");
    choices.className = "choice-list";

    question.options.forEach(function (option, choiceIndex) {
      const label = document.createElement("label");
      label.className = "choice";
      label.dataset.choice = String(choiceIndex);

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "question-" + questionIndex + "-" + roundId;
      input.value = String(choiceIndex);
      input.checked = Boolean(state.answers[questionIndex]) && state.answers[questionIndex][roundId] === choiceIndex;
      input.disabled = model.isChoiceUsed(state.answers, questionIndex, roundId, choiceIndex);
      life.listen(input, "change", function () {
        selectChoice(questionIndex, roundId, choiceIndex);
      });

      const text = document.createElement("strong");
      text.className = "choice-copy";
      text.textContent = option;
      const marker = document.createElement("span");
      marker.className = "choice-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = String.fromCharCode(65 + choiceIndex);
      const selectedIcon = document.createElement("af-icon");
      selectedIcon.className = "choice-state-icon";
      selectedIcon.setAttribute("name", "success");
      selectedIcon.setAttribute("aria-hidden", "true");
      label.append(input, marker, text, selectedIcon);
      choices.appendChild(label);
    });

    fieldset.appendChild(choices);
    return fieldset;
  }

  function selectChoice(questionIndex, roundId, choiceIndex) {
    const answer = Object.assign({}, state.answers[questionIndex] || {});
    data.rounds.forEach(function (round) {
      if (round.id !== roundId && answer[round.id] === choiceIndex) delete answer[round.id];
    });
    answer[roundId] = choiceIndex;
    state.answers[questionIndex] = answer;
    state.result = null;
    saveState();
    updateCompletion();
  }

  function updateCompletion() {
    const round = data.rounds[state.roundIndex];
    const answer = state.answers[state.questionIndex];
    const answered = Boolean(answer && Number.isInteger(answer[round.id]));
    elements.answeredCount.textContent = "Questão " + String(state.questionIndex + 1).padStart(2, "0") + " de " + String(data.questions.length).padStart(2, "0");
    elements.questionProgress.value = state.questionIndex + 1;
    elements.questionProgress.textContent = (state.questionIndex + 1) + " de " + data.questions.length;
    elements.next.disabled = !answered;
    elements.formMessage.textContent = "";
  }

  function updateProgress(activeId) {
    const order = ["most", "least", "somewhat", "result"];
    const activeIndex = order.indexOf(activeId);
    root.querySelectorAll("[data-progress]").forEach(function (item) {
      const index = order.indexOf(item.dataset.progress);
      item.classList.toggle("is-current", index === activeIndex);
      item.classList.toggle("is-complete", index < activeIndex);
      if (index === activeIndex) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  }

  function renderRoundHelp(round) {
    const emphasis = round.emphasis;
    const emphasisIndex = emphasis ? round.help.indexOf(emphasis) : -1;
    elements.roundHelpShell.dataset.tone = round.id;
    elements.roundHelp.className = "round-help-copy";
    if (emphasisIndex < 0) {
      elements.roundHelp.textContent = round.help;
      return;
    }

    const keyword = document.createElement("strong");
    keyword.className = "round-help-emphasis";
    keyword.textContent = emphasis;
    elements.roundHelp.replaceChildren(
      document.createTextNode(round.help.slice(0, emphasisIndex)),
      keyword,
      document.createTextNode(round.help.slice(emphasisIndex + emphasis.length))
    );
  }

  function renderRound() {
    const round = data.rounds[state.roundIndex];
    const question = data.questions[state.questionIndex];
    elements.roundKicker.textContent = "Rodada " + (state.roundIndex + 1) + " de " + data.rounds.length;
    elements.roundTitle.textContent = round.title;
    renderRoundHelp(round);
    elements.quiz.dataset.round = round.id;
    elements.previous.hidden = state.roundIndex === 0 && state.questionIndex === 0;
    const isLastQuestion = state.questionIndex === data.questions.length - 1;
    const isLastRound = state.roundIndex === data.rounds.length - 1;
    setButtonText(elements.next, isLastQuestion ? (isLastRound ? "Calcular meu perfil" : "Próxima rodada") : "Continuar");
    elements.formMessage.textContent = "";
    const renderedQuestion = createQuestion(question, state.questionIndex, round.id);
    elements.questionList.replaceChildren(renderedQuestion);
    renderedQuestion.querySelector(".question-instruction").after(elements.roundHelpShell);
    updateProgress(round.id);
    updateCompletion();
    elements.questionList.querySelector(".question-copy").focus({ preventScroll: true });
  }

  function nextRound(event) {
    event.preventDefault();
    const round = data.rounds[state.roundIndex];
    const answer = state.answers[state.questionIndex];
    if (!answer || !Number.isInteger(answer[round.id])) {
      elements.formMessage.textContent = "Escolha uma alternativa para continuar.";
      return;
    }

    if (state.questionIndex < data.questions.length - 1) {
      state.questionIndex += 1;
      saveState();
      renderRound();
      return;
    }

    if (!model.isRoundComplete(data.questions, state.answers, round.id)) {
      state.questionIndex = data.questions.findIndex(function (_, index) {
        return !state.answers[index] || !Number.isInteger(state.answers[index][round.id]);
      });
      saveState();
      renderRound();
      return;
    }

    if (state.roundIndex < data.rounds.length - 1) {
      state.roundIndex += 1;
      state.questionIndex = 0;
      saveState();
      renderRound();
      scrollToShell();
      return;
    }
    showResult(true);
  }

  function previousRound() {
    if (state.questionIndex > 0) state.questionIndex -= 1;
    else if (state.roundIndex > 0) {
      state.roundIndex -= 1;
      state.questionIndex = data.questions.length - 1;
    } else return;
    saveState();
    renderRound();
  }

  function showResult(completed = false) {
    const scores = model.score(data.questions, state.answers, data.weights);
    const primary = model.primary(scores);
    const profile = data.profiles[primary];
    state.result = { scores: scores, primary: primary };
    window.AgentFlixAgentPrompt.ensure(state, window.AgentFlixAgentPrompt.disc(data, scores), state.answers, completed);
    saveState();
    window.AgentFlixAssessmentResults.mount(root.getElementById("disc-save-state"), state.agentRecord, completed);

    elements.quiz.hidden = true;
    elements.intro.hidden = true;
    elements.result.hidden = false;
    elements.resultTitle.textContent = profile.title;
    elements.resultLede.textContent = "Seu resultado combina quatro tendências. A letra em destaque é a que recebeu mais pontos neste preenchimento.";
    elements.scoreGrid.replaceChildren();

    dimensions.forEach(function (dimension) {
      const card = document.createElement("article");
      card.className = "score-card" + (dimension === primary ? " is-primary" : "");
      const heading = document.createElement("div");
      heading.className = "score-name";
      const name = document.createElement("strong");
      name.textContent = dimension + " · " + data.profiles[dimension].name;
      const value = document.createElement("span");
      value.textContent = String(scores[dimension]);
      heading.append(name, value);
      const track = document.createElement("div");
      track.className = "score-track";
      track.setAttribute("aria-label", data.profiles[dimension].name + ": " + scores[dimension] + " de 50 pontos");
      const bar = document.createElement("i");
      bar.style.width = (scores[dimension] / 50 * 100) + "%";
      track.appendChild(bar);
      card.append(heading, track);
      elements.scoreGrid.appendChild(card);
    });

    elements.profileReading.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = profile.title;
    const summary = document.createElement("p");
    summary.textContent = profile.summary;
    const details = document.createElement("dl");
    details.innerHTML = '<div><dt>Potência possível</dt><dd></dd></div><div><dt>Ponto de atenção</dt><dd></dd></div>';
    details.querySelectorAll("dd")[0].textContent = profile.strength;
    details.querySelectorAll("dd")[1].textContent = profile.attention;
    elements.profileReading.append(title, summary, details);

    elements.copyStatus.textContent = "";
    updateProgress("result");
    elements.resultTitle.focus({ preventScroll: true });
    scrollToShell();
    if (completed) openAgentPrompt();
  }

  function openAgentPrompt() {
    window.AgentFlixAgentPromptUI.open(state.agentRecord, root.getElementById("disc-agent-prompt"));
  }

  function resultText() {
    const result = state.result;
    if (!result) return "";
    const profile = data.profiles[result.primary];
    const scores = dimensions.map(function (dimension) {
      return data.profiles[dimension].name + ": " + result.scores[dimension];
    }).join("\n");
    return "Meu mapa DISC · AgentFlix\n\n" + scores + "\n\n" + profile.title + "\n" + profile.summary + "\n\nLeitura de autoconhecimento, não diagnóstico.";
  }

  async function copyResult() {
    const text = resultText();
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand("copy");
      area.remove();
    }
    elements.copyStatus.textContent = copied ? "Resultado copiado." : "Não foi possível copiar automaticamente. Selecione o conteúdo da página para salvar.";
  }

  function restartAssessment() {
    state = emptyState();
    try { sessionStorage.removeItem(storageKey); } catch (_) { /* sem armazenamento */ }
    elements.result.hidden = true;
    elements.quiz.hidden = true;
    elements.intro.hidden = false;
    setButtonText(elements.start, "Iniciar assessment");
    root.getElementById("disc-title").setAttribute("tabindex", "-1");
    root.getElementById("disc-title").focus({ preventScroll: true });
    scrollToShell();
  }

  life.listen(elements.start, "click", startAssessment);
  life.listen(elements.form, "submit", nextRound);
  life.listen(elements.previous, "click", previousRound);
  life.listen(elements.copy, "click", copyResult);
  life.listen(root.getElementById("disc-agent-prompt"), "click", openAgentPrompt);
  life.listen(elements.restart, "click", restartAssessment);

  elements.start.disabled = true;
  const ready = window.AgentFlixAssessmentResults.ready.then(() => {
    if (life.signal.aborted) return;
    storageKey = window.AgentFlixAssessmentResults.key("agentflix-disc-v1");
    state = loadState();
    elements.start.disabled = false;
    if (state.result && state.result.scores && state.result.primary) showResult();
    else if (state.started) setButtonText(elements.start, "Continuar assessment");
  });
  return { ready };
}
window.AgentFlixMountDisc = AgentFlixMountDisc;
if (!window.AgentFlixShellEntry && !window.AgentFlixProductShell && document.getElementById('disc-form')) AgentFlixMountDisc();
