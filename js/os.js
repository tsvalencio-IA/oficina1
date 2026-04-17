/**
 * JARVIS ERP — os.js
 * Motor de Ordens de Serviço, Kanban Chevron 7 Etapas, WhatsApp B2C, Laudos PDF
 */

'use strict';

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

      return `<div class="k-card" style="border-left-color:${cor}" onclick="window.prepOS('edit','${os.id}');abrirModal('modalOS')">
        <div class="k-placa" style="color:${cor}">${os.placa || v?.placa || 'S/PLACA'}</div>
        <div class="k-cliente">${os.cliente || c?.nome || 'Cliente não encontrado'}</div>
        <div class="k-desc">${os.desc || os.relato || 'Sem descrição'}</div>
        <div class="k-footer">
          <span class="k-tipo ${tipoCls}">${tipoLabel}</span>
          <span style="font-family:var(--fm);font-size:0.75rem;color:var(--success);font-weight:700;">${moeda(os.total)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;border-top:1px solid rgba(255,255,255,0.05);padding-top:4px;">
          ${btnPrev}
          <span class="k-date">${dtBr(os.createdAt || os.data)}</span>
          ${btnNext}
        </div>
      </div>`;
    }).join('');
  });
};

window.moverStatusOS = async function(id, novoStatus) {
    await db.collection('ordens_servico').doc(id).update({ status: novoStatus, updatedAt: new Date().toISOString() });
    window.toast(`✓ Movido para ${novoStatus.replace('_', ' ')}`);
    audit('KANBAN', `Moveu OS ${id.slice(-6)} para ${novoStatus}`);
    
    if (novoStatus === 'Orcamento_Enviado') {
        window.enviarWppB2C(id);
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

    // ✅ Link correto para GitHub Pages
    const link = 'https://tsvalencio-ia.github.io/of/cliente.html';

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
  ['chkPainel', 'chkPressao', 'chkCarroceria', 'chkDocumentos'].forEach(f => { if ($(f)) $(f).checked = false; });
  
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
  if ($('areaPgtoOS')) $('areaPgtoOS').style.display = 'none'; 
  if ($('btnEnviarWppOS')) $('btnEnviarWppOS').style.display = 'none';
  
  window.osPecas = [];
  window.osFotos = [];

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

    if ($('chkComb')) $('chkComb').value = o.chkComb || 'N/A'; 
    if ($('chkPneuDia')) $('chkPneuDia').value = o.chkPneuDia || ''; 
    if ($('chkPneuTra')) $('chkPneuTra').value = o.chkPneuTra || ''; 
    if ($('chkObs')) $('chkObs').value = o.chkObs || '';
    
    if (o.chkPainel && $('chkPainel')) $('chkPainel').checked = true; 
    if (o.chkPressao && $('chkPressao')) $('chkPressao').checked = true;
    if (o.chkCarroceria && $('chkCarroceria')) $('chkCarroceria').checked = true; 
    if (o.chkDocumentos && $('chkDocumentos')) $('chkDocumentos').checked = true;

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
    
    if ($('btnGerarPDFOS')) $('btnGerarPDFOS').style.display = 'block';
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

window.adicionarServicoOS = function() {
  const sel = document.createElement('div');
  sel.style.cssText = 'display:grid;grid-template-columns:1fr 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
  sel.innerHTML = `
    <input type="text" class="j-input serv-desc" placeholder="Ex: Alinhamento, Troca de Freio..." oninput="window.calcOSTotal()">
    <input type="number" class="j-input serv-valor" value="0" step="0.01" placeholder="R$ 0,00" oninput="window.calcOSTotal()">
    <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  if($('containerServicosOS')) $('containerServicosOS').appendChild(sel);
};

window.renderServicoOSRow = function(s) {
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML = `
    <input type="text" class="j-input serv-desc" value="${s.desc || ''}" placeholder="Descrição do Serviço" oninput="window.calcOSTotal()">
    <input type="number" class="j-input serv-valor" value="${s.valor || 0}" step="0.01" placeholder="R$ 0,00" oninput="window.calcOSTotal()">
    <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  if($('containerServicosOS')) $('containerServicosOS').appendChild(div);
};

window.adicionarPecaOS = function() {
  const sel = document.createElement('div');
  sel.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;';
  const opts = '<option value="">Selecionar peça...</option>' + J.estoque.filter(p => (p.qtd || 0) > 0).map(p => `<option value="${p.id}" data-venda="${p.venda || 0}" data-desc="${p.desc || ''}">[${p.qtd}un] ${p.desc} — ${moeda(p.venda)}</option>`).join('');
  sel.innerHTML = `
    <select class="j-select peca-sel" onchange="window.selecionarPecaOS(this)">${opts}</select>
    <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()">
    <input type="number" class="j-input peca-custo" value="0" step="0.01" placeholder="Custo" oninput="window.calcOSTotal()">
    <input type="number" class="j-input peca-venda" value="0" step="0.01" placeholder="Venda" oninput="window.calcOSTotal()">
    <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  if($('containerPecasOS')) $('containerPecasOS').appendChild(sel); window.calcOSTotal();
};

window.renderPecaOSRow = function(p) {
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;';
  const opts = '<option value="">' + p.desc + '</option>' + J.estoque.filter(x => (x.qtd || 0) > 0 || x.id === p.estoqueId).map(x => `<option value="${x.id}" data-venda="${x.venda || 0}" data-desc="${x.desc || ''}" ${x.id === p.estoqueId ? 'selected' : ''}>[${x.qtd}un] ${x.desc}</option>`).join('');
  div.innerHTML = `
    <select class="j-select peca-sel" onchange="window.selecionarPecaOS(this)">${opts}</select>
    <input type="number" class="j-input peca-qtd" value="${p.qtd || p.q || 1}" min="1" oninput="window.calcOSTotal()">
    <input type="number" class="j-input peca-custo" value="${p.custo || p.c || 0}" step="0.01" oninput="window.calcOSTotal()">
    <input type="number" class="j-input peca-venda" value="${p.venda || p.v || 0}" step="0.01" oninput="window.calcOSTotal()">
    <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  if($('containerPecasOS')) $('containerPecasOS').appendChild(div);
};

window.selecionarPecaOS = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  sel.parentElement.querySelector('.peca-venda').value = opt.dataset.venda || 0;
  window.calcOSTotal();
};

window.calcOSTotal = function() {
    let total = 0;
    
    document.querySelectorAll('#containerItensOS > div').forEach(div => {
        const q = parseFloat(div.querySelector('.os-item-qtd')?.value || 0);
        const v = parseFloat(div.querySelector('.os-item-venda')?.value || 0);
        total += (q * v);
    });

    document.querySelectorAll('#containerServicosOS > div').forEach(row => {
        total += parseFloat(row.querySelector('.serv-valor')?.value || 0);
    });
  
    document.querySelectorAll('#containerPecasOS > div').forEach(row => {
        const qtd = parseFloat(row.querySelector('.peca-qtd')?.value || 0);
        const venda = parseFloat(row.querySelector('.peca-venda')?.value || 0);
        total += qtd * venda;
    });

    if ($('osTotalVal')) $('osTotalVal').innerText = total.toFixed(2).replace('.', ',');
    if ($('osTotalHidden')) $('osTotalHidden').value = total;
};

window.verificarStatusOS = function() {
  const s = $v('osStatus');
  if($('areaPgtoOS')) $('areaPgtoOS').style.display = (s === 'Pronto' || s === 'Entregue' || s === 'pronto' || s === 'entregue') ? 'block' : 'none';
  if($('btnEnviarWppOS')) $('btnEnviarWppOS').style.display = (s === 'Orcamento_Enviado' || s === 'orcamento' || s === 'aprovacao') && $v('osId') ? 'flex' : 'none';
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
    const q = parseFloat(div.querySelector('.os-item-qtd').value || 0);
    const v = parseFloat(div.querySelector('.os-item-venda').value || 0);
    const t = div.querySelector('.os-item-tipo').value;
    if (desc && q > 0) itens.push({ desc, q, v, t });
  });

  const servicos = []; 
  let totalMaoObra = 0;
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    const desc = row.querySelector('.serv-desc')?.value || '';
    const valor = parseFloat(row.querySelector('.serv-valor')?.value || 0);
    if (desc || valor > 0) { servicos.push({ desc, valor }); totalMaoObra += valor; }
  });

  const pecas = [];
  let totalPecas = 0;
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const sel = row.querySelector('.peca-sel'); 
    const opt = sel?.options[sel.selectedIndex];
    const qtd = parseFloat(row.querySelector('.peca-qtd')?.value || 1);
    const venda = parseFloat(row.querySelector('.peca-venda')?.value || 0);
    const custo = parseFloat(row.querySelector('.peca-custo')?.value || 0);
    totalPecas += (qtd * venda);
    
    pecas.push({
      estoqueId: sel?.value, 
      desc: opt?.dataset.desc || opt?.text || '',
      qtd: qtd, custo: custo, venda: venda
    });
  });

  const totalFormatado = $('osTotalVal') ? $('osTotalVal').innerText.replace(',', '.') : 0;
  const total = parseFloat(totalFormatado);
  
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
  
  if (itens.length > 0) payload.pecasLegacy = itens;
  if (servicos.length > 0) payload.servicos = servicos;
  if (pecas.length > 0) payload.pecas = pecas;
  payload.maoObra = totalMaoObra;

  const tl = JSON.parse($('osTimelineData')?.value || '[]');
  tl.push({ dt: new Date().toISOString(), user: J.nome, acao: `${osId ? 'Editou' : 'Abriu'} O.S. — Status: ${$v('osStatus')}` });
  payload.timeline = tl;
  
  if ($('osMediaArray')) {
      payload.media = JSON.parse($('osMediaArray').value || '[]');
  }

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
      
      const formasPagas = ['Dinheiro', 'PIX', 'Débito', 'Crédito à Vista'];
      payload.pgtoForma = $v('osPgtoForma'); 
      payload.pgtoData = $v('osPgtoData');
      
      if(payload.pgtoForma && payload.pgtoData) {
        const statusFin = formasPagas.includes(payload.pgtoForma) ? 'Pago' : 'Pendente';
        const parcelas = parseInt($v('osPgtoParcelas') || 1);
        const valorParc = payload.total / parcelas;
        
        for (let i = 0; i < parcelas; i++) {
          const d = new Date(payload.pgtoData || new Date()); 
          d.setMonth(d.getMonth() + i);
          db.collection('financeiro').add({
            tenantId: J.tid, tipo: 'Entrada', status: statusFin,
            desc: `O.S. ${payload.placa || J.veiculos.find(v => v.id === payload.veiculoId)?.placa || ''} — ${J.clientes.find(c => c.id === payload.clienteId)?.nome || payload.cliente || ''} ${parcelas > 1 ? `(${i + 1}/${parcelas})` : ''}`,
            valor: valorParc, pgto: payload.pgtoForma, venc: d.toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
        }
        
        for (const p of pecas) {
          if (p.estoqueId) {
            const item = J.estoque.find(x => x.id === p.estoqueId);
            if (item) db.collection('estoqueItems').doc(p.estoqueId).update({ qtd: Math.max(0, (item.qtd || 0) - p.qtd) });
          }
        }
      }
  }

  if (osId) {
    await db.collection('ordens_servico').doc(osId).update(payload);
    window.toast('✓ O.S. ATUALIZADA');
    audit('OS', `Editou OS ${osId.slice(-6)}`);
  } else {
    payload.createdAt = new Date().toISOString();
    payload.pin = Math.floor(1000 + Math.random() * 9000).toString(); 
    const ref = await db.collection('ordens_servico').add(payload);
    window.toast('✓ O.S. CRIADA');
    audit('OS', `Criou OS para ${payload.placa || payload.cliente || J.clientes.find(c => c.id === payload.clienteId)?.nome}`);
  }

  if(typeof window.fecharModal === 'function') window.fecharModal('modalOS');
};

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
  btn.innerText = 'UPLOAD'; btn.disabled = false;
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
