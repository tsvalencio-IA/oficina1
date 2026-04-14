/**
 * JARVIS ERP — config.js
 * Firebase config + white-label brand + constantes globais
 * Cada tenant pode ter sua cor de marca própria salva no Firestore
 */

'use strict';

// ============================================================
// FIREBASE
// ============================================================
window.JARVIS_FB_CONFIG = {
  apiKey:            "AIzaSyBqIuCsHHuy_f-mBWV4JBkbyOorXpqQvqg",
  authDomain:        "hub-thiaguinho.firebaseapp.com",
  projectId:         "hub-thiaguinho",
  storageBucket:     "hub-thiaguinho.firebasestorage.app",
  messagingSenderId: "453508098543",
  appId:             "1:453508098543:web:305f4d48edd9be40bd6e1a"
};

// ============================================================
// WHITE-LABEL DEFAULT BRAND
// Sobrescrito após login com os dados do tenant no Firestore
// ============================================================
window.JARVIS_BRAND = {
  name:        "JARVIS ERP",
  tagline:     "Gestão Automotiva Inteligente",
  logoLetter:  "J",
  color:       "#3B82F6",      // brand primary (hex)
  colorDim:    "rgba(59,130,246,0.12)",
  colorGlow:   "rgba(59,130,246,0.25)",
  colorDark:   "#1D4ED8",
  footer:      "Powered by thIAguinho Soluções Digitais · 2026"
};

// ============================================================
// CONSTANTES DE NEGÓCIO
// ============================================================
window.JARVIS_CONST = {

  // PLANOS SaaS
  PLANOS: {
    trial:      { label: 'Trial',      preco: 0,   dias: 7  },
    starter:    { label: 'Starter',    preco: 97,  dias: 30 },
    pro:        { label: 'Pro',        preco: 197, dias: 30 },
    enterprise: { label: 'Enterprise', preco: 397, dias: 30 }
  },

  // NICHOS
  NICHOS: {
    carros:     { label: '🚗 Carros',      tipo: 'carro' },
    motos:      { label: '🏍️ Motos',       tipo: 'moto'  },
    bicicletas: { label: '🚲 Bicicletas',  tipo: 'bicicleta' },
    multi:      { label: '🔧 Multi',       tipo: null    }
  },

  // STATUS KANBAN
  STATUS_OS: [
    { key: 'Aguardando',  label: 'Triagem',     cor: '#94A3B8', classe: 'card-triagem'   },
    { key: 'Orcamento',   label: 'Orçamento',   cor: '#F59E0B', classe: 'card-orcamento' },
    { key: 'Aprovado',    label: 'Aprovado',    cor: '#3B82F6', classe: 'card-aprovado'  },
    { key: 'Andamento',   label: 'Em Serviço',  cor: '#F97316', classe: 'card-servico'   },
    { key: 'Concluido',   label: 'Pronto',      cor: '#22D3A0', classe: 'card-pronto'    },
    { key: 'Cancelado',   label: 'Cancelado',   cor: '#F43F5E', classe: 'card-danger'    }
  ],

  // CARGOS
  CARGOS: {
    mecanico:     '🔧 Mecânico',
    eletricista:  '⚡ Eletricista',
    funileiro:    '🔨 Funileiro',
    pintor:       '🎨 Pintor',
    borracheiro:  '⚙️ Borracheiro',
    gerente:      '📋 Gerente',
    vendedor:     '💼 Vendedor',
    recepcionista:'📞 Recepcionista'
  },

  // FORMAS DE PAGAMENTO
  FORMAS_PGTO: [
    { value: 'Dinheiro',           label: '💵 Dinheiro',              pago: true  },
    { value: 'PIX',                label: '📱 PIX',                   pago: true  },
    { value: 'Débito',             label: '💳 Cartão Débito',         pago: true  },
    { value: 'Crédito à Vista',    label: '💳 Crédito à Vista',       pago: true  },
    { value: 'Crédito Parcelado',  label: '💳 Crédito Parcelado',     pago: false },
    { value: 'Transferência',      label: '🏦 Transferência Bancária', pago: true  },
    { value: 'Boleto',             label: '📄 Boleto Bancário',        pago: false },
    { value: 'A Prazo',            label: '📅 A Prazo (Fiado)',        pago: false }
  ],

  // UNIDADES
  UNIDADES: ['UN','PC','L','ML','KG','M','JG','PAR','CX','KT'],

  // MODELOS DE MENSAGEM WHATSAPP
  WPP_MSGS: {
    orcamento: (nome, veiculo, oficial, total) =>
      `Olá ${nome}! 👋\n\nSeu *${veiculo}* está em análise na *${oficial}*.\n\n💰 *Orçamento aprovado: R$ ${total}*\n\nPara aprovar o serviço, clique no link abaixo para acessar seu portal:`,

    aprovado: (nome, veiculo, oficial) =>
      `✅ *Serviço Aprovado!*\n\nOlá ${nome}! Seu *${veiculo}* foi para a fila de serviço na *${oficial}*.\nEm breve nossa equipe dará início ao serviço.`,

    pronto: (nome, veiculo, oficial) =>
      `🎉 *Veículo Pronto!*\n\nOlá ${nome}! Boas notícias! Seu *${veiculo}* está pronto e disponível para retirada na *${oficial}*.\n\nAgradecemos a preferência! 🚗✨`,

    revisao: (nome, veiculo, data, km) =>
      `🔔 *Lembrete de Revisão*\n\nOlá ${nome}! Seu *${veiculo}* está próximo da revisão programada${data ? ` para ${data}` : ''}${km ? ` (${km} km)` : ''}.\n\nAgende agora para manter seu veículo em dia!`
  },

  // SUPERADMIN CREDENTIALS (OBSOLETE - USE FIREBASE AUTH)
  SA_CREDENTIALS: []
};

// ============================================================
// APLICAR WHITE-LABEL CSS VARS
// ============================================================
window.aplicarBrand = function(brand) {
  const b = { ...window.JARVIS_BRAND, ...brand };
  window.JARVIS_BRAND = b;
  const root = document.documentElement;
  root.style.setProperty('--brand',      b.color);
  root.style.setProperty('--brand-dim',  b.colorDim  || hexToRgba(b.color, 0.12));
  root.style.setProperty('--brand-glow', b.colorGlow || hexToRgba(b.color, 0.25));
  root.style.setProperty('--brand-dark', b.colorDark || shadeColor(b.color, -20));

  // Atualiza logo mark em todas as ocorrências
  document.querySelectorAll('.sb-brand-mark').forEach(el => {
    el.textContent = b.logoLetter || b.name.charAt(0).toUpperCase();
  });
  document.querySelectorAll('.brand-name').forEach(el => el.textContent = b.name);
  document.querySelectorAll('.brand-tagline').forEach(el => el.textContent = b.tagline || '');
  document.querySelectorAll('.brand-footer').forEach(el => el.textContent = b.footer);

  // Favicon dinâmico
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/x-icon'; link.rel = 'shortcut icon';
  link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${encodeURIComponent(b.color)}'/><text x='16' y='22' text-anchor='middle' font-family='sans-serif' font-weight='800' font-size='18' fill='white'>${b.logoLetter || 'J'}</text></svg>`;
  document.head.appendChild(link);

  // Title
  document.title = b.name + ' — ' + (b.tagline || 'ERP Automotivo');
};

// HELPERS DE COR
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shadeColor(hex, percent) {
  let R = parseInt(hex.slice(1,3),16);
  let G = parseInt(hex.slice(3,5),16);
  let B = parseInt(hex.slice(5,7),16);
  R = Math.min(255, Math.max(0, R + (R * percent / 100)));
  G = Math.min(255, Math.max(0, G + (G * percent / 100)));
  B = Math.min(255, Math.max(0, B + (B * percent / 100)));
  return `#${Math.round(R).toString(16).padStart(2,'0')}${Math.round(G).toString(16).padStart(2,'0')}${Math.round(B).toString(16).padStart(2,'0')}`;
}

// ============================================================
// FIREBASE INIT (chamado pelo core.js)
// ============================================================
window.initFirebase = function() {
  if (!firebase.apps.length) firebase.initializeApp(window.JARVIS_FB_CONFIG);
  return firebase.firestore();
};