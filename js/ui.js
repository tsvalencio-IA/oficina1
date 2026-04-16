/**
 * JARVIS ERP — ui.js
 * Sistema de UI: toast, modal, tabs, loaders, navegação
 */
'use strict';

// ── TOAST ──────────────────────────────────────────────────
window.toast = function(msg, type='success', title=null) {
  const icons = { success:'✓', error:'✕', warn:'⚠', info:'ℹ' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-icon">${icons[type]||'✓'}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-msg">${msg}</div>
    </div>`;
  container.appendChild(el);
  const remove = () => {
    el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 330);
  };
  setTimeout(remove, type === 'error' ? 5000 : 3500);
  el.addEventListener('click', remove);
};
window.toastOk   = msg => toast(msg, 'success');
window.toastErr  = msg => toast(msg, 'error', 'Erro');
window.toastWarn = msg => toast(msg, 'warn');
window.toastInfo = msg => toast(msg, 'info');

// Compat com código legado do jarvis.html
window.toast_j = window.toast;

// ── MODAL ──────────────────────────────────────────────────
window.abrirModal = window.openModal = function(id) {
  const el = document.getElementById(id); if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const first = el.querySelector('input:not([type=hidden]),select,textarea');
    if (first) first.focus();
  }, 120);
};

window.fecharModal = window.closeModal = function(id) {
  const el = document.getElementById(id); if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
};

window.closeAllModals = function() {
  document.querySelectorAll('.overlay.open').forEach(el => el.classList.remove('open'));
  document.body.style.overflow = '';
};

// Fechar no overlay
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay') && e.target.id !== 'buscaGlobalWrap') {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Fechar com ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// ── TABS ───────────────────────────────────────────────────
window.switchTab = function(tabEl, activeId, ...others) {
  tabEl.parentElement.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  const pane = document.getElementById(activeId);
  if (pane) pane.classList.add('active');
  others.forEach(id => { const p = document.getElementById(id); if (p) p.classList.remove('active'); });
};

// ── NAVEGAÇÃO SEÇÕES ───────────────────────────────────────
window.ir = window.irSecao = function(key, navEl) {
  const map = window.SECTION_MAP || {};
  const titles = window.TITLE_MAP || {};

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const secId = map[key]; if (!secId) return;
  const sec = document.getElementById(secId); if (sec) sec.classList.add('active');
  if (navEl) navEl.classList.add('active');

  const titleEl = document.getElementById('pageTitle'); if (titleEl) titleEl.textContent = titles[key] || key.toUpperCase();
  const subEl   = document.getElementById('pageSub');   if (subEl)   subEl.textContent = 'SISTEMA OPERACIONAL';

  if (window.onSectionChange) onSectionChange(key);
};

// ── LOADER GLOBAL ──────────────────────────────────────────
window.showPageLoader = function(show) {
  const loader = document.getElementById('page-loader'); if (!loader) return;
  if (show) { loader.classList.remove('hidden','fade-out'); }
  else { loader.classList.add('fade-out'); setTimeout(() => loader.classList.add('hidden'), 460); }
};

window.setLoading = function(btnId, loading, origText) {
  const btn = document.getElementById(btnId); if (!btn) return;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${origText||'Aguarde...'}`;
    btn.disabled = true; btn.classList.add('btn-loading');
  } else {
    btn.innerHTML = btn._orig || origText || 'Salvar';
    btn.disabled = false; btn.classList.remove('btn-loading');
  }
};

// ── HELPERS DE TABELA ──────────────────────────────────────
window.tableEmpty = function(cols, icon, msg) {
  return `<tr><td colspan="${cols}" class="table-empty">${icon} ${msg}</td></tr>`;
};

window.emptyState = function(icon, title, sub) {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <div class="empty-state-title">${title}</div>
    ${sub ? `<div class="empty-state-sub">${sub}</div>` : ''}
  </div>`;
};

// ── BADGES SEMÂNTICOS ──────────────────────────────────────
window.badgeStatus = function(status) {
  const map = {
    Triagem:'badge-neutral', Orcamento:'badge-warn', Orcamento_Enviado:'badge-purple',
    Aprovado:'badge-brand', Andamento:'badge-warn', Pronto:'badge-success',
    Entregue:'badge-success', Cancelado:'badge-danger',
    Pago:'badge-success', Pendente:'badge-warn',
    Ativo:'badge-success', Bloqueado:'badge-danger', Trial:'badge-warn'
  };
  return `<span class="badge ${map[status]||'badge-neutral'}">${status}</span>`;
};

window.badgeTipo = function(tipo) {
  const map = { carro:['badge-brand','🚗 Carro'], moto:['badge-warn','🏍️ Moto'], bicicleta:['badge-success','🚲 Bicicleta'] };
  const [cls, lbl] = map[tipo] || ['badge-neutral', tipo];
  return `<span class="badge ${cls}">${lbl}</span>`;
};

// ── CONFIRM PERSONALIZADO ──────────────────────────────────
window.confirmar = function(msg, titulo='Confirmação') {
  return Promise.resolve(window.confirm(`${titulo}\n\n${msg}`));
};
