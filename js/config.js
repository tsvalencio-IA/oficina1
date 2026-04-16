/**
 * JARVIS ERP — config.js
 * Firebase + Brand + Constantes globais
 */
'use strict';

window.JARVIS_FB_CONFIG = {
  apiKey:            "AIzaSyBqIuCsHHuy_f-mBWV4JBkbyOorXpqQvqg",
  authDomain:        "hub-thiaguinho.firebaseapp.com",
  projectId:         "hub-thiaguinho",
  storageBucket:     "hub-thiaguinho.firebasestorage.app",
  messagingSenderId: "453508098543",
  appId:             "1:453508098543:web:305f4d48edd9be40bd6e1a"
};

window.JARVIS_BRAND = {
  name:        "JARVIS ERP",
  tagline:     "Gestão Automotiva Inteligente",
  logoLetter:  "J",
  color:       "#3B82F6",
  colorDim:    "rgba(59,130,246,0.12)",
  colorGlow:   "rgba(59,130,246,0.25)",
  colorDark:   "#1D4ED8",
  footer:      "Powered by thIAguinho Soluções Digitais · 2026"
};

window.JARVIS_CONST = {
  // Status da OS — 7 etapas Kanban (Chevron + Evolution unified)
  STATUS_OS: [
    { key: 'Triagem',            label: 'Triagem',               cor: '#94A3B8' },
    { key: 'Orcamento',          label: 'Orçamento',             cor: '#F59E0B' },
    { key: 'Orcamento_Enviado',  label: 'Orç. Enviado',          cor: '#8B5CF6' },
    { key: 'Aprovado',           label: 'Aprovado',              cor: '#3B82F6' },
    { key: 'Andamento',          label: 'Em Serviço',            cor: '#FF8C00' },
    { key: 'Pronto',             label: 'Pronto p/ Retirada',    cor: '#22D3A0' },
    { key: 'Entregue',           label: 'Entregue',              cor: '#10B981' }
  ],

  // Status que geram alertas no Painel de Atenção
  ALERT_STATUSES: {
    'Triagem': { label: '⏳ AGUARDANDO MECÂNICO', cor: '#F59E0B' },
    'Aprovado':{ label: '✅ SERVIÇO AUTORIZADO',  cor: '#22D3A0' }
  },

  FORMAS_PGTO: [
    { value: 'Dinheiro',          label: '💵 Dinheiro',         pago: true },
    { value: 'PIX',               label: '📱 PIX',              pago: true },
    { value: 'Débito',            label: '💳 Débito',           pago: true },
    { value: 'Crédito à Vista',   label: '💳 Crédito à Vista',  pago: true },
    { value: 'Crédito Parcelado', label: '💳 Crédito Parcelado', pago: false },
    { value: 'Boleto',            label: '📄 Boleto',           pago: false }
  ],

  CARGOS: {
    mecanico:      '🔧 Mecânico',
    eletricista:   '⚡ Eletricista',
    funileiro:     '🔨 Funileiro',
    pintor:        '🎨 Pintor',
    gerente:       '📋 Gerente',
    atendente:     '📞 Atendente',
    recepcionista: '📞 Recepcionista'
  },

  UNIDADES: ['UN','PC','L','ML','KG','M','JG','PAR','CX','KT'],

  NICHOS: {
    carros:     '🚗 Carros',
    motos:      '🏍️ Motos',
    bicicletas: '🚲 Bicicletas',
    multi:      '🔧 Multi-Marca'
  },

  PLANOS: {
    starter:    { label: 'Starter',    preco: 97 },
    pro:        { label: 'Pro',        preco: 197 },
    enterprise: { label: 'Enterprise', preco: 397 }
  },

  // Mensagens WhatsApp B2C
  WPP_MSGS: {
    orcamento: (nome, veiculo, oficina, total, link, pin) =>
      `Olá ${nome}! 👋\n\nO orçamento do seu *${veiculo}* está pronto na *${oficina}*.\n\n💰 *Total: R$ ${total}*\n\nAcesse seu portal exclusivo:\n🔗 ${link}\n🔑 PIN: *${pin}*`,
    pronto: (nome, veiculo, oficina) =>
      `🎉 Olá ${nome}! Seu *${veiculo}* está pronto para retirada na *${oficina}*. Agradecemos a preferência!`,
    revisao: (nome, veiculo, data) =>
      `🔔 Olá ${nome}, seu *${veiculo}* tem revisão programada para ${data}. Deseja agendar?`
  }
};

// ── APLICAR BRAND ──────────────────────────────────────────
window.aplicarBrand = function(brand) {
  const b = { ...window.JARVIS_BRAND, ...brand };
  window.JARVIS_BRAND = b;

  const root = document.documentElement;
  root.style.setProperty('--brand',      b.color      || '#3B82F6');
  root.style.setProperty('--brand-dim',  b.colorDim   || 'rgba(59,130,246,0.12)');
  root.style.setProperty('--brand-glow', b.colorGlow  || 'rgba(59,130,246,0.25)');
  root.style.setProperty('--brand-dark', b.colorDark  || '#1D4ED8');

  document.querySelectorAll('.sb-brand-mark').forEach(el => el.textContent = b.logoLetter || b.name.charAt(0));
  document.querySelectorAll('.brand-name').forEach(el => el.textContent = b.name || 'JARVIS ERP');
  document.querySelectorAll('.brand-tagline').forEach(el => el.textContent = b.tagline || '');
  document.querySelectorAll('.brand-footer').forEach(el => el.textContent = b.footer || '');

  document.title = (b.name || 'JARVIS ERP') + ' — ERP Automotivo';
};

// ── FIREBASE INIT ──────────────────────────────────────────
window.initFirebase = function() {
  if (!firebase.apps.length) firebase.initializeApp(window.JARVIS_FB_CONFIG);
  return firebase.firestore();
};

// ── HELPERS ────────────────────────────────────────────────
function _hexDim(hex, alpha) {
  const c = (hex || '#3B82F6').replace('#', '');
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

window._hexDim = _hexDim;
