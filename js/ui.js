/**
 * JARVIS ERP — ui.js
 * Sistema Universal de UI: toast, modal, tabs, loaders, navegação, badges
 */

'use strict';

// ============================================================
// TOAST SYSTEM
// ============================================================
window.toast = function(msg, type = 'ok', title = null) {
  const icons = { ok: '✓', err: '✕', warn: '⚠', info: 'ℹ', success: '✓', error: '✕' };
  const t = (type === 'error') ? 'err' : (type === 'success' ? 'ok' : type);
  const container = document.getElementById('toastBox') || document.body;
  const el = document.createElement('div');
  el.className = `toast-j ${t}`;
  el.innerHTML = `${icons[t] || '✓'} ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3500);
};

window.toastOk   = msg => toast(msg, 'ok');
window.toastErr  = msg => toast(msg, 'err');
window.toastWarn = msg => toast(msg, 'warn');
window.toastInfo = msg => toast(msg, 'info');

// ============================================================
// MODAL SYSTEM (Adaptador Universal)
// ============================================================
window.abrirModal = window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
};

window.fecharModal = window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
};

window.fecharTodosModais = window.closeAllModals = function() {
  document.querySelectorAll('.overlay.open').forEach(el => el.classList.remove('open'));
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('open');
});

// ============================================================
// TABS E NAVEGAÇÃO (Adaptador Universal)
// ============================================================
window.switchTab = function(el, active, ...others) {
  el.parentElement.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const a = document.getElementById(active); if(a) a.classList.add('active');
  others.forEach(o => { const oe = document.getElementById(o); if(oe) oe.classList.remove('active'); });
};

window.ir = window.irSecao = function(key, navEl) {
  const sectionMap = window.SECTION_MAP || { dashboard:'s-dashboard', agenda:'s-agenda', kanban:'s-kanban', clientes:'s-clientes', estoque:'s-estoque', financeiro:'s-financeiro', equipe:'s-equipe', chat:'s-chat', chatEquipe:'s-chat-equipe', ia:'s-ia', auditoria:'s-auditoria' };
  const titleMap   = window.TITLE_MAP   || { dashboard:'DASHBOARD', agenda:'AGENDA', kanban:'PÁTIO / O.S.', clientes:'CLIENTES & VEÍCULOS', estoque:'ESTOQUE / NF', financeiro:'FINANCEIRO / DRE', equipe:'EQUIPE & RH', chat:'CRM CHAT', chatEquipe:'CHAT DA EQUIPE', ia:'thIAguinho IA', auditoria:'AUDITORIA' };

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const secId = sectionMap[key];
  if (secId) {
    const sec = document.getElementById(secId);
    if (sec) sec.classList.add('active');
  }

  if (navEl) navEl.classList.add('active');
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titleMap[key] || key.toUpperCase();
};

// ============================================================
// LOADERS, BADGES & HELPERS
// ============================================================
window.showPageLoader = function(show) {};

window.confirmar = function(msg, titulo = 'Confirmação') {
  return new Promise(resolve => resolve(window.confirm(`${titulo}\n\n${msg}`)));
};

window.tableEmpty = function(cols, icon, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;color:var(--muted);padding:24px;">${icon} ${msg}</td></tr>`;
};

window.setBadge = function(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'block' : 'none';
};

window.badgeStatus = function(status) {
  const map = { 'Aguardando': 'pill-gray', 'Triagem': 'pill-gray', 'Orcamento': 'pill-warn', 'Orcamento_Enviado': 'pill-purple', 'Aprovado': 'pill-cyan', 'Andamento': 'pill-warn', 'Concluido': 'pill-green', 'Cancelado': 'pill-danger', 'Pago': 'pill-green', 'Pendente': 'pill-warn', 'Entregue': 'pill-green', 'Pronto': 'pill-green' };
  return `<span class="pill ${map[status] || 'pill-gray'}">${status}</span>`;
};

window.badgeTipo = function(tipo) {
  const map = { carro: ['pill-cyan', '🚗 Carro'], moto: ['pill-warn', '🏍️ Moto'], bicicleta: ['pill-green', '🚲 Bicicleta'] };
  const [cls, lbl] = map[tipo] || ['pill-gray', tipo];
  return `<span class="pill ${cls}">${lbl}</span>`;
};

window.badgeEntradaSaida = function(tipo) {
  return tipo === 'Entrada' ? `<span class="pill pill-green">${tipo}</span>` : `<span class="pill pill-danger">${tipo}</span>`;
};
