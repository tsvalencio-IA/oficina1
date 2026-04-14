/**
 * JARVIS ERP — core.js v3
 * Estado global, RBAC completo, listeners Firestore, utilitários
 *
 * PAPÉIS:
 *   superadmin  — thIAguinho master (superadmin.html)
 *   admin       — Dono da oficina (jarvis.html) — acesso total
 *   gestor      — Gerente master (jarvis.html) — sem financeiro privado
 *   atendente   — Recepção/balcão (jarvis.html) — OS + clientes + agenda
 *   mecanico    — Técnico (equipe.html) — kanban + logs + mídia
 *   cliente     — Proprietário do veículo (cliente.html)
 */

'use strict';

// ============================================================
// NAMESPACE GLOBAL
// ============================================================
window.J = {
  // SESSÃO
  tid:         sessionStorage.getItem('j_tid')         || null,
  role:        sessionStorage.getItem('j_role')        || null,
  nome:        sessionStorage.getItem('j_nome')        || 'Usuário',
  tnome:       sessionStorage.getItem('j_tnome')       || 'Oficina',
  fid:         sessionStorage.getItem('j_fid')         || null,
  gemini:      sessionStorage.getItem('j_gemini')      || null,
  nicho:       sessionStorage.getItem('j_nicho')       || 'carros',
  cloudName:   sessionStorage.getItem('j_cloud_name')  || 'dmuvm1o6m',
  cloudPreset: sessionStorage.getItem('j_cloud_preset')|| 'evolution',
  brand:       JSON.parse(sessionStorage.getItem('j_brand')  || 'null'),
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
  notifLastSeen: Date.now(),

  // DB REFERENCE
  db: null
};

// ============================================================
// RBAC — TABELA DE PERMISSÕES
// ============================================================
window.PERM = {
  //                           admin  gestor  atendente  mecanico
  criarOS:         roles => ['admin','gestor','atendente'].includes(roles),
  editarOS:        roles => ['admin','gestor','atendente'].includes(roles),
  deletarOS:       roles => ['admin','gestor'].includes(roles),
  verFinanceiro:   roles => ['admin'].includes(roles),
  verDRE:          roles => ['admin','gestor'].includes(roles),
  editarCamposOS:  roles => ['admin','gestor'].includes(roles),
  deletarLog:      roles => ['admin','gestor','atendente'].includes(roles),
  deletarMidia:    roles => ['admin','gestor','atendente'].includes(roles),
  verRelatorios:   roles => ['admin','gestor'].includes(roles),
  configCloudinary:roles => ['admin'].includes(roles),
  gerenciarEquipe: roles => ['admin','gestor'].includes(roles),
  adicionarLog:    roles => ['admin','gestor','atendente','mecanico','gerente'].includes(roles),
  moverStatus:     roles => ['admin','gestor','atendente','mecanico','gerente'].includes(roles),
  verComissoes:    roles => ['admin','gestor'].includes(roles),
  acessarIA:       roles => ['admin','gestor'].includes(roles),
};

// Atalho: pode(ação) → boolean
window.pode = (acao) => {
  const fn = PERM[acao];
  return fn ? fn(J.role) : false;
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
window.initCore = function() {
  J.db = window.initFirebase();

  if (!J.tid) { window.location.replace('index.html'); return; }

  if (J.brand) window.aplicarBrand(J.brand);

  _populateBaseUI();
  _aplicarRestricoesPorRole();

  // Listeners em paralelo
  _escutarOS();
  _escutarClientes();
  _escutarVeiculos();
  _escutarEstoque();
  _escutarFinanceiro();
  _escutarEquipe();
  _escutarFornecedores();
  _escutarMensagens();
  _escutarAgendamentos();
  _escutarAuditoria();
  _escutarNotificacoes();
};

window.initCoreEquipe = function() {
  J.db = window.initFirebase();
  if (!J.tid || J.role === 'admin') { window.location.replace('index.html'); return; }
  if (J.brand) window.aplicarBrand(J.brand);
  _populateBaseUI();
  _escutarOS();
  _escutarClientes();
  _escutarVeiculos();
  _escutarEstoque();
  _escutarChatEquipe();
  _escutarNotificacoes();
  if (J.fid) _escutarComissoesEquipe();
};

// ============================================================
// UI BASE
// ============================================================
function _populateBaseUI() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sbTenantNome',  J.tnome);
  set('sbUserNome',    J.nome);
  set('sbUserRole',    _roleLabel(J.role));
  set('topNomeTenant', J.tnome);

  const av = document.getElementById('sbAvatar');
  if (av) av.textContent = J.nome.charAt(0).toUpperCase();

  const nichoLabel = { carros:'🚗 Carros', motos:'🏍️ Motos', bicicletas:'🚲 Bicicletas', multi:'🔧 Multi' };
  const tnEl = document.getElementById('tbNicho');
  if (tnEl) tnEl.textContent = nichoLabel[J.nicho] || '🚗 Carros';
}

function _roleLabel(role) {
  const map = {
    admin:     'ADMINISTRADOR',
    gestor:    'GESTOR MASTER',
    gerente:   'GERENTE',
    atendente: 'ATENDENTE',
    mecanico:  'MECÂNICO',
    cliente:   'CLIENTE'
  };
  return map[role] || (role || 'USUÁRIO').toUpperCase();
}

// ============================================================
// APLICAR RESTRIÇÕES POR ROLE
// Oculta elementos do DOM que a role não deve ver
// ============================================================
function _aplicarRestricoesPorRole() {
  const role = J.role;

  // Aba financeiro — só admin vê DRE completo
  if (!pode('verFinanceiro')) {
    document.querySelectorAll('[data-role-hide*="financeiro"]').forEach(el => el.style.display = 'none');
  }
  if (!pode('verDRE')) {
    document.querySelectorAll('[data-role-hide*="dre"]').forEach(el => el.style.display = 'none');
  }

  // Botão deletar OS
  if (!pode('deletarOS')) {
    document.querySelectorAll('[data-role-hide*="deletar-os"]').forEach(el => el.style.display = 'none');
  }

  // Configurações
  if (!pode('configCloudinary')) {
    document.querySelectorAll('[data-role-hide*="config"]').forEach(el => el.style.display = 'none');
  }

  // Equipe / RH
  if (!pode('gerenciarEquipe')) {
    document.querySelectorAll('[data-role-hide*="rh"]').forEach(el => el.style.display = 'none');
  }

  // IA — só admin e gestor
  if (!pode('acessarIA')) {
    document.querySelectorAll('[data-role-hide*="ia"]').forEach(el => el.style.display = 'none');
  }

  // Mostrar badge de role na sidebar
  const roleEl = document.getElementById('sbUserRole');
  if (roleEl) {
    const colors = {
      admin:     'var(--brand)',
      gestor:    '#22D3A0',
      gerente:   '#60A5FA',
      atendente: '#F59E0B',
      mecanico:  '#F97316',
    };
    roleEl.style.color = colors[role] || 'var(--text-muted)';
  }
}

// ============================================================
// LISTENERS FIRESTORE
// ============================================================
function _escutarOS() {
  J.db.collection('ordens_servico')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.os = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderKanban)        renderKanban();
      if (window.renderDashboard)     renderDashboard();
      if (window.calcComissoes)       calcComissoes();
      if (window.atualizarPainelAtencao) atualizarPainelAtencao();
      // Atualiza modal de detalhes se estiver aberto
      const openModal = document.querySelector('.overlay.open');
      if (openModal && window._osDetalheAberta) {
        const os = J.os.find(x => x.id === window._osDetalheAberta);
        if (os && window.renderTimelineOS) renderTimelineOS(os.timeline || [], os.id);
      }
    });
}

function _escutarClientes() {
  J.db.collection('clientes')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderClientes) renderClientes();
      popularSelects();
    });
}

function _escutarVeiculos() {
  J.db.collection('veiculos')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.veiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderVeiculos) renderVeiculos();
      popularSelects();
    });
}

function _escutarEstoque() {
  J.db.collection('estoqueItems')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.estoque = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderEstoque)   renderEstoque();
      if (window.renderDashboard) renderDashboard();
    });
}

function _escutarFinanceiro() {
  J.db.collection('financeiro')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.financeiro = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderFinanceiro) renderFinanceiro();
      if (window.renderDashboard)  renderDashboard();
    });
}

function _escutarEquipe() {
  J.db.collection('funcionarios')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.equipe = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderEquipe)  renderEquipe();
      if (window.calcComissoes) calcComissoes();
      popularSelects();
    });
}

function _escutarFornecedores() {
  J.db.collection('fornecedores')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderFornecedores) renderFornecedores();
      popularSelects();
    });
}

function _escutarMensagens() {
  J.db.collection('mensagens')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.mensagens = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (window.renderChatLista) renderChatLista();
      if (J.chatAtivo && window.renderChatMsgs) renderChatMsgs(J.chatAtivo);
      const unread = J.mensagens.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
      setBadge('chatBadge', unread);
    });
}

function _escutarAgendamentos() {
  J.db.collection('agendamentos')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.agendamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderAgenda) renderAgenda();
    });
}

function _escutarAuditoria() {
  J.db.collection('lixeira_auditoria')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.auditoria = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.ts > a.ts ? 1 : -1);
      if (window.renderAuditoria) renderAuditoria();
    });
}

// Notificações em tempo real entre usuários (Chevron-style)
function _escutarNotificacoes() {
  J.db.collection('notificacoes_live')
    .where('tenantId', '==', J.tid)
    .where('ts', '>', J.notifLastSeen)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const n = change.doc.data();
        // Não mostra notificação do próprio usuário
        if (n.de === J.nome) return;
        toast(`${n.de}: ${n.msg}`, 'info');
        // Auto-deleta após 10s para não acumular
        setTimeout(() => change.doc.ref.delete().catch(() => {}), 10000);
      });
    });
}

// Chat equipe↔admin
function _escutarChatEquipe() {
  J.db.collection('chat_equipe')
    .where('tenantId', '==', J.tid)
    .onSnapshot(snap => {
      J.chatEquipe = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (window.renderChatEquipe) renderChatEquipe();
      const nLidas = J.chatEquipe.filter(m => m.sender === 'admin' && !m.lidaEquipe && m.para === J.fid).length;
      setBadge('chatTabBadge', nLidas);
    });
}

function _escutarComissoesEquipe() {
  J.db.collection('financeiro')
    .where('tenantId', '==', J.tid)
    .where('isComissao', '==', true)
    .where('mecId', '==', J.fid)
    .onSnapshot(snap => {
      const fins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (window.renderComissoes) renderComissoes(fins);
    });
}

// ============================================================
// PAINEL DE ATENÇÃO (Chevron-style) — alertas em tempo real
// ============================================================
window.atualizarPainelAtencao = function() {
  const container = _$('painelAtencao');
  if (!container) return;

  // Status que exigem atenção imediata
  const alertas = [
    {
      key:   'Aguardando',
      label: '⏳ AGUARDANDO MECÂNICO',
      cor:   'var(--warn)',
      bg:    'rgba(245,158,11,0.08)',
      borda: 'rgba(245,158,11,0.3)'
    },
    {
      key:   'Aprovado',
      label: '✅ SERVIÇO AUTORIZADO',
      cor:   'var(--success)',
      bg:    'rgba(34,211,160,0.08)',
      borda: 'rgba(34,211,160,0.3)'
    }
  ];

  let temAlerta = false;

  container.innerHTML = alertas.map(a => {
    const osNaFila = J.os.filter(o => o.status === a.key);
    if (osNaFila.length > 0) temAlerta = true;

    const items = osNaFila.map(o => {
      const v = J.veiculos.find(x => x.id === o.veiculoId);
      const c = J.clientes.find(x => x.id === o.clienteId);
      const prioClass = o.prioridade === 'vermelho' ? 'prio-vermelho' :
                        o.prioridade === 'amarelo'  ? 'prio-amarelo'  : '';
      return `<div class="painel-item ${prioClass}" onclick="_abrirDetalheOS('${o.id}')" title="Abrir O.S.">
        <span class="painel-placa">${v?.placa || '?'}</span>
        <span class="painel-cliente">${c?.nome?.split(' ')[0] || '—'}</span>
      </div>`;
    }).join('');

    return `<div class="painel-box" style="border-color:${a.borda};background:${a.bg}">
      <div class="painel-titulo" style="color:${a.cor}">${a.label}</div>
      <div class="painel-lista">
        ${items || '<span style="color:var(--text-muted);font-size:0.72rem">— Vazio —</span>'}
      </div>
    </div>`;
  }).join('');

  // LED de alerta no topbar
  const led = _$('alertaLed');
  if (led) {
    led.style.display = temAlerta ? 'block' : 'none';
    led.style.animation = temAlerta ? 'pulse-dot 1.5s infinite' : 'none';
  }
};

// Abrir detalhe da OS (usado pelo painel de atenção)
window._abrirDetalheOS = function(osId) {
  window._osDetalheAberta = osId;
  if (window.prepOS) { prepOS('edit', osId); openModal('modalOS'); }
  else if (window.irSecao) {
    irSecao('kanban', null);
    setTimeout(() => { prepOS('edit', osId); openModal('modalOS'); }, 100);
  }
};

// ============================================================
// NOTIFICAÇÃO LIVE para outros usuários
// ============================================================
window.notificarEquipe = async function(msg) {
  try {
    await J.db.collection('notificacoes_live').add({
      tenantId: J.tid,
      de:       J.nome,
      msg,
      ts:       Date.now()
    });
  } catch (e) { /* silencioso */ }
};

// ============================================================
// POPULAR SELECTS
// ============================================================
window.popularSelects = function() {
  const cOpts = '<option value="">Selecione...</option>' +
    J.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  ['osCliente','agdCliente','veicDono'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = cOpts;
  });

  const mOpts = '<option value="">Não atribuído</option>' +
    J.equipe.map(f => `<option value="${f.id}">${f.nome} — ${JARVIS_CONST.CARGOS[f.cargo] || f.cargo}</option>`).join('');
  ['osMec','agdMec'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = mOpts;
  });

  const fOpts = '<option value="">Selecione...</option>' +
    J.fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  const nfEl = document.getElementById('nfFornec');
  if (nfEl) nfEl.innerHTML = fOpts;
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

// ============================================================
// BUSCA GLOBAL POR PLACA (Chevron-style)
// ============================================================
window.buscaGlobal = function(termo) {
  const t   = (termo || '').trim().toUpperCase();
  const box = _$('buscaGlobalResultados');
  if (!box) return;

  if (!t) { box.classList.add('hidden'); return; }

  const matches = J.os
    .filter(o => {
      const v = J.veiculos.find(x => x.id === o.veiculoId);
      const c = J.clientes.find(x => x.id === o.clienteId);
      return v?.placa?.toUpperCase().includes(t) || c?.nome?.toUpperCase().includes(t);
    })
    .sort((a, b) => (b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1)
    .slice(0, 8);

  if (!matches.length) {
    box.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.8rem;text-align:center">Nenhum veículo encontrado</div>';
    box.classList.remove('hidden');
    return;
  }

  box.innerHTML = matches.map(o => {
    const v   = J.veiculos.find(x => x.id === o.veiculoId);
    const c   = J.clientes.find(x => x.id === o.clienteId);
    const cls = { Aguardando:'badge-neutral', Orcamento:'badge-warn', Aprovado:'badge-brand', Andamento:'badge-warn', Concluido:'badge-success', Cancelado:'badge-danger' }[o.status] || 'badge-neutral';
    return `<div class="busca-item" onclick="_abrirDetalheOS('${o.id}')">
      <div style="font-weight:700;font-family:var(--ff-mono);letter-spacing:0.08em">${v?.placa || '?'}</div>
      <div style="font-size:0.78rem;color:var(--text-secondary)">${c?.nome || '—'} · ${v?.modelo || ''}</div>
      <span class="badge ${cls}" style="font-size:0.55rem">${o.status}</span>
    </div>`;
  }).join('');
  box.classList.remove('hidden');
};

// Fecha busca ao clicar fora
document.addEventListener('click', e => {
  const searchWrap = document.getElementById('buscaGlobalWrap');
  if (searchWrap && !searchWrap.contains(e.target)) {
    const box = _$('buscaGlobalResultados');
    if (box) box.classList.add('hidden');
  }
});

// ============================================================
// AUDITORIA
// ============================================================
window.audit = async function(modulo, acao) {
  try {
    await J.db.collection('lixeira_auditoria').add({
      tenantId: J.tid, modulo, acao,
      usuario:  J.nome, role: J.role,
      ts:       new Date().toISOString()
    });
  } catch (e) { /* silencioso */ }
};

// ============================================================
// UTILITÁRIOS GLOBAIS
// ============================================================
window._$  = id  => document.getElementById(id);
window._v  = id  => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
window._sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
window._st = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt ?? ''; };
window._sh = (id, htm) => { const el = document.getElementById(id); if (el) el.innerHTML = htm ?? ''; };
window._chk = id => { const el = document.getElementById(id); return el ? el.checked : false; };
window._ck  = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

window.moeda = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v) || 0);

window.dtBr = iso => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } catch { return iso; }
};

window.dtHrBr = iso => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } catch { return iso; }
};

window.dtISO = () => new Date().toISOString();
window.randId = (n = 6) => Math.random().toString(36).slice(-n).toUpperCase();

window.sair = function() {
  sessionStorage.clear();
  window.location.href = 'index.html';
};

window.abrirWpp = function(numero, msg) {
  const n = (numero || '').replace(/\D/g, '');
  window.open(`https://wa.me/55${n}?text=${encodeURIComponent(msg || '')}`, '_blank');
};
