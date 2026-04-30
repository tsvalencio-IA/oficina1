/**
 * JARVIS ERP — core.js
 * Estado global, RBAC, listeners Firestore em tempo real, utilitários
 *
 * ROLES:
 * superadmin  — master SaaS (superadmin.html)
 * admin       — dono da oficina (jarvis.html) — acesso total
 * gestor      — gerente master (jarvis.html) — sem financeiro privado
 * atendente   — recepção (jarvis.html) — OS + clientes + agenda
 * mecanico    — técnico (equipe.html) — kanban + logs + mídia
 * cliente     — portal do cliente (cliente.html)
 *
 * Powered by thIAguinho Soluções Digitais
 */
'use strict';

// ── NAMESPACE GLOBAL ───────────────────────────────────────
window.J = {
  // SESSÃO
  tid:         sessionStorage.getItem('j_tid')          || null,
  role:        sessionStorage.getItem('j_role')         || null,
  nome:        sessionStorage.getItem('j_nome')         || 'Usuário',
  tnome:       sessionStorage.getItem('j_tnome')        || 'Oficina',
  fid:         sessionStorage.getItem('j_fid')          || null,
  gemini:      sessionStorage.getItem('j_gemini')       || null,
  nicho:       sessionStorage.getItem('j_nicho')        || 'carros',
  cloudName:   sessionStorage.getItem('j_cloud_name')   || 'dmuvm1o6m',
  cloudPreset: sessionStorage.getItem('j_cloud_preset') || 'evolution',
  brand:       JSON.parse(sessionStorage.getItem('j_brand') || 'null'),
  comissao:    parseFloat(sessionStorage.getItem('j_comissao') || '0'),

  // ESTADO IN-MEMORY
  os:           [],
  clientes:     [],
  veiculos:     [],
  estoque:      [],
  financeiro:   [],
  equipe:       [],
  fornecedores: [],
  agendamentos: [],
  mensagens:    [],
  chatEquipe:   [],
  auditoria:    [],

  chatAtivo:    null,
  chatAtivoEquipe: null,
  notifLastSeen: Date.now(),

  db: null
};

// ── RBAC ───────────────────────────────────────────────────
window.PERM = {
  criarOS:          r => ['admin','gestor','atendente'].includes(r),
  editarOS:         r => ['admin','gestor','atendente'].includes(r),
  deletarOS:        r => ['admin','gestor'].includes(r),
  moverStatus:      r => ['admin','gestor','atendente','mecanico'].includes(r),
  adicionarLog:     r => ['admin','gestor','atendente','mecanico'].includes(r),
  verFinanceiro:    r => ['admin'].includes(r),
  verDRE:           r => ['admin','gestor'].includes(r),
  verRelatorios:    r => ['admin','gestor'].includes(r),
  gerenciarEquipe:  r => ['admin','gestor'].includes(r),
  configCloudinary: r => ['admin'].includes(r),
  deletarLog:       r => ['admin','gestor','atendente'].includes(r),
  deletarMidia:     r => ['admin','gestor','atendente'].includes(r),
  acessarIA:        r => ['admin','gestor'].includes(r),
  verComissoes:     r => ['admin','gestor'].includes(r),
};

window.pode = acao => {
  const fn = PERM[acao];
  return fn ? fn(J.role) : false;
};

// ── INICIALIZAÇÃO ──────────────────────────────────────────
window.initCore = function() {
  J.db = window.initFirebase();
  if (!J.tid) { window.location.replace('index.html'); return; }
  if (J.brand) window.aplicarBrand(J.brand);

  _populateBaseUI();
  _aplicarRestricoesPorRole();

  _escutarOS();
  _escutarClientes();
  _escutarVeiculos();
  _escutarEstoque();
  _escutarFinanceiro();
  _escutarEquipe();
  _escutarFornecedores();
  _escutarMensagens();
  _escutarChatEquipe();
  _escutarAgendamentos();
  _escutarAuditoria();
  _escutarNotificacoes();

  window.showPageLoader && showPageLoader(false);
};

window.initCoreEquipe = function() {
  J.db = window.initFirebase();
  if (!J.tid) { window.location.replace('index.html'); return; }
  if (J.brand) window.aplicarBrand(J.brand);

  _populateBaseUI();
  _escutarOS();
  _escutarClientes();
  _escutarVeiculos();
  _escutarEstoque();
  _escutarChatEquipe();
  _escutarNotificacoes();
  if (J.fid) _escutarComissoesEquipe();

  window.showPageLoader && showPageLoader(false);
};

// ── BASE UI ────────────────────────────────────────────────
function _populateBaseUI() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sbTenantNome', J.tnome);
  set('sbUserNome',   J.nome);
  set('sbUserRole',   _roleLabel(J.role));
  const nichoMap = { carros:'🚗 Carros', motos:'🏍️ Motos', bicicletas:'🚲 Bicicletas', multi:'🔧 Multi' };
  set('tbNicho', nichoMap[J.nicho] || '🚗 Carros');
  const av = document.getElementById('sbAvatar');
  if (av) av.textContent = (J.nome || 'U').charAt(0).toUpperCase();
}

function _roleLabel(role) {
  return { admin:'ADMINISTRADOR', gestor:'GESTOR MASTER', atendente:'ATENDENTE', mecanico:'MECÂNICO', equipe:'EQUIPE', cliente:'CLIENTE' }[role] || (role||'').toUpperCase();
}

function _aplicarRestricoesPorRole() {
  if (!pode('verFinanceiro')) document.querySelectorAll('[data-role-hide*="financeiro"]').forEach(el => el.style.display='none');
  if (!pode('verDRE'))        document.querySelectorAll('[data-role-hide*="dre"]').forEach(el => el.style.display='none');
  if (!pode('deletarOS'))     document.querySelectorAll('[data-role-hide*="deletar-os"]').forEach(el => el.style.display='none');
  if (!pode('gerenciarEquipe')) document.querySelectorAll('[data-role-hide*="rh"]').forEach(el => el.style.display='none');
  if (!pode('acessarIA'))     document.querySelectorAll('[data-role-hide*="ia"]').forEach(el => el.style.display='none');
  const roleEl = document.getElementById('sbUserRole');
  if (roleEl) {
    const colors = { admin:'var(--brand)', gestor:'var(--success)', atendente:'var(--warn)', mecanico:'#FF8C00' };
    roleEl.style.color = colors[J.role] || 'var(--text-muted)';
  }
}

// ── LISTENERS FIRESTORE ────────────────────────────────────
function _escutarOS() {
  J.db.collection('ordens_servico')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.os = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.renderKanban        && renderKanban();
      window.renderDashboard     && renderDashboard();
      window.calcComissoes       && calcComissoes();
      window.atualizarPainelAtencao && atualizarPainelAtencao();
    });
}

function _escutarClientes() {
  J.db.collection('clientes').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderClientes && renderClientes();
    popularSelects();
  });
}

function _escutarVeiculos() {
  J.db.collection('veiculos').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.veiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderVeiculos && renderVeiculos();
    popularSelects();
  });
}

function _escutarEstoque() {
  J.db.collection('estoqueItems').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.estoque = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderEstoque   && renderEstoque();
    window.renderDashboard && renderDashboard();
  });
}

function _escutarFinanceiro() {
  J.db.collection('financeiro').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.financeiro = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderFinanceiro && renderFinanceiro();
    window.renderDashboard  && renderDashboard();
  });
}

function _escutarEquipe() {
  J.db.collection('funcionarios').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.equipe = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderEquipe  && renderEquipe();
    window.calcComissoes && calcComissoes();
    popularSelects();
  });
}

function _escutarFornecedores() {
  J.db.collection('fornecedores').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderFornecedores && renderFornecedores();
    popularSelects();
  });
}

function _escutarMensagens() {
  J.db.collection('mensagens').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.mensagens = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.ts||0)-(b.ts||0));
    window.renderChatLista && renderChatLista();
    if (J.chatAtivo && window.renderChatMsgs) renderChatMsgs(J.chatAtivo);
    const unread = J.mensagens.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
    setBadge('chatBadge', unread);
  });
}

function _escutarAgendamentos() {
  J.db.collection('agendamentos').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.agendamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderAgenda && renderAgenda();
  });
}

function _escutarAuditoria() {
  J.db.collection('lixeira_auditoria').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.auditoria = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>b.ts>a.ts?1:-1);
    window.renderAuditoria && renderAuditoria();
  });
}

function _escutarNotificacoes() {
  J.db.collection('notificacoes_live')
    .where('tenantId', '==', J.tid)
    .where('ts', '>', J.notifLastSeen)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const n = change.doc.data();
        if (n.de === J.nome) return;
        window.toast && toast(`${n.de}: ${n.msg}`, 'info');
        setTimeout(() => change.doc.ref.delete().catch(()=>{}), 10000);
      });
    });
}

function _escutarChatEquipe() {
  J.db.collection('chat_equipe').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.chatEquipe = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.ts||0)-(b.ts||0));

    // Render para Equipe (equipe.html)
    window.renderChatEquipe && renderChatEquipe();

    // Render para Admin (jarvis.html)
    window.renderChatEquipeAdmin && renderChatEquipeAdmin();
    if (J.chatAtivoEquipe && window.renderChatMsgsEquipeAdmin) renderChatMsgsEquipeAdmin(J.chatAtivoEquipe);

    // Badges
    const nEquipe = J.chatEquipe.filter(m => m.sender==='admin' && !m.lidaEquipe && m.para===J.fid).length;
    setBadge('chatTabBadge', nEquipe);

    const nAdmin = J.chatEquipe.filter(m => m.sender==='equipe' && !m.lidaAdmin).length;
    setBadge('chatEquipeBadge', nAdmin);
  });
}

function _escutarComissoesEquipe() {
  J.db.collection('financeiro')
    .where('tenantId', '==', J.tid)
    .where('isComissao', '==', true)
    .where('mecId', '==', J.fid)
    .onSnapshot(snap => {
      const fins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.renderComissoes && renderComissoes(fins);
    });
}

// ── PAINEL DE ATENÇÃO (Chevron-style) ──────────────────────
window.atualizarPainelAtencao = function() {
  const container = document.getElementById('painelAtencao');
  if (!container) return;

  const alertas = JARVIS_CONST.ALERT_STATUSES;
  let temAlerta = false;

  container.innerHTML = Object.entries(alertas).map(([key, cfg]) => {
    const lista = J.os.filter(o => o.status === key);
    if (lista.length > 0) temAlerta = true;

    const items = lista.map(o => {
      const v = J.veiculos.find(x => x.id === o.veiculoId);
      const c = J.clientes.find(x => x.id === o.clienteId);
      const placa = o.placa || v?.placa || '???';
      return `<div class="atencao-item" onclick="_abrirDetalheOS('${o.id}')" title="${c?.nome || ''}">${placa}</div>`;
    }).join('') || `<span style="font-family:var(--fm);font-size:0.65rem;color:var(--text-disabled)">— vazio —</span>`;

    return `<div class="atencao-box" style="border-color:rgba(${_hexToRGB(cfg.cor)},0.3);background:rgba(${_hexToRGB(cfg.cor)},0.06)">
      <div class="atencao-titulo" style="color:${cfg.cor}">${cfg.label}</div>
      <div class="atencao-lista">${items}</div>
    </div>`;
  }).join('');

  const led = document.getElementById('alertaLed');
  if (led) led.style.display = temAlerta ? 'block' : 'none';
};

window._abrirDetalheOS = function(osId) {
  window._osDetalheAberta = osId;
  if (window.prepOS) { prepOS('edit', osId); abrirModal('modalOS'); }
};

// ── NOTIFICAÇÃO LIVE ───────────────────────────────────────
window.notificarEquipe = async function(msg) {
  try {
    await J.db.collection('notificacoes_live').add({ tenantId: J.tid, de: J.nome, msg, ts: Date.now() });
  } catch(e) {}
};

// ── POPULAR SELECTS ────────────────────────────────────────
window.popularSelects = function() {
  const cOpts = '<option value="">Selecione...</option>' +
    J.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  ['osCliente','agdCliente','veicDono'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = cOpts;
  });

  const mOpts = '<option value="">Não atribuído</option>' +
    J.equipe.map(f => `<option value="${f.id}">${f.nome} (${JARVIS_CONST.CARGOS[f.cargo]||f.cargo})</option>`).join('');
  ['osMec','agdMec'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = mOpts;
  });

  const fOpts = '<option value="">Selecione...</option>' +
    J.fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  const nfEl = document.getElementById('nfFornec');
  if (nfEl) nfEl.innerHTML = fOpts;

  const optF = document.getElementById('optFornec');
  if (optF) optF.innerHTML = J.fornecedores.map(f=>`<option value="F_${f.id}">${f.nome}</option>`).join('');
  const optE = document.getElementById('optEquipe');
  if (optE) optE.innerHTML = J.equipe.map(f=>`<option value="E_${f.id}">${f.nome}</option>`).join('');

  if (window.renderChatEquipeAdmin) renderChatEquipeAdmin();
};

window.filtrarVeiculosOS = function() {
  const cid  = _v('osCliente');
  const tipo = _v('osTipoVeiculo');
  let veics  = J.veiculos.filter(v => v.clienteId === cid);
  if (tipo) veics = veics.filter(v => v.tipo === tipo);
  const el = document.getElementById('osVeiculo');
  if (el) el.innerHTML = '<option value="">Selecione...</option>' +
    veics.map(v => `<option value="${v.id}">${v.modelo} (${v.placa})</option>`).join('');
};

window.filtrarVeicsAgenda = function() {
  const cid   = _v('agdCliente');
  const veics = J.veiculos.filter(v => v.clienteId === cid);
  const el    = document.getElementById('agdVeiculo');
  if (el) el.innerHTML = '<option value="">Selecione...</option>' +
    veics.map(v => `<option value="${v.id}">${v.modelo} (${v.placa})</option>`).join('');
};

// ── BUSCA GLOBAL ───────────────────────────────────────────
window.buscaGlobal = function(termo) {
  const t   = (termo || '').trim().toUpperCase();
  const box = document.getElementById('buscaGlobalResultados');
  if (!box) return;
  if (!t) { box.classList.add('hidden'); return; }

  const matches = J.os
    .filter(o => {
      const v = J.veiculos.find(x => x.id === o.veiculoId);
      const c = J.clientes.find(x => x.id === o.clienteId);
      return (v?.placa||'').toUpperCase().includes(t) ||
             (o.placa||'').toUpperCase().includes(t) ||
             (c?.nome||'').toUpperCase().includes(t);
    })
    .sort((a,b) => (b.updatedAt||'') > (a.updatedAt||'') ? 1 : -1)
    .slice(0, 8);

  if (!matches.length) {
    box.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:0.8rem;text-align:center">Nenhum resultado</div>`;
    box.classList.remove('hidden');
    return;
  }

  box.innerHTML = matches.map(o => {
    const v = J.veiculos.find(x => x.id === o.veiculoId);
    const c = J.clientes.find(x => x.id === o.clienteId);
    const STATUS_COLORS = {
      Triagem:'badge-neutral', Orcamento:'badge-warn', Orcamento_Enviado:'badge-purple',
      Aprovado:'badge-brand', Andamento:'badge-warn', Pronto:'badge-success', Entregue:'badge-success', Cancelado:'badge-danger'
    };
    return `<div class="busca-item" onclick="_abrirDetalheOS('${o.id}')">
      <div style="font-weight:700;font-family:var(--fm);letter-spacing:0.08em">${o.placa||v?.placa||'?'}</div>
      <div style="font-size:0.78rem;color:var(--text-secondary)">${c?.nome||'—'} · ${v?.modelo||o.veiculo||''}</div>
      <span class="badge ${STATUS_COLORS[o.status]||'badge-neutral'}" style="font-size:0.55rem;margin-top:4px;">${o.status||'?'}</span>
    </div>`;
  }).join('');
  box.classList.remove('hidden');
};

document.addEventListener('click', e => {
  if (!document.getElementById('buscaGlobalWrap')?.contains(e.target)) {
    const box = document.getElementById('buscaGlobalResultados');
    if (box) box.classList.add('hidden');
  }
});

// ── AUDITORIA ──────────────────────────────────────────────
window.audit = async function(modulo, acao) {
  try {
    await J.db.collection('lixeira_auditoria').add({
      tenantId: J.tid, modulo, acao,
      usuario: J.nome, role: J.role,
      ts: new Date().toISOString()
    });
  } catch(e) {}
};

// ── UTILITÁRIOS ────────────────────────────────────────────
window._$   = id  => document.getElementById(id);
window._v   = id  => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
window._sv  = (id,v) => { const el=document.getElementById(id); if(el) el.value = v ?? ''; };
window._st  = (id,t) => { const el=document.getElementById(id); if(el) el.textContent = t ?? ''; };
window._sh  = (id,h) => { const el=document.getElementById(id); if(el) el.innerHTML = h ?? ''; };
window._chk = id => { const el=document.getElementById(id); return el?el.checked:false; };
window._ck  = (id,v) => { const el=document.getElementById(id); if(el) el.checked=!!v; };

// Atalhos compatíveis com código legado (of1/of2 usam $ e $v)
window.$  = id => document.getElementById(id);
window.$v = id => { const el=document.getElementById(id); return el?el.value.trim():''; };

window.moeda = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(parseFloat(v)||0);
window.dtBr  = iso => { if(!iso) return '—'; try { return new Date(iso).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}); } catch{return iso;} };
window.dtHrBr= iso => { if(!iso) return '—'; try { return new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}); } catch{return iso;} };
window.dtISO = () => new Date().toISOString();
window.randId= (n=6) => Math.random().toString(36).slice(-n).toUpperCase();

window.sair = function() { sessionStorage.clear(); window.location.href='index.html'; };
window.abrirWpp = function(numero, msg) {
  const n = (numero||'').replace(/\D/g,'');
  window.open(`https://wa.me/55${n}?text=${encodeURIComponent(msg||'')}`, '_blank');
};

window.setBadge = function(id, count) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = count;
  el.classList.toggle('show', count > 0);
  el.style.display = count > 0 ? 'block' : 'none';
};

window.buscarCEP = async function(cep) {
  const c = (cep||'').replace(/\D/g,''); if (c.length !== 8) return;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
    const d = await r.json();
    if (!d.erro) {
      _sv('cliRua', d.logradouro); _sv('cliBairro', d.bairro);
      _sv('cliCidade', d.localidade); document.getElementById('cliNum')?.focus();
    }
  } catch(e) {}
};

function _hexToRGB(hex) {
  const c = (hex||'#3B82F6').replace('#','');
  return `${parseInt(c.substring(0,2),16)},${parseInt(c.substring(2,4),16)},${parseInt(c.substring(4,6),16)}`;
}

// ═════════════════════════════════════════════════════════════
// MOTOR DE MÍDIA DO CHAT (ÁUDIO, FOTOS E ANEXOS)
// Correções 1, 2, 3 e 4 — Powered by thIAguinho Soluções Digitais
// ═════════════════════════════════════════════════════════════

// Escape seguro contra XSS ao renderizar texto livre no chat
function _escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}
function _escapeAttr(s) {
  return String(s == null ? '' : s).replace(/["<>]/g, c => ({
    '"':'&quot;', '<':'&lt;', '>':'&gt;'
  }[c]));
}

// ── PARSING DE MÍDIA ROBUSTO (CORREÇÃO #1) ────────────────
// Tolera espaços invisíveis (BOM, zero-width, NBSP), quebras de linha
// e capitalização inconsistente das tags [IMAGEM] / [AUDIO] / [ARQUIVO]
// que teclados mobile (Gboard/iOS) eventualmente inserem.
window.formatarMidiaChat = function(texto) {
  if (texto == null) return '';

  // 1) Normalização: remove caracteres invisíveis que quebram .startsWith()
  const limpo = String(texto)
    .replace(/\uFEFF/g, '')   // BOM
    .replace(/\u200B/g, '')   // zero-width space
    .replace(/\u200C/g, '')   // zero-width non-joiner
    .replace(/\u200D/g, '')   // zero-width joiner
    .replace(/\u00A0/g, ' ')  // non-breaking space → espaço comum
    .trim();

  if (!limpo) return '';

  // 2) Regex robusta: aceita [TAG] seguida de espaços/quebras antes da URL,
  // case-insensitive, com \s* em volta da tag para tolerar ruído.
  const match = limpo.match(/^\s*\[\s*(AUDIO|IMAGEM|ARQUIVO)\s*\]\s*([\s\S]+)$/i);

  if (!match) {
    // Não é mídia: renderiza como texto seguro preservando quebras
    return _escapeHtml(limpo).replace(/\n/g, '<br>');
  }

  const tipo = match[1].toUpperCase();
  // Pega a primeira "palavra" depois da tag (descarta qualquer ruído após a URL)
  const bruto = match[2].trim();
  const url = bruto.split(/\s+/)[0];

  // 3) Valida que é uma URL HTTPS(S) real — caso contrário devolve como texto
  if (!/^https?:\/\/\S+/i.test(url)) {
    return _escapeHtml(limpo).replace(/\n/g, '<br>');
  }

  const urlAttr = _escapeAttr(url);

  if (tipo === 'AUDIO') {
    return `<audio src="${urlAttr}" controls preload="metadata" style="height:34px; max-width:220px; outline:none; display:block;"></audio>`;
  }
  if (tipo === 'IMAGEM') {
    return `<img src="${urlAttr}" loading="lazy" alt="imagem" style="max-width:220px; max-height:220px; border-radius:6px; cursor:zoom-in; display:block;" onclick="window.open('${urlAttr}','_blank','noopener')">`;
  }
  if (tipo === 'ARQUIVO') {
    return `<a href="${urlAttr}" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:underline;display:inline-block;padding:4px 0">📎 Ver Anexo</a>`;
  }

  // Fallback defensivo
  return _escapeHtml(limpo).replace(/\n/g, '<br>');
};

// ── ROTEADOR DE MÍDIA PARA O CHAT CORRETO ─────────────────
// Após gravar áudio ou enviar arquivo, decide em QUAL chat
// despachar a mídia, baseado na URL atual e no chat ativo.
function _despacharMidiaChat(payload) {
  const path = (window.location.pathname || '').toLowerCase();

  // CLIENTE (portal do cliente)
  if (path.includes('cliente.html')) {
    const inp = document.getElementById('chatInputCliente') || document.getElementById('chatInput');
    if (inp) {
      inp.value = payload;
      if (typeof window.enviarChatCliente === 'function') return window.enviarChatCliente();
      if (typeof window.enviarChat === 'function')        return window.enviarChat();
    }
    return;
  }

  // EQUIPE (mecânico falando com o admin)
  if (path.includes('equipe.html')) {
    const inp = document.getElementById('chatInputEquipe') || document.getElementById('chatInput');
    if (inp) {
      inp.value = payload;
      if (typeof window.enviarMsgEquipe === 'function') return window.enviarMsgEquipe();
    }
    return;
  }

  // JARVIS (admin): decide pelo chat ativo
  // Se há um chat com membro da equipe aberto, vai para o chat_equipe.
  if (J.chatAtivoEquipe || J.chatEquipeAtivo) {
    const inp = document.getElementById('chatInputEquipeAdmin');
    if (inp) {
      inp.value = payload;
      if (typeof window.enviarMsgEquipeAdmin === 'function') return window.enviarMsgEquipeAdmin();
    }
    return;
  }
  // Caso contrário, CRM com o cliente.
  if (J.chatAtivo) {
    const inp = document.getElementById('chatInput');
    if (inp) {
      inp.value = payload;
      if (typeof window.enviarChat === 'function') return window.enviarChat();
    }
    return;
  }

  // Último fallback: se houver qualquer input genérico
  const fallback = document.getElementById('chatInput');
  if (fallback) {
    fallback.value = payload;
    if (typeof window.enviarChat === 'function') window.enviarChat();
  }
}

// ── GRAVAÇÃO DE ÁUDIO CLICK-TO-RECORD (CORREÇÃO #3) ───────
// Clique 1× → inicia gravação (botão fica vermelho com ⏹)
// Clique 2× → para, sobe ao Cloudinary e envia automaticamente
// Libera o microfone IMEDIATAMENTE ao parar (evita LED preso no mobile)
window._pttState = { recorder: null, stream: null, chunks: [], btnId: null, mime: '' };

window.togglePTT = async function(btnId) {
  btnId = btnId || 'btnPTT';
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const st = window._pttState;

  // ── Se já está gravando, PARA e envia ─────────────────
  if (st.recorder && st.recorder.state === 'recording') {
    try { st.recorder.stop(); } catch (e) { /* ignore */ }
    return;
  }

  // ── Checagem de suporte ───────────────────────────────
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined') {
    window.toastErr && toastErr('Este navegador não suporta gravação de áudio.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Escolhe um mimetype suportado (Safari iOS prefere mp4)
    let mime = '';
    if (window.MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))      mime = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/webm'))             mime = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4'))              mime = 'audio/mp4';
      else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'))  mime = 'audio/ogg;codecs=opus';
    }
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

    st.recorder = recorder;
    st.stream   = stream;
    st.chunks   = [];
    st.btnId    = btnId;
    st.mime     = mime || 'audio/webm';

    recorder.ondataavailable = ev => {
      if (ev.data && ev.data.size > 0) st.chunks.push(ev.data);
    };

    recorder.onerror = ev => {
      window.toastErr && toastErr('Erro na gravação: ' + (ev?.error?.message || 'desconhecido'));
      _pttLimpar();
    };

    recorder.onstop = async () => {
      // 1) Libera o microfone IMEDIATAMENTE (crítico no mobile)
      if (st.stream) {
        try { st.stream.getTracks().forEach(t => { try { t.stop(); } catch(e){} }); } catch(e) {}
        st.stream = null;
      }

      const btnEl = document.getElementById(st.btnId || btnId);
      if (btnEl) {
        btnEl.style.color = '';
        btnEl.style.background = '';
        btnEl.disabled = true;
        btnEl.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;border-style:solid;border-color:var(--brand) transparent transparent transparent;border-radius:50%;animation:spin 0.8s linear infinite"></span>';
      }

      try {
        if (!st.chunks.length) {
          window.toastErr && toastErr('Gravação vazia — fale algo antes de parar.');
          _pttLimpar();
          return;
        }

        const blob = new Blob(st.chunks, { type: st.mime || 'audio/webm' });
        if (blob.size < 500) {
          window.toastErr && toastErr('Áudio muito curto.');
          _pttLimpar();
          return;
        }

        const fd = new FormData();
        fd.append('file', blob, 'ptt.' + (st.mime.includes('mp4') ? 'm4a' : 'webm'));
        fd.append('upload_preset', J.cloudPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, {
          method: 'POST', body: fd
        });
        const data = await res.json();

        if (!data.secure_url) {
          throw new Error(data?.error?.message || 'Falha no upload do áudio.');
        }

        _despacharMidiaChat('[AUDIO]' + data.secure_url);

      } catch (e) {
        window.toastErr && toastErr('Erro ao enviar áudio: ' + (e.message || e));
      } finally {
        _pttLimpar();
      }
    };

    recorder.start();
    btn.style.color = '#fff';
    btn.style.background = 'var(--danger, #dc2626)';
    btn.innerHTML = '⏹';
    btn.title = 'Clique para parar e enviar';
    btn.setAttribute('aria-pressed', 'true');
    window.toastOk && toastOk('🔴 Gravando... Clique ⏹ para enviar.');

  } catch (err) {
    window.toastErr && toastErr('⚠ Permissão de microfone negada ou indisponível.');
    _pttLimpar();
  }
};

function _pttLimpar() {
  const st = window._pttState;
  if (st.stream) {
    try { st.stream.getTracks().forEach(t => { try { t.stop(); } catch(e){} }); } catch(e){}
  }
  const btnEl = document.getElementById(st.btnId || 'btnPTT');
  if (btnEl) {
    btnEl.style.color = '';
    btnEl.style.background = '';
    btnEl.innerHTML = '🎤';
    btnEl.disabled = false;
    btnEl.title = 'Gravar áudio';
    btnEl.removeAttribute('aria-pressed');
  }
  st.recorder = null;
  st.stream   = null;
  st.chunks   = [];
  st.btnId    = null;
  st.mime     = '';
}

// ── ENVIO DE ARQUIVO ÚNICO PELO CHAT (anexo/foto) ─────────
// Usado pelos clipes de anexo de jarvis.html, equipe.html e cliente.html.
// Após o upload, decide automaticamente em qual chat despachar via _despacharMidiaChat.
window.enviarArquivoChat = async function(input) {
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  if (!file) return;

  window.toastOk && toastOk('Enviando arquivo...');

  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', J.cloudPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, {
      method: 'POST', body: fd
    });
    const data = await res.json();

    if (!data.secure_url) {
      throw new Error(data?.error?.message || 'Falha no upload.');
    }

    const isImg = (data.resource_type === 'image') || /^image\//.test(file.type || '');
    const prefixo = isImg ? '[IMAGEM]' : '[ARQUIVO]';
    _despacharMidiaChat(prefixo + data.secure_url);

  } catch (e) {
    window.toastErr && toastErr('Erro no anexo: ' + (e.message || e));
  } finally {
    // Libera o input para que o mesmo arquivo possa ser reanexado no futuro
    try { input.value = ''; } catch(e) {}
  }
};

// ── BATCH UPLOAD PARA O.S. (CORREÇÃO #4) ──────────────────
// Recebe uma FileList/array de File, envia em lote ao Cloudinary,
// devolve um array [{url, type, publicId}]. Aceita callback de progresso.
// O chamador (os.js / jarvis.html) é quem grava as URLs no documento da O.S.
// em UMA ÚNICA update do Firestore.
window.uploadBatchOS = async function(files, onProgress) {
  if (!files || !files.length) return [];
  const arr = Array.from(files);
  const total = arr.length;
  const resultados = [];

  for (let i = 0; i < total; i++) {
    const f = arr[i];
    if (!f) continue;

    const fd = new FormData();
    fd.append('file', f);
    fd.append('upload_preset', J.cloudPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, {
        method: 'POST', body: fd
      });
      const data = await res.json();

      if (data && data.secure_url) {
        resultados.push({
          url: data.secure_url,
          type: data.resource_type || (f.type?.startsWith('image/') ? 'image' : 'raw'),
          publicId: data.public_id || null,
          nome: f.name || '',
          tamanho: f.size || 0
        });
      } else {
        window.toastErr && toastErr(`Falha no arquivo ${i + 1}/${total}: ${data?.error?.message || 'erro desconhecido'}`);
      }
    } catch (e) {
      window.toastErr && toastErr(`Falha no arquivo ${i + 1}/${total}: ${e.message || e}`);
    }

    if (typeof onProgress === 'function') {
      try { onProgress(i + 1, total); } catch (e) {}
    }
  }

  return resultados;
};

// Helper exposto para os handlers inline dos HTMLs: retorna o ID do chat ativo
// (usado pelas funções de render quando precisam abrir o próprio chat).
window._chatAtivoId = function() {
  return J.chatAtivo || J.chatAtivoEquipe || J.chatEquipeAtivo || null;
};

// ═════════════════════════════════════════════════════════════
// CHAT CRM B2C (admin ↔ cliente) E CHAT EQUIPE ADMIN
// ═════════════════════════════════════════════════════════════
window.renderChatLista = function() {
  const el = document.getElementById('chatLista'); if(!el) return;
  el.innerHTML = J.clientes.map(c=>{
    const msgs = J.mensagens.filter(m => m.clienteId === c.id);
    const ultima = msgs[msgs.length-1];
    const nLidas = msgs.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
    return `<div class="chat-item ${J.chatAtivo === c.id ? 'active' : ''}" onclick="window.abrirChat('${c.id}','${c.nome}')">
      <div class="chat-item-name">${c.nome} ${nLidas > 0 ? `<span class="chat-unread">${nLidas}</span>` : ''}</div>
      <div class="chat-item-last">${ultima?.msg ? window.formatarMidiaChat(ultima.msg) : 'Sem mensagens'}</div>
    </div>`;
  }).join('');
};

window.abrirChat = function(cid, nome) {
  J.chatAtivo = cid;
  _st('chatHead', 'ATENDIMENTO: ' + (nome||'').toUpperCase());
  const cf = document.getElementById('chatFoot'); if(cf) cf.style.display = 'flex';
  window.renderChatMsgs(cid);
  J.mensagens.filter(m => m.clienteId === cid && m.sender === 'cliente' && !m.lidaAdmin).forEach(m => {
    J.db.collection('mensagens').doc(m.id).update({lidaAdmin: true});
  });
};

window.renderChatMsgs = function(cid) {
  const msgs = J.mensagens.filter(m => m.clienteId === cid);
  const el = document.getElementById('chatMsgs'); if(!el) return;
  el.innerHTML = msgs.map(m => `<div class="chat-msg ${m.sender === 'admin' ? 'admin' : 'cliente'}">
    ${window.formatarMidiaChat ? window.formatarMidiaChat(m.msg) : m.msg}
    <div class="ts">${m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
  </div>`).join('');
  el.scrollTop = el.scrollHeight;
};

window.enviarChat = async function(txt) {
  const msg = (txt || _v('chatInput') || '').trim();
  if(!msg || !J.chatAtivo) return;
  await J.db.collection('mensagens').add({
    tenantId: J.tid, clienteId: J.chatAtivo, sender: 'admin',
    msg, lidaAdmin: true, lidaCliente: false, ts: Date.now()
  });
  _sv('chatInput', '');
};

document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.enviarChat(); }
});

window.renderChatEquipeAdmin = window.renderChatListaEquipe = function() {
  const el = document.getElementById('chatListaEquipe'); if(!el) return;
  el.innerHTML = J.equipe.map(f=>{
    const msgs = J.chatEquipe.filter(m => (m.de === f.id || m.para === f.id));
    const ultima = msgs[msgs.length-1];
    const nLidas = msgs.filter(m => m.sender === 'equipe' && m.de === f.id && !m.lidaAdmin).length;
    return `<div class="chat-item ${J.chatEquipeAtivo === f.id ? 'active' : ''}" onclick="window.abrirChatEquipe('${f.id}','${f.nome}')">
      <div class="chat-item-name">${f.nome} ${nLidas > 0 ? `<span class="chat-unread">${nLidas}</span>` : ''}</div>
      <div class="chat-item-last">${ultima?.msg ? window.formatarMidiaChat(ultima.msg) : 'Sem mensagens'}</div>
    </div>`;
  }).join('');
};

window.abrirChatEquipe = function(fid, nome) {
  J.chatEquipeAtivo = fid;
  J.chatAtivoEquipe = fid;
  _st('chatHeadEquipe', 'CHAT EQUIPE: ' + (nome||'').toUpperCase());
  const cf = document.getElementById('chatFootEquipe'); if(cf) cf.style.display = 'flex';
  window.renderChatMsgsEquipeAdmin(fid);
  J.chatEquipe.filter(m => m.de === fid && m.sender === 'equipe' && !m.lidaAdmin).forEach(m => {
    J.db.collection('chat_equipe').doc(m.id).update({lidaAdmin: true});
  });
};

window.renderChatMsgsEquipeAdmin = function(fid) {
  const msgs = J.chatEquipe.filter(m => (m.de === fid || m.para === fid));
  const el = document.getElementById('chatMsgsEquipe'); if(!el) return;
  el.innerHTML = msgs.map(m => `<div class="chat-msg ${m.sender === 'admin' ? 'admin' : 'cliente'}">
    <small style="display:block;opacity:0.6;margin-bottom:2px">${m.sender === 'admin' ? 'Você' : (J.equipe.find(f => f.id === m.de)?.nome || 'Equipe')}</small>
    ${window.formatarMidiaChat ? window.formatarMidiaChat(m.msg) : m.msg}
    <div class="ts">${m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
  </div>`).join('');
  el.scrollTop = el.scrollHeight;
};

window.enviarMsgEquipeAdmin = async function(txt) {
  const msg = (txt || _v('chatInputEquipeAdmin') || '').trim();
  if (!msg || (!J.chatEquipeAtivo && !J.chatAtivoEquipe)) return;
  const fid = J.chatEquipeAtivo || J.chatAtivoEquipe;
  await J.db.collection('chat_equipe').add({
    tenantId: J.tid, de: 'admin', para: fid, sender: 'admin',
    msg, lidaAdmin: true, lidaEquipe: false, ts: Date.now()
  });
  _sv('chatInputEquipeAdmin', '');
};

document.getElementById('chatInputEquipeAdmin')?.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.enviarMsgEquipeAdmin(); }
});

// ═══════════════════════════════════════════════════════════════════════
// VALIDADORES FISCAIS OFICIAIS (CPF / CNPJ / PLACA / CEP)
// Algoritmos conforme Receita Federal do Brasil — módulo 11.
// Bloqueia cadastros duplicados e com dígito verificador inválido.
// Powered by thIAguinho Soluções Digitais
// ═══════════════════════════════════════════════════════════════════════

/**
 * Valida CPF pelo algoritmo oficial da Receita Federal (módulo 11).
 * Retorna true apenas se os 11 dígitos + DV estiverem corretos.
 * Rejeita sequências repetidas (111.111.111-11, 000.000.000-00, etc.).
 */
window.validarCPF = function(cpf) {
  if (!cpf) return false;
  const c = String(cpf).replace(/[^\d]/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // todos os dígitos iguais
  let s, r, i;
  // 1º dígito verificador
  s = 0;
  for (i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  r = 11 - (s % 11);
  if (r >= 10) r = 0;
  if (r !== parseInt(c[9])) return false;
  // 2º dígito verificador
  s = 0;
  for (i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  r = 11 - (s % 11);
  if (r >= 10) r = 0;
  if (r !== parseInt(c[10])) return false;
  return true;
};

/**
 * Valida CNPJ pelo algoritmo oficial (módulo 11 com pesos 5,4,3,2,9,8,7,6,5,4,3,2).
 */
window.validarCNPJ = function(cnpj) {
  if (!cnpj) return false;
  const c = String(cnpj).replace(/[^\d]/g, '');
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const calc = (len) => {
    let s = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      s += parseInt(c[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (calc(12) !== parseInt(c[12])) return false;
  if (calc(13) !== parseInt(c[13])) return false;
  return true;
};

/**
 * Formata CPF (###.###.###-##) ou retorna o valor original se inválido.
 */
window.formatarCPF = function(cpf) {
  const c = String(cpf || '').replace(/[^\d]/g, '');
  if (c.length !== 11) return cpf || '';
  return c.substring(0,3) + '.' + c.substring(3,6) + '.' + c.substring(6,9) + '-' + c.substring(9,11);
};

/**
 * Formata CNPJ (##.###.###/####-##)
 */
window.formatarCNPJ = function(cnpj) {
  const c = String(cnpj || '').replace(/[^\d]/g, '');
  if (c.length !== 14) return cnpj || '';
  return c.substring(0,2)+'.'+c.substring(2,5)+'.'+c.substring(5,8)+'/'+c.substring(8,12)+'-'+c.substring(12,14);
};

/**
 * Validação da placa (Mercosul AAA1A23 OU antiga AAA1234).
 */
window.validarPlaca = function(placa) {
  if (!placa) return false;
  const p = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (p.length !== 7) return false;
  // Mercosul: 3 letras + 1 número + 1 letra + 2 números
  // Antiga:   3 letras + 4 números
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p);
};

/**
 * Checa se já existe OUTRO registro no tenant com o mesmo CPF/CNPJ.
 * Passe o array (J.clientes) + documento normalizado + id atual (opcional).
 */
window.cpfDuplicado = function(cpf, lista, idAtual) {
  const c = String(cpf || '').replace(/[^\d]/g, '');
  if (!c) return false;
  return (lista || []).some(x => {
    if (idAtual && x.id === idAtual) return false;
    const cpfX = String(x.cpf || x.cnpj || '').replace(/[^\d]/g, '');
    return cpfX && cpfX === c;
  });
};

/* Powered by thIAguinho Soluções Digitais */
