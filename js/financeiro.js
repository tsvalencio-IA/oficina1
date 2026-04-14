/**
 * JARVIS ERP — financeiro.js
 * DRE, Fluxo de Caixa, NF Entrada, Comissões
 */

'use strict';

// ============================================================
// DRE + TABELA CAIXA
// ============================================================
window.renderFinanceiro = function() {
  const filTipo   = _v('filtroFinTipo')   || '';
  const filStatus = _v('filtroFinStatus') || '';
  const filMes    = _v('filtroFinMes')    || '';

  let base = [...J.financeiro];
  if (filTipo)   base = base.filter(f => f.tipo === filTipo);
  if (filStatus) base = base.filter(f => f.status === filStatus);
  if (filMes)    base = base.filter(f => (f.venc || '').startsWith(filMes));
  base.sort((a, b) => (b.venc || '') > (a.venc || '') ? 1 : -1);

  // DRE (total geral, não filtrado)
  let entradas = 0, saidas = 0;
  J.financeiro.filter(f => f.status === 'Pago').forEach(f => {
    if (f.tipo === 'Entrada') entradas += f.valor || 0;
    else saidas += f.valor || 0;
  });

  _st('dreEntradas', moeda(entradas));
  _st('dreSaidas',   moeda(saidas));
  const saldo = entradas - saidas;
  _st('dreSaldo', moeda(saldo));
  const saldoEl = _$('dreSaldo');
  if (saldoEl) saldoEl.style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';

  // Tabela
  _sh('tbFinanceiro', base.map(f => {
    const atrasado = f.status === 'Pendente' && f.venc && new Date(f.venc) < new Date();
    return `<tr ${atrasado ? 'style="background:rgba(244,63,94,0.03)"' : ''}>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${dtBr(f.venc)}</td>
      <td>${badgeEntradaSaida(f.tipo)}</td>
      <td>${f.desc || '—'}</td>
      <td style="font-family:var(--ff-mono);font-size:0.75rem">${f.pgto || '—'}</td>
      <td style="font-family:var(--ff-mono);font-weight:700;color:${f.tipo === 'Entrada' ? 'var(--success)' : 'var(--danger)'}">${moeda(f.valor)}</td>
      <td>${badgeStatus(f.status)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepFin('${f.id}');openModal('modalFin')" style="margin-right:4px">✏</button>
        <button class="btn btn-sm ${f.status === 'Pago' ? 'btn-warn' : 'btn-success'}" onclick="toggleStatusFin('${f.id}','${f.status}')" title="${f.status === 'Pago' ? 'Marcar pendente' : 'Marcar pago'}">
          ${f.status === 'Pago' ? '⌛' : '✓'}
        </button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(7, '💰', 'Nenhum lançamento'));
};

window.prepFin = function(id = null) {
  ['finId','finDesc','finValor','finNota'].forEach(f => _sv(f, ''));
  _sv('finTipo',   'Entrada');
  _sv('finStatus', 'Pago');
  _sv('finPgto',   'PIX');
  _sv('finVenc',   new Date().toISOString().split('T')[0]);

  if (id) {
    const f = J.financeiro.find(x => x.id === id);
    if (!f) return;
    _sv('finId',     f.id);
    _sv('finDesc',   f.desc   || '');
    _sv('finValor',  f.valor  || 0);
    _sv('finTipo',   f.tipo   || 'Entrada');
    _sv('finStatus', f.status || 'Pago');
    _sv('finPgto',   f.pgto   || 'PIX');
    _sv('finVenc',   f.venc   || '');
    _sv('finNota',   f.nota   || '');
  }
};

window.salvarFin = async function() {
  if (!_v('finDesc') || !_v('finValor')) {
    toastWarn('Preencha descrição e valor');
    return;
  }
  const p = {
    tenantId:  J.tid,
    tipo:      _v('finTipo'),
    desc:      _v('finDesc'),
    valor:     parseFloat(_v('finValor') || 0),
    pgto:      _v('finPgto'),
    venc:      _v('finVenc'),
    status:    _v('finStatus'),
    nota:      _v('finNota'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('finId');
  if (id) await J.db.collection('financeiro').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('financeiro').add(p); }

  toastOk('Lançamento registrado!');
  closeModal('modalFin');
  audit('FINANCEIRO', `Lançou ${p.tipo}: ${p.desc} — ${moeda(p.valor)}`);
};

window.toggleStatusFin = async function(id, status) {
  const novo = status === 'Pago' ? 'Pendente' : 'Pago';
  await J.db.collection('financeiro').doc(id).update({ status: novo, updatedAt: new Date().toISOString() });
  toastOk(`Status atualizado → ${novo}`);
};

// ============================================================
// NF ENTRADA
// ============================================================
window.prepNF = function() {
  _sv('nfData',   new Date().toISOString().split('T')[0]);
  _sv('nfNumero', '');
  _sv('nfPgtoForma', 'Dinheiro');
  _sv('nfVenc', new Date().toISOString().split('T')[0]);
  _sh('containerItensNF', '');
  _st('nfTotal', '0,00');
  _sh('divParcelasNF', '');
  popularSelects();
  adicionarItemNF();
};

window.adicionarItemNF = function() {
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 70px 90px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML = `
    <input class="input" placeholder="Descrição do item" oninput="_sugerirPecaNF(this)">
    <input type="number" class="input" value="1" min="1"    oninput="calcNFTotal()">
    <input type="number" class="input" value="0" step="0.01" placeholder="Custo"  oninput="calcNFTotal()">
    <input type="number" class="input" value="0" step="0.01" placeholder="Venda"  oninput="calcNFTotal()">
    <button type="button" class="btn btn-danger btn-icon" onclick="this.parentElement.remove();calcNFTotal()">✕</button>
  `;
  _$('containerItensNF').appendChild(div);
};

// Autocompletar descrição se peça já existe
window._sugerirPecaNF = function(input) {
  const val = input.value.toLowerCase().trim();
  if (val.length < 3) return;
  const existente = J.estoque.find(p => p.desc.toLowerCase().includes(val));
  if (existente) {
    const row = input.parentElement;
    const custoEl = row.querySelectorAll('input')[2];
    const vendaEl = row.querySelectorAll('input')[3];
    if (custoEl && !parseFloat(custoEl.value)) custoEl.value = existente.custo || 0;
    if (vendaEl && !parseFloat(vendaEl.value)) vendaEl.value = existente.venda || 0;
    calcNFTotal();
  }
};

window.calcNFTotal = function() {
  let t = 0;
  _$('containerItensNF')?.querySelectorAll(':scope > div').forEach(r => {
    const qtd   = parseFloat(r.querySelectorAll('input')[1]?.value || 0);
    const custo = parseFloat(r.querySelectorAll('input')[2]?.value || 0);
    t += qtd * custo;
  });
  _st('nfTotal', t.toFixed(2).replace('.', ','));
};

window.checkPgtoNF = function() {
  const show = ['Parcelado', 'Boleto'].includes(_v('nfPgtoForma'));
  const el   = _$('divParcelasNF');
  if (el) el.classList.toggle('hidden', !show);
};

window.salvarNF = async function() {
  const itens = [];
  _$('containerItensNF')?.querySelectorAll(':scope > div').forEach(r => {
    const inputs = r.querySelectorAll('input');
    const desc   = inputs[0]?.value?.trim();
    if (desc) itens.push({
      desc,
      qtd:   parseFloat(inputs[1]?.value || 1),
      custo: parseFloat(inputs[2]?.value || 0),
      venda: parseFloat(inputs[3]?.value || 0)
    });
  });

  if (!itens.length) { toastWarn('Adicione pelo menos um item'); return; }

  setLoading('btnSalvarNF', true);
  try {
    const batch   = J.db.batch();
    let totalNF   = 0;
    const nfNum   = _v('nfNumero') || 's/n';
    const fornec  = J.fornecedores.find(f => f.id === _v('nfFornec'));

    for (const item of itens) {
      totalNF += item.qtd * item.custo;
      const existente = J.estoque.find(p => p.desc.toLowerCase() === item.desc.toLowerCase());
      if (existente) {
        batch.update(J.db.collection('estoqueItems').doc(existente.id), {
          qtd:       (existente.qtd || 0) + item.qtd,
          custo:     item.custo,
          venda:     item.venda || existente.venda,
          updatedAt: new Date().toISOString()
        });
      } else {
        batch.set(J.db.collection('estoqueItems').doc(), {
          tenantId:  J.tid,
          desc:      item.desc,
          qtd:       item.qtd,
          custo:     item.custo,
          venda:     item.venda,
          min:       2,
          und:       'UN',
          createdAt: new Date().toISOString()
        });
      }
    }

    // Despesa financeira
    const formasPagas = ['Dinheiro', 'PIX'];
    const stFin       = formasPagas.includes(_v('nfPgtoForma')) ? 'Pago' : 'Pendente';
    const nPar        = parseInt(_v('nfParcelas') || 1);

    for (let i = 0; i < nPar; i++) {
      const d = new Date(_v('nfVenc') || new Date());
      d.setMonth(d.getMonth() + i);
      batch.set(J.db.collection('financeiro').doc(), {
        tenantId:  J.tid,
        tipo:      'Saída',
        status:    stFin,
        desc:      `NF ${nfNum} — ${fornec?.nome || 'Fornecedor'} ${nPar > 1 ? `(${i+1}/${nPar})` : ''}`,
        valor:     totalNF / nPar,
        pgto:      _v('nfPgtoForma'),
        venc:      d.toISOString().split('T')[0],
        nfNum,
        fornecedorId: _v('nfFornec') || null,
        createdAt: new Date().toISOString()
      });
    }

    await batch.commit();
    toastOk(`NF processada — ${itens.length} itens adicionados ao estoque!`);
    closeModal('modalNF');
    audit('ESTOQUE/NF', `Entrada NF ${nfNum} — ${moeda(totalNF)}`);
  } catch (e) {
    toastErr('Erro ao processar NF: ' + e.message);
  } finally {
    setLoading('btnSalvarNF', false, 'FINALIZAR ENTRADA');
  }
};

// ============================================================
// COMISSÕES (painel admin)
// ============================================================
window.calcComissoes = function() {
  const comissoes = {};
  J.equipe.forEach(f => { comissoes[f.id] = { nome: f.nome, cargo: f.cargo, val: 0 }; });
  J.financeiro
    .filter(f => f.isComissao && f.mecId && f.status === 'Pendente')
    .forEach(f => { if (comissoes[f.mecId]) comissoes[f.mecId].val += f.valor || 0; });

  const lista = Object.values(comissoes).filter(c => c.val > 0);
  const el    = _$('boxComissoes');
  if (!el) return;

  el.innerHTML = lista.map(c => `
    <div class="com-card">
      <div>
        <div class="com-name">${c.nome}</div>
        <div class="com-label">A PAGAR — ${JARVIS_CONST.CARGOS[c.cargo] || c.cargo || 'Mecânico'}</div>
      </div>
      <div class="com-value">${moeda(c.val)}</div>
    </div>
  `).join('') || `<div class="empty-state" style="padding:24px">
      <div class="empty-state-icon">✅</div>
      <div class="empty-state-sub">Sem comissões pendentes</div>
    </div>`;
};

// Painel do mecânico (equipe.html)
window.renderComissoes = function(fins) {
  const total = fins.filter(f => f.status === 'Pendente').reduce((a, f) => a + (f.valor || 0), 0);
  const pago  = fins.filter(f => f.status === 'Pago').reduce((a, f) => a + (f.valor || 0), 0);
  const kEl   = _$('kComPend');
  if (kEl) kEl.textContent = moeda(total);

  const boxEl = _$('boxComissaoDetalhada');
  if (!boxEl) return;

  boxEl.innerHTML = `
    <div class="dre-cards" style="margin-bottom:20px">
      <div class="dre-card entradas">
        <div class="dre-label">A RECEBER</div>
        <div class="dre-value">${moeda(total)}</div>
      </div>
      <div class="dre-card" style="border:1px solid var(--border);border-radius:var(--r-xl);padding:20px;text-align:center">
        <div class="dre-label">JÁ RECEBIDO</div>
        <div class="dre-value" style="color:var(--text-secondary)">${moeda(pago)}</div>
      </div>
      <div class="dre-card" style="border:1px solid var(--border);border-radius:var(--r-xl);padding:20px;text-align:center">
        <div class="dre-label">TOTAL HISTÓRICO</div>
        <div class="dre-value" style="color:var(--brand)">${moeda(total + pago)}</div>
      </div>
    </div>
    <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">DETALHAMENTO POR O.S.</div>
    ${fins.length ? fins.map(f => `
      <div class="com-card">
        <div>
          <div class="com-name" style="font-size:0.84rem">${f.desc || '—'}</div>
          <div class="com-label">${dtBr(f.venc)}</div>
        </div>
        <div style="text-align:right">
          <div class="com-value" style="font-size:1rem;color:${f.status === 'Pago' ? 'var(--text-muted)' : 'var(--success)'}">${moeda(f.valor)}</div>
          ${badgeStatus(f.status)}
        </div>
      </div>
    `).join('') : `<div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-sub">Nenhuma comissão registrada</div></div>`}
  `;
};
