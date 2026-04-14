/**
 * JARVIS ERP — ia.js / chat.js
 * Gemini RAG + Chat CRM admin↔cliente + Chat equipe↔admin
 */

'use strict';

// ============================================================
// GEMINI IA
// ============================================================
let _iaHistorico = [];

window.iaPerguntar = async function() {
  const inp = _$('iaInput');
  const msg = inp ? inp.value.trim() : '';
  if (!msg) return;
  inp.value = '';

  _adicionarMsgIA('user', msg);
  _adicionarMsgIA('bot', '<span style="color:var(--text-muted)">⏳ Analisando dados da oficina...</span>', true);

  const key = J.gemini;
  if (!key) {
    _iaMsgsRemoveLast();
    _adicionarMsgIA('bot', '⚠️ Configure a API Key do Gemini no painel do Superadmin.');
    return;
  }

  // RAG — contexto da oficina
  const ctx = _buildContext();
  const systemPrompt = `Você é o assistente de IA da oficina "${J.tnome}", especializado em gestão automotiva.

DADOS DA OFICINA AGORA:
${ctx}

REGRAS:
- Responda sempre em português brasileiro
- Seja direto, técnico e útil
- Nunca invente dados — baseie-se apenas nos dados fornecidos
- Ao mencionar valores, use o formato R$ X.XXX,XX
- Para placas de veículos, destaque em negrito`;

  _iaHistorico.push({ role: 'user', text: msg });

  const MODELOS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

  for (const modelo of MODELOS) {
    try {
      const contents = _iaHistorico.map(h => ({
        role:  h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
          })
        }
      );

      if (res.status === 429) {
        _iaMsgsRemoveLast();
        _adicionarMsgIA('bot', '⚠️ Limite de uso da API atingido. Aguarde 1 minuto e tente novamente.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (modelo === MODELOS[MODELOS.length - 1]) throw new Error(data.error?.message || 'Erro na API');
        continue;
      }

      const resposta = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
      _iaHistorico.push({ role: 'model', text: resposta });
      _iaMsgsRemoveLast();
      _adicionarMsgIA('bot', _formatarRespIA(resposta));
      return;

    } catch (e) {
      if (modelo === MODELOS[MODELOS.length - 1]) {
        _iaMsgsRemoveLast();
        _adicionarMsgIA('bot', `⚠️ Erro: ${e.message}`);
      }
    }
  }
};

window.iaAnalisarDRE = async function() {
  _sv('iaInput', 'Analise o financeiro atual da oficina. Quais são as principais fontes de receita, as maiores despesas, e qual a saúde geral do caixa? Dê sugestões práticas de melhoria.');
  if (_$('iaInput')) _$('iaInput').dispatchEvent(new Event('input'));
  await iaPerguntar();
};

window.iaAnalisarEstoque = async function() {
  _sv('iaInput', 'Analise o estoque atual. Quais itens estão críticos (abaixo do mínimo)? Quais têm maior giro? Recomende o que comprar com prioridade.');
  await iaPerguntar();
};

window.iaDiagnosticarPlaca = async function(placa) {
  _sv('iaInput', `Mostre o histórico completo de serviços da placa ${placa}. Há algum serviço vencido ou que deva ser feito em breve?`);
  await iaPerguntar();
};

function _buildContext() {
  const agora = new Date();
  const mes   = agora.getMonth(), ano = agora.getFullYear();

  const fatMes = J.os
    .filter(o => o.status === 'Concluido' && o.updatedAt)
    .reduce((acc, o) => {
      const d = new Date(o.updatedAt);
      return (d.getMonth() === mes && d.getFullYear() === ano) ? acc + (o.total || 0) : acc;
    }, 0);

  const osAbertas = J.os.filter(o => !['Concluido','Cancelado'].includes(o.status));
  const pecasCrit = J.estoque.filter(p => (p.qtd || 0) <= (p.min || 0));

  const osDetalhes = J.os.slice(-15).map(o => {
    const v = J.veiculos.find(x => x.id === o.veiculoId);
    const c = J.clientes.find(x => x.id === o.clienteId);
    return `- Placa: **${v?.placa || '?'}** | Cliente: ${c?.nome || '?'} | Serviço: ${o.desc || '?'} | Status: ${o.status} | Data: ${dtBr(o.data)} | Valor: ${moeda(o.total)}`;
  }).join('\n');

  return `
Oficina: ${J.tnome} | Nicho: ${J.nicho}
Mecânicos: ${J.equipe.map(f => f.nome).join(', ') || 'nenhum'}
Clientes cadastrados: ${J.clientes.length}
Veículos cadastrados: ${J.veiculos.length}
O.S. abertas no momento: ${osAbertas.length}
Peças com estoque crítico: ${pecasCrit.map(p => p.desc).join(', ') || 'nenhuma'}
Faturamento do mês atual: ${moeda(fatMes)}

ÚLTIMAS 15 O.S.:
${osDetalhes || 'Nenhuma O.S. registrada'}
  `.trim();
}

function _formatarRespIA(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\n/g, '<br>');
}

function _adicionarMsgIA(role, html, temp = false) {
  const container = _$('iaMsgs');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `ia-msg ${role}`;
  if (temp) div.dataset.temp = '1';
  if (role === 'bot') {
    div.innerHTML = `<strong style="color:var(--brand);font-size:0.72rem;display:block;margin-bottom:4px">✦ IA</strong>${html}`;
  } else {
    div.innerHTML = html;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function _iaMsgsRemoveLast() {
  const container = _$('iaMsgs');
  if (!container) return;
  const temp = container.querySelector('[data-temp="1"]');
  if (temp) temp.remove();
}

// Enter no input da IA
document.addEventListener('DOMContentLoaded', () => {
  const iaInput = _$('iaInput');
  if (iaInput) iaInput.addEventListener('keydown', e => { if (e.key === 'Enter') iaPerguntar(); });
});

// ============================================================
// CHAT CRM (admin ↔ cliente)
// ============================================================
window.renderChatLista = function() {
  const container = _$('chatLista');
  if (!container) return;

  if (!J.clientes.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Nenhum cliente cadastrado</div></div>`;
    return;
  }

  container.innerHTML = J.clientes.map(c => {
    const msgs     = J.mensagens.filter(m => m.clienteId === c.id);
    const ultima   = msgs[msgs.length - 1];
    const naoLidas = msgs.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
    const isAtivo  = J.chatAtivo === c.id;
    return `
      <div class="chat-contact ${isAtivo ? 'active' : ''}" onclick="abrirChatCRM('${c.id}','${c.nome}')">
        <div class="chat-contact-name">
          ${c.nome}
          ${naoLidas > 0 ? `<span class="chat-unread">${naoLidas}</span>` : ''}
        </div>
        <div class="chat-contact-last">${ultima?.msg || 'Sem mensagens'}</div>
      </div>
    `;
  }).join('');
};

window.abrirChatCRM = function(cid, nome) {
  J.chatAtivo = cid;
  const head = _$('chatMainHeader');
  if (head) head.textContent = nome;
  const foot = _$('chatFoot');
  if (foot) foot.style.display = 'flex';
  renderChatMsgs(cid);

  // Marcar como lidas
  J.mensagens
    .filter(m => m.clienteId === cid && m.sender === 'cliente' && !m.lidaAdmin)
    .forEach(m => J.db.collection('mensagens').doc(m.id).update({ lidaAdmin: true }));
};

window.renderChatMsgs = function(cid) {
  const container = _$('chatMessages');
  if (!container) return;
  const msgs = J.mensagens.filter(m => m.clienteId === cid);

  if (!msgs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Sem mensagens com este cliente</div></div>`;
    return;
  }

  container.innerHTML = msgs.map(m => {
    const t   = m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
    const dir = m.sender === 'admin' ? 'outgoing' : 'incoming';
    return `<div class="chat-msg ${dir}">${m.msg}<div class="msg-time">${t}</div></div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
};

window.enviarChatCRM = async function() {
  const msg = _v('chatInputCRM');
  if (!msg || !J.chatAtivo) return;
  await J.db.collection('mensagens').add({
    tenantId:    J.tid,
    clienteId:   J.chatAtivo,
    sender:      'admin',
    msg,
    lidaCliente: false,
    lidaAdmin:   true,
    ts:          Date.now()
  });
  _sv('chatInputCRM', '');
};

// Enter no chat CRM
document.addEventListener('DOMContentLoaded', () => {
  const el = _$('chatInputCRM');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChatCRM(); } });
});

// ============================================================
// CHAT EQUIPE ↔ ADMIN (equipe.html)
// ============================================================
window.renderChatEquipe = function() {
  const container = _$('chatMsgs');
  if (!container) return;

  if (!J.chatEquipe.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-sub">Sem mensagens ainda</div></div>`;
    return;
  }

  container.innerHTML = J.chatEquipe.map(m => {
    const t    = m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
    const dir  = m.sender === 'equipe' ? 'outgoing' : 'incoming';
    const nome = m.sender === 'equipe' ? J.nome : 'Admin';

    // Marcar como lida
    if (m.sender === 'admin' && !m.lidaEquipe && m.para === J.fid) {
      J.db.collection('chat_equipe').doc(m.id).update({ lidaEquipe: true }).catch(() => {});
    }

    return `<div class="chat-msg ${dir}">
      <strong style="font-size:0.65rem;color:${dir === 'outgoing' ? 'var(--brand)' : 'var(--text-secondary)'};display:block;margin-bottom:3px">${nome}</strong>
      ${m.msg}
      <div class="msg-time">${t}</div>
    </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
};

window.enviarMsgEquipe = async function() {
  const msg = _v('chatInputEquipe');
  if (!msg) return;
  await J.db.collection('chat_equipe').add({
    tenantId:   J.tid,
    de:         J.fid,
    para:       'admin',
    sender:     'equipe',
    msg,
    lidaAdmin:  false,
    lidaEquipe: true,
    ts:         Date.now()
  });
  _sv('chatInputEquipe', '');
};

document.addEventListener('DOMContentLoaded', () => {
  const el = _$('chatInputEquipe');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMsgEquipe(); } });
});