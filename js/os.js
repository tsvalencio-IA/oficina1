/**
 * JARVIS ERP — os.js
 * Motor de Ordens de Serviço, Kanban Chevron 7 Etapas, WhatsApp B2C, Laudos PDF
 *
 * Powered by thIAguinho Soluções Digitais
 */

'use strict';

const OSU = () => window.JarvisOSUtils || window.JOS || {};
const numBR = value => (OSU().parseNumberBR ? OSU().parseNumberBR(value) : (parseFloat(String(value || 0).replace(',', '.')) || 0));
const escOS = value => (OSU().escapeHtml ? OSU().escapeHtml(value) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

async function auditGeralOS(osId, acao, extra = {}) {
  try {
    const idCurto = osId ? String(osId).slice(-6).toUpperCase() : 'NOVA';
    const texto = `OS #${idCurto} — ${acao}`;
    if (typeof window.audit === 'function') {
      await window.audit('OS', texto, { osId: osId || null, origem: 'jarvis_campos_editaveis', ...extra });
    } else if (typeof audit === 'function') {
      await audit('OS', texto);
    }
  } catch(e) {}
}

const KANBAN_STATUSES = ['Triagem', 'Orcamento', 'Orcamento_Enviado', 'Aprovado', 'Andamento', 'Pronto', 'Entregue'];

const STATUS_MAP_LEGACY = { 
    'Aguardando': 'Triagem', 
    'Concluido': 'Entregue', 
    'patio': 'Triagem', 
    'aprovacao': 'Orcamento_Enviado', 
    'box': 'Andamento', 
    'faturado': 'Pronto', 
    'cancelado': 'Cancelado', 
    'orcamento': 'Orcamento', 
    'pronto': 'Pronto', 
    'entregue': 'Entregue',
    'Triagem': 'Triagem',
    'Orcamento': 'Orcamento',
    'Orcamento_Enviado': 'Orcamento_Enviado',
    'Aprovado': 'Aprovado',
    'Andamento': 'Andamento',
    'Pronto': 'Pronto',
    'Entregue': 'Entregue'
};

window.escutarOS = function() {
  db.collection('ordens_servico').where('tenantId', '==', J.tid).onSnapshot(snap => {
    J.os = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if(typeof window.renderKanban === 'function') window.renderKanban(); 
    if(typeof window.renderDashboard === 'function') window.renderDashboard(); 
    if(typeof window.calcComissoes === 'function') window.calcComissoes();
  });
};

window.renderKanban = function() {
  const busca = ($v('searchOS') || '').toLowerCase();
  const filtroNicho = $v('filtroNichoKanban');
  const cols = {}; const cnts = {};
  KANBAN_STATUSES.forEach(s => { cols[s] = []; cnts[s] = 0; });

  J.os.filter(o => (o.status || '').toLowerCase() !== 'cancelado').forEach(o => {
    const stRaw = o.status || 'Triagem';
    const st = STATUS_MAP_LEGACY[stRaw] || 'Triagem'; 
    
    const v = J.veiculos.find(x => x.id === o.veiculoId) || { placa: o.placa, modelo: o.veiculo, tipo: o.tipoVeiculo };
    const c = J.clientes.find(x => x.id === o.clienteId) || { nome: o.cliente };
    
    if (busca && !(v.placa||'').toLowerCase().includes(busca) && !(c.nome||'').toLowerCase().includes(busca) && !(o.placa||'').toLowerCase().includes(busca)) return;
    if (filtroNicho && v.tipo !== filtroNicho) return;
    
    if (cols[st]) { cols[st].push({ os: o, v, c }); cnts[st]++; }
  });

  KANBAN_STATUSES.forEach(s => {
    const cntEl = $('cnt-' + s); if (cntEl) cntEl.innerText = cnts[s];
    const colEl = $('kb-' + s); if (!colEl) return;
    
    colEl.innerHTML = cols[s].sort((a, b) => new Date(b.os.updatedAt || 0) - new Date(a.os.updatedAt || 0)).map(({ os, v, c }) => {
      const tipoCls = v?.tipo || 'carro';
      const tipoLabel = { carro: '🚗 CARRO', moto: '🏍️ MOTO', bicicleta: '🚲 BICICLETA' }[tipoCls] || '🚗 VEÍCULO';
      const cor = { Triagem: 'var(--muted)', Orcamento: 'var(--warn)', Orcamento_Enviado: 'var(--purple)', Aprovado: 'var(--cyan)', Andamento: '#FF8C00', Pronto: 'var(--success)', Entregue: 'var(--green2)' }[s];
      
      const idx = KANBAN_STATUSES.indexOf(s);
      const sPrev = idx > 0 ? KANBAN_STATUSES[idx - 1] : null;
      const sNext = idx < KANBAN_STATUSES.length - 1 ? KANBAN_STATUSES[idx + 1] : null;
      
      const btnPrev = sPrev ? `<button onclick="event.stopPropagation(); window.moverStatusOS('${os.id}', '${sPrev}')" title="Mover para ${sPrev}" style="background:transparent;border:none;color:var(--muted2);cursor:pointer;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 18l-6-6 6-6"/></svg></button>` : '<div></div>';
      const btnNext = sNext ? `<button onclick="event.stopPropagation(); window.moverStatusOS('${os.id}', '${sNext}')" title="Mover para ${sNext}" style="background:transparent;border:none;color:var(--muted2);cursor:pointer;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6"/></svg></button>` : '<div></div>';

      // Sanitização defensiva contra HTML/script em campos de texto livres
      const esc = s => String(s == null ? '' : s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
      const nomeCli = esc(c?.nome || os.cliente || 'Cliente Avulso').trim() || 'Cliente Avulso';
      const placaRaw = (os.placa || v?.placa || 'S/PLACA').toString().trim().toUpperCase();
      const placaFmt = placaRaw === 'S/PLACA' ? 'S/PLACA' : esc(placaRaw);
      const descFmt = esc(os.desc || os.relato || 'Sem descrição inicial...').substring(0, 120);

      // Botão de exclusão definitiva — visível apenas para admin/gestor/superadmin
      const role = (sessionStorage.getItem('j_role') || '').toLowerCase();
      const ehGestor = ['admin','gestor','gerente','superadmin'].includes(role);
      const btnExcluir = ehGestor
        ? `<button title="Excluir definitivamente esta O.S." onclick="event.stopPropagation();window.excluirOSDef('${os.id}')" style="background:transparent;border:1px solid var(--danger);color:var(--danger);font-family:var(--fm);font-size:0.6rem;padding:3px 7px;border-radius:3px;cursor:pointer;">🗑</button>`
        : '';

      return `<div class="k-card" style="border-left-color:${cor}" onclick="window.prepOS('edit','${os.id}');abrirModal('modalOS')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;gap:6px;">
            <div class="k-placa" style="color:${cor};margin:0;font-size:1rem;">${placaFmt}</div>
            ${btnExcluir}
        </div>
        <div class="k-cliente" style="font-size:0.85rem;font-weight:700;color:var(--text);margin-bottom:2px;">${nomeCli}</div>
        <div class="k-desc" style="margin-bottom:8px;">${descFmt}</div>
        <div class="k-footer" style="margin-bottom:8px;">
          <span class="k-tipo ${tipoCls}">${tipoLabel}</span>
          <span style="font-family:var(--fm);font-size:0.85rem;color:var(--success);font-weight:700;">${moeda(os.total)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;">
          ${btnPrev}
          <span class="k-date">${dtBr(os.createdAt || os.data)}</span>
          ${btnNext}
        </div>
      </div>`;
    }).join('');
  });
};

window.moverStatusOS = async function(id, novoStatus) {
    // Captura status antigo ANTES de atualizar (para comparar)
    const osAntes = J.os.find(x => x.id === id);
    const statusAntes = osAntes?.status || '';

    if ((novoStatus === 'Aprovado' || novoStatus === 'Andamento') && osAntes && !OSU().hasApproval?.(osAntes)) {
        try {
            const res = await OSU().aprovarOrcamentoComSelecao?.({
                db,
                osId: id,
                novoStatus: novoStatus === 'Andamento' ? 'Aprovado' : novoStatus,
                clientes: J.clientes,
                actorName: J.nome || 'Gestor',
                actorType: 'jarvis',
                toast: window.toast
            });
            if (res) {
                window.toast(`✓ Orçamento aprovado: ${moeda(res.totalAprovado || 0)}`);
                audit('KANBAN', `Aprovou OS ${id.slice(-6)} com seleção de itens`);
            }
        } catch(e) {
            window.toast('Erro ao aprovar itens: ' + e.message, 'err');
        }
        return;
    }

    await db.collection('ordens_servico').doc(id).update({ status: novoStatus, updatedAt: new Date().toISOString() });
    window.toast(`✓ Movido para ${novoStatus.replace('_', ' ')}`);
    audit('KANBAN', `Moveu OS ${id.slice(-6)} de "${statusAntes}" para "${novoStatus}"`);

    if (novoStatus === 'Orcamento_Enviado') {
        window.enviarWppB2C(id);
    }

    // Pronto avisa o admin/equipe internamente. WhatsApp ao cliente fica sob OK do gestor.
    if (novoStatus === 'Pronto' && statusAntes !== 'Pronto') {
        window.notificarAdminOSPronta?.(id, 'jarvis');
        return;
    }

    // WhatsApp automatico somente para entrega confirmada pelo gestor/caixa.
    if ((novoStatus === 'Entregue') && statusAntes !== 'Entregue') {
        setTimeout(() => {
            if (typeof window.dispararAvisoEntregaAutomatico === 'function') {
                window.dispararAvisoEntregaAutomatico(id, novoStatus);
            }
        }, 300);
    }
};

/**
 * Dispara aviso via WhatsApp quando a O.S. fica Pronta ou Entregue.
 * Abre o WhatsApp Web/App com mensagem pré-preenchida. Cliente confirma envio.
 */
window.dispararAvisoEntregaAutomatico = function(id, novoStatus) {
    const os = J.os.find(x => x.id === id);
    if (!os) return;
    const c = J.clientes.find(x => x.id === os.clienteId);
    if (!c?.wpp) {
        window.toast('Cliente sem WhatsApp cadastrado — aviso automático não enviado.', 'warn');
        return;
    }
    const v = J.veiculos.find(x => x.id === os.veiculoId);
    const placaFmt = os.placa || v?.placa || 'seu veículo';
    const modelo = v?.modelo ? ` ${v.modelo}` : '';
    const fone = String(c.wpp).replace(/\D/g, '');

    let msg = '';
    if (novoStatus === 'Pronto') {
        msg = `Olá ${c.nome}! 👋\n\nAqui é da ${J.tnome}.\n\n✅ Seu veículo ${placaFmt}${modelo} está *PRONTO PARA RETIRADA*!\n\nPassamos a O.S. #${id.slice(-6).toUpperCase()} para conferência do caixa. Pode vir buscar quando for melhor pra você.\n\nAguardamos!`;
    } else if (novoStatus === 'Entregue') {
        msg = `Olá ${c.nome}! 👋\n\nAqui é da ${J.tnome}.\n\n🚘 Confirmamos a *ENTREGA* do seu veículo ${placaFmt}${modelo} referente à O.S. #${id.slice(-6).toUpperCase()}.\n\nMuito obrigado pela confiança! Qualquer dúvida pós-serviço, é só chamar por aqui.\n\nBoa estrada! 🛣️`;
    }
    if (!msg) return;

    // Confirma com o usuário antes de abrir o WhatsApp (evita spam involuntário)
    if (confirm(`Enviar aviso automático para ${c.nome} via WhatsApp?\n\n"${msg.substring(0, 200)}..."`)) {
        const url = `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        audit('WHATSAPP', `Aviso ${novoStatus === 'Pronto' ? 'PRONTO P/ RETIRADA' : 'ENTREGA CONFIRMADA'} enviado para ${c.nome} (OS ${id.slice(-6).toUpperCase()})`);
    }
};

window.notificarAdminOSPronta = async function(id, origem) {
    try {
        const os = (window.J?.os || []).find(x => x.id === id);
        if (!os || !window.db) return;
        const v = (window.J?.veiculos || []).find(x => x.id === os.veiculoId) || {};
        const c = (window.J?.clientes || []).find(x => x.id === os.clienteId) || {};
        const placa = os.placa || v.placa || 'S/PLACA';
        const msg = `OS #${String(id).slice(-6).toUpperCase()} marcada como PRONTO para retirada. Veiculo: ${placa}${v.modelo ? ' - ' + v.modelo : ''}. Cliente: ${c.nome || os.cliente || '-'}. Conferir e enviar WhatsApp ao cliente quando autorizado.`;
        await db.collection('chat_equipe').add({
            tenantId: J.tid,
            de: os.mecId || J.uid || 'sistema',
            para: 'admin',
            sender: 'equipe',
            msg,
            lidaAdmin: false,
            lidaEquipe: true,
            origem: origem || 'status_pronto',
            osId: id,
            ts: Date.now()
        });
        window.toast?.('Admin avisado no chat da equipe.', 'ok');
    } catch(e) {
        console.warn('Aviso interno OS pronta:', e);
    }
};

window.enviarWppB2C = function(id) {
    const os = J.os.find(x => x.id === id);
    if (!os) return;

    // Busca dados REAIS do cliente no Firebase (J.clientes já carregado)
    const cli = J.clientes.find(x => x.id === os.clienteId);
    const veic = J.veiculos.find(x => x.id === os.veiculoId);

    const cel = cli?.wpp || os.celular || '';
    const cliNome = cli?.nome || os.cliente || 'Cliente';
    const veicLabel = veic ? `${veic.modelo} (${veic.placa})` : (os.veiculo || 'Veículo');

    if (!cel) { window.toast('⚠ Cliente sem WhatsApp cadastrado', 'warn'); return; }

    const fone = cel.replace(/\D/g, '');

    // ✅ Login e PIN REAIS do cadastro do cliente no Firebase
    const loginUser = cli?.login || os.placa || cliNome.split(' ')[0].toLowerCase();
    const pin = cli?.pin || os.pin || '';

    // Link correto: governo → clienteOficial, demais → cliente
    const isGov = cli?.tipoCliente === 'governo';
    const link = isGov
      ? 'https://tsvalencio-ia.github.io/ERP-CODEX2/clienteOficial.html'
      : 'https://tsvalencio-ia.github.io/ERP-CODEX2/cliente.html';

    const totalFmt = (os.total || 0).toFixed(2).replace('.', ',');

    const msg =
        `Olá ${cliNome.split(' ')[0]}! 👋\n\n` +
        `O orçamento do seu *${veicLabel}* está pronto na *${J.tnome}*.\n\n` +
        `💰 *Total: R$ ${totalFmt}*\n\n` +
        `Acesse seu portal exclusivo para aprovar o serviço:\n` +
        `🔗 Link: ${link}\n` +
        `👤 Usuário: *${loginUser}*\n` +
        `🔑 PIN: *${pin}*\n\n` +
        `_(Em conformidade com a LGPD, seus dados estão protegidos conosco.)_`;

    window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank');
    window.toast('✓ Redirecionando WhatsApp B2C');
    audit('WHATSAPP', `Enviou Link/PIN para ${os.placa || veicLabel}`);
};

let mediaOSAtual = []; 
let timelineOSAtual = [];

window.prepOS = function(mode, id = null) {
  ['osId', 'osPlaca', 'osVeiculo', 'osCliente', 'osCelular', 'osCpf', 'osDiagnostico', 'osRelato', 'osDescricao', 'chkObs', 'osKm', 'osData'].forEach(f => { if ($(f)) $(f).value = ''; });
  // Checklist tri-state: limpa valor hidden + botões ativos
  ['chkPainel', 'chkPressao', 'chkCarroceria', 'chkDocumentos'].forEach(f => {
    if ($(f)) $(f).value = '';
    if (typeof window._chkTriApply === 'function') window._chkTriApply(f, '');
  });
  
  if ($('osStatus')) $('osStatus').value = 'Triagem';
  if ($('osTipoVeiculo')) $('osTipoVeiculo').value = 'carro';
  if ($('osData')) $('osData').value = new Date().toISOString().split('T')[0];
  if ($('containerItensOS')) $('containerItensOS').innerHTML = '';
  if ($('containerServicosOS')) $('containerServicosOS').innerHTML = '';
  if ($('containerPecasOS')) $('containerPecasOS').innerHTML = '';
  if ($('osTotalVal')) $('osTotalVal').innerText = '0,00';
  if ($('osTotalHidden')) $('osTotalHidden').value = '0';
  if ($('osMediaGrid')) $('osMediaGrid').innerHTML = ''; 
  if ($('osMediaArray')) $('osMediaArray').value = '[]';
  if ($('osTimeline')) $('osTimeline').innerHTML = ''; 
  if ($('osTimelineData')) $('osTimelineData').value = '[]';
  if ($('osIdBadge')) $('osIdBadge').innerText = 'NOVA O.S.';
  if ($('btnGerarPDFOS')) $('btnGerarPDFOS').style.display = 'none'; 
  if ($('btnExcluirOS')) $('btnExcluirOS').style.display = 'none';   // só aparece editando OS existente
  if ($('areaPgtoOS')) $('areaPgtoOS').style.display = 'none'; 
  if ($('btnEnviarWppOS')) $('btnEnviarWppOS').style.display = 'none';
  
  window.osPecas = [];
  window.osFotos = [];

  // Limpa também o preview local do batch upload (correção #4)
  if (typeof window.limparOsMediaPreview === 'function') window.limparOsMediaPreview();

  if (typeof window.popularSelects === 'function') window.popularSelects();

  if (mode === 'add') { 
      if(typeof window.adicionarServicoOS === 'function') window.adicionarServicoOS(); 
  }

  if (mode === 'edit' && id) {
    const o = J.os.find(x => x.id === id);
    if (!o) return;

    if ($('osId')) $('osId').value = o.id;
    if ($('osIdBadge')) $('osIdBadge').innerText = 'OS #' + o.id.slice(-6).toUpperCase();
    if ($('osPlaca')) $('osPlaca').value = o.placa || '';
    if ($('osTipoVeiculo')) $('osTipoVeiculo').value = o.tipoVeiculo || o.tipo || 'carro';
    
    if ($('osCliente')) {
        $('osCliente').value = o.clienteId || '';
        if(typeof window.filtrarVeiculosOS === 'function') window.filtrarVeiculosOS(); 
    }
    setTimeout(() => { if ($('osVeiculo')) $('osVeiculo').value = o.veiculoId || o.veiculo || ''; }, 100);

    if ($('osMec')) $('osMec').value = o.mecId || ''; 
    if ($('osCelular')) $('osCelular').value = o.celular || '';
    if ($('osCpf')) $('osCpf').value = o.cpf || '';
    if ($('osStatus')) $('osStatus').value = STATUS_MAP_LEGACY[o.status] || o.status || 'Triagem';
    if ($('osDiagnostico')) $('osDiagnostico').value = o.diagnostico || '';
    if ($('osRelato')) $('osRelato').value = o.relato || '';
    if ($('osDescricao')) $('osDescricao').value = o.desc || o.relato || '';
    if ($('osData')) $('osData').value = o.data || ''; 
    if ($('osKm')) $('osKm').value = o.km || '';
    if ($('osEntregueA')) {
      $('osEntregueA').value = o.entreguePara || '';
      const r = document.getElementById('rowEntregueA');
      if (r) r.style.display = (o.status === 'Entregue') ? 'flex' : 'none';
    }
    // Desconto personalizado desta OS
    if ($('osDescMO')) $('osDescMO').value = o.descMO != null ? (parseFloat(o.descMO)*100).toFixed(1) : '';
    if ($('osDescPeca')) $('osDescPeca').value = o.descPeca != null ? (parseFloat(o.descPeca)*100).toFixed(1) : '';
    // Mostra blocos governo se cliente for gov
    const _cli_load = (window.J?.clientes||[]).find(cl=>cl.id===o.clienteId);
    const _ehGov_load = _cli_load?.tipoCliente === 'governo';
    const _blocoDesc = document.getElementById('blocoDescontoOS');
    const _blocoReais = document.getElementById('blocoReais');
    if (_blocoDesc) _blocoDesc.style.display = _ehGov_load ? 'block' : 'none';
    if (_blocoReais) {
      // Somente dono (perfil admin) vê peças reais
      const _isDono = ['admin','superadmin'].includes((window.J?.role||'').toLowerCase());
      _blocoReais.style.display = _isDono ? 'block' : 'none';
    }
    // Carregar peças reais
    if ($('containerPecasReais')) {
      $('containerPecasReais').innerHTML = '';
      (o.pecasReais || []).forEach(p => window.adicionarPecaRealRow(p));
    }
    // LOTE C — Traz próxima revisão ao editar
    if ($('osProxRev')) $('osProxRev').value = o.proxRev || '';
    if ($('osProxKm'))  $('osProxKm').value  = o.proxKm  || '';
    // LOTE B — Traz forma de pagamento e parcelas
    if ($('osPgtoForma')) $('osPgtoForma').value = o.pgtoForma || '';
    if ($('osPgtoData'))  $('osPgtoData').value  = o.pgtoData  || '';
    if ($('osPgtoParcelas')) $('osPgtoParcelas').value = o.pgtoParcelas || 1;
    
    window.osPecas = o.pecas || [];
    window.osFotos = o.media || o.fotos || [];
    
    if(typeof window.renderItensOS === 'function') window.renderItensOS();
    
    if (o.servicos && o.servicos.length > 0 && typeof window.renderServicoOSRow === 'function') {
        o.servicos.forEach(s => window.renderServicoOSRow(s));
    } else if (o.maoObra > 0 && typeof window.renderServicoOSRow === 'function') {
        window.renderServicoOSRow({ desc: 'Mão de Obra Geral', valor: o.maoObra });
    }

    if (o.pecas && o.pecas.length > 0 && typeof window.renderPecaOSRow === 'function') {
        o.pecas.forEach(p => window.renderPecaOSRow(p));
    }

    if (typeof window.aplicarMarcadoresAprovacaoOS === 'function') {
      window.aplicarMarcadoresAprovacaoOS(o);
    }

    if ($('chkComb')) $('chkComb').value = o.chkComb || 'N/A'; 
    if ($('chkPneuDia')) $('chkPneuDia').value = o.chkPneuDia || ''; 
    if ($('chkPneuTra')) $('chkPneuTra').value = o.chkPneuTra || ''; 
    if ($('chkObs')) $('chkObs').value = o.chkObs || '';
    
    // LOTE 1.5 — Checklist tri-state: aceita formato antigo (boolean) e novo (string 'ok'/'atencao'/'critico')
    const _toTri = v => (v === true || v === 'ok') ? 'ok' : (v === 'atencao' || v === 'critico') ? v : '';
    if (typeof window._chkTriApply === 'function') {
      window._chkTriApply('chkPainel',     _toTri(o.chkPainel));
      window._chkTriApply('chkPressao',    _toTri(o.chkPressao));
      window._chkTriApply('chkCarroceria', _toTri(o.chkCarroceria));
      window._chkTriApply('chkDocumentos', _toTri(o.chkDocumentos));
    } else {
      // Fallback compatível com versão antiga
      if (o.chkPainel && $('chkPainel')) $('chkPainel').value = _toTri(o.chkPainel);
      if (o.chkPressao && $('chkPressao')) $('chkPressao').value = _toTri(o.chkPressao);
      if (o.chkCarroceria && $('chkCarroceria')) $('chkCarroceria').value = _toTri(o.chkCarroceria);
      if (o.chkDocumentos && $('chkDocumentos')) $('chkDocumentos').value = _toTri(o.chkDocumentos);
    }

    if($('osTimelineData') && o.timeline) {
        $('osTimelineData').value = JSON.stringify(o.timeline);
        window.renderTimelineOS();
    }
    
    if($('osMediaArray')) {
        $('osMediaArray').value = JSON.stringify(window.osFotos);
        window.renderMediaOS();
    }
    
    window.calcOSTotal();
    window.verificarStatusOS();
    
    // Auto-preenche placa na busca histórica com a placa desta OS
    const _elBuscaPlaca = document.getElementById('histBuscaPlaca');
    if (_elBuscaPlaca && o.placa) _elBuscaPlaca.value = (o.placa||'').toUpperCase();
    const _elBuscaRes = document.getElementById('histBuscaResultado');
    if (_elBuscaRes) _elBuscaRes.innerHTML = '';

    if ($('btnGerarPDFOS')) $('btnGerarPDFOS').style.display = 'block';

    // Botão de exclusão só aparece se for admin/gestor (e estiver editando OS existente)
    if ($('btnExcluirOS')) {
      const role = (sessionStorage.getItem('j_role') || '').toLowerCase();
      const ehGestor = ['admin','gestor','gerente','superadmin'].includes(role);
      $('btnExcluirOS').style.display = ehGestor ? 'block' : 'none';
      $('btnExcluirOS').dataset.osId = id;
    }

    // Botão Exportar Orçamento PMSP — aparece SOMENTE se cliente é governamental
    if ($('btnExportarPMSP')) {
      const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
      $('btnExportarPMSP').style.display = ehGov ? 'block' : 'none';
      $('btnExportarPMSP').dataset.osId = id;
    }
  }
};

// Helper para o botão "EXCLUIR O.S." dentro do modal — pega o ID do dataset e chama excluirOSDef
window._excluirOSDoModal = async function() {
  const btn = document.getElementById('btnExcluirOS');
  const id = btn?.dataset?.osId;
  if (!id) return;
  if (typeof window.excluirOSDef === 'function') {
    const ok = await window.excluirOSDef(id);
    if (ok && typeof window.fecharModal === 'function') {
      window.fecharModal('modalOS');
    }
  }
};

window.adicionarItemOS = function(item = null) {
    const div = document.createElement('div');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 60px 80px 80px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
        <input class="j-input os-item-desc" value="${item ? item.desc : ''}" placeholder="Descrição">
        <input type="number" class="j-input os-item-qtd" value="${item ? item.q : 1}" min="1" oninput="window.calcOSTotal()">
        <input type="number" class="j-input os-item-venda" value="${item ? (item.v || item.venda) : 0}" step="0.01" oninput="window.calcOSTotal()">
        <select class="j-select os-item-tipo" onchange="window.calcOSTotal()">
            <option value="peca" ${item && item.t === 'peca' ? 'selected' : ''}>Peça</option>
            <option value="servico" ${item && item.t === 'servico' ? 'selected' : ''}>M.O.</option>
        </select>
        <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    if($('containerItensOS')) $('containerItensOS').appendChild(div);
};

window.renderItensOS = function() {
    if (!$('containerItensOS')) return;
    $('containerItensOS').innerHTML = '';
    window.osPecas.forEach(p => window.adicionarItemOS(p));
    window.calcOSTotal();
};

window._osValorHoraCliente = function() {
  const dadosGov = typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const cliId = document.getElementById('osCliente')?.value;
  const cli = (window.J?.clientes || []).find(c => c.id === cliId) || null;
  return numBR(dadosGov?.valorHora || cli?.govValorHora || cli?.valorHora || window.J?.valorHoraMecanica || 0);
};

window._osVeiculoAtual = function() {
  const id = document.getElementById('osVeiculo')?.value;
  return (window.J?.veiculos || []).find(v => v.id === id) || {};
};

function fmtHoraOS(value) {
  return numBR(value).toFixed(2).replace('.', ',');
}

window._osSecaoHoraOptions = function(selected) {
  const rates = OSU().getPMSPValoresHora?.() || [];
  const opts = ['<option value="">Sem selecao / manual</option>'];
  rates.forEach(rate => {
    opts.push(`<option value="${escOS(rate.key)}" ${rate.key === selected ? 'selected' : ''}>${escOS(rate.label)} - R$ ${fmtHoraOS(rate.valor)}/h</option>`);
  });
  return opts.join('');
};

window.aplicarSecaoMaoObraOS = function(row, key, options) {
  if (!row) return null;
  const opts = options || {};
  const select = row.querySelector('.serv-secao-hora');
  const horaInput = row.querySelector('.serv-valor-hora');
  const rate = key ? OSU().getPMSPValorHora?.(key) : null;

  if (select) select.value = rate ? rate.key : '';
  row.dataset.secaoHora = rate ? rate.key : '';
  row.dataset.secaoHoraLabel = rate ? rate.label : '';
  row.dataset.valorHoraSecao = rate ? String(rate.valor) : '';

  if (horaInput && opts.preserveValorHora !== true) {
    horaInput.value = rate ? fmtHoraOS(rate.valor) : '';
    row.dataset.valorHoraManual = rate ? '0' : '';
  }
  if (opts.recalcular !== false) window.atualizarValorServicoPorHora(row);
  return rate;
};

window.atualizarSecaoMaoObraOS = function(select) {
  const row = select?.closest('div');
  if (!row) return;
  window.aplicarSecaoMaoObraOS(row, select.value, { recalcular: true });
};

window.atualizarValorServicoPorHora = function(row) {
  if (!row) return;
  const tempo = numBR(row.querySelector('.serv-tempo')?.value || 0);
  const horaInput = row.querySelector('.serv-valor-hora');
  const valorHora = horaInput ? numBR(horaInput.value || 0) : window._osValorHoraCliente();
  const valorInput = row.querySelector('.serv-valor');
  if (tempo > 0 && valorHora > 0 && valorInput && row.dataset.valorManual !== '1') {
    valorInput.value = (tempo * valorHora).toFixed(2).replace('.', ',');
  }
  window.calcOSTotal?.();
};

window.adicionarServicoOS = function() {
  const sel = document.createElement('div');
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descMO = dadosGov ? numBR(dadosGov.descMO || 0) : 0;
  if (ehGov) {
    sel.style.cssText = 'display:grid;grid-template-columns:minmax(150px,0.9fr) minmax(210px,1.4fr) 70px 90px 110px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    sel.innerHTML = `
      <select class="j-select serv-secao-hora" onchange="window.atualizarSecaoMaoObraOS(this)" title="Secao oficial da mao de obra PMSP. Use Sem selecao/manual quando nao houver correspondencia segura.">${window._osSecaoHoraOptions('')}</select>
      <input type="text" class="j-input serv-desc" placeholder="Ex: Alinhamento, Troca de Freio..." oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor-hora" value="" placeholder="R$/h" oninput="this.closest('div').dataset.valorHoraManual='1';window.atualizarValorServicoPorHora(this.closest('div'))" title="Valor da hora trabalhada desta seção. Vem da tabela oficial quando selecionada, mas é editável pelo admin." style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--cyan);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="0,00" placeholder="Total serv." oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto total do serviço. Calculado por TMO x valor/hora quando não estiver manual.">
      <div class="serv-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="serv-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descMO*100).toFixed(0)}%</div>
        <div class="serv-desc-val">R$ 0,00</div>
      </div>
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    sel.style.cssText = 'display:grid;grid-template-columns:1fr 70px 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    sel.innerHTML = `
      <input type="text" class="j-input serv-desc" placeholder="Ex: Alinhamento, Troca de Freio..." oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="0,00" placeholder="R$ 0,00" oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto do serviço. Editável pelo admin.">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  }
  if($('containerServicosOS')) $('containerServicosOS').appendChild(sel);
};

window.renderServicoOSRow = function(s) {
  const div = document.createElement('div');
  div.dataset.codigoTabela = s.codigoTabela || s.codigo || '';
  div.dataset.sistemaTabela = s.sistemaTabela || s.sistema || '';
  div.dataset.tempoTabela = s.tempoTabela || s.tempo || '';
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descMO = dadosGov ? numBR(dadosGov.descMO || 0) : 0;
  const vBruto = numBR(s.valor || 0);
  const vFinal = +(vBruto * (1 - descMO)).toFixed(2);
  if (ehGov) {
    const resolvido = OSU().resolvePMSPServico?.(s, { veiculo: window._osVeiculoAtual?.(), fallbackValorHora: window._osValorHoraCliente?.() }) || {};
    const secaoKey = s.secaoHora || resolvido.secaoHora || '';
    const valorHora = numBR(s.valorHora || s.valorHoraSecao || resolvido.valorHora || 0);
    div.dataset.secaoHora = secaoKey;
    div.dataset.secaoHoraLabel = s.secaoHoraLabel || resolvido.secaoHoraLabel || '';
    div.dataset.valorHoraSecao = s.valorHoraTabela || resolvido.valorHoraTabela || '';
    div.dataset.valorHoraManual = s.valorHoraManual ? '1' : '';
    div.style.cssText = 'display:grid;grid-template-columns:minmax(150px,0.9fr) minmax(210px,1.4fr) 70px 90px 110px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
      <select class="j-select serv-secao-hora" onchange="window.atualizarSecaoMaoObraOS(this)" title="Secao oficial da mao de obra PMSP. Use Sem selecao/manual quando nao houver correspondencia segura.">${window._osSecaoHoraOptions(secaoKey)}</select>
      <input type="text" class="j-input serv-desc" value="${escOS(s.desc || '')}" placeholder="Descrição do Serviço" oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" value="${String(s.tempo || '').replace('.', ',')}" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor-hora" value="${valorHora ? valorHora.toFixed(2).replace('.', ',') : ''}" placeholder="R$/h" oninput="this.closest('div').dataset.valorHoraManual='1';window.atualizarValorServicoPorHora(this.closest('div'))" title="Valor da hora trabalhada desta seção. Vem da tabela oficial quando selecionada, mas é editável pelo admin." style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--cyan);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Total serv." oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto total do serviço. Calculado por TMO x valor/hora quando não estiver manual.">
      <div class="serv-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="serv-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descMO*100).toFixed(0)}%</div>
        <div class="serv-desc-val">R$ ${vFinal.toFixed(2).replace('.',',')}</div>
      </div>
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    div.style.cssText = 'display:grid;grid-template-columns:1fr 70px 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
      <input type="text" class="j-input serv-desc" value="${escOS(s.desc || '')}" placeholder="Descrição do Serviço" oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" value="${String(s.tempo || '').replace('.', ',')}" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="R$ 0,00" oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto do serviço. Editável pelo admin.">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  }
  if($('containerServicosOS')) $('containerServicosOS').appendChild(div);
};

window.adicionarPecaOS = function() {
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const sel = document.createElement('div');

  if (ehGov) {
    // Cliente governamental — peça AVULSA com badge de desconto
    const dadosGovP = typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
    const descPecaP = dadosGovP ? numBR(dadosGovP.descPeca || 0) : 0;
    const colsGov = descPecaP > 0
      ? '120px 1fr 60px 100px 80px 32px'
      : '120px 1fr 60px 100px 32px';
    sel.style.cssText = `display:grid;grid-template-columns:${colsGov};gap:8px;align-items:center;background:rgba(167,139,250,0.06);padding:8px;border-radius:3px;border:1px solid rgba(167,139,250,0.2);`;
    sel.dataset.pecaAvulsa = '1';
    const badgePeca = descPecaP > 0 ? `
      <div class="peca-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descPecaP*100).toFixed(0)}%</div>
        <div class="peca-desc-val">R$ 0,00</div>
      </div>` : '';
    sel.innerHTML = `
      <input type="text" class="j-input peca-codigo" placeholder="Código original" title="Código original do fabricante (ex: 5207381)" style="font-family:var(--fm);font-size:0.78rem;">
      <input type="text" class="j-input peca-desc-livre" placeholder="Descrição da peça (ex: AMORTECEDOR DIANT. DIREITO)" oninput="window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Valor unit. registrado" oninput="window.calcOSTotal()" title="Valor unitário da ata de registro de preço">
      ${badgePeca}
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    // Cliente normal — usa estoque, mas permite peça avulsa se não tiver no estoque
    sel.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;';
    const opts = '<option value="">Selecionar peça...</option>'
      + J.estoque.filter(p => (p.qtd || 0) > 0).map(p => `<option value="${p.id}" data-venda="${p.venda || 0}" data-desc="${p.desc || ''}">[${p.qtd}un] ${p.desc} — ${moeda(p.venda)}</option>`).join('')
      + '<option value="__avulsa__" data-venda="0" data-desc="">➕ Peça não cadastrada (digitar manualmente)</option>';
    sel.innerHTML = `
      <select class="j-select peca-sel" onchange="window.selecionarPecaOS(this)">${opts}</select>
      <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="0,00" placeholder="Custo" oninput="window.calcOSTotal()" title="Custo unitário interno da peça">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Venda" oninput="window.calcOSTotal()" title="Valor unitário de venda/orçamento da peça">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  }
  if($('containerPecasOS')) $('containerPecasOS').appendChild(sel); window.calcOSTotal();
};

window.renderPecaOSRow = function(p) {
  const div = document.createElement('div');
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descPeca = dadosGov ? numBR(dadosGov.descPeca || 0) : 0;

  if (ehGov && p.codigo !== undefined) {
    // Peça avulsa (governo) — mostra código + desc + qtd + valor + badge desconto
    const vBruto = numBR(p.venda || p.v || 0);
    const qtd = numBR(p.qtd || p.q || 1) || 1;
    const vFinal = +((qtd * vBruto) * (1 - descPeca)).toFixed(2);
    const colsGov = descPeca > 0 ? '120px 1fr 60px 100px 80px 32px' : '120px 1fr 60px 100px 32px';
    div.style.cssText = `display:grid;grid-template-columns:${colsGov};gap:8px;align-items:center;background:rgba(167,139,250,0.06);padding:8px;border-radius:3px;border:1px solid rgba(167,139,250,0.2);`;
    div.dataset.pecaAvulsa = '1';
    const badgePeca = descPeca > 0 ? `
      <div class="peca-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descPeca*100).toFixed(0)}%</div>
        <div class="peca-desc-val">R$ ${vFinal.toFixed(2).replace('.',',')}</div>
      </div>` : '';
    div.innerHTML = `
      <input type="text" class="j-input peca-codigo" value="${escOS(p.codigo || '')}" placeholder="Código original" style="font-family:var(--fm);font-size:0.78rem;" title="Código original/OEM da peça">
      <input type="text" class="j-input peca-desc-livre" value="${escOS(p.desc || '')}" placeholder="Descrição da peça" oninput="window.calcOSTotal()" title="Descrição da peça no orçamento">
      <input type="number" class="j-input peca-qtd" value="${qtd}" min="1" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Valor unit. registrado" oninput="window.calcOSTotal()" title="Valor unitário da peça no orçamento">
      ${badgePeca}
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    // Cliente normal (estoque)
    const vBruto = numBR(p.venda || p.v || 0);
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;';
    const opts = '<option value="">' + p.desc + '</option>' + (J.estoque||[]).filter(x => (x.qtd || 0) > 0 || x.id === p.estoqueId).map(x => `<option value="${x.id}" data-venda="${x.venda || 0}" data-desc="${x.desc || ''}" ${x.id === p.estoqueId ? 'selected' : ''}>[${x.qtd}un] ${x.desc}</option>`).join('');
    div.innerHTML = `
      <select class="j-select peca-sel" onchange="window.selecionarPecaOS(this)">${opts}</select>
      <input type="number" class="j-input peca-qtd" value="${p.qtd || p.q || 1}" min="1" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="${numBR(p.custo || p.c || 0).toFixed(2).replace('.', ',')}" oninput="window.calcOSTotal()" title="Custo unitário interno da peça">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" oninput="window.calcOSTotal()" title="Valor unitário de venda/orçamento da peça">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  }
  if($('containerPecasOS')) $('containerPecasOS').appendChild(div);
};

window.selecionarPecaOS = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (opt.value === '__avulsa__') {
    // Transforma a linha em entrada manual (igual ao modo governo, mas sem código original)
    const row = sel.parentElement;
    row.dataset.pecaAvulsa = '1';
    row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;background:rgba(255,165,0,0.06);padding:4px;border-radius:3px;border:1px solid rgba(255,165,0,0.25);';
    row.innerHTML = `
      <input type="text" class="j-input peca-desc-livre" placeholder="Descrição da peça" oninput="window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="0,00" placeholder="Custo" oninput="window.calcOSTotal()" title="Custo unitário interno da peça">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Venda" oninput="window.calcOSTotal()" title="Valor unitário de venda/orçamento da peça">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    row.querySelector('.peca-desc-livre').focus();
  } else {
    sel.parentElement.querySelector('.peca-venda').value = numBR(opt.dataset.venda || 0).toFixed(2).replace('.', ',');
  }
  window.calcOSTotal();
};

window.calcOSTotal = function() {
    let total = 0;

    // Desconto: prioriza campo da OS; fallback para padrão do cadastro do cliente
    const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
    const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
    const _osDescMOField = document.getElementById('osDescMO');
    const _osDescPecaField = document.getElementById('osDescPeca');
    const _osDescMOVal = _osDescMOField?.value?.trim();
    const _osDescPecaVal = _osDescPecaField?.value?.trim();
    // Se preenchido na OS, usa ele; senão usa padrão do cliente (já em decimal 0-1)
    const descMO   = _osDescMOVal   !== '' && _osDescMOVal   != null ? numBR(_osDescMOVal)/100   : (dadosGov ? numBR(dadosGov.descMO   || 0) : 0);
    const descPeca = _osDescPecaVal !== '' && _osDescPecaVal != null ? numBR(_osDescPecaVal)/100 : (dadosGov ? numBR(dadosGov.descPeca || 0) : 0);

    document.querySelectorAll('#containerItensOS > div').forEach(div => {
        const q = numBR(div.querySelector('.os-item-qtd')?.value || 0);
        const v = numBR(div.querySelector('.os-item-venda')?.value || 0);
        total += (q * v);
    });

    document.querySelectorAll('#containerServicosOS > div').forEach(row => {
        const vBruto = numBR(row.querySelector('.serv-valor')?.value || 0);
        const vFinal = +(vBruto * (1 - descMO)).toFixed(2);
        // Atualiza badge de desconto em tempo real
        const descBox = row.querySelector('.serv-desc-val');
        if (descBox) descBox.textContent = 'R$ ' + vFinal.toFixed(2).replace('.', ',');
        total += vFinal;
    });

    document.querySelectorAll('#containerPecasOS > div').forEach(row => {
        const qtd   = numBR(row.querySelector('.peca-qtd')?.value   || 0);
        const venda = numBR(row.querySelector('.peca-venda')?.value  || 0);
        const vBruto = qtd * venda;
        const vFinal = +(vBruto * (1 - descPeca)).toFixed(2);
        // Atualiza badge de desconto em tempo real
        const descBox = row.querySelector('.peca-desc-val');
        if (descBox) descBox.textContent = 'R$ ' + vFinal.toFixed(2).replace('.', ',');
        total += vFinal;
    });

    if ($('osTotalVal')) $('osTotalVal').innerText = total.toFixed(2).replace('.', ',');
    if ($('osTotalHidden')) $('osTotalHidden').value = total;
};

window.verificarStatusOS = function() {
  const s = $v('osStatus');
  if($('areaPgtoOS')) $('areaPgtoOS').style.display = (s === 'Pronto' || s === 'Entregue' || s === 'pronto' || s === 'entregue') ? 'block' : 'none';
  if($('btnEnviarWppOS')) $('btnEnviarWppOS').style.display = (s === 'Orcamento_Enviado' || s === 'orcamento' || s === 'aprovacao') && $v('osId') ? 'flex' : 'none';
  if($('btnAvisarProntoOS')) $('btnAvisarProntoOS').style.display = (s === 'Pronto' || s === 'pronto') && $v('osId') ? 'inline-flex' : 'none';
};

window.checkPgtoOS = function() {
  const f = $v('osPgtoForma');
  if($('divParcelasOS')) $('divParcelasOS').style.display = (f === 'Crédito Parcelado' || f === 'Boleto') ? 'block' : 'none';
};

window.salvarOS = async function() {
  const osId = $v('osId');
  if ($('osPlaca') && !$v('osPlaca')) { window.toast('⚠ Preencha a Placa', 'warn'); return; }
  if ($('osCliente') && $('osVeiculo') && !$v('osCliente') && !$v('osVeiculo')) { window.toast('⚠ Selecione cliente e veículo', 'warn'); return; }

  const itens = [];
  document.querySelectorAll('#containerItensOS > div').forEach(div => {
    const desc = div.querySelector('.os-item-desc').value.trim();
    const q = numBR(div.querySelector('.os-item-qtd').value || 0);
    const v = numBR(div.querySelector('.os-item-venda').value || 0);
    const t = div.querySelector('.os-item-tipo').value;
    if (desc && q > 0) itens.push({ desc, q, v, t });
  });

  const servicos = []; 
  let totalMaoObra = 0;
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    const desc = row.querySelector('.serv-desc')?.value || '';
    const valor = numBR(row.querySelector('.serv-valor')?.value || 0);
    const tempoStr = row.querySelector('.serv-tempo')?.value || '';
    const tempo = numBR(tempoStr) || 0;
    const codigoTabela = row.dataset?.codigoTabela || '';
    const sistemaTabela = row.dataset?.sistemaTabela || '';
    const secaoHora = row.querySelector('.serv-secao-hora')?.value || row.dataset?.secaoHora || '';
    const secaoInfo = secaoHora ? OSU().getPMSPValorHora?.(secaoHora) : null;
    let valorHora = numBR(row.querySelector('.serv-valor-hora')?.value || row.dataset?.valorHoraSecao || (tempo > 0 ? valor / tempo : 0));
    if (row.dataset?.valorManual === '1' && row.dataset?.valorHoraManual !== '1' && tempo > 0 && valor > 0) {
      valorHora = +(valor / tempo).toFixed(2);
    }
    const valorHoraTabela = secaoInfo ? numBR(secaoInfo.valor) : numBR(row.dataset?.valorHoraSecao || 0);
    const secaoHoraLabel = secaoInfo?.label || row.dataset?.secaoHoraLabel || '';
    const valorHoraManual = row.dataset?.valorHoraManual === '1' || (valorHoraTabela > 0 && valorHora > 0 && Math.abs(valorHora - valorHoraTabela) > 0.009);
    if (desc || valor > 0) {
      servicos.push({
        desc,
        valor,
        tempo,
        codigoTabela,
        sistemaTabela,
        secaoHora,
        secaoHoraLabel,
        valorHora,
        valorHoraTabela,
        valorHoraManual
      });
      totalMaoObra += valor;
    }
  });

  const pecas = [];
  let totalPecas = 0;
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    // Peça AVULSA (cliente governo)
    if (row.dataset?.pecaAvulsa === '1') {
      const codigo = row.querySelector('.peca-codigo')?.value || '';
      const descLivre = row.querySelector('.peca-desc-livre')?.value || '';
      const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
      const venda = numBR(row.querySelector('.peca-venda')?.value || 0);
      if (descLivre || codigo) {
        totalPecas += (qtd * venda);
        pecas.push({
          avulsa: true,        // marcador
          estoqueId: '',       // não baixa estoque
          codigo: codigo,
          desc: descLivre,
          qtd: qtd,
          custo: 0,
          venda: venda,
          ciliaBruto: numBR(row.dataset?.ciliaBruto || venda),
          ciliaValorLiquido: numBR(row.dataset?.ciliaLiquido || 0),
          ciliaDesconto: numBR(row.dataset?.ciliaDesconto || 0)
        });
      }
      return;
    }
    // Peça normal (estoque)
    const sel = row.querySelector('.peca-sel');
    const opt = sel?.options[sel.selectedIndex];
    const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
    const venda = numBR(row.querySelector('.peca-venda')?.value || 0);
    const custo = numBR(row.querySelector('.peca-custo')?.value || 0);
    totalPecas += (qtd * venda);

    pecas.push({
      estoqueId: sel?.value,
      desc: opt?.dataset.desc || opt?.text || '',
      qtd: qtd, custo: custo, venda: venda
    });
  });

  const totalFormatado = $('osTotalVal') ? $('osTotalVal').innerText : 0;
  const total = numBR(totalFormatado);
  
  const payload = {
    tenantId: J.tid,
    status: $v('osStatus'),
    total: total,
    updatedAt: new Date().toISOString()
  };

  if ($v('osPlaca')) payload.placa = $v('osPlaca').toUpperCase();
  if ($v('osVeiculo')) payload.veiculo = $v('osVeiculo');
  if ($('osVeiculo') && $('osVeiculo').tagName === 'SELECT') payload.veiculoId = $v('osVeiculo');
  if ($v('osCliente')) payload.cliente = $v('osCliente');
  if ($('osCliente') && $('osCliente').tagName === 'SELECT') payload.clienteId = $v('osCliente');
  if ($v('osCelular')) payload.celular = $v('osCelular');
  if ($v('osCpf')) payload.cpf = $v('osCpf');
  if ($v('osDiagnostico')) payload.diagnostico = $v('osDiagnostico');
  if ($v('osRelato')) payload.relato = $v('osRelato');
  if ($v('osDescricao')) payload.desc = $v('osDescricao');
  if ($v('osMec')) payload.mecId = $v('osMec');
  if ($v('osData')) payload.data = $v('osData');
  if ($v('osKm')) payload.km = $v('osKm');
  if ($v('osEntregueA')) payload.entreguePara = $v('osEntregueA');
  // Desconto personalizado desta OS (converte % para decimal)
  const _descMOval = $v('osDescMO');
  const _descPecaval = $v('osDescPeca');
  if (_descMOval !== '' && _descMOval != null) payload.descMO = numBR(_descMOval)/100;
  if (_descPecaval !== '' && _descPecaval != null) payload.descPeca = numBR(_descPecaval)/100;
  // Peças realmente instaladas (somente dono)
  const _pecasReais = [];
  document.querySelectorAll('#containerPecasReais > div').forEach(row => {
    const pr = {
      codigo: row.querySelector('.pr-codigo')?.value?.trim() || '',
      desc: row.querySelector('.pr-desc')?.value?.trim() || '',
      qtd: numBR(row.querySelector('.pr-qtd')?.value || 1) || 1,
      fornecedor: row.querySelector('.pr-fornec')?.value?.trim() || '',
      nf: row.querySelector('.pr-nf')?.value?.trim() || '',
      dataCompra: row.querySelector('.pr-datacompra')?.value?.trim() || '',
      valorCompra: numBR(row.querySelector('.pr-valor')?.value || 0),
      estoqueId: row.querySelector('.pr-estoque')?.value || ''
    };
    if (pr.desc || pr.codigo) _pecasReais.push(pr);
  });
  if (document.getElementById('containerPecasReais')) payload.pecasReais = _pecasReais;
  // LOTE C — Persistir próxima revisão (data e/ou KM) para o cliente ver
  if ($v('osProxRev')) payload.proxRev = $v('osProxRev');
  if ($v('osProxKm'))  payload.proxKm  = $v('osProxKm');
  // Checklist tri-state (cada campo vale '', 'ok', 'atencao' ou 'critico')
  ['chkPainel','chkPressao','chkCarroceria','chkDocumentos'].forEach(f => {
    const v = $v(f);
    if (v) payload[f] = v;
  });
  if ($v('chkObs')) payload.chkObs = $v('chkObs');
  if ($v('chkPneuDia')) payload.chkPneuDia = $v('chkPneuDia');
  if ($v('chkPneuTra')) payload.chkPneuTra = $v('chkPneuTra');
  if ($v('chkComb')) payload.chkComb = $v('chkComb');
  
  if (itens.length > 0) payload.pecasLegacy = itens;
  if (servicos.length > 0) payload.servicos = servicos;
  if (pecas.length > 0) payload.pecas = pecas;
  payload.maoObra = totalMaoObra;

  // Mapeia media para o payload antes do Deep Diff para podermos comparar
  if ($('osMediaArray')) {
      payload.media = JSON.parse($('osMediaArray').value || '[]');
  }

  const oldOSParaAprovacao = osId ? (J.os.find(x => x.id === osId) || {}) : {};
  const statusPedeAprovacao = ['Aprovado', 'Andamento'].includes(payload.status);
  if (statusPedeAprovacao && !OSU().hasApproval?.(oldOSParaAprovacao)) {
      const cliAprov = (J.clientes || []).find(c => c.id === payload.clienteId);
      const aprov = await OSU().openApprovalModal?.({ id: osId || 'nova-os', ...oldOSParaAprovacao, ...payload }, {
          clientes: J.clientes,
          cliente: cliAprov,
          toast: window.toast
      });
      if (!aprov) return;
      payload.status = 'Aprovado';
      payload.aprovacao = {
          status: aprov.status,
          aprovadoEm: new Date().toISOString(),
          aprovadoPor: J.nome || 'Gestor',
          aprovadoPorTipo: 'jarvis',
          totalOrcamento: aprov.totalOrcamento,
          totalAprovado: aprov.totalAprovado,
          itens: aprov.itens
      };
      payload.itensAprovados = aprov.keys;
      payload.totalAprovado = aprov.totalAprovado;
  } else if (oldOSParaAprovacao.totalAprovado != null) {
      payload.totalAprovado = oldOSParaAprovacao.totalAprovado;
      payload.aprovacao = oldOSParaAprovacao.aprovacao;
      payload.itensAprovados = oldOSParaAprovacao.itensAprovados || oldOSParaAprovacao.aprovacao?.itens?.map(i => i.key) || [];
  }

  // --- INÍCIO: DEEP DIFF E GATILHOS (AUDITORIA E WHATSAPP) ---
  const funcUser = J.nome || 'Mecânico/Gestor';
  let tl = [];
  let dispararAvisoEntrega = false;
  const auditoriaGeralOS = [];

  if (osId) {
      const oldOS = J.os.find(x => x.id === osId) || {};
      tl = oldOS.timeline ? [...oldOS.timeline] : JSON.parse($('osTimelineData')?.value || '[]');
      let registouAlgo = false;
      let alterouCampoAuditavel = false;
      const addAuditoriaCampo = acao => {
          auditoriaGeralOS.push(acao);
          alterouCampoAuditavel = true;
      };
      const fmtAudit = v => {
          if (v == null || v === '') return 'vazio';
          if (typeof v === 'number') return String(v).replace('.', ',');
          return String(v);
      };
      const normAudit = v => JSON.stringify(v == null ? '' : v);
      const auditCampoSeMudou = (key, label) => {
          if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
          if (normAudit(oldOS[key]) !== normAudit(payload[key])) {
              addAuditoriaCampo(`${label}: "${fmtAudit(oldOS[key])}" -> "${fmtAudit(payload[key])}"`);
          }
      };

      // 1. Mudança de Status e Gatilhos de Notificação
      if (oldOS.status !== payload.status) {
          const novoStatusLegivel = STATUS_MAP_LEGACY[payload.status] || payload.status;
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Status alterado para: ${novoStatusLegivel}` });
          registouAlgo = true;
          
          // Pronto avisa internamente; WhatsApp automatico fica apenas para Entregue.
          if (payload.status === 'Pronto' && oldOS.status !== 'Pronto') {
              window.notificarAdminOSPronta?.(osId, 'jarvis_salvar');
          }
          if ((payload.status === 'Entregue') && oldOS.status !== 'Entregue') {
              dispararAvisoEntrega = true;
          }
      }

      // 2. Mudança de Diagnóstico (Texto exato)
      const oldDiag = (oldOS.diagnostico || '').trim();
      const novoDiag = (payload.diagnostico || '').trim();
      if (novoDiag && novoDiag !== oldDiag) {
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Diagnóstico Técnico preenchido/atualizado: "${novoDiag}"` });
          registouAlgo = true;
      }

      // 3. Verificação Individual de Checklist (agora tri-state: ok/atencao/critico)
      const mapCheck = { 
          chkPainel: 'Painel/Instrumentos', 
          chkPressao: 'Pressão dos Pneus', 
          chkCarroceria: 'Carroceria/Pintura', 
          chkDocumentos: 'Documentos' 
      };
      const mapEstadoLabel = { ok: '✓ OK', atencao: '⚠ ATENÇÃO', critico: '✕ CRÍTICO', '': 'neutro' };
      ['chkPainel', 'chkPressao', 'chkCarroceria', 'chkDocumentos'].forEach(chk => {
          // Compatibilidade: antigo era boolean (true/false), novo é string ('ok'/'atencao'/'critico')
          const oldValRaw = oldOS[chk];
          const newValRaw = payload[chk];
          const oldVal = (oldValRaw === true || oldValRaw === 'ok') ? 'ok'
                       : (oldValRaw === 'atencao' || oldValRaw === 'critico') ? oldValRaw : '';
          const newVal = newValRaw || '';
          if (oldVal !== newVal) {
              const labelDe = mapEstadoLabel[oldVal] || 'neutro';
              const labelPara = mapEstadoLabel[newVal] || 'neutro';
              addAuditoriaCampo(`Checklist "${mapCheck[chk]}": ${labelDe} -> ${labelPara}`);
          }
      });

      // 3b. Mudança de mecânico responsável
      if (oldOS.mecId !== payload.mecId && payload.mecId) {
          const mecOld = (J.equipe || []).find(m => m.id === oldOS.mecId);
          const mecNovo = (J.equipe || []).find(m => m.id === payload.mecId);
          addAuditoriaCampo(`Mecanico responsavel: ${mecOld?.nome || '-'} -> ${mecNovo?.nome || '-'}`);
      }

      // 3c. Mudança de KM
      if (oldOS.km && payload.km && String(oldOS.km).trim() !== String(payload.km).trim()) {
          addAuditoriaCampo(`KM do veiculo: ${oldOS.km} -> ${payload.km}`);
      }

      // 3d. Mudança de cliente vinculado
      if (oldOS.clienteId && payload.clienteId && oldOS.clienteId !== payload.clienteId) {
          const cOld = (J.clientes || []).find(c => c.id === oldOS.clienteId);
          const cNovo = (J.clientes || []).find(c => c.id === payload.clienteId);
          addAuditoriaCampo(`Cliente vinculado: "${cOld?.nome || '-'}" -> "${cNovo?.nome || '-'}"`);
      }

      [
          ['placa', 'Placa'],
          ['veiculo', 'Veiculo'],
          ['veiculoId', 'Veiculo vinculado'],
          ['celular', 'Celular'],
          ['cpf', 'CPF/Documento'],
          ['relato', 'Relato/queixa'],
          ['desc', 'Descricao geral'],
          ['data', 'Data da OS'],
          ['entreguePara', 'Entregue para'],
          ['descMO', 'Desconto mao de obra'],
          ['descPeca', 'Desconto pecas'],
          ['proxRev', 'Proxima revisao - data'],
          ['proxKm', 'Proxima revisao - KM'],
          ['chkObs', 'Observacoes do checklist'],
          ['chkPneuDia', 'Pneu dianteiro'],
          ['chkPneuTra', 'Pneu traseiro'],
          ['chkComb', 'Nivel combustivel']
      ].forEach(([key, label]) => auditCampoSeMudou(key, label));

      // 4. Identificação de Peças (Adições, Remoções, Alterações de Qtd/Valor)
      const oldPecas = oldOS.pecas || [];
      const newPecas = payload.pecas || [];
      
      newPecas.forEach(newP => {
          const descNovo = (newP.desc || '').toLowerCase().trim();
          const oldP = oldPecas.find(p => (p.desc || '').toLowerCase().trim() === descNovo);
          
          if (!oldP) {
              tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Adicionou peça: ${newP.desc} (Qtd: ${newP.qtd})` });
              registouAlgo = true;
          } else {
              if (numBR(oldP.qtd || 0) !== numBR(newP.qtd || 0) || numBR(oldP.venda || 0) !== numBR(newP.venda || 0)) {
                  addAuditoriaCampo(`Alterou peca "${newP.desc}" para Qtd: ${newP.qtd} / Valor: R$ ${(newP.venda||0).toFixed(2).replace('.', ',')}`);
              }
          }
      });
      
      oldPecas.forEach(oldP => {
           const descOld = (oldP.desc || '').toLowerCase().trim();
           const newP = newPecas.find(p => (p.desc || '').toLowerCase().trim() === descOld);
           if (!newP) {
               tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Removeu peça: ${oldP.desc}` });
               registouAlgo = true;
           }
      });

      // 5. Identificação de Serviços (Adições, Remoções, Alterações de Valor)
      const oldServicos = oldOS.servicos || [];
      const newServicos = payload.servicos || [];
      
      newServicos.forEach(newS => {
          const descNovo = (newS.desc || '').toLowerCase().trim();
          const oldS = oldServicos.find(s => (s.desc || '').toLowerCase().trim() === descNovo);
          
          if (!oldS) {
              tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Adicionou serviço: ${newS.desc}` });
              registouAlgo = true;
          } else {
              if (numBR(oldS.valor || 0) !== numBR(newS.valor || 0)) {
                  addAuditoriaCampo(`Alterou valor do servico "${newS.desc}" para R$ ${(newS.valor||0).toFixed(2).replace('.', ',')}`);
              }
              if (numBR(oldS.tempo || 0) !== numBR(newS.tempo || 0)) {
                  addAuditoriaCampo(`Alterou horas/TMO do servico "${newS.desc}" de ${String(oldS.tempo || 0).replace('.', ',')}h para ${String(newS.tempo || 0).replace('.', ',')}h`);
              }
              if ((oldS.secaoHora || '') !== (newS.secaoHora || '') || (oldS.secaoHoraLabel || '') !== (newS.secaoHoraLabel || '')) {
                  addAuditoriaCampo(`Alterou secao de mao de obra do servico "${newS.desc}" de "${oldS.secaoHoraLabel || oldS.sistemaTabela || '-'}" para "${newS.secaoHoraLabel || newS.sistemaTabela || '-'}"`);
              }
              if (numBR(oldS.valorHora || 0) !== numBR(newS.valorHora || 0)) {
                  addAuditoriaCampo(`Alterou valor/hora do servico "${newS.desc}" de R$ ${numBR(oldS.valorHora || 0).toFixed(2).replace('.', ',')} para R$ ${numBR(newS.valorHora || 0).toFixed(2).replace('.', ',')}`);
              }
          }
      });
      
      oldServicos.forEach(oldS => {
           const descOld = (oldS.desc || '').toLowerCase().trim();
           const newS = newServicos.find(s => (s.desc || '').toLowerCase().trim() === descOld);
           if (!newS) {
               tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Removeu serviço: ${oldS.desc}` });
               registouAlgo = true;
           }
      });

      // 6. Novas Fotos/Evidências
      const oldMediaLength = (oldOS.media || oldOS.fotos || []).length;
      const newMediaLength = (payload.media || []).length;
      if (newMediaLength > oldMediaLength) {
          const adicionadas = newMediaLength - oldMediaLength;
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Anexou ${adicionadas} nova(s) foto(s)/vídeo(s) de evidência.` });
          registouAlgo = true;
      } else if (newMediaLength < oldMediaLength) {
          const removidas = oldMediaLength - newMediaLength;
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Removeu ${removidas} foto(s)/vídeo(s) de evidência.` });
          registouAlgo = true;
      }

      // Fallback operacional: se nada entrou no histórico da OS e também não foi
      // alteração de campo auditável, mantém um registro mínimo de edição.
      if (!registouAlgo && !alterouCampoAuditavel) {
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Atualizou os detalhes gerais da Ordem de Serviço.` });
      }
      
  } else {
      // Criação de Nova O.S.
      tl = JSON.parse($('osTimelineData')?.value || '[]');
      tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Abriu a O.S. (Status inicial: ${STATUS_MAP_LEGACY[payload.status] || payload.status})` });
  }

  if (payload.aprovacao && !oldOSParaAprovacao.aprovacao) {
      tl.push({
          dt: new Date().toISOString(),
          user: funcUser,
          acao: `Orcamento aprovado (${payload.aprovacao.status}) - ${(payload.aprovacao.itens || []).length} item(ns) - Total aprovado ${moeda(payload.aprovacao.totalAprovado || 0)}`
      });
  }

  payload.timeline = tl;
  // --- FIM: DEEP DIFF ---

  if (($v('osStatus') === 'Pronto' || $v('osStatus') === 'Entregue' || $v('osStatus') === 'pronto' || $v('osStatus') === 'entregue') && payload.mecId) {
      const mec = J.equipe.find(f => f.id === payload.mecId);
      if (mec) {
        const percServico = parseFloat(mec.comissaoServico || mec.comissao || 0);
        const percPeca = parseFloat(mec.comissaoPeca || 0);
        
        const valComServico = totalMaoObra * (percServico / 100);
        const valComPeca = totalPecas * (percPeca / 100);
        const valComTotal = valComServico + valComPeca;

        if (valComTotal > 0) {
            db.collection('financeiro').add({
                tenantId: J.tid, tipo: 'Saída', status: 'Pendente',
                desc: `Comissão (Serv: ${moeda(valComServico)} | Peça: ${moeda(valComPeca)}) — O.S. ${payload.placa || ''}`,
                valor: valComTotal, pgto: 'A Combinar', venc: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(), isComissao: true, mecId: payload.mecId, vinculo: `E_${payload.mecId}`
            });
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // LÓGICA FINANCEIRA COERENTE (LOTE A - refatoração completa)
      // ═══════════════════════════════════════════════════════════════════
      // Conceitos importantes:
      //  • formaRecebimento (como cliente pagou): Dinheiro, PIX, Débito,
      //    Crédito (1x / 2x / 3x...), Boleto, Crediário próprio
      //  • Do ponto de vista do CLIENTE, se pagou no cartão, está QUITADO
      //  • Do ponto de vista da OFICINA, se foi cartão de crédito Nx, ela
      //    vai receber N parcelas DA OPERADORA (não do cliente)
      //  • Se foi Boleto/Crediário próprio, aí sim o CLIENTE deve em N parcelas
      //
      // Campos na OS:
      //   payload.pgtoForma    = Dinheiro / PIX / Débito / Crédito / Boleto / Crediário
      //   payload.pgtoParcelas = 1, 2, 3, 4, 6, 10, 12...
      //   payload.pgtoData     = data em que o CLIENTE efetuou o pagamento
      //   payload.pgtoQuitado  = true se cliente pagou por completo (à vista/cartão)
      //                         false se vai parcelar no crediário/boleto
      // ═══════════════════════════════════════════════════════════════════
      const formasAVistaCliente = ['Dinheiro', 'PIX', 'Débito'];     // cliente paga e pronto
      const formasCartaoCredito = ['Crédito à Vista', 'Crédito', 'Crédito Parcelado']; // cliente quita, operadora paga a oficina em parcelas
      const formasCreditoOficina = ['Boleto', 'Crediário', 'Boleto (Pendente)']; // cliente DEVE parcelas à oficina

      payload.pgtoForma    = $v('osPgtoForma');
      payload.pgtoData     = $v('osPgtoData');
      payload.pgtoParcelas = parseInt($v('osPgtoParcelas') || 1);

      if (payload.pgtoForma && payload.pgtoData) {
        const parcelas = payload.pgtoParcelas;
        const valorFinanceiro = numBR(payload.totalAprovado || oldOSParaAprovacao.totalAprovado || payload.total);
        const valorParc = valorFinanceiro / parcelas;
        const placaRef  = payload.placa || J.veiculos.find(v => v.id === payload.veiculoId)?.placa || '';
        const cliRef    = J.clientes.find(c => c.id === payload.clienteId)?.nome || payload.cliente || '';

        const pgtoBase = payload.pgtoForma.trim();

        // Apaga recebimentos anteriores desta OS (evita duplicação ao editar)
        if (osId) {
          try {
            const snap = await db.collection('financeiro').where('osId', '==', osId).get();
            for (const docSnap of snap.docs) {
              await db.collection('financeiro').doc(docSnap.id).delete();
            }
          } catch(e) { console.warn('Limpeza financeiro OS:', e); }
        }

        // Decide o tipo de fluxo financeiro pela forma de pagamento
        if (formasAVistaCliente.some(f => pgtoBase.toLowerCase().includes(f.toLowerCase()))) {
          // ═══ CLIENTE PAGOU À VISTA (Dinheiro/PIX/Débito) ═══
          // 1 recebimento liquidado, quitado na data informada
          payload.pgtoQuitado = true;
          payload.pgtoResumoCliente = `${pgtoBase} à vista`;
          await db.collection('financeiro').add({
            tenantId:  J.tid,
            tipo:      'Entrada',
            status:    'Pago',
            desc:      `O.S. ${placaRef} — ${cliRef}`,
            valor:     valorFinanceiro,
            pgto:      pgtoBase,
            venc:      payload.pgtoData,
            dataPgto:  payload.pgtoData,
            osId:      osId || null,
            clienteId: payload.clienteId || null,
            quitadoPeloCliente: true,
            origem: 'recebimento_os_avista',
            createdAt: new Date().toISOString()
          });

        } else if (formasCartaoCredito.some(f => pgtoBase.toLowerCase().includes(f.toLowerCase()))) {
          // ═══ CLIENTE QUITOU NO CARTÃO DE CRÉDITO (1x, 2x, Nx) ═══
          // Para o cliente: ESTÁ QUITADO. Não deve nada.
          // Para a oficina: vai receber da OPERADORA em N parcelas (D+30, D+60...)
          payload.pgtoQuitado = true;
          payload.pgtoResumoCliente = parcelas > 1
            ? `Cartão de Crédito em ${parcelas}x`
            : `Cartão de Crédito à vista`;

          for (let i = 0; i < parcelas; i++) {
            const dVenc = new Date(payload.pgtoData);
            dVenc.setDate(dVenc.getDate() + 30 * (i + 1));  // D+30, D+60, D+90...
            await db.collection('financeiro').add({
              tenantId:   J.tid,
              tipo:       'Entrada',
              status:     'A Receber',
              desc:       `Recebimento operadora — O.S. ${placaRef} — ${cliRef} ${parcelas > 1 ? `(${i + 1}/${parcelas})` : ''}`,
              valor:      valorParc,
              pgto:       pgtoBase,
              venc:       dVenc.toISOString().split('T')[0],
              osId:       osId || null,
              clienteId:  payload.clienteId || null,
              quitadoPeloCliente: true,  // IMPORTANTE: cliente já quitou
              aReceberDe: 'Operadora de Cartão',
              origem: 'recebimento_os_cartao',
              createdAt: new Date().toISOString()
            });
          }

        } else if (formasCreditoOficina.some(f => pgtoBase.toLowerCase().includes(f.toLowerCase()))) {
          // ═══ BOLETO / CREDIÁRIO PRÓPRIO (cliente DEVE à oficina) ═══
          // Aqui sim criamos N títulos "a receber do cliente"
          payload.pgtoQuitado = false;
          payload.pgtoResumoCliente = parcelas > 1
            ? `${pgtoBase} em ${parcelas}x (pendente)`
            : `${pgtoBase} (pendente)`;

          for (let i = 0; i < parcelas; i++) {
            const dVenc = new Date(payload.pgtoData);
            dVenc.setMonth(dVenc.getMonth() + i);
            await db.collection('financeiro').add({
              tenantId:   J.tid,
              tipo:       'Entrada',
              status:     'Pendente',
              desc:       `O.S. ${placaRef} — ${cliRef} ${parcelas > 1 ? `(${i + 1}/${parcelas})` : ''}`,
              valor:      valorParc,
              pgto:       pgtoBase,
              venc:       dVenc.toISOString().split('T')[0],
              osId:       osId || null,
              clienteId:  payload.clienteId || null,
              quitadoPeloCliente: false,  // cliente ainda deve
              aReceberDe: 'Cliente',
              origem: 'recebimento_os_credito_oficina',
              createdAt: new Date().toISOString()
            });
          }

        } else {
          // ═══ OUTRAS FORMAS / INDEFINIDO ═══
          // Cria um único título pendente para análise manual
          payload.pgtoQuitado = false;
          payload.pgtoResumoCliente = `${pgtoBase} — verificar`;
          await db.collection('financeiro').add({
            tenantId:  J.tid,
            tipo:      'Entrada',
            status:    'Pendente',
            desc:      `O.S. ${placaRef} — ${cliRef}`,
            valor:     valorFinanceiro,
            pgto:      pgtoBase,
            venc:      payload.pgtoData,
            osId:      osId || null,
            clienteId: payload.clienteId || null,
            quitadoPeloCliente: false,
            origem: 'recebimento_os_outros',
            createdAt: new Date().toISOString()
          });
        }

        // Estoque nao baixa pelo orcamento. A baixa acontece somente em pecas reais instaladas.
      }
  }

  let savedOsId = osId;
if (osId) {
    await db.collection('ordens_servico').doc(osId).update(payload);
    window.toast('✓ O.S. ATUALIZADA');
    audit('OS', `Editou OS ${osId.slice(-6)}`);
  } else {
    payload.createdAt = new Date().toISOString();
    payload.pin = Math.floor(1000 + Math.random() * 9000).toString(); 
    const ref = await db.collection('ordens_servico').add(payload);
    savedOsId = ref.id;
    window.toast('✓ O.S. CRIADA');
    audit('OS', `Criou OS para ${payload.placa || payload.cliente || J.clientes.find(c => c.id === payload.clienteId)?.nome}`);
  }

  if (auditoriaGeralOS.length) {
    for (const acao of auditoriaGeralOS) {
      await auditGeralOS(savedOsId, acao);
    }
  }

  if (_pecasReais.length > 0 || (oldOSParaAprovacao.pecasReais || []).length > 0) {
    await window.baixarEstoquePecasReais?.(savedOsId, oldOSParaAprovacao.pecasReais || [], _pecasReais);
  }

  if(typeof window.fecharModal === 'function') window.fecharModal('modalOS');

  // Disparo de WhatsApp somente quando o gestor/caixa confirmar entrega.
  if (dispararAvisoEntrega && payload.clienteId) {
      setTimeout(() => {
          if (confirm('A O.S. foi marcada como ENTREGUE. Deseja avisar o cliente via WhatsApp agora?')) {
              const cli = J.clientes.find(c => c.id === payload.clienteId);
              if (cli && cli.wpp) {
                  const fone = cli.wpp.replace(/\D/g, '');
                  const vLabel = payload.placa || J.veiculos.find(v => v.id === payload.veiculoId)?.placa || 'seu veículo';
                  const msg = `Olá ${cli.nome.split(' ')[0]}! 👋\n\nPassando para avisar que o serviço no *${vLabel}* já foi concluído e está *${STATUS_MAP_LEGACY[payload.status]}* na oficina ${J.tnome}.\n\nAgradecemos a confiança!`;
                  window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank');
              } else {
                  window.toast('⚠ Cliente não possui WhatsApp cadastrado.', 'warn');
              }
          }
      }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// GALERIA DE PROVAS — UPLOAD LEGADO (1 por vez) — MANTIDO COMO FALLBACK
// ═══════════════════════════════════════════════════════════════
window.uploadOsMedia = async function() {
  const f = $('osFileInput')?.files[0]; if (!f) return;
  const btn = $('btnUploadMedia'); btn.innerText = 'ENVIANDO...'; btn.disabled = true;
  try {
    const fd = new FormData(); fd.append('file', f); fd.append('upload_preset', J.cloudPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.secure_url) {
      const media = JSON.parse($('osMediaArray').value || '[]');
      media.push({ url: data.secure_url, type: data.resource_type });
      $('osMediaArray').value = JSON.stringify(media); window.renderMediaOS(); window.toast('✓ UPLOAD CONCLUÍDO');
    }
  } catch (e) { window.toast('✕ ERRO UPLOAD', 'err'); }
  btn.innerText = 'ENVIAR TODAS'; btn.disabled = false;
};

// ═══════════════════════════════════════════════════════════════
// CORREÇÃO #4: GALERIA DE PROVAS — BATCH UPLOAD
// Powered by thIAguinho Soluções Digitais
// ═══════════════════════════════════════════════════════════════

// Estado local do preview (arquivos ainda não enviados).
// Acumulativo: o mecânico pode bater foto, bater outra, abrir novamente
// sem perder as anteriores.
window._osBatchFiles = [];

// Dispara quando o mecânico seleciona 1+ arquivos no input.
// Acumula em _osBatchFiles e renderiza grid de prévia.
window.previewOsMediaBatch = function(input) {
  if (!input || !input.files || !input.files.length) { window.renderOsMediaPreview(); return; }
  const novos = Array.from(input.files);
  window._osBatchFiles = window._osBatchFiles.concat(novos);
  // Libera o input para que o usuário possa selecionar/tirar mais fotos
  try { input.value = ''; } catch(e){}
  window.renderOsMediaPreview();
};

window.renderOsMediaPreview = function() {
  const wrap = $('osMediaPreviewLocal');
  const grid = $('osMediaPreviewGrid');
  const count = $('osMediaPreviewCount');
  if (!wrap || !grid) return;

  if (!window._osBatchFiles || !window._osBatchFiles.length) {
    wrap.style.display = 'none';
    grid.innerHTML = '';
    if (count) count.innerText = '0';
    return;
  }

  wrap.style.display = 'block';
  if (count) count.innerText = window._osBatchFiles.length;

  grid.innerHTML = window._osBatchFiles.map((f, i) => {
    const isVideo = /^video\//.test(f.type || '');
    const url = URL.createObjectURL(f);
    const mediaEl = isVideo
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}" alt="prévia">`;
    return `<div class="media-item" data-idx="${i}">
      ${mediaEl}
      <button class="media-del" type="button" onclick="window.removerOsMediaPreview(${i})" title="Remover">✕</button>
    </div>`;
  }).join('');
};

window.removerOsMediaPreview = function(idx) {
  if (!window._osBatchFiles || idx < 0 || idx >= window._osBatchFiles.length) return;
  window._osBatchFiles.splice(idx, 1);
  window.renderOsMediaPreview();
};

window.limparOsMediaPreview = function() {
  window._osBatchFiles = [];
  try { const f = $('osFileInput'); if (f) f.value = ''; } catch(e){}
  window.renderOsMediaPreview();
  const prog = $('osMediaProgress'); if (prog) { prog.style.display = 'none'; prog.innerText = ''; }
};

// Sobe todos os arquivos do preview em lote, concatena com os já gravados,
// atualiza o hidden array e re-renderiza a galeria. Grava no Firestore
// somente quando o usuário clicar "SALVAR O.S." (via salvarOS).
window.uploadOsMediaBatch = async function() {
  // Se o input ainda tem seleção não absorvida, incorpora agora
  const fInput = $('osFileInput');
  if (fInput && fInput.files && fInput.files.length) {
    window._osBatchFiles = (window._osBatchFiles || []).concat(Array.from(fInput.files));
    try { fInput.value = ''; } catch(e){}
    window.renderOsMediaPreview();
  }

  if (!window._osBatchFiles || !window._osBatchFiles.length) {
    window.toast('⚠ Selecione ao menos um arquivo.', 'warn');
    return;
  }

  const btn = $('btnUploadMedia');
  const prog = $('osMediaProgress');
  if (btn) { btn.disabled = true; btn.innerText = 'ENVIANDO...'; }
  if (prog) { prog.style.display = 'inline'; prog.innerText = '0/' + window._osBatchFiles.length; }

  const total = window._osBatchFiles.length;
  const novasUrls = [];
  let sucesso = 0, falhas = 0;

  for (let i = 0; i < total; i++) {
    const f = window._osBatchFiles[i];
    const fd = new FormData();
    fd.append('file', f);
    fd.append('upload_preset', J.cloudPreset);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data && data.secure_url) {
        novasUrls.push({ url: data.secure_url, type: data.resource_type || 'image' });
        sucesso++;
      } else {
        falhas++;
      }
    } catch (e) {
      falhas++;
    }
    if (prog) prog.innerText = (i + 1) + '/' + total;
  }

  // Concatena com o que já estava gravado no hidden (em caso de edição de O.S.)
  const jaSalvo = JSON.parse($('osMediaArray').value || '[]');
  const final = jaSalvo.concat(novasUrls);
  $('osMediaArray').value = JSON.stringify(final);
  window.renderMediaOS();

  // Limpa o preview local (as prévias já viraram itens reais da galeria)
  window._osBatchFiles = [];
  window.renderOsMediaPreview();

  if (btn) { btn.disabled = false; btn.innerText = 'ENVIAR TODAS'; }
  if (prog) { prog.style.display = 'none'; prog.innerText = ''; }

  if (sucesso && !falhas) window.toast(`✓ ${sucesso} arquivo(s) enviado(s). Salve a O.S. para persistir.`);
  else if (sucesso && falhas) window.toast(`⚠ ${sucesso} ok, ${falhas} falhou. Salve a O.S. para persistir o que deu certo.`, 'warn');
  else window.toast('✕ Nenhum arquivo enviado.', 'err');
};

window.renderMediaOS = function() {
  const media = JSON.parse($('osMediaArray')?.value || '[]');
  if($('osMediaGrid')) {
      $('osMediaGrid').innerHTML = media.map((m, i) => `
        <div class="media-item">
          ${m.type === 'video' ? `<video src="${m.url}" controls></video>` : `<img src="${m.url}" onclick="window.open('${m.url}')" style="cursor:zoom-in">`}
          <button class="media-del" onclick="window.removerMediaOS(${i})">✕</button>
        </div>`).join('');
  }
};

window.removerMediaOS = function(idx) {
  const media = JSON.parse($('osMediaArray').value || '[]');
  media.splice(idx, 1); $('osMediaArray').value = JSON.stringify(media); window.renderMediaOS();
};

window.renderTimelineOS = function() {
  if(!$('osTimeline')) return;
  const tl = JSON.parse($('osTimelineData')?.value || '[]');
  $('osTimeline').innerHTML = [...tl].reverse().map(e => `<div class="tl-item"><div class="tl-date">${dtHrBr(e.dt)}</div><div class="tl-user">${e.user}</div><div class="tl-action">${e.acao}</div></div>`).join('');
};

window.gerarPDFOS = async function() {
  if (typeof window.jspdf === 'undefined') { window.toast('⚠ jsPDF não carregado', 'err'); return; }
  const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth(); let y = 15;
  
  doc.setFillColor(6, 10, 20); doc.rect(0, 0, pw, 35, 'F');
  doc.setTextColor(0, 212, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('J.A.R.V.I.S — LAUDO TÉCNICO', pw / 2, 18, { align: 'center' });
  doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text(J.tnome + ' · ' + new Date().toLocaleDateString('pt-BR'), pw / 2, 27, { align: 'center' });
  y = 45;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('DADOS DO VEÍCULO E CLIENTE', 15, y); doc.line(15, y + 2, pw - 15, y + 2); y += 10;
  
  const v = J.veiculos.find(x => x.id === $v('osVeiculo'));
  const c = J.clientes.find(x => x.id === $v('osCliente'));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Cliente: ${c?.nome || $v('osCliente') || '-'}  |  WhatsApp: ${c?.wpp || $v('osCelular') || '-'}`, 15, y); y += 7;
  doc.text(`Veículo: ${v?.modelo || $v('osVeiculo') || '-'}  |  Placa: ${v?.placa || $v('osPlaca') || '-'}  |  KM: ${$v('osKm') || '-'}`, 15, y); y += 12;
  
  doc.setFont('helvetica', 'bold'); doc.text('DEFEITO RECLAMADO / SERVIÇO', 15, y); doc.line(15, y + 2, pw - 15, y + 2); y += 10;
  doc.setFont('helvetica', 'normal');
  const descText = $v('osDescricao') || $v('osRelato') || '-';
  const descLines = doc.splitTextToSize(descText, pw - 30);
  doc.text(descLines, 15, y); y += descLines.length * 6 + 10;
  
  const relRows = [];
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    const desc = row.querySelector('.serv-desc')?.value || 'Serviço';
    const val = row.querySelector('.serv-valor')?.value || 0;
    if (desc || val > 0) relRows.push([desc, '1 (Srv)', 'R$ ' + parseFloat(val).toFixed(2), 'R$ ' + parseFloat(val).toFixed(2)]);
  });
  
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const sel = row.querySelector('.peca-sel'); const opt = sel?.options[sel?.selectedIndex];
    const qtd = row.querySelector('.peca-qtd')?.value || 0;
    const val = row.querySelector('.peca-venda')?.value || 0;
    relRows.push([opt?.dataset.desc || opt?.text || '-', qtd, 'R$ ' + parseFloat(val).toFixed(2), 'R$ ' + (parseFloat(qtd) * parseFloat(val)).toFixed(2)]);
  });
  
  if (relRows.length) {
    doc.setFont('helvetica', 'bold'); doc.text('ORÇAMENTO DETALHADO', 15, y); doc.line(15, y + 2, pw - 15, y + 2); y += 8;
    doc.autoTable({ startY: y, head: [['Descrição', 'Qtd', 'Valor Unit.', 'Subtotal']], body: relRows, theme: 'grid', headStyles: { fillColor: [6, 10, 20], textColor: [0, 212, 255] }, margin: { left: 15, right: 15 } });
    y = doc.lastAutoTable.finalY + 10;
  }
  
  doc.setFillColor(230, 250, 230); doc.rect(pw - 80, y, 65, 16, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 100, 0);
  doc.text('TOTAL: R$ ' + $v('osTotalHidden'), pw - 15, y + 10, { align: 'right' });
  
  doc.save(`Laudo_${v?.placa || $v('osPlaca') || 'OS'}_${new Date().getTime()}.pdf`);
  window.toast('✓ PDF GERADO');
};

/* Powered by thIAguinho Soluções Digitais */


// ══════════════════════════════════════════════════════════════════════
// IMPORTAR PEÇAS DO SISTEMA CÍLIA (PDF ou XML)
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// PEÇAS REAIS INSTALADAS — linha editável
// ══════════════════════════════════════════════════════════════════════
window.adicionarPecaReal = function() {
  window.adicionarPecaRealRow({});
};

window.adicionarPecaRealRow = function(p) {
  const ct = document.getElementById('containerPecasReais');
  if (!ct) return;
  const hoje = new Date().toISOString().slice(0,10);
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:110px 1fr 50px 130px 110px 130px 105px 105px 32px;gap:6px;align-items:center;background:rgba(255,59,59,0.05);padding:6px;border-radius:3px;border:1px solid rgba(255,59,59,0.2);';
  const estoqueOpts = '<option value="">Nao baixar estoque</option>' + (window.J?.estoque || [])
    .map(e => `<option value="${escOS(e.id)}" data-codigo="${escOS(e.codigo || '')}" data-desc="${escOS(e.desc || '')}" data-custo="${numBR(e.custo || 0)}" ${e.id === p.estoqueId ? 'selected' : ''}>${escOS(e.codigo || '')} ${escOS(e.desc || '')} (${e.qtd || 0})</option>`)
    .join('');
  div.innerHTML = `
    <input type="text" class="j-input pr-codigo" value="${_escVal(p.codigo||'')}" placeholder="Cód. real" style="font-family:var(--fm);font-size:0.75rem;" title="Código OEM/real da peça instalada">
    <input type="text" class="j-input pr-desc" value="${_escVal(p.desc||'')}" placeholder="Descrição real instalada">
    <input type="number" class="j-input pr-qtd" value="${p.qtd||1}" min="1" placeholder="Qtd">
    <select class="j-select pr-estoque" onchange="window.selecionarPecaRealEstoque(this)" title="Selecione uma peça do estoque somente se esta peça real deve baixar estoque">${estoqueOpts}</select>
    <input type="text" class="j-input pr-fornec" value="${_escVal(p.fornecedor||'')}" placeholder="Fornecedor">
    <input type="text" class="j-input pr-nf" value="${_escVal(p.nf||'')}" placeholder="Nº Nota Fiscal">
    <input type="date" class="j-input pr-datacompra" value="${p.dataCompra||hoje}" title="Data da compra">
    <input type="text" inputmode="decimal" class="j-input pr-valor" value="${numBR(p.valorCompra||0).toFixed(2).replace('.', ',')}" placeholder="R$ compra" title="Valor real de compra da peça instalada">
    <button type="button" onclick="this.parentElement.remove()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  ct.appendChild(div);
};

window.selecionarPecaRealEstoque = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  const row = sel.closest('div');
  if (!opt || !row || !sel.value) return;
  const codigo = opt.dataset.codigo || '';
  const desc = opt.dataset.desc || '';
  const custo = numBR(opt.dataset.custo || 0);
  if (codigo && !row.querySelector('.pr-codigo')?.value) row.querySelector('.pr-codigo').value = codigo;
  if (desc && !row.querySelector('.pr-desc')?.value) row.querySelector('.pr-desc').value = desc;
  if (custo && numBR(row.querySelector('.pr-valor')?.value || 0) <= 0) row.querySelector('.pr-valor').value = custo.toFixed(2).replace('.', ',');
};

window.baixarEstoquePecasReais = async function(osId, antigas, novas) {
  const role = (window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  if (!['admin','superadmin','gestor','gerente'].includes(role)) return;
  const antigasPorEstoque = {};
  (antigas || []).forEach(p => {
    if (!p.estoqueId) return;
    antigasPorEstoque[p.estoqueId] = (antigasPorEstoque[p.estoqueId] || 0) + numBR(p.qtd || 0);
  });
  const novasPorEstoque = {};
  (novas || []).forEach(p => {
    if (!p.estoqueId) return;
    novasPorEstoque[p.estoqueId] = (novasPorEstoque[p.estoqueId] || 0) + numBR(p.qtd || 0);
  });
  for (const estoqueId of Object.keys(novasPorEstoque)) {
    const delta = novasPorEstoque[estoqueId] - (antigasPorEstoque[estoqueId] || 0);
    if (delta <= 0) continue;
    const item = (window.J?.estoque || []).find(x => x.id === estoqueId);
    if (!item) continue;
    await db.collection('estoqueItems').doc(estoqueId).update({
      qtd: Math.max(0, numBR(item.qtd || 0) - delta),
      updatedAt: new Date().toISOString()
    });
    await db.collection('lixeira_auditoria').add({
      tenantId: J.tid,
      modulo: 'ESTOQUE',
      acao: `Baixa por peca real instalada OS ${String(osId || '').slice(-6).toUpperCase()}: ${item.desc || estoqueId} (-${delta})`,
      usuario: J.nome || 'Gestor',
      ts: new Date().toISOString()
    }).catch(() => {});
  }
};

window.aplicarMarcadoresAprovacaoOS = function(os) {
  const U = OSU();
  if (!U.hasApproval?.(os)) return;
  const keys = U.getApprovedKeys?.(os) || new Set();
  const badge = key => `<div class="aprovacao-item-badge" style="grid-column:1/-1;font-family:var(--fm);font-size:.62rem;letter-spacing:.8px;color:${keys.has(key) ? 'var(--success)' : 'var(--danger)'};border-top:1px dashed rgba(255,255,255,.12);padding-top:5px;margin-top:2px;">${keys.has(key) ? 'APROVADO NO ORÇAMENTO' : 'NÃO APROVADO - MANTIDO APENAS COMO HISTÓRICO'}</div>`;
  document.querySelectorAll('#containerServicosOS > div').forEach((row, idx) => {
    row.querySelector('.aprovacao-item-badge')?.remove();
    row.insertAdjacentHTML('beforeend', badge('servico-' + idx));
  });
  document.querySelectorAll('#containerPecasOS > div').forEach((row, idx) => {
    row.querySelector('.aprovacao-item-badge')?.remove();
    row.insertAdjacentHTML('beforeend', badge('peca-' + idx));
  });
};

// ══════════════════════════════════════════════════════════════════════
// BUSCA HISTÓRICO POR PLACA + SERVIÇO/PEÇA
// ══════════════════════════════════════════════════════════════════════
window.buscarHistoricoOS = function(opts = {}) {
  const placaId = opts.placaId || 'histBuscaPlaca';
  const termoId = opts.termoId || 'histBuscaTermo';
  const resultadoId = opts.resultadoId || 'histBuscaResultado';
  const placa = OSU().normalizePlate ? OSU().normalizePlate(document.getElementById(placaId)?.value || '') : (document.getElementById(placaId)?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const termoRaw = document.getElementById(termoId)?.value || '';
  const termo = OSU().normalizeText ? OSU().normalizeText(termoRaw) : termoRaw.trim().toLowerCase();
  const el = document.getElementById(resultadoId);
  if (!el) return;
  if (!placa && !termo) { el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">Digite a placa e/ou o serviço/peça.</div>'; return; }

  const hits = (window.J?.os || []).filter(o => {
    const veicOS = (window.J?.veiculos||[]).find(v=>v.id===o.veiculoId)||{};
    const placaOS = OSU().normalizePlate ? OSU().normalizePlate(o.placa || veicOS.placa || '') : String(o.placa || veicOS.placa || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const matchPlaca = !placa || placaOS === placa || placaOS.includes(placa);
    if (!matchPlaca) return false;
    if (!termo) return true;
    const textoOS = [
      ...(o.servicos||[]).map(s=>[s.desc,s.codigoTabela,s.sistemaTabela,s.tempo].join(' ')),
      ...(o.pecas||[]).map(p=>[p.desc,p.codigo,p.qtd,p.venda].join(' ')),
      ...(o.pecasReais||[]).map(p=>[p.desc,p.codigo,p.nf,p.fornecedor].join(' ')),
      o.diagnostico || '',
      o.relato || '',
      o.desc || ''
    ].join(' ');
    return (OSU().normalizeText ? OSU().normalizeText(textoOS) : textoOS.toLowerCase()).includes(termo);
  });

  if (!hits.length) {
    el.innerHTML = `<div style="color:var(--muted);font-family:var(--fm);font-size:0.8rem;padding:10px 0;">Nenhuma OS encontrada${placa?' para placa '+escOS(placa):''}${termoRaw?' com "'+escOS(termoRaw)+'"':''}.</div>`;
    return;
  }

  const html = hits.map(o => {
    const cli = (window.J?.clientes||[]).find(c=>c.id===o.clienteId)||{};
    const veic = (window.J?.veiculos||[]).find(v=>v.id===o.veiculoId)||{};
    const matchText = value => !termo || (OSU().normalizeText ? OSU().normalizeText(value) : String(value||'').toLowerCase()).includes(termo);
    const servMatches = (o.servicos||[]).filter(s=>matchText([s.desc,s.codigoTabela,s.sistemaTabela,s.tempo].join(' ')));
    const pecMatches  = (o.pecas||[]).filter(p=>matchText([p.desc,p.codigo,p.qtd,p.venda].join(' ')));
    const reaisMtch   = (o.pecasReais||[]).filter(p=>matchText([p.desc,p.codigo,p.nf,p.fornecedor].join(' ')));
    return `<div style="background:var(--surf3);border:1px solid var(--border);border-radius:3px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        <div>
          <span style="font-family:var(--fm);font-size:0.7rem;color:var(--cyan);font-weight:700;">OS #${(o.id||'').slice(-6).toUpperCase()}</span>
          <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-left:10px;">${escOS(o.data||'')}</span>
          <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-left:10px;">${escOS(veic.placa || o.placa || '')}</span>
          <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-left:10px;">${escOS(cli.nome||o.cliente||'')}</span>
        </div>
        <span style="font-family:var(--fm);font-size:0.7rem;color:var(--success);font-weight:700;">${moeda(o.totalAprovado || o.total || 0)}</span>
      </div>
      ${servMatches.length?`<div style="font-size:0.75rem;margin-bottom:4px;"><strong style="color:var(--cyan);">Serviços:</strong> ${servMatches.map(s=>`${escOS(s.codigoTabela||'')} ${escOS(s.desc||'')} (${String(s.tempo||0).replace('.',',')}h - ${moeda(s.valor||0)})`).join(' | ')}</div>`:''}
      ${pecMatches.length?`<div style="font-size:0.75rem;margin-bottom:4px;"><strong style="color:var(--success);">Peças orç.:</strong> ${pecMatches.map(p=>`${escOS(p.codigo||'')} ${escOS(p.desc||'')} x${p.qtd||1} - ${moeda(numBR(p.venda||0)*(numBR(p.qtd||1)||1))}`).join(' | ')}</div>`:''}
      ${reaisMtch.length?`<div style="font-size:0.75rem;margin-bottom:4px;"><strong style="color:var(--danger);">Peças reais:</strong> ${reaisMtch.map(p=>`${escOS(p.codigo||'')} ${escOS(p.desc||'')} x${p.qtd||1} - NF:${escOS(p.nf||'-')} ${escOS(p.fornecedor||'')}`).join(' | ')}</div>`:''}
    </div>`;
  }).join('');

  el.innerHTML = `<div style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-bottom:6px;">${hits.length} OS encontrada(s)</div>${html}`;
};

window.importarCilia = async function(input) {
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  input.value = '';

  if (ext === 'xml') {
    _ciliaProcessarXML(file);
  } else if (ext === 'pdf') {
    _ciliaProcessarPDF(file);
  } else {
    if (typeof window.toast === 'function') window.toast('Formato inválido. Use XML ou PDF do Cília.', 'err');
  }
};

function _ciliaAdicionarPecas(pecas) {
  pecas = OSU().normalizeCiliaPieces ? OSU().normalizeCiliaPieces(pecas) : pecas;
  if (!pecas || !pecas.length) {
    if (typeof window.toast === 'function') window.toast('Nenhuma peça encontrada no arquivo Cília.', 'warn');
    return;
  }
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descPeca = dadosGov ? numBR(dadosGov.descPeca || 0) : 0;

  pecas.forEach(p => {
    const div = document.createElement('div');
    const vBruto = numBR(p.venda || p.valor || 0);
    const qtd = numBR(p.qtd || 1) || 1;
    const vFinal = +(qtd * vBruto * (1 - descPeca)).toFixed(2);
    const colsGov = (ehGov && descPeca > 0) ? '120px 1fr 60px 100px 80px 32px' : '120px 1fr 60px 100px 32px';
    const badgePeca = (ehGov && descPeca > 0) ? `
      <div class="peca-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descPeca*100).toFixed(0)}%</div>
        <div class="peca-desc-val">R$ ${vFinal.toFixed(2).replace('.',',')}</div>
      </div>` : '';

    div.style.cssText = `display:grid;grid-template-columns:${colsGov};gap:8px;align-items:center;background:rgba(0,212,255,0.06);padding:8px;border-radius:3px;border:1px solid rgba(0,212,255,0.25);`;
    div.dataset.pecaAvulsa = '1';
    div.dataset.cilia = '1';
    div.dataset.ciliaBruto = String(vBruto);
    div.dataset.ciliaLiquido = String(numBR(p.ciliaValorLiquido || 0));
    div.dataset.ciliaDesconto = String(numBR(p.ciliaDesconto || 0));
    div.innerHTML = `
      <input type="text" class="j-input peca-codigo" value="${_escVal(p.codigo)}" placeholder="Código OEM" style="font-family:var(--fm);font-size:0.78rem;" title="Código OEM (editável)">
      <input type="text" class="j-input peca-desc-livre" value="${_escVal(p.desc)}" placeholder="Descrição da peça" oninput="window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="${qtd}" min="1" oninput="window.calcOSTotal()" title="Quantidade importada do Cília">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Valor unit." oninput="this.dataset.editadoManual='1';window.calcOSTotal()" title="Valor unitário bruto importado do Cília (editável)">
      ${badgePeca}
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    if (typeof $ === 'function' && $('containerPecasOS')) {
      $('containerPecasOS').appendChild(div);
    }
  });

  if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
  if (typeof window.toast === 'function') window.toast(`✓ ${pecas.length} peça(s) importada(s) do Cília`, 'ok');
}

function _escVal(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── XML: estrutura esperada do Cília ──────────────────────────────────
// <Pecas><Peca><Codigo>XX</Codigo><Descricao>YY</Descricao><Quantidade>1</Quantidade><PrecoUnitario>100.00</PrecoUnitario></Peca></Pecas>
// Também tenta variações comuns de tag
function _ciliaProcessarXML(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(e.target.result, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

      const segmentos = Array.from(xml.querySelectorAll('segment')).map(n => n.textContent?.trim() || '').filter(Boolean);
      if (segmentos.length) {
        const pecasSegmentadas = OSU().parseCiliaPiecesFromTokens ? OSU().parseCiliaPiecesFromTokens(segmentos) : [];
        if (!pecasSegmentadas.length) throw new Error('Nenhuma peça encontrada nos segmentos do Cília.');
        _ciliaAdicionarPecas(pecasSegmentadas);
        return;
      }

      // Tenta vários nomes de tag de item
      const tagsCandidatas = ['Peca','peca','PECA','Item','item','ITEM','Produto','produto'];
      let nos = [];
      for (const tag of tagsCandidatas) {
        nos = Array.from(xml.querySelectorAll(tag));
        if (nos.length) break;
      }
      if (!nos.length) throw new Error('Nenhuma tag de peça reconhecida no XML. Verifique o arquivo Cília.');

      const pecas = nos.map(n => {
        const t = tag => n.querySelector(tag)?.textContent?.trim() || '';
        return {
          codigo: t('Codigo') || t('codigo') || t('CODIGO') || t('CodigoOEM') || t('codigoOem') || t('CodPeca') || '',
          desc:   t('Descricao') || t('descricao') || t('DESCRICAO') || t('Descr') || t('Nome') || t('nome') || '',
          qtd:    numBR(t('Quantidade') || t('quantidade') || t('Qtd') || t('qtd') || '1') || 1,
          venda:  numBR(t('PrecoUnitario') || t('precoUnitario') || t('Preco') || t('preco') || t('ValorUnitario') || '0') || 0
        };
      }).filter(p => p.desc || p.codigo);

      _ciliaAdicionarPecas(pecas);
    } catch(err) {
      if (typeof window.toast === 'function') window.toast('Erro ao ler XML Cília: ' + err.message, 'err');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ── PDF: extrai texto e tenta parsear tabela de peças ────────────────
// Requer pdf.js (CDN) — carrega dinamicamente se não estiver presente
async function _ciliaProcessarPDF(file) {
  if (typeof window.toast === 'function') window.toast('Lendo PDF do Cília...', 'warn');
  try {
    // Carrega pdf.js dinamicamente
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Coleta TODOS os spans com coordenadas X,Y de todas as páginas
    const allSpans = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      tc.items.forEach(item => {
        if (item.str.trim()) {
          allSpans.push({
            text: item.str.trim(),
            page: i,
            x: Math.round(item.transform[4]),
            y: Math.round(item.transform[5])
          });
        }
      });
    }

    // Agrupa por linha (Y ±4px), ordena por X dentro de cada linha
    const linhasMap = {};
    allSpans.forEach(sp => {
      const yKey = Math.round(sp.y / 4) * 4;
      if (!linhasMap[yKey]) linhasMap[yKey] = [];
      linhasMap[yKey].push(sp);
    });
    // PDF: Y cresce de baixo pra cima — invertemos para ter ordem natural
    const linhas = Object.keys(linhasMap)
      .map(Number)
      .sort((a, b) => b - a)
      .map(y => linhasMap[y].sort((a, b) => a.x - b.x).map(s => s.text).join(' '));

    const tokensOrdenados = linhas.join(' ').split(/\s+/).filter(Boolean);
    const utils = OSU();
    const sane = lista => !utils.isSaneCiliaPieces || utils.isSaneCiliaPieces(lista || []);
    let pecas = utils.parseCiliaPiecesFromSpans ? utils.parseCiliaPiecesFromSpans(allSpans) : [];
    if (!pecas.length || !sane(pecas)) {
      pecas = utils.parseCiliaPiecesFromLines ? utils.parseCiliaPiecesFromLines(linhas) : [];
    }
    if (!pecas.length || !sane(pecas)) {
      const porTokens = utils.parseCiliaPiecesFromTokens ? utils.parseCiliaPiecesFromTokens(tokensOrdenados) : [];
      pecas = sane(porTokens) ? porTokens : [];
    }
    const brl = s => numBR(s);

    for (const linha of (pecas.length ? [] : linhas)) {
      // ── PADRÃO PRINCIPAL CÍLIA ──────────────────────────────────────────────
      // "T R&I 0,00 1.00 BOMBA DE COMBUSTÍVEL Cód: 172029382R Oficina R$ 1.795,30 % 48,00 R$ 933,56"
      // Captura: operação | TMO | qtd | DESCRIÇÃO Cód: CODIGO Fornec | preçoBruto | %desc | preçoLíquido
      const mPrincipal = linha.match(
        /(?:[TR](?:\s+R&I)?)\s+[\d,]+\s+([\d,]+)\s+(.+?)\s+C.?d[:\.]\s*([A-Z0-9\-\.\/]+)\s+\w+\s+R\$\s*([\d\.,]+)\s+%\s*[\d,]+\s+R\$\s*([\d\.,]+)/i
      );
      if (mPrincipal) {
        pecas.push({
          codigo: mPrincipal[3].trim(),
          desc:   mPrincipal[2].trim(),
          qtd:    numBR(mPrincipal[1]) || 1,
          venda:  brl(mPrincipal[4]), // preço bruto fiel ao PDF; desconto do cliente calcula o líquido
          ciliaValorLiquido: brl(mPrincipal[5])
        });
        continue;
      }

      // ── PADRÃO SEM OPERAÇÃO: "DESCRICAO Cód: CODIGO Qtd R$ PRECO_LIQ" ──────
      const mSemOp = linha.match(/(.+?)\s+C.?d[:\.]\s*([A-Z0-9\-\.\/]+)\s+[\w\/]+\s+R\$\s*([\d\.,]+)\s+%\s*[\d,]+\s+R\$\s*([\d\.,]+)/i);
      if (mSemOp) {
        pecas.push({
          codigo: mSemOp[2].trim(),
          desc:   mSemOp[1].trim(),
          qtd:    1,
          venda:  brl(mSemOp[3]),
          ciliaValorLiquido: brl(mSemOp[4])
        });
        continue;
      }

      // ── PADRÃO LEGADO (espaços largos): "CODIGO   DESCRICAO   QTD   VALOR" ─
      const mLeg = linha.match(/^([A-Z0-9\-\.\/]{4,25})\s{2,}(.+?)\s{2,}(\d+(?:[,.]\d+)?)\s{2,}([\d\.,]+)\s*$/);
      if (mLeg) {
        pecas.push({
          codigo: mLeg[1].trim(),
          desc:   mLeg[2].trim(),
          qtd:    numBR(mLeg[3]) || 1,
          venda:  brl(mLeg[4])
        });
      }
    }

    if (!pecas.length || !sane(pecas)) {
      if (typeof window.toast === 'function') window.toast('Não foi possível extrair as peças do PDF Cília com segurança. Tente exportar o Cília em XML para melhor resultado.', 'warn');
      return;
    }
    _ciliaAdicionarPecas(pecas);
  } catch(err) {
    if (typeof window.toast === 'function') window.toast('Erro ao ler PDF Cília: ' + err.message, 'err');
    console.error('[Cília PDF]', err);
  }
}
