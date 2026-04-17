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

// ── MOTOR DE MÍDIA DO CHAT (ÁUDIO E ARQUIVOS) ─────────────────
let _mediaRecorder;
let _audioChunks = [];

window.togglePTT = async function() {
  const btn = document.getElementById('btnPTT');
  if (!btn) return;

  if (_mediaRecorder && _mediaRecorder.state === 'recording') {
    _mediaRecorder.stop();
    btn.style.color = '';
    btn.style.background = '';
    btn.innerHTML = '🎤';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _mediaRecorder = new MediaRecorder(stream);
    _audioChunks = [];

    _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };
    _mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(_audioChunks, { type: 'audio/webm' });
      const fd = new FormData();
      fd.append('file', audioBlob);
      fd.append('upload_preset', J.cloudPreset);
      
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;border-color:var(--brand) transparent transparent transparent"></span>';
      
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, {method:'POST',body:fd});
        const data = await res.json();
        
        if (data.secure_url) {
          const isEquipe = window.location.pathname.includes('equipe.html');
          const inputEl = document.getElementById(isEquipe ? 'chatInputEquipe' : 'chatInput');
          
          if (inputEl) {
            inputEl.value = `[AUDIO]${data.secure_url}`;
            if (isEquipe && window.enviarMsgEquipe) window.enviarMsgEquipe();
            else if (window.enviarChat) window.enviarChat();
          }
        }
      } catch (e) {
        window.toastErr && toastErr('Erro ao enviar áudio: ' + e.message);
      } finally {
        btn.innerHTML = '🎤';
        stream.getTracks().forEach(t => t.stop());
      }
    };

    _mediaRecorder.start();
    btn.style.color = 'white';
    btn.style.background = 'var(--danger)';
    btn.innerHTML = '⏹️';
    window.toastOk && toastOk('Gravando... Toque no ⏹️ para enviar.');

  } catch (err) {
    window.toastErr && toastErr('⚠ Permissão de microfone negada.');
  }
};

window.enviarArquivoChat = async function(input) {
  const file = input.files[0];
  if (!file) return;
  
  const isEquipe = window.location.pathname.includes('equipe.html');
  const inputEl = document.getElementById(isEquipe ? 'chatInputEquipe' : 'chatInput');
  if (!inputEl) return;

  window.toastOk && toastOk('Enviando arquivo...');
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', J.cloudPreset);
    
    const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, {method:'POST',body:fd});
    const data = await res.json();
    
    if (data.secure_url) {
      const prefixo = data.resource_type === 'image' ? '[IMAGEM]' : '[ARQUIVO]';
      inputEl.value = `${prefixo}${data.secure_url}`;
      
      if (isEquipe && window.enviarMsgEquipe) window.enviarMsgEquipe();
      else if (window.enviarChat) window.enviarChat();
    }
  } catch(e) {
    window.toastErr && toastErr('Erro no anexo: ' + e.message);
  } finally {
    input.value = '';
  }
};

// ── FORMATADOR BLINDADO DE MÍDIA ──
window.formatarMidiaChat = function(texto) {
  if (!texto) return '';
  const t = String(texto).trim();
  
  if (t.includes('[AUDIO]')) {
    const url = t.split('[AUDIO]')[1].trim();
    return `<audio src="${url}" controls style="height:34px; max-width:200px; outline:none;"></audio>`;
  }
  if (t.includes('[IMAGEM]')) {
    const url = t.split('[IMAGEM]')[1].trim();
    return `<img src="${url}" style="max-width:200px; border-radius:4px; cursor:zoom-in; border:1px solid var(--border);" onclick="window.open('${url}')">`;
  }
  if (t.includes('[ARQUIVO]')) {
    const url = t.split('[ARQUIVO]')[1].trim();
    return `<a href="${url}" target="_blank" style="color:var(--brand);text-decoration:underline;font-weight:bold;">📎 Abrir Anexo de Documento</a>`;
  }
  return texto;
};

// ============================================================
// CHAT CRM B2C E CHAT EQUIPE ADMIN
// ============================================================
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
  _st('chatHead', 'ATENDIMENTO: ' + nome.toUpperCase());
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
    ${window.formatarMidiaChat(m.msg)}
    <div class="ts">${m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
  </div>`).join('');
  el.scrollTop = el.scrollHeight;
};

window.enviarChat = async function(txt) {
  const msg = txt || _v('chatInput'); if(!msg || !J.chatAtivo) return;
  await J.db.collection('mensagens').add({tenantId: J.tid, clienteId: J.chatAtivo, sender: 'admin', msg, lidaAdmin: true, lidaCliente: false, ts: Date.now()});
  _sv('chatInput', '');
};

document.getElementById('chatInput')?.addEventListener('keydown', e => { if(e.key === 'Enter') window.enviarChat(); });

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
  _st('chatHeadEquipe', 'CHAT EQUIPE: ' + nome.toUpperCase());
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
    ${window.formatarMidiaChat(m.msg)}
    <div class="ts">${m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
  </div>`).join('');
  el.scrollTop = el.scrollHeight;
};

window.enviarMsgEquipeAdmin = async function(txt) {
  const msg = txt || _v('chatInputEquipeAdmin'); if (!msg || (!J.chatEquipeAtivo && !J.chatAtivoEquipe)) return;
  const fid = J.chatEquipeAtivo || J.chatAtivoEquipe;
  await J.db.collection('chat_equipe').add({tenantId: J.tid, de: 'admin', para: fid, sender: 'admin', msg, lidaAdmin: true, lidaEquipe: false, ts: Date.now()});
  _sv('chatInputEquipeAdmin', '');
};

document.getElementById('chatInputEquipeAdmin')?.addEventListener('keydown', e => { if(e.key === 'Enter') window.enviarMsgEquipeAdmin(); });
