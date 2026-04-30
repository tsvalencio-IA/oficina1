/**
 * JARVIS ERP — config.js
 * Firebase config + white-label brand + constantes globais
 * CONFORMIDADE LGPD BRASIL + LOGICA EVOLUTION + STATUS CHEVRON
 */

'use strict';

// ============================================================
// FIREBASE CONFIGURATION (Oficial do Repositório)
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
// BRANDING & UI (Chevron Style)
// ============================================================
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

// ============================================================
// CONSTANTES DE NEGÓCIO E LGPD
// ============================================================
window.JARVIS_CONST = {

  // CONFIGURAÇÃO LGPD (Brasil)
  LGPD: {
    versao: "1.0",
    termos_uso: "Ao utilizar este sistema, você concorda com a coleta de dados necessária para a prestação de serviços automotivos, conforme a Lei 13.709/2018.",
    politica_privacidade: "Os dados coletados (Nome, CPF, Placa, Telefone) são utilizados exclusivamente para fins de faturamento, garantia e comunicação direta sobre o status do serviço.",
    consentimento_msg: "Autorizo o processamento dos meus dados para fins de manutenção veicular e recebimento de orçamentos via WhatsApp."
  },

  // STATUS KANBAN (Lógica Teste Chevron - 7 Etapas)
  STATUS_OS: [
    { key: 'Triagem',             label: 'Triagem',              cor: '#94A3B8', classe: 'card-triagem'   },
    { key: 'Orcamento',           label: 'Orçamento',            cor: '#F59E0B', classe: 'card-orcamento' },
    { key: 'Orcamento_Enviado',   label: 'Orçamento Enviado',    cor: '#8B5CF6', classe: 'card-enviado'   },
    { key: 'Aprovado',            label: 'Aprovado',             cor: '#3B82F6', classe: 'card-aprovado'  },
    { key: 'Andamento',           label: 'Em Serviço',           cor: '#F97316', classe: 'card-servico'   },
    { key: 'Pronto',              label: 'Pronto para Retirada', cor: '#22D3A0', classe: 'card-pronto'    },
    { key: 'Entregue',            label: 'Veículos Entregues',   cor: '#10B981', classe: 'card-entregue'  }
  ],

  // MODELOS DE MENSAGEM WHATSAPP (Lógica Evolution B2C)
  WPP_MSGS: {
    orcamento: (nome, veiculo, oficial, total, link, pin) =>
      `Olá ${nome}! 👋\n\nO orçamento do seu *${veiculo}* está pronto na *${oficial}*.\n\n💰 *Total: R$ ${total}*\n\nAcesse seu portal exclusivo para aprovar o serviço:\n🔗 Link: ${link}\n🔑 PIN de Acesso: *${pin}*\n\n_(Em conformidade com a LGPD, seus dados estão protegidos conosco.)_`,

    pronto: (nome, veiculo, oficial) =>
      `🎉 *Boas notícias!* Olá ${nome}, seu *${veiculo}* está pronto para retirada na *${oficial}*. Agradecemos a preferência!`,

    revisao: (nome, veiculo, data) =>
      `🔔 *Lembrete de Segurança:* Olá ${nome}, seu *${veiculo}* possui uma revisão programada para ${data}. Deseja agendar um horário?`
  },

  // PLANOS SaaS
  PLANOS: {
    starter:    { label: 'Starter',    preco: 97,  dias: 30 },
    pro:        { label: 'Pro',        preco: 197, dias: 30 },
    enterprise: { label: 'Enterprise', preco: 397, dias: 30 }
  },

  // NICHOS
  NICHOS: {
    carros:     { label: '🚗 Carros',      tipo: 'carro' },
    motos:      { label: '🏍️ Motos',       tipo: 'moto'  },
    multi:      { label: '🔧 Multi-Marca', tipo: null    }
  },

  CARGOS: {
    mecanico:     '🔧 Mecânico',
    gerente:      '📋 Gerente',
    recepcionista:'📞 Recepcionista'
  },

  FORMAS_PGTO: [
    { value: 'Dinheiro', label: '💵 Dinheiro', pago: true },
    { value: 'PIX', label: '📱 PIX', pago: true },
    { value: 'Cartao', label: '💳 Cartão', pago: true },
    { value: 'Boleto', label: '📄 Boleto', pago: false }
  ],

  UNIDADES: ['UN','PC','L','ML','KG','M','JG','PAR','CX','KT']
};

// ============================================================
// APLICAR BRAND & FAVICON
// ============================================================
window.aplicarBrand = function(brand) {
  const b = { ...window.JARVIS_BRAND, ...brand };
  window.JARVIS_BRAND = b;
  const root = document.documentElement;
  root.style.setProperty('--brand',      b.color);
  root.style.setProperty('--brand-dim',  b.colorDim);
  root.style.setProperty('--brand-glow', b.colorGlow);
  root.style.setProperty('--brand-dark', b.colorDark);

  document.querySelectorAll('.sb-brand-mark').forEach(el => {
    el.textContent = b.logoLetter || b.name.charAt(0).toUpperCase();
  });
  document.querySelectorAll('.brand-name').forEach(el => el.textContent = b.name);
  document.querySelectorAll('.brand-tagline').forEach(el => el.textContent = b.tagline || '');
  document.querySelectorAll('.brand-footer').forEach(el => el.textContent = b.footer);

  // Favicon Dinâmico
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/x-icon'; link.rel = 'shortcut icon';
  link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${encodeURIComponent(b.color)}'/><text x='16' y='22' text-anchor='middle' font-family='sans-serif' font-weight='800' font-size='18' fill='white'>${b.logoLetter || 'J'}</text></svg>`;
  document.head.appendChild(link);

  document.title = b.name + ' — ' + (b.tagline || 'ERP Automotivo');
};

// ============================================================
// FIREBASE INIT
// ============================================================
window.initFirebase = function() {
  if (!firebase.apps.length) firebase.initializeApp(window.JARVIS_FB_CONFIG);
  return firebase.firestore();
};

// Helper de Cores
function _hexDim(hex, alpha) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
