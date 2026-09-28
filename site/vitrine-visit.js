/* Respostas da visita: sessão para visitantes, memória da conta após login. */
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.AgentFlixVisit = factory;
})(typeof window === 'undefined' ? globalThis : window, (data, storage) => {
  'use strict';
  const key = 'agentflix-visit-v1';
  const revision = JSON.stringify(data.guia);
  function decode(value) {
    if (!value || value.version !== 1 || !['avulsa','colecao','guia'].includes(value.kind) ||
        !Array.isArray(value.answers) || value.answers.length > 3 || typeof value.completed !== 'boolean') return null;
    if (value.revision !== revision) {
      if (!value.completed || typeof value.goal !== 'string' || !data.skills[value.goal]) return null;
      return {kind:value.kind, answers:[], completed:true, trail:['inicio'], result:{skill:value.goal},
        door:value.kind === 'guia' ? null : value.kind};
    }
    const trail = [value.kind === 'avulsa' ? 'o_que_agora' : 'inicio'];
    let result = null;
    for (const answer of value.answers) {
      const option = Number.isInteger(answer) && data.guia[trail.at(-1)]?.o[answer];
      if (!option || result) return null;
      if (option.vai && data.guia[option.vai]) trail.push(option.vai);
      else if (option.skill && data.skills[option.skill]) result = option;
      else return null;
    }
    if (value.completed && !result) return null;
    return {kind:value.kind, answers:[...value.answers], completed:value.completed, trail, result,
      door:value.kind === 'guia' ? null : value.kind};
  }
  function load() {
    try { return decode(JSON.parse(storage.getItem(key))); } catch { return null; }
  }
  function wasPresented() {
    try {
      const value = JSON.parse(storage.getItem(key));
      // Percursos anteriores já começaram: não obrigar a conta a repeti-los.
      return value?.version === 1 && (value.presented === true ||
        ['avulsa','colecao','guia'].includes(value.kind) && Array.isArray(value.answers) &&
        typeof value.completed === 'boolean');
    } catch { return false; }
  }
  function markPresented() {
    if (wasPresented()) return true;
    try {
      const previous = JSON.parse(storage.getItem(key));
      const value = previous?.version === 1 ? previous : {version:1};
      storage.setItem(key, JSON.stringify({...value, presented:true}));
      return true;
    } catch { return false; }
  }
  function save(kind, answers, completed) {
    const value = {version:1,revision,kind,answers,completed,presented:true};
    const decoded = decode(value);
    if (!decoded) return false;
    if (completed) value.goal = decoded.result.skill;
    try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function clear() {
    // Refazer escolhas é voluntário; não apaga o histórico da primeira entrada.
    if (wasPresented()) { try { storage.setItem(key, JSON.stringify({version:1,presented:true})); } catch {} }
    else { try { storage.removeItem(key); } catch {} }
  }
  return {key,load,save,clear,wasPresented,markPresented};
});
