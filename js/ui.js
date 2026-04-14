/**
 * JARVIS ERP — ui.js
 * Sistema de UI: toast, modal, tabs, loaders, navegação
 */

'use strict';

// ============================================================
// TOAST SYSTEM
// ============================================================
window.toast = function(msg, type = 'success', title = null) {
  const icons = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-icon">${icons[type] || '✓'}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-msg">${msg}</div>
    </div>
  `;
  container.appendChild(el);

  // Auto-remove
  const remove = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 320);
  };

  setTimeout(remove, type === 'error' ? 5000 : 3200);
  el.addEventListener('click', remove);
};

// Atalhos
window.toastOk   = msg => toast(msg, 'success');
window.toastErr  = msg => toast(msg, 'error', 'Erro');
window.toastWarn = msg => toast(msg, 'warn');
window.toastInfo = msg => toast(msg, 'info');

// ============================================================
// MODAL SYSTEM
// ============================================================
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus no primeiro input
  setTimeout(() => {
    const first = el.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
  }, 100);
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
};

window.closeAllModals = function() {
  document.querySelectorAll('.overlay.open').forEach(el => {
    el.classList.remove('open');
  });
  document.body.style.overflow = '';
};

// Fechar clicando no overlay
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Fechar com ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// ============================================================
// TABS SYSTEM
// ============================================================
window.switchTab = function(tabEl, paneId, ...otherPaneIds) {
  // Desativa todos os tabs do mesmo pai
  tabEl.parentElement.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');

  // Ativa o pane correto
  const pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');

  otherPaneIds.forEach(id => {
    const p = document.getElementById(id);
    if (p) p.classList.remove('active');
  });
};

// ============================================================
// PAGE NAVIGATION (sidebar)
// ============================================================
const _sectionCache = {};

window.irSecao = function(key, navEl) {
  const sectionMap = window.SECTION_MAP || {};
  const titleMap   = window.TITLE_MAP   || {};

  // Esconde todas as seções
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  // Desativa nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Ativa seção
  const secId = sectionMap[key];
  if (secId) {
    const sec = document.getElementById(secId);
    if (sec) sec.classList.add('active');
  }

  // Ativa nav item
  if (navEl) navEl.classList.add('active');

  // Atualiza título
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titleMap[key] || key.toUpperCase();

  // Hook para seção ativada
  if (window.onSectionChange) onSectionChange(key);
};

// ============================================================
// LOADER STATES
// ============================================================
window.setLoading = function(btnId, loading, originalText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn._origText = btn.innerHTML;
    btn.innerHTML = `<div class="spinner"></div> ${originalText || 'Aguarde...'}`;
    btn.disabled = true;
    btn.classList.add('btn-loading');
  } else {
    btn.innerHTML = btn._origText || originalText || 'Salvar';
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
};

window.showPageLoader = function(show) {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  if (show) {
    loader.classList.remove('hidden', 'fade-out');
  } else {
    loader.classList.add('fade-out');
    setTimeout(() => loader.classList.add('hidden'), 450);
  }
};

// ============================================================
// EMPTY STATE HELPER
// ============================================================
window.emptyState = function(icon, title, sub) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${title}</div>
      ${sub ? `<div class="empty-state-sub">${sub}</div>` : ''}
    </div>
  `;
};

window.tableEmpty = function(cols, icon, msg) {
  return `<tr><td colspan="${cols}" class="table-empty">${icon} ${msg}</td></tr>`;
};

// ============================================================
// CONFIRM DIALOG (melhorado vs. window.confirm nativo)
// ============================================================
window.confirmar = function(msg, titulo = 'Confirmação') {
  return new Promise(resolve => {
    // Usa confirm nativo por agora (pode-se customizar com modal)
    resolve(window.confirm(`${titulo}\n\n${msg}`));
  });
};

// ============================================================
// SEARCH BAR HELPER
// ============================================================
window.setupSearch = function(inputId, onSearch) {
  const el = document.getElementById(inputId);
  if (!el) return;
  let debounce;
  el.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => onSearch(el.value.toLowerCase().trim()), 180);
  });
};

// ============================================================
// BADGE COUNTER
// ============================================================
window.setBadge = function(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('show', count > 0);
};

// ============================================================
// FORMATTERS (para tabelas)
// ============================================================
window.badgeStatus = function(status) {
  const map = {
    'Aguardando': 'badge-neutral',
    'Orcamento':  'badge-warn',
    'Aprovado':   'badge-brand',
    'Andamento':  'badge-warn',
    'Concluido':  'badge-success',
    'Cancelado':  'badge-danger',
    'Pago':       'badge-success',
    'Pendente':   'badge-warn',
    'Online':     'badge-success',
    'Trial':      'badge-warn',
    'Bloqueado':  'badge-danger'
  };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${status}</span>`;
};

window.badgeTipo = function(tipo) {
  const map = {
    carro:     ['badge-brand',   '🚗 Carro'],
    moto:      ['badge-warn',    '🏍️ Moto'],
    bicicleta: ['badge-success', '🚲 Bicicleta']
  };
  const [cls, lbl] = map[tipo] || ['badge-neutral', tipo];
  return `<span class="badge ${cls}">${lbl}</span>`;
};

window.badgeEntradaSaida = function(tipo) {
  return tipo === 'Entrada'
    ? `<span class="badge badge-success">${tipo}</span>`
    : `<span class="badge badge-danger">${tipo}</span>`;
};

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  // Enter em inputs mono não submete formulário acidentalmente
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.classList.contains('input-mono')) {
    e.preventDefault();
  }
});