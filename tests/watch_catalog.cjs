const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sandbox = { module: { exports: {} } };
require("node:vm").runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "../site/assistir/catalog-model.js"),
    "utf8",
  ),
  sandbox,
);
const model = sandbox.module.exports;
const resume = (series, read) =>
  JSON.parse(JSON.stringify(model.resume(series, read)));
const continuing = (data, read) => Array.from(model.continuing(data, read));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../site/assistir/series.json")),
);
const upcoming = data.series.find(s => s.slug === "hermes-em-operacao");
assert.ok(model.available(data).some(s => s === upcoming));
assert.ok(model.episodes(upcoming).length >= 3);
assert.deepEqual(
  Array.from(model.episodes(upcoming).slice(0, 3), ({ episode }, index) =>
    model.episodeNumber(episode, index),
  ),
  [2, 3, 4],
);
assert.deepEqual(upcoming.seasons[0].atividades.map(item => item.n), [2, 3, 4]);
assert.equal(upcoming.seasons[0].atividades[1].url, 'hermes-em-operacao/t1e3/');
assert.equal(model.episodeNumber(model.episodes(upcoming)[0].episode, 0), 2);
const operationEpisode = model.episodes(upcoming)[1].episode;
assert.equal(operationEpisode.t, "Construa o segundo cérebro da sua marca");
assert.equal(operationEpisode.ch.at(-1).acao.tipo, "videos");
assert.equal(operationEpisode.ch.at(-1).acao.videos.length, 11);
assert.equal(model.continuing({series:[upcoming]}, () => null).length, 0);
assert.equal(model.available({series:[{...upcoming, em_breve: false, seasons: [{n:1, eps:[]}]}]}).length, 0);
data.series = data.series.filter(s => s !== upcoming);
const series = data.series.find((s) => s.slug === "hermes-agent");
const memory = {};
const read = (key, fallback) => memory[key] ?? fallback;
const save = (episode, t, at) =>
  (memory[`agentflix-prog-${episode.uid}`] = { t, at });
const first = series.seasons[0].eps[0];
const branch = series.seasons[1];
assert.deepEqual(
  model.available(data).map((s) => s.slug),
  ["hermes-agent"],
);
assert.deepEqual(resume(series, read), { season: 0, ep: 0, fresh: true });
assert.deepEqual(continuing(data, read), []);
save(first, 60, 1);
assert.equal(resume(series, read).fresh, false);
assert.equal(model.continuing(data, read)[0].series.slug, series.slug);
save(first, first.d, 2);
assert.equal(resume(series, read).ep, 0, "a escolha precede o episódio seguinte da mesma temporada");
assert.equal(
  resume(series, read).season,
  0,
  "raiz sem escolha não pula para um caminho",
);
memory[`agentflix-caminho-${series.slug}`] = { temporada: 1, episodio: 2 };
assert.deepEqual(resume(series, read), { season: 0, ep: 1, fresh: true });
assert.deepEqual(JSON.parse(JSON.stringify(model.choiceTarget(series, first.escolha.opcoes[0]))), { season: 0, ep: 1 });
for (const choice of [{ temporada: 1 }, { temporada: 1, episodio: 99 }, { temporada: 2 }, { temporada: 3, episodio: 2 }]) {
  memory[`agentflix-caminho-${series.slug}`] = choice;
  assert.deepEqual(resume(series, read), { season: 0, ep: 0, fresh: true }, "escolha inválida ou não oferecida volta à raiz");
}
assert.equal(model.choiceTarget(series, { temporada: 1, episodio: 0 }), null);
assert.equal(model.choiceTarget(series, { temporada: 1, episodio: 1.5 }), null);
assert.equal(model.choiceTarget(series, { temporada: 1, episodio: 99 }), null);
assert.equal(model.choiceTarget(series, { temporada: 1, episodio: 2, em_breve: true }), null);
const easy = series.seasons[0].eps[1];
save(easy, easy.d, 3);
assert.deepEqual(resume(series, read), { season: 0, ep: 2, fresh: true }, "T1E2 segue para o onboarding em T1E3");
assert.equal(continuing(data, read)[0].series.slug, series.slug);
const onboarding = series.seasons[0].eps[2];
save(onboarding, 120, 4);
assert.deepEqual(resume(series, read), { season: 0, ep: 2, fresh: false });
save(onboarding, onboarding.d, 5);
assert.equal(resume(series, read).finished, true, "fim de T1E3 não inicia o caminho Difícil");
assert.deepEqual(continuing(data, read), []);
delete memory[`agentflix-prog-${easy.uid}`];
delete memory[`agentflix-prog-${onboarding.uid}`];
memory[`agentflix-caminho-${series.slug}`] = { temporada: 3 };
assert.deepEqual(resume(series, read), { season: 1, ep: 0, fresh: true });
save(branch.eps[0], branch.eps[0].d, 3);
assert.deepEqual(resume(series, read), { season: 1, ep: 1, fresh: true });
save(branch.eps.at(-1), branch.eps.at(-1).d, 4);
assert.equal(resume(series, read).finished, true);
assert.deepEqual(
  continuing(data, read),
  [],
  "fim do caminho não vira retomada eterna",
);
const extra = structuredClone(series);
extra.slug = "nova-serie";
extra.name = "Nova série";
extra.gen = ["Novo gênero"];
extra.seasons.forEach((season) =>
  season.eps.forEach(
    (episode, i) => (episode.uid = `${season.n}${i}`.padEnd(32, "f")),
  ),
);
const expanded = { ...data, series: [...data.series, extra] };
assert.equal(
  model.available(expanded).length,
  2,
  "nova série entra sem editar HTML ou registro paralelo",
);
assert.equal(model.rows(expanded)[0].series.length, 2);
assert.equal(
  model.rows({
    ...expanded,
    vitrine: {
      fileiras: [{ id: "tema", titulo: "Tema", genero: "Novo gênero" }],
    },
  })[0].series[0].slug,
  extra.slug,
);
assert.equal(
  model.rows({
    ...data,
    vitrine: {
      fileiras: [{ id: "vazio", titulo: "Sem série", genero: "Ausente" }],
    },
  }).length,
  0,
);
save(extra.seasons[0].eps[0], 30, 10);
assert.equal(model.continuing(expanded, read)[0].series.slug, extra.slug);
assert.equal(
  resume(series, read).finished,
  true,
  "progresso não atravessa séries",
);
save(extra.seasons[0].eps[0], -1, 11);
assert.equal(model.resume(extra, read).fresh, true);
console.log(
  "PASS: acervo por dados, múltiplas séries, filtros, retomada, escolha de caminho e fim de série",
);

// Numeração editorial pode começar no episódio 2 sem criar um episódio fictício.
const numbered = {seasons: [{n: 1, eps: [{n: 2, uid: "a".repeat(32), d: 20}, {n: 5, uid: "b".repeat(32), d: 30}]}]};
assert.equal(model.episodeNumber(numbered.seasons[0].eps[0], 0), 2);
assert.equal(model.episodeNumber({}, 0), 1);
assert.deepEqual({...model.choiceTarget(numbered, {temporada: 1, episodio: 5})}, {season: 0, ep: 1});
assert.equal(model.choiceTarget(numbered, {temporada: 1, episodio: 1}), null);

const lateProgress = key => key === `agentflix-prog-${upcoming.seasons[0].eps[0].uid}` ? {t:2683, at:1} : null;
assert.equal(resume(upcoming, lateProgress).fresh, false, "última parte não é concluída por atingir 95%");
assert.deepEqual(
  resume(upcoming, key => key.startsWith('agentflix-finished-') ? true : lateProgress(key)),
  {season: 0, ep: 1, fresh: true},
  "concluir T1E2 abre o novo T1E3",
);
const allOperationDone = key => {
  if (key.startsWith('agentflix-finished-')) return true;
  if (key === `agentflix-prog-${upcoming.seasons[0].eps[1].uid}`) return {t: 3100, at: 2};
  return lateProgress(key);
};
assert.deepEqual(resume(upcoming, allOperationDone), {season: 0, ep: 2, fresh: true});
const finishedE4 = key => key === `agentflix-prog-${upcoming.seasons[0].eps[2].uid}`
  ? {t: upcoming.seasons[0].eps[2].d, at: 3}
  : allOperationDone(key);
assert.deepEqual(resume(upcoming, finishedE4), {season: 0, ep: 3, fresh: true}, "concluir T1E4 abre T1E5");

const shared = {...numbered, slug: 'a-serie'};
shared.seasons[0].eps[0].share_url = '/aulas/a-serie/t1/e2/';
assert.equal(model.lessonUrl(shared, 0, 0), '/aulas/a-serie/t1/e2/');
assert.equal(model.lessonUrl(shared, 0, 1), '/assistir/?s=a-serie#t1e5');
assert.deepEqual({...model.lessonRoute('/aulas/a-serie/t1/e2/')}, {slug:'a-serie', season:1, episode:2});
assert.equal(model.lessonRoute('/aulas/../t1/e2/'), null);
assert.equal(model.lessonRoute('/assistir/'), null);

assert.equal(model.assetUrl('img/cover.png'), '/assistir/img/cover.png');
assert.equal(model.assetUrl('./img/cover.png'), '/assistir/img/cover.png');
assert.equal(model.assetUrl('/brand/logo.svg'), '/brand/logo.svg');
assert.equal(model.assetUrl('https://example.test/image.jpg'), 'https://example.test/image.jpg');
assert.equal(model.assetUrl(undefined), undefined);
