/**
 * JARVIS ERP — os.js
 * Motor de Ordens de Serviço: Kanban 7 etapas, regras de negócio completas,
 * baixa automática de estoque, financeiro, comissões, WhatsApp B2C
 */
'use strict';

const OS_STATUSES = ['Triagem','Orcamento','Orcamento_Enviado','Aprovado','Andamento','Pronto','Entregue'];

// Mapa de compatibilidade com dados legados
const STATUS_LEGADO = {
  'Aguardando':'Triagem','patio':'Triagem','box':'Andamento',
  'aprovacao':'Orcamento_Enviado','faturado':'Pronto','cancelado':'Cancelado',
  'concluido':'Entregue','Concluido':'Entregue',
  'Triagem':'Triagem','Orcamento':'Orcamento','Orcamento_Enviado':'Orcamento_Enviado',
  'Aprovado':'Aprovado','Andamento':'Andamento','Pronto':'Pronto','Entregue':'Entregue','Cancelado':'Cancelado'
};

// ── KANBAN ─────────────────────────────────────────────────
window.renderKanban = function() {
  const busca       = (_v('searchOS') || '').toLowerCase();
  const filtroNicho = _v('filtroNichoKanban');

  const cols = {}, cnts = {};
  OS_STATUSES.forEach(s => { cols[s] = []; cnts[s] = 0; });

  J.os.filter(o => {
    const st = STATUS_LEGADO[o.status] || o.status;
    return st !== 'Cancelado';
  }).forEach(o => {
    const st  = STATUS_LEGADO[o.status] || o.status || 'Triagem';
    const v   = J.veiculos.find(x => x.id === o.veiculoId) || { placa: o.placa, modelo: o.veiculo, tipo: o.tipoVeiculo };
    const c   = J.clientes.find(x => x.id === o.clienteId) || { nome: o.cliente };
    if (busca && !(v?.placa||'').toLowerCase().includes(busca) &&
        !(c?.nome||'').toLowerCase().includes(busca) &&
        !(o.placa||'').toLowerCase().includes(busca)) return;
    if (filtroNicho && (v?.tipo||'') !== filtroNicho) return;
    if (cols[st]) { cols[st].push({ os: o, v, c }); cnts[st]++; }
  });

  OS_STATUSES.forEach(s => {
    const cntEl = document.getElementById('cnt-' + s); if (cntEl) cntEl.innerText = cnts[s];
    const colEl = document.getElementById('kb-' + s);  if (!colEl) return;

    colEl.innerHTML = cols[s]
      .sort((a,b) => new Date(b.os.updatedAt||0) - new Date(a.os.updatedAt||0))
      .map(({os,v,c}) => _buildCard(os, v, c, s))
      .join('');
  });

  window.atualizarPainelAtencao && atualizarPainelAtencao();
};

function _buildCard(os, v, c, status) {
  const cor = {
    Triagem:'#94A3B8', Orcamento:'#F59E0B', Orcamento_Enviado:'#8B5CF6',
    Aprovado:'#3B82F6', Andamento:'#FF8C00', Pronto:'#22D3A0', Entregue:'#10B981'
  }[status] || '#94A3B8';

  const idx  = OS_STATUSES.indexOf(status);
  const prev = idx > 0 ? OS_STATUSES[idx-1] : null;
  const next = idx < OS_STATUSES.length-1 ? OS_STATUSES[idx+1] : null;

  const btnPrev = prev ? `<button onclick="event.stopPropagation();window.moverStatusOS('${os.id}','${prev}')" title="← ${prev}" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:4px;font-size:1.1rem;line-height:1;transition:color .15s" onmouseenter="this.style.color='white'" onmouseleave="this.style.color='var(--text-muted)'">‹</button>` : '<div style="width:26px"></div>';
  const btnNext = next ? `<button onclick="event.stopPropagation();window.moverStatusOS('${os.id}','${next}')" title="→ ${next}" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:4px;font-size:1.1rem;line-height:1;transition:color .15s" onmouseenter="this.style.color='white'" onmouseleave="this.style.color='var(--text-muted)'">›</button>` : '<div style="width:26px"></div>';

  const tipoLabel = { carro:'🚗 CARRO', moto:'🏍️ MOTO', bicicleta:'🚲 BICI' }[v?.tipo||'carro'] || '🚗 VEÍ';
  const tipoCls   = v?.tipo || 'carro';

  const prioColor = { vermelho:'var(--danger)', amarelo:'var(--warn)', verde:'var(--success)' }[os.prioridade||'verde'] || 'var(--success)';

  return `<div class="k-card" draggable="true" ondragstart="window.dragOS(event, '${os.id}')" style="border-left-color:${cor}" onclick="window.prepOS('edit','${os.id}');abrirModal('modalOS')">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <div class="k-placa" style="color:${cor}">
        <span class="prio-indicador" style="background:${prioColor};box-shadow:0 0 4px ${prioColor};"></span>
        ${os.placa||v?.placa||'S/PLACA'}
      </div>
    </div>
    <div class="k-cliente">${c?.nome||os.cliente||'—'}</div>
    <div class="k-desc">${os.desc||os.relato||'Sem descrição'}</div>
    <div class="k-footer">
      <span class="k-tipo ${tipoCls}">${tipoLabel}</span>
      <span style="font-family:var(--fm);font-size:0.72rem;color:var(--success);font-weight:700">${window.moeda ? moeda(os.total||0) : 'R$ 0,00'}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;border-top:1px solid rgba(255,255,255,0.05);padding-top:4px;">
      ${btnPrev}
      <span class="k-date">${dtBr(os.createdAt||os.data)}</span>
      ${btnNext}
    </div>
  </div>`;
}

// ── LÓGICA DE DRAG & DROP NATIVO ───────────────────────────
window.allowDrop = function(ev) {
  ev.preventDefault();
};

window.dragOS = function(ev, id) {
  ev.dataTransfer.setData("text/plain", id);
};

window.drop = function(ev) {
  ev.preventDefault();
  const osId = ev.dataTransfer.getData("text/plain");
  const col = ev.target.closest('.k-col');
  if (col && osId) {
    const novoStatus = col.getAttribute('data-s');
    if (novoStatus) {
      window.moverStatusOS(osId, novoStatus);
    }
  }
};

// ── MOVER STATUS ───────────────────────────────────────────
window.moverStatusOS = async function(id, novoStatus) {
  const os = J.os.find(x => x.id === id);
  if (!os) return;

  // Validações de negócio
  const st = STATUS_LEGADO[os.status] || os.status || 'Triagem';
  const idxAtual = OS_STATUSES.indexOf(st);
  const idxNovo  = OS_STATUSES.indexOf(novoStatus);

  if (novoStatus === 'Orcamento' && !os.desc && !os.relato) {
    toastWarn('⚠ Preencha o defeito/serviço antes de mover para Orçamento.');
    return;
  }
  if (novoStatus === 'Aprovado' && os.status !== 'Orcamento_Enviado') {
    // Permite aprovação direta pela equipe
  }
  if (novoStatus === 'Andamento' && !['Aprovado','Orcamento_Enviado'].includes(STATUS_LEGADO[os.status]||os.status)) {
    toastWarn('⚠ A O.S. precisa estar Aprovada antes de ir para Em Serviço.');
    return;
  }
  if (novoStatus === 'Pronto') {
    const temItens = (os.servicos||[]).length > 0 || (os.pecas||[]).length > 0 || os.maoObra > 0 || os.total > 0;
    if (!temItens) {
      toastWarn('⚠ Adicione serviços ou peças antes de finalizar.');
      return;
    }
  }

  const tl = [...(os.timeline||[])];
  tl.push({ dt: new Date().toISOString(), user: J.nome, acao: `Status: ${st} → ${novoStatus}`, tipo: 'status', antes: st, depois: novoStatus });

  await J.db.collection('ordens_servico').doc(id).update({
    status: novoStatus,
    timeline: tl,
    updatedAt: new Date().toISOString()
  });

  audit('KANBAN', `OS ${(os.placa||id.slice(-6)).toUpperCase()} → ${novoStatus}`);
  notificarEquipe(`O.S. ${os.placa||id.slice(-6)} movida para ${novoStatus.replace('_',' ')} por ${J.nome}`);
  toastOk(`✓ Movido para ${novoStatus.replace('_',' ')}`);

  if (novoStatus === 'Orcamento_Enviado') {
    setTimeout(() => window.enviarWppB2C && enviarWppB2C(id), 300);
  }
};

// ── WHATSAPP B2C ───────────────────────────────────────────
window.enviarWppB2C = function(id) {
  const os = J.os.find(x => x.id === id); if (!os) return;
  const c  = J.clientes.find(x => x.id === os.clienteId);
  const v  = J.veiculos.find(x => x.id === os.veiculoId);
  const cel = os.celular || c?.wpp || '';
  if (!cel) { toastWarn('⚠ Cliente sem WhatsApp'); return; }
  
  const pin = c?.pin || os.pin || '';
  const loginCliente = c?.login || (c?.nome ? c.nome.split(' ')[0].toUpperCase() : 'CLIENTE');
  const cliNome = c?.nome ? c.nome.split(' ')[0] : 'Cliente';
  const veicNome = v?.modelo || 'veículo';
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
  const link = baseUrl + '/cliente.html';
  
  const msg = `Olá ${cliNome}! ⚙️\n\nO orçamento do seu ${veicNome} está pronto na ${J.tnome}.\n\n💰 Total: R$ ${(os.total||0).toFixed(2).replace('.',',')}\n\nAcesse seu portal exclusivo para aprovar o serviço:\n🔗 Link: ${link}\n\n(Em conformidade com a LGPD, seus dados estão protegidos conosco.)\n👤 Usuário: ${loginCliente}\n🔑 PIN: ${pin}`;
  
  window.open(`https://wa.me/55${cel.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  audit('WHATSAPP', `Enviou orçamento B2C para ${os.placa||veicNome}`);
};
// ── PREPARAR MODAL OS ──────────────────────────────────────
window.prepOS = function(mode, id=null) {
  const reset = ['osId','osPlaca','osDiagnostico','osRelato','osDescricao','chkObs','osKm','osData','osCelular','osCpf'];
  reset.forEach(f => { const el=document.getElementById(f); if(el) el.value=''; });
  ['chkPainel','chkPressao','chkCarroceria','chkDocumentos'].forEach(f=>{const el=document.getElementById(f);if(el)el.checked=false;});
  _sv('osStatus','Triagem'); _sv('osTipoVeiculo','carro');
  _sv('osData', new Date().toISOString().split('T')[0]);
  _sh('containerServicosOS',''); _sh('containerPecasOS','');
  _sv('osTotalHidden','0'); _st('osTotalVal','0,00');
  _sh('osMediaGrid',''); _sv('osMediaArray','[]');
  _sh('osTimeline',''); _sv('osTimelineData','[]');
  _st('osIdBadge','NOVA O.S.');
  if(document.getElementById('btnGerarPDFOS')) document.getElementById('btnGerarPDFOS').style.display='none';
  if(document.getElementById('areaPgtoOS'))   document.getElementById('areaPgtoOS').style.display='none';
  if(document.getElementById('btnEnviarWppOS')) document.getElementById('btnEnviarWppOS').style.display='none';

  popularSelects && popularSelects();
  if (mode==='add') { adicionarServicoOS && adicionarServicoOS(); return; }

  if (mode==='edit' && id) {
    const o = J.os.find(x => x.id === id); if (!o) return;
    _sv('osId', o.id);
    _st('osIdBadge', 'OS #' + o.id.slice(-6).toUpperCase());
    _sv('osPlaca',     o.placa || '');
    _sv('osTipoVeiculo', o.tipoVeiculo || o.tipo || 'carro');
    _sv('osCelular',   o.celular || '');
    _sv('osCpf',       o.cpf    || '');
    _sv('osDiagnostico',o.diagnostico||'');
    _sv('osRelato',    o.relato || '');
    _sv('osDescricao', o.desc   || o.relato || '');
    _sv('osData',      o.data   || '');
    _sv('osKm',        o.km     || '');
    _sv('osMec',       o.mecId  || '');
    _sv('osStatus', STATUS_LEGADO[o.status] || o.status || 'Triagem');

    _sv('osCliente', o.clienteId||'');
    filtrarVeiculosOS && filtrarVeiculosOS();
    setTimeout(()=>{ _sv('osVeiculo', o.veiculoId||''); }, 80);

    // Serviços
    if (o.servicos?.length) o.servicos.forEach(s => adicionarServicoOS && adicionarServicoOS(s));
    else if ((o.maoObra||0) > 0) adicionarServicoOS && adicionarServicoOS({desc:'Mão de Obra', valor:o.maoObra});

    // Peças
    if (o.pecas?.length) o.pecas.forEach(p => adicionarPecaOS && adicionarPecaOS(p));

    // Checklist
    _sv('chkComb', o.chkComb||'N/A'); _sv('chkPneuDia', o.chkPneuDia||'');
    _sv('chkPneuTra', o.chkPneuTra||''); _sv('chkObs', o.chkObs||'');
    _ck('chkPainel', o.chkPainel); _ck('chkPressao', o.chkPressao);
    _ck('chkCarroceria', o.chkCarroceria); _ck('chkDocumentos', o.chkDocumentos);

    // Timeline
    if (o.timeline) {
      _sv('osTimelineData', JSON.stringify(o.timeline));
      renderTimelineOS();
    }

    // Mídia
    const media = o.media || o.fotos || [];
    _sv('osMediaArray', JSON.stringify(media));
    renderMediaOS && renderMediaOS();

    calcOSTotal && calcOSTotal();
    verificarStatusOS && verificarStatusOS();

    if (document.getElementById('btnGerarPDFOS')) document.getElementById('btnGerarPDFOS').style.display='block';
  }
};

// ── SERVIÇOS (Mão de Obra) ─────────────────────────────────
window.adicionarServicoOS = function(s=null) {
  const div = document.createElement('div');
  div.className = 'grid-servicos';
  div.innerHTML = `
    <input type="text" class="j-input serv-desc" value="${s?.desc||''}" placeholder="Serviço / descrição" oninput="calcOSTotal()">
    <input type="number" class="j-input serv-valor" value="${s?.valor||0}" step="0.01" placeholder="R$ 0,00" oninput="calcOSTotal()">
    <button type="button" onclick="this.parentElement.remove();calcOSTotal()" style="background:var(--danger-dim);border:1px solid rgba(255,59,59,.3);color:var(--danger);cursor:pointer;width:36px;height:36px;font-size:1rem;line-height:1;">✕</button>`;
  document.getElementById('containerServicosOS')?.appendChild(div);
  calcOSTotal && calcOSTotal();
};

// ── PEÇAS ──────────────────────────────────────────────────
window.adicionarPecaOS = function(p=null) {
  const div = document.createElement('div');
  div.className = 'grid-pecas';
  const opts = '<option value="">Selecionar peça...</option>' +
    J.estoque.filter(x => (x.qtd||0) > 0 || (p && p.estoqueId === x.id))
    .map(x => `<option value="${x.id}" data-v="${x.venda||0}" data-c="${x.custo||0}" data-d="${x.desc||''}" ${p?.estoqueId===x.id?'selected':''}>[${x.qtd}] ${x.desc} — ${moeda(x.venda)}</option>`).join('');
  div.innerHTML = `
    <select class="j-select peca-sel" onchange="selecionarPecaOS(this)">${opts}</select>
    <input type="number" class="j-input peca-qtd" value="${p?.qtd||p?.q||1}" min="1" oninput="calcOSTotal()">
    <input type="number" class="j-input peca-custo" value="${p?.custo||p?.c||0}" step="0.01" placeholder="Custo" oninput="calcOSTotal()">
    <input type="number" class="j-input peca-venda" value="${p?.venda||p?.v||0}" step="0.01" placeholder="Venda" oninput="calcOSTotal()">
    <button type="button" onclick="this.parentElement.remove();calcOSTotal()" style="background:var(--danger-dim);border:1px solid rgba(255,59,59,.3);color:var(--danger);cursor:pointer;width:36px;height:36px;font-size:1rem;line-height:1;">✕</button>`;
  document.getElementById('containerPecasOS')?.appendChild(div);
  calcOSTotal && calcOSTotal();
};

window.selecionarPecaOS = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  const row = sel.parentElement;
  const vendaEl = row.querySelector('.peca-venda');
  const custoEl = row.querySelector('.peca-custo');
  if (vendaEl && opt.dataset.v) vendaEl.value = opt.dataset.v;
  if (custoEl && opt.dataset.c) custoEl.value = opt.dataset.c;
  calcOSTotal && calcOSTotal();
};

// ── CÁLCULO TOTAL ──────────────────────────────────────────
window.calcOSTotal = function() {
  let total = 0;
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    total += parseFloat(row.querySelector('.serv-valor')?.value||0);
  });
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const q = parseFloat(row.querySelector('.peca-qtd')?.value||0);
    const v = parseFloat(row.querySelector('.peca-venda')?.value||0);
    total += q * v;
  });
  _st('osTotalVal', total.toFixed(2).replace('.',','));
  _sv('osTotalHidden', total.toString());
};

// ── VERIFICAR STATUS ───────────────────────────────────────
window.verificarStatusOS = function() {
  const s = _v('osStatus');
  const showPgto   = ['Pronto','Entregue'].includes(s);
  const showWpp    = ['Orcamento_Enviado'].includes(s) && !!_v('osId');
  if (document.getElementById('areaPgtoOS'))     document.getElementById('areaPgtoOS').style.display     = showPgto ? 'block' : 'none';
  if (document.getElementById('btnEnviarWppOS')) document.getElementById('btnEnviarWppOS').style.display = showWpp  ? 'flex'  : 'none';
};

window.checkPgtoOS = function() {
  const f = _v('osPgtoForma');
  const showParcelas = ['Crédito Parcelado','Boleto'].includes(f);
  if (document.getElementById('divParcelasOS')) document.getElementById('divParcelasOS').style.display = showParcelas ? 'block' : 'none';
};

// ── SALVAR OS ──────────────────────────────────────────────
window.salvarOS = async function() {
  const osId = _v('osId');

  // Validações obrigatórias
  const placa = _v('osPlaca');
  const cliId = _v('osCliente');
  const veicId= _v('osVeiculo');
  const desc  = _v('osDescricao') || _v('osRelato');
  const status= _v('osStatus');

  if (!placa && !cliId) { toastWarn('⚠ Informe a placa ou selecione o cliente'); return; }

  // Regra: Orçamento precisa de diagnóstico ou desc
  if (status === 'Orcamento' && !desc && !_v('osDiagnostico')) {
    toastWarn('⚠ Preencha o defeito reclamado antes de gerar orçamento'); return;
  }
  // Regra: Execução exige aprovação
  if (status === 'Andamento') {
    const osAtual = J.os.find(x => x.id === osId);
    const stAtual = osAtual ? (STATUS_LEGADO[osAtual.status]||osAtual.status) : 'Triagem';
    if (!['Aprovado','Andamento','Orcamento_Enviado'].includes(stAtual) && !osId) {
      toastWarn('⚠ A O.S. precisa ser aprovada antes de ir para execução'); return;
    }
  }

  // Coletar serviços
  const servicos = []; let totalMO = 0;
  document.querySelectorAll('#containerServicosOS > div').forEach(row => {
    const desc2 = row.querySelector('.serv-desc')?.value||'';
    const val   = parseFloat(row.querySelector('.serv-valor')?.value||0);
    if (desc2||val>0) { servicos.push({desc:desc2,valor:val}); totalMO+=val; }
  });

  // Coletar peças (com validação de estoque negativo)
  const pecas = []; let totalPecas = 0;
  let estoqueInsuficiente = false;
  document.querySelectorAll('#containerPecasOS > div').forEach(row => {
    const sel   = row.querySelector('.peca-sel');
    const opt   = sel?.options[sel.selectedIndex];
    const qtd   = parseFloat(row.querySelector('.peca-qtd')?.value||1);
    const venda = parseFloat(row.querySelector('.peca-venda')?.value||0);
    const custo = parseFloat(row.querySelector('.peca-custo')?.value||0);
    const estoqueId = sel?.value;

    // Validação estoque negativo apenas na conclusão
    if (estoqueId && ['Pronto','Entregue'].includes(status) && !osId) {
      const item = J.estoque.find(x => x.id === estoqueId);
      if (item && (item.qtd||0) < qtd) {
        toastWarn(`⚠ Estoque insuficiente: ${item.desc} (${item.qtd||0} disponível)`);
        estoqueInsuficiente = true;
      }
    }

    totalPecas += qtd * venda;
    pecas.push({
      estoqueId, desc: opt?.dataset.d || opt?.text || '',
      qtd, custo, venda
    });
  });
  if (estoqueInsuficiente) return;

  // Validação: concluir sem itens
  if (['Pronto','Entregue'].includes(status) && servicos.length === 0 && pecas.length === 0 && totalMO === 0) {
    toastWarn('⚠ Adicione serviços ou peças antes de finalizar a O.S.'); return;
  }

  const total = parseFloat(_v('osTotalHidden')||0);

  // Montar timeline
  const tl = JSON.parse(document.getElementById('osTimelineData')?.value||'[]');
  const stAtualTL = osId ? (STATUS_LEGADO[J.os.find(x=>x.id===osId)?.status]||status) : 'Nova';
  const acaoTL    = osId ? `Editou O.S. | Status: ${stAtualTL} → ${status}` : `Abriu nova O.S. | Status: ${status}`;
  tl.push({ dt: new Date().toISOString(), user: J.nome, role: J.role, acao: acaoTL, tipo: 'edicao', antes: stAtualTL, depois: status });

  const payload = {
    tenantId:    J.tid,
    status,
    placa:       placa ? placa.toUpperCase() : '',
    tipoVeiculo: _v('osTipoVeiculo') || 'carro',
    clienteId:   cliId,
    veiculoId:   veicId,
    celular:     _v('osCelular'),
    cpf:         _v('osCpf'),
    desc:        _v('osDescricao') || _v('osRelato'),
    diagnostico: _v('osDiagnostico'),
    mecId:       _v('osMec'),
    data:        _v('osData'),
    km:          _v('osKm'),
    servicos, pecas, maoObra: totalMO, total,
    media:       JSON.parse(document.getElementById('osMediaArray')?.value||'[]'),
    timeline:    tl,
    chkComb:     _v('chkComb'), chkPneuDia: _v('chkPneuDia'),
    chkPneuTra:  _v('chkPneuTra'), chkObs: _v('chkObs'),
    chkPainel:   _chk('chkPainel'), chkPressao: _chk('chkPressao'),
    chkCarroceria:_chk('chkCarroceria'), chkDocumentos: _chk('chkDocumentos'),
    pgtoForma:   _v('osPgtoForma'), pgtoData: _v('osPgtoData'),
    proxRevData: _v('osProxRev'), proxRevKm: _v('osProxKm'),
    updatedAt:   new Date().toISOString()
  };

  const btnSalvar = document.getElementById('btnSalvarOS');
  if (btnSalvar) { btnSalvar.disabled=true; btnSalvar.innerHTML='<span class="spinner"></span> Salvando...'; }

  try {
    // ── GERAÇÃO FINANCEIRA AO FECHAR A OS ──────────────────
    if (['Pronto','Entregue'].includes(status) && _v('osPgtoForma') && _v('osPgtoData')) {
      await _gerarFinanceiroOS(payload, pecas, totalMO, totalPecas, osId);
    }

    if (osId) {
      await J.db.collection('ordens_servico').doc(osId).update(payload);
      toastOk('✓ O.S. ATUALIZADA');
      audit('OS', `Editou OS ${osId.slice(-6).toUpperCase()} — ${placa||cliId}`);
    } else {
      payload.createdAt = new Date().toISOString();
      payload.pin = Math.floor(1000 + Math.random()*9000).toString();
      const ref = await J.db.collection('ordens_servico').add(payload);
      toastOk('✓ O.S. CRIADA');
      audit('OS', `Criou OS para ${placa||J.clientes.find(c=>c.id===cliId)?.nome||'?'}`);
      notificarEquipe(`Nova O.S. — ${placa||''} criada por ${J.nome}`);
    }

    fecharModal('modalOS');
  } catch(e) {
    toastErr('Erro ao salvar O.S.: ' + e.message);
    console.error(e);
  } finally {
    if (btnSalvar) { btnSalvar.disabled=false; btnSalvar.innerHTML='REGISTRAR O.S.'; }
  }
};

// ── GERAR FINANCEIRO + BAIXAR ESTOQUE ─────────────────────
async function _gerarFinanceiroOS(payload, pecas, totalMO, totalPecas, osId) {
  const batch = J.db.batch();
  const pgtoForma = payload.pgtoForma;
  const pgtoData  = payload.pgtoData;
  const parcelas  = parseInt(_v('osPgtoParcelas')||1);
  const pago      = ['Dinheiro','PIX','Débito','Crédito à Vista'].includes(pgtoForma);
  const status    = pago ? 'Pago' : 'Pendente';
  const v = J.veiculos.find(x => x.id === payload.veiculoId);
  const c = J.clientes.find(x => x.id === payload.clienteId);
  const placa = payload.placa || v?.placa || '';
  const nomeCliente = c?.nome || payload.cliente || '';
  const valorParc = payload.total / Math.max(parcelas,1);

  // Gera parcelas financeiras
  for (let i = 0; i < parcelas; i++) {
    const d = new Date(pgtoData); d.setMonth(d.getMonth() + i);
    const ref = J.db.collection('financeiro').doc();
    batch.set(ref, {
      tenantId: J.tid, tipo: 'Entrada', status,
      desc: `OS ${placa} — ${nomeCliente}${parcelas>1?` (${i+1}/${parcelas})`:''}`,
      valor: parseFloat(valorParc.toFixed(2)),
      pgto: pgtoForma, venc: d.toISOString().split('T')[0],
      osId: osId||null, clienteId: payload.clienteId,
      createdAt: new Date().toISOString()
    });
  }

  // Comissão do mecânico
  const mec = J.equipe.find(f => f.id === payload.mecId);
  if (mec && payload.total > 0) {
    const percMO  = parseFloat(mec.comissaoServico || mec.comissao || 0);
    const percPec = parseFloat(mec.comissaoPeca || 0);
    const valMO   = totalMO   * (percMO  / 100);
    const valPec  = totalPecas * (percPec / 100);
    const valCom  = valMO + valPec;
    if (valCom > 0) {
      const ref = J.db.collection('financeiro').doc();
      batch.set(ref, {
        tenantId: J.tid, tipo: 'Saída', status: 'Pendente',
        desc: `Comissão ${mec.nome} — OS ${placa} (MO: ${moeda(valMO)}, Peça: ${moeda(valPec)})`,
        valor: parseFloat(valCom.toFixed(2)),
        pgto: 'A Combinar', venc: new Date().toISOString().split('T')[0],
        isComissao: true, mecId: payload.mecId, vinculo: `E_${payload.mecId}`,
        createdAt: new Date().toISOString()
      });
    }
  }

  // Baixar estoque
  for (const p of pecas) {
    if (!p.estoqueId || !p.qtd) continue;
    const item = J.estoque.find(x => x.id === p.estoqueId);
    if (item) {
      const novaQtd = Math.max(0, (item.qtd||0) - p.qtd);
      batch.update(J.db.collection('estoqueItems').doc(p.estoqueId), {
        qtd: novaQtd, updatedAt: new Date().toISOString()
      });
    }
  }

  await batch.commit();
  audit('FINANCEIRO', `Gerou ${parcelas}x parcela(s) para OS ${placa}`);
}

// ── UPLOAD MÍDIA ───────────────────────────────────────────
window.uploadOsMedia = async function() {
  const files = document.getElementById('osFileInput')?.files; 
  if (!files || files.length === 0) return;
  
  const btn = document.getElementById('btnUploadMedia');
  if (btn) { btn.innerHTML='<span class="spinner"></span> Enviando...'; btn.disabled=true; }
  
  try {
    const media = JSON.parse(document.getElementById('osMediaArray').value||'[]');
    
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData(); 
      fd.append('file', files[i]); 
      fd.append('upload_preset', J.cloudPreset);
      
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, {method:'POST',body:fd});
      const data = await res.json();
      
      if (data.secure_url) {
        media.push({ url: data.secure_url, type: data.resource_type });
      }
    }
    
    _sv('osMediaArray', JSON.stringify(media));
    renderMediaOS(); 
    toastOk(`✓ ${files.length} mídia(s) enviada(s)`);
    
  } catch(e) { 
    toastErr('Erro no upload: '+e.message); 
  } finally { 
    if (btn) { btn.innerHTML='UPLOAD'; btn.disabled=false; } 
    document.getElementById('osFileInput').value = ''; 
  }
};
window.renderMediaOS = function() {
  const media = JSON.parse(document.getElementById('osMediaArray')?.value||'[]');
  const grid  = document.getElementById('osMediaGrid'); if (!grid) return;
  grid.innerHTML = media.map((m,i)=> `
    <div class="media-item">
      ${m.type==='video' ? `<video src="${m.url}" controls></video>` : `<img src="${m.url}" onclick="window.open('${m.url}')" style="cursor:zoom-in">`}
      <button class="media-del" onclick="removerMediaOS(${i})">✕</button>
    </div>`).join('');
};

window.removerMediaOS = function(idx) {
  const media = JSON.parse(document.getElementById('osMediaArray').value||'[]');
  media.splice(idx,1); _sv('osMediaArray', JSON.stringify(media)); renderMediaOS();
};

// ── TIMELINE ───────────────────────────────────────────────
window.renderTimelineOS = function() {
  const el = document.getElementById('osTimeline'); if (!el) return;
  const tl = JSON.parse(document.getElementById('osTimelineData')?.value||'[]');
  if (!tl.length) { el.innerHTML = '<div class="empty-state-sub" style="padding:20px">Nenhum registro na timeline.</div>'; return; }
  el.innerHTML = '<div class="timeline">' + [...tl].reverse().map(e => `
    <div class="tl-item">
      <div class="tl-date">${dtHrBr(e.dt)}</div>
      <div class="tl-user">${e.user||'—'}</div>
      <div class="tl-action">${e.acao||'—'}</div>
    </div>`).join('') + '</div>';
};
