/**
 * thIAguinho ERP — ia.js (v2 com busca contextual inteligente)
 *
 * Mudanças relevantes:
 *   • Extrai entidades da pergunta (placa, nome do cliente, código DTC)
 *   • Busca TODO o histórico relevante ANTES de chamar o LLM
 *   • Monta um contexto rico com: O.S. anteriores, diagnósticos técnicos,
 *     peças trocadas, serviços feitos, DTCs lidos pelo OBD, timeline
 *   • Suporta Claude (prioridade) ou Gemini (fallback)
 *   • Corta tokens: só manda o que é pertinente à pergunta (RAG simples)
 *
 * Powered by thIAguinho Soluções Digitais
 */
'use strict';

window.iaHistorico = [];

// ═══════════════════════════════════════════════════════════════════════
// EXTRAÇÃO DE ENTIDADES (placa, nome, DTC, palavras-chave)
// ═══════════════════════════════════════════════════════════════════════

/** Placa BR: 3 letras + 4 dígitos (antigo) OU 3 letras + 1 dígito + 1 letra + 2 dígitos (Mercosul). */
const _RE_PLACA = /\b([A-Z]{3})-?([0-9][A-Z0-9][0-9]{2})\b/gi;
const _RE_DTC   = /\b([PCBU][0-9][0-9A-F]{3})\b/gi;

window._iaExtrairEntidades = function(pergunta) {
  const txt = String(pergunta || '');
  const out = { placas: [], dtcs: [], clientes: [], veiculos: [], termos: [] };

  const pm = txt.match(_RE_PLACA) || [];
  out.placas = [...new Set(pm.map(p => p.toUpperCase().replace('-','')))];

  const dm = txt.match(_RE_DTC) || [];
  out.dtcs = [...new Set(dm.map(d => d.toUpperCase()))];

  if (window.J && Array.isArray(window.J.clientes)) {
    const txtL = txt.toLowerCase();
    window.J.clientes.forEach(c => {
      const n = (c.nome || '').toLowerCase().trim();
      if (!n || n.length < 3) return;
      const primeiro = n.split(' ')[0];
      if (txtL.includes(n) || (primeiro.length >= 4 && txtL.includes(primeiro))) {
        out.clientes.push(c);
      }
    });
  }

  if (window.J && Array.isArray(window.J.veiculos) && out.placas.length) {
    out.placas.forEach(pl => {
      const v = window.J.veiculos.find(x => (x.placa||'').toUpperCase().replace('-','') === pl);
      if (v) out.veiculos.push(v);
    });
  }

  const TERMOS = [
    'motor','freio','freios','embreagem','cambio','câmbio','suspensao','suspensão',
    'oleo','óleo','bateria','alternador','partida','arranque','injecao','injeção',
    'ignicao','ignição','radiador','agua','água','vazamento','barulho','ruido','ruído',
    'luz','painel','escape','escapamento','pneu','pneus','direcao','direção',
    'arrefecimento','superaquecimento','consumo','velocimetro','velocímetro',
    'falha','defeito','problema','diagnostico','diagnóstico','historico','histórico'
  ];
  const txtLow = txt.toLowerCase();
  out.termos = TERMOS.filter(t => txtLow.includes(t));

  return out;
};

// ═══════════════════════════════════════════════════════════════════════
// BUSCA HISTÓRICA CONTEXTUAL
// ═══════════════════════════════════════════════════════════════════════
window._iaBuscarHistorico = function(ent) {
  const J = window.J;
  if (!J || !Array.isArray(J.os)) return null;

  const oss = J.os || [];
  const veiculos = J.veiculos || [];
  let osRelevantes = [];

  if (ent.placas.length) {
    ent.placas.forEach(pl => {
      const veic = veiculos.find(v => (v.placa||'').toUpperCase().replace('-','') === pl);
      oss.forEach(o => {
        const plOS = (o.placa||'').toUpperCase().replace('-','');
        if (plOS === pl || (veic && o.veiculoId === veic.id)) osRelevantes.push(o);
      });
    });
  }

  if (ent.clientes.length) {
    ent.clientes.forEach(cli => {
      oss.forEach(o => { if (o.clienteId === cli.id) osRelevantes.push(o); });
    });
  }

  if (ent.dtcs.length) {
    ent.dtcs.forEach(code => {
      oss.forEach(o => {
        const achou = (o.dtcsCliente||[]).some(d => (d.code||'').toUpperCase() === code)
                   || (o.obdScan?.dtcs||[]).some(d => (d.code||'').toUpperCase() === code);
        if (achou) osRelevantes.push(o);
      });
    });
  }

  if (ent.termos.length && !osRelevantes.length) {
    ent.termos.forEach(t => {
      oss.forEach(o => {
        const blob = `${o.diagnostico||''} ${o.relato||''} ${o.desc||''}`.toLowerCase();
        if (blob.includes(t)) osRelevantes.push(o);
      });
    });
  }

  const vistos = new Set();
  osRelevantes = osRelevantes.filter(o => {
    if (vistos.has(o.id)) return false;
    vistos.add(o.id);
    return true;
  });

  osRelevantes.sort((a,b) => {
    const da = a.data || a.createdAt || '';
    const db = b.data || b.createdAt || '';
    return db.localeCompare(da);
  });

  return osRelevantes;
};

// ═══════════════════════════════════════════════════════════════════════
// FORMATAÇÃO DE O.S. PARA CONTEXTO
// ═══════════════════════════════════════════════════════════════════════
window._iaFormatarOS = function(o) {
  const J = window.J || {};
  const veic = (J.veiculos||[]).find(v => v.id === o.veiculoId) || {};
  const cli  = (J.clientes||[]).find(c => c.id === o.clienteId) || {};
  const mec  = (J.equipe||[]).find(m => m.id === o.mecId) || {};
  const data = o.data || (o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '—');
  const placa = o.placa || veic.placa || '—';
  const modelo = veic.modelo || o.veiculo || '—';
  const total = typeof o.total === 'number' ? `R$ ${o.total.toFixed(2).replace('.',',')}` : '—';

  let linha = `═════════════════════════════════════
• O.S. #${(o.id||'').slice(-6).toUpperCase()} | Data: ${data} | Status: ${o.status||'—'}
• Veículo: ${placa} ${modelo} (KM: ${o.km||'—'})
• Cliente: ${cli.nome||o.cliente||'—'}
• Mecânico responsável: ${mec.nome||'—'}
• Valor: ${total}`;

  if (o.relato)       linha += `\n• Queixa do cliente: ${o.relato}`;
  if (o.diagnostico)  linha += `\n• Diagnóstico técnico: ${o.diagnostico}`;
  if (o.desc && o.desc !== o.relato) linha += `\n• Descrição: ${o.desc}`;

  if (Array.isArray(o.servicos) && o.servicos.length) {
    linha += `\n• Serviços executados:`;
    o.servicos.forEach(s => {
      linha += `\n  - ${s.desc||'—'} ${s.valor?`(R$ ${Number(s.valor).toFixed(2)})`:''}`;
    });
  } else if (o.maoObra) {
    linha += `\n• Mão de obra: R$ ${Number(o.maoObra).toFixed(2)}`;
  }

  if (Array.isArray(o.pecas) && o.pecas.length) {
    linha += `\n• Peças substituídas:`;
    o.pecas.forEach(p => {
      linha += `\n  - ${p.desc||'—'} (qtd: ${p.q||1}${p.v?`, R$ ${Number(p.v).toFixed(2)}`:''})`;
    });
  }

  if (Array.isArray(o.dtcsCliente) && o.dtcsCliente.length) {
    linha += `\n• DTCs lidos via OBD: ${o.dtcsCliente.map(d=>`${d.code}(${d.description||d.desc||'—'})`).join('; ')}`;
  }
  if (o.obdScan?.dtcs?.length) {
    linha += `\n• DTCs scan completo: ${o.obdScan.dtcs.map(d=>`${d.code}(${d.description||'—'})`).join('; ')}`;
  }

  if (o.obdUltimoSnapshot) {
    const s = o.obdUltimoSnapshot;
    const dados = [];
    if (s.rpm)      dados.push(`RPM:${s.rpm}`);
    if (s.speed)    dados.push(`vel:${s.speed}km/h`);
    if (s.temp)     dados.push(`temp:${s.temp}°C`);
    if (s.voltage)  dados.push(`bat:${s.voltage}V`);
    if (dados.length) linha += `\n• Último snapshot OBD: ${dados.join(' | ')}`;
  }

  if (o.chkObs) linha += `\n• Observações da entrega: ${o.chkObs}`;

  if (Array.isArray(o.timeline) && o.timeline.length) {
    const tl = o.timeline.slice(-3);
    linha += `\n• Últimos eventos:`;
    tl.forEach(t => {
      const dt = t.dt ? new Date(t.dt).toLocaleDateString('pt-BR') : '—';
      linha += `\n  - [${dt}] ${t.user||'Sistema'}: ${t.acao||'—'}`;
    });
  }

  return linha;
};

// ═══════════════════════════════════════════════════════════════════════
// CONTEXTO COMPLETO PARA O LLM
// ═══════════════════════════════════════════════════════════════════════
window._iaConstruirContexto = function(pergunta) {
  const J = window.J || {};
  const ent = window._iaExtrairEntidades(pergunta);
  const relevantes = window._iaBuscarHistorico(ent) || [];

  let ctx = `═══ OFICINA ═══
Nome: ${J.tnome||'—'}
Mecânicos cadastrados: ${(J.equipe||[]).map(f=>f.nome).join(', ') || 'nenhum'}
Total de clientes: ${(J.clientes||[]).length}
Total de veículos: ${(J.veiculos||[]).length}
Total de O.S. na base: ${(J.os||[]).length}
Peças críticas em estoque: ${(J.estoque||[]).filter(p=>(p.qtd||0)<=(p.min||0)).map(p=>p.desc).join(', ') || 'nenhuma'}
`;

  if (ent.placas.length || ent.clientes.length || ent.dtcs.length) {
    ctx += `\n═══ FILTROS APLICADOS À BUSCA ═══`;
    if (ent.placas.length)   ctx += `\nPlacas: ${ent.placas.join(', ')}`;
    if (ent.clientes.length) ctx += `\nClientes: ${ent.clientes.map(c=>c.nome).join(', ')}`;
    if (ent.dtcs.length)     ctx += `\nCódigos DTC: ${ent.dtcs.join(', ')}`;
    if (ent.termos.length)   ctx += `\nPalavras-chave técnicas: ${ent.termos.join(', ')}`;
  }

  let oss;
  if (relevantes.length) {
    oss = relevantes.slice(0, 15);
    ctx += `\n\n═══ O.S. RELEVANTES ENCONTRADAS (${relevantes.length} total, mostrando até 15) ═══`;
  } else {
    oss = (J.os||[]).slice(-5);
    ctx += `\n\n═══ ÚLTIMAS 5 O.S. DA OFICINA (nenhum filtro casou) ═══`;
  }

  oss.forEach(o => { ctx += '\n' + window._iaFormatarOS(o); });

  if (ent.clientes.length) {
    ctx += `\n\n═══ PERFIL DOS CLIENTES IDENTIFICADOS ═══`;
    ent.clientes.forEach(c => {
      const veicsDele = (J.veiculos||[]).filter(v => v.clienteId === c.id);
      ctx += `\n• ${c.nome} | WhatsApp: ${c.wpp||'—'} | Veículos: ${veicsDele.map(v=>`${v.placa}(${v.modelo||'—'})`).join(', ') || 'nenhum'}`;
    });
  }

  return ctx;
};

// ═══════════════════════════════════════════════════════════════════════
// PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
window.iaPerguntar = async function() {
  const msg = window._v ? window._v('iaInput') : (document.getElementById('iaInput')?.value.trim() || '');
  if (!msg) return;
  if (window._sv) window._sv('iaInput',''); else { const el=document.getElementById('iaInput'); if(el) el.value=''; }

  window.adicionarMsgIA('user', msg);
  window.adicionarMsgIA('bot', '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid var(--cyan);border-right-color:transparent;border-radius:50%;animation:jspin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span> Consultando histórico e processando...');

  const keyClaude = (window.J && window.J.claude) || null;
  const keyGemini = (window.J && window.J.gemini) || null;

  if (!keyClaude && !keyGemini) {
    document.getElementById('iaMsgs').lastChild?.remove();
    const role = (window.J && window.J.role) || '';
    let instr = '';
    if (role === 'admin' || role === 'superadmin') {
      instr = '<br><br><strong>Como resolver:</strong><br>' +
              '1. Abra o painel Superadmin (superadmin.html)<br>' +
              '2. Edite a oficina e preencha <strong>Gemini API Key</strong> ou <strong>Claude API Key</strong><br>' +
              '3. Gemini grátis: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--cyan);text-decoration:underline">aistudio.google.com/app/apikey</a><br>' +
              '4. Faça logout/login na oficina para recarregar a chave.';
    } else {
      instr = '<br><br>Peça ao administrador da oficina para configurar a chave Gemini ou Claude no painel Superadmin.';
    }
    window.adicionarMsgIA('bot', '⚠ <strong>Chave de IA não configurada.</strong>' + instr);
    if (window.toast) window.toast('⚠ Configure Gemini ou Claude no painel Superadmin', 'warn');
    return;
  }

  if (!window.J || !Array.isArray(window.J.os)) {
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', '⚠ Base de dados ainda carregando. Aguarde alguns segundos e tente novamente.');
    return;
  }

  const ctx = window._iaConstruirContexto(msg);

  const systemPrompt = `Você é o thIAguinho — assistente de inteligência artificial ESPECIALIZADO em gestão e diagnóstico automotivo para oficinas mecânicas.

REGRAS FUNDAMENTAIS:
1. Use SOMENTE os dados do CONTEXTO abaixo. NUNCA invente, estime ou alucine informações que não estão explícitas.
2. Se o contexto não contém a resposta, diga honestamente: "Não encontrei essa informação no histórico da oficina."
3. Ao mencionar uma O.S., cite o número curto (últimos 6 caracteres) e a data.
4. Quando o usuário pergunta sobre defeitos, problemas, diagnósticos de uma placa ou cliente, liste TODAS as O.S. relevantes em ordem cronológica (mais recente primeiro).
5. Quando há DTCs (códigos OBD), explique o que significam em linguagem acessível.
6. Responda em português do Brasil, tom técnico mas amigável. Formate com tags HTML (<strong>, <br>, <ul>, <li>).
7. Se a pergunta for ambígua (ex: "quais defeitos o carro teve?" sem especificar placa), PERGUNTE qual placa/cliente.
8. Nunca exponha dados sensíveis desnecessariamente (CPF completo, senhas).

═══ CONTEXTO REAL DA OFICINA ═══
${ctx}
═══ FIM DO CONTEXTO ═══

Agora responda à pergunta do usuário usando APENAS esses dados acima.`;

  window.iaHistorico.push({role: 'user', text: msg});

  try {
    let resp;
    if (keyClaude) {
      resp = await _chamarClaude(keyClaude, systemPrompt, window.iaHistorico);
    } else {
      resp = await _chamarGemini(keyGemini, systemPrompt, window.iaHistorico);
    }

    window.iaHistorico.push({role: 'model', text: resp});
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', resp.replace(/\n/g, '<br>'));
  } catch (e) {
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', '⚠ Erro na IA: ' + (e.message || e));
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ADAPTADORES LLM
// ═══════════════════════════════════════════════════════════════════════
async function _chamarGemini(key, systemPrompt, historico) {
  const contents = historico.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemPrompt }] } })
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    let dica = '';
    if (/API key not valid|API_KEY_INVALID/i.test(errMsg)) dica = '<br><br>A chave Gemini é inválida. Gere nova em <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--cyan);text-decoration:underline">aistudio.google.com/app/apikey</a>.';
    else if (/quota|RESOURCE_EXHAUSTED/i.test(errMsg)) dica = '<br><br>Cota Gemini esgotada. Aguarde reset ou gere nova chave.';
    throw new Error(errMsg + dica);
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
}

async function _chamarClaude(key, systemPrompt, historico) {
  const messages = historico.map(h => ({
    role: h.role === 'user' ? 'user' : 'assistant',
    content: h.text
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      messages
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error('Claude: ' + errMsg);
  }
  return data.content?.[0]?.text || 'Sem resposta';
}

// ═══════════════════════════════════════════════════════════════════════
// ATALHOS / CHIPS
// ═══════════════════════════════════════════════════════════════════════
window.iaAnalisarDRE = function() {
  const q = 'Analise o financeiro atual da oficina. Mostre receitas vs despesas do mês, títulos vencidos, margem líquida. Sugira ações.';
  if (window._sv) window._sv('iaInput', q); else { const el=document.getElementById('iaInput'); if(el) el.value=q; }
  if (window.ir) window.ir('ia');
  setTimeout(window.iaPerguntar, 200);
};

window.iaAnalisarEstoque = function() {
  const q = 'Quais peças estão em nível crítico de estoque? Liste código, descrição, quantidade atual e mínima. Sugira prioridade de compra.';
  if (window._sv) window._sv('iaInput', q); else { const el=document.getElementById('iaInput'); if(el) el.value=q; }
  if (window.ir) window.ir('ia');
  setTimeout(window.iaPerguntar, 200);
};

window.iaHistoricoPlaca = function(placa) {
  if (!placa) return;
  const q = `Me mostre o histórico completo de atendimentos da placa ${placa}: defeitos relatados, diagnósticos feitos, peças trocadas, serviços executados e quanto o cliente já gastou conosco.`;
  if (window._sv) window._sv('iaInput', q); else { const el=document.getElementById('iaInput'); if(el) el.value=q; }
  if (window.ir) window.ir('ia');
  setTimeout(window.iaPerguntar, 200);
};

window.iaPerfilCliente = function(nome) {
  if (!nome) return;
  const q = `Me mostre o perfil completo do cliente ${nome}: quais veículos tem conosco, histórico de atendimentos, recorrência de defeitos e ticket médio.`;
  if (window._sv) window._sv('iaInput', q); else { const el=document.getElementById('iaInput'); if(el) el.value=q; }
  if (window.ir) window.ir('ia');
  setTimeout(window.iaPerguntar, 200);
};

// ═══════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════
window.adicionarMsgIA = function(role, html) {
  const el = document.getElementById('iaMsgs'); if (!el) return;
  const div = document.createElement('div');
  div.className = 'ia-msg ' + role;
  if (role === 'bot') div.innerHTML = '<strong>thIAguinho:</strong> ' + html;
  else div.innerHTML = html;
  el.appendChild(div); el.scrollTop = el.scrollHeight;
};

document.getElementById('iaInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') window.iaPerguntar();
});

/* Powered by thIAguinho Soluções Digitais */
