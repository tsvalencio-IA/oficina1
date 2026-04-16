/**
 * JARVIS ERP — financeiro.js
 * DRE, Fluxo de Caixa, NF Entrada com XML, Parcelamento real, Comissões, Exportação CSV
 */
'use strict';

// ── DRE + TABELA ───────────────────────────────────────────
window.renderFinanceiro = function() {
  let base = [...J.financeiro];
  const bTipo   = _v('filtroFinTipo');
  const bStatus = _v('filtroFinStatus');
  const bMes    = _v('filtroFinMes');
  if (bTipo)   base = base.filter(f => f.tipo   === bTipo);
  if (bStatus) base = base.filter(f => f.status === bStatus);
  if (bMes)    base = base.filter(f => (f.venc||'').startsWith(bMes));
  base.sort((a,b) => (b.venc||'') > (a.venc||'') ? 1 : -1);

  // Totais (sobre TODOS os financeiro, não só o filtrado)
  let entradas=0, saidas=0;
  J.financeiro.filter(f=>f.status==='Pago').forEach(f=>{
    if(f.tipo==='Entrada') entradas+=f.valor||0; else saidas+=f.valor||0;
  });
  _st('dreEntradas', moeda(entradas));
  _st('dreSaidas',   moeda(saidas));
  const saldo = entradas - saidas;
  const saldoEl = document.getElementById('dreSaldo');
  if (saldoEl) { saldoEl.textContent = moeda(saldo); saldoEl.style.color = saldo>=0?'var(--brand)':'var(--danger)'; }

  const tb = document.getElementById('tbFinanceiro'); if (!tb) return;
  if (!base.length) { tb.innerHTML = tableEmpty(7,'💰','Nenhum lançamento'); return; }

  tb.innerHTML = base.map(f => {
    const atrasado = f.status==='Pendente' && f.venc && new Date(f.venc) < new Date();
    const stCls = f.status==='Pago' ? 'badge-success' : atrasado ? 'badge-danger' : 'badge-warn';
    const tipCls= f.tipo==='Entrada' ? 'badge-success' : 'badge-danger';
    const corVal= f.tipo==='Entrada' ? 'var(--success)' : 'var(--danger)';
    return `<tr style="${atrasado?'background:rgba(255,59,59,0.04);':''}">
      <td style="font-family:var(--fm);font-size:0.73rem">${dtBr(f.venc)}</td>
      <td><span class="badge ${tipCls}">${f.tipo}</span></td>
      <td>${f.desc||'—'}${atrasado?'<br><span style="font-family:var(--fm);font-size:0.6rem;color:var(--danger)">⚠ VENCIDO</span>':''}</td>
      <td style="font-family:var(--fm);font-size:0.72rem">${f.pgto||'—'}</td>
      <td style="font-family:var(--fm);font-weight:700;color:${corVal}">${moeda(f.valor)}</td>
      <td><span class="badge ${stCls}">${f.status}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepFin('${f.id}');abrirModal('modalFin')" title="Editar" style="margin-right:4px">✏</button>
        <button class="${f.status==='Pago'?'btn btn-warn btn-sm':'btn btn-success btn-sm'}" onclick="toggleStatusFin('${f.id}','${f.status}')" title="${f.status==='Pago'?'Marcar Pendente':'Marcar Pago'}">
          ${f.status==='Pago'?'⌛':'✓'}
        </button>
      </td>
    </tr>`;
  }).join('');
};

window.prepFin = function(id=null) {
  ['finId','finDesc','finValor','finNota'].forEach(f=>_sv(f,''));
  _sv('finTipo','Entrada'); _sv('finStatus','Pago'); _sv('finPgto','PIX');
  _sv('finVenc', new Date().toISOString().split('T')[0]);
  _sv('finVinculo','');
  if (id) {
    const f=J.financeiro.find(x=>x.id===id); if(!f) return;
    _sv('finId',f.id); _sv('finDesc',f.desc||''); _sv('finValor',f.valor||0);
    _sv('finTipo',f.tipo||'Entrada'); _sv('finStatus',f.status||'Pago');
    _sv('finPgto',f.pgto||'PIX'); _sv('finVenc',f.venc||'');
    _sv('finNota',f.nota||''); _sv('finVinculo',f.vinculo||'');
  }
};

window.salvarFin = async function() {
  if (!_v('finDesc')||!_v('finValor')) { toastWarn('⚠ Preencha descrição e valor'); return; }
  const p = {
    tenantId:J.tid, tipo:_v('finTipo'), desc:_v('finDesc'),
    valor:parseFloat(_v('finValor')||0), pgto:_v('finPgto'),
    venc:_v('finVenc'), status:_v('finStatus'), nota:_v('finNota'),
    vinculo:_v('finVinculo')||'', updatedAt:new Date().toISOString()
  };
  const id=_v('finId');
  if(id) { await J.db.collection('financeiro').doc(id).update(p); toastOk('✓ Lançamento atualizado'); audit('FINANCEIRO',`Editou ${p.tipo}: ${p.desc}`); }
  else   { p.createdAt=new Date().toISOString(); await J.db.collection('financeiro').add(p); toastOk('✓ Lançamento registrado'); audit('FINANCEIRO',`Lançou ${p.tipo}: ${p.desc}`); }
  fecharModal('modalFin');
};

window.toggleStatusFin = async function(id, status) {
  const novo = status==='Pago' ? 'Pendente' : 'Pago';
  await J.db.collection('financeiro').doc(id).update({status:novo, updatedAt:new Date().toISOString()});
  toastOk(`✓ Marcado como ${novo}`);
  audit('FINANCEIRO', `Alterou status para ${novo}: ${J.financeiro.find(f=>f.id===id)?.desc||id}`);
};

// ── NF ENTRADA ─────────────────────────────────────────────
window.prepNF = function() {
  _sv('nfData', new Date().toISOString().split('T')[0]);
  _sv('nfNumero','');
  _sh('containerItensNF','');
  _st('nfTotal','0,00');
  _sv('nfPgtoForma','PIX');
  popularSelects && popularSelects();
  adicionarItemNF();
  checkPgtoNF();
};

window.lerXMLNFe = function(event) {
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload = function(e) {
    try {
      const parser=new DOMParser();
      const xml=parser.parseFromString(e.target.result,'text/xml');
      const get=(n,tag)=>{const el=n.getElementsByTagName(tag)[0]||n.getElementsByTagNameNS('*',tag)[0]; return el?el.textContent:'';};
      const nNF=get(xml,'nNF'), dhEmi=get(xml,'dhEmi');
      if(nNF) _sv('nfNumero',nNF);
      if(dhEmi) _sv('nfData',dhEmi.split('T')[0]);
      const nomeEmit=get(xml,'xNome');
      if(nomeEmit){const f=J.fornecedores.find(x=>x.nome.toLowerCase()===nomeEmit.toLowerCase()); if(f) _sv('nfFornec',f.id);}
      const dets=xml.getElementsByTagName('det').length>0?xml.getElementsByTagName('det'):xml.getElementsByTagNameNS('*','det');
      if(dets.length>0){
        _sh('containerItensNF','');
        Array.from(dets).forEach(det=>{
          const xProd=get(det,'xProd'), qCom=parseFloat(get(det,'qCom')||1), vUnCom=parseFloat(get(det,'vUnCom')||0);
          const existente=J.estoque.find(p=>p.desc.toLowerCase()===xProd.toLowerCase());
          const vVenda=existente?(existente.venda||0):(vUnCom*1.5);
          const div=document.createElement('div');
          div.style.cssText='display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
          div.innerHTML=`<input class="j-input nf-desc" value="${xProd}"><input type="number" class="j-input nf-qtd" value="${qCom}" min="1" oninput="calcNFTotal()"><input type="number" class="j-input nf-custo" value="${vUnCom.toFixed(2)}" step="0.01" oninput="calcNFTotal()"><input type="number" class="j-input nf-venda" value="${vVenda.toFixed(2)}" step="0.01" oninput="calcNFTotal()"><button type="button" onclick="this.parentElement.remove();calcNFTotal()" style="background:rgba(255,59,59,.1);border:1px solid rgba(255,59,59,.3);color:var(--danger);cursor:pointer;width:32px;height:32px;font-size:1rem;">✕</button>`;
          document.getElementById('containerItensNF')?.appendChild(div);
        });
        calcNFTotal(); toastOk('✓ XML importado');
        audit('ESTOQUE/NF',`Importou XML NF ${nNF||'s/n'}`);
      }
    } catch(err) { toastErr('XML inválido: '+err.message); }
    if(document.getElementById('xmlInputFile')) document.getElementById('xmlInputFile').value='';
  };
  reader.readAsText(file);
};

window.adicionarItemNF = function() {
  const div=document.createElement('div');
  div.style.cssText='display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
  div.innerHTML=`<input class="j-input nf-desc" placeholder="Descrição"><input type="number" class="j-input nf-qtd" value="1" min="1" oninput="calcNFTotal()"><input type="number" class="j-input nf-custo" value="0" step="0.01" placeholder="Custo" oninput="calcNFTotal()"><input type="number" class="j-input nf-venda" value="0" step="0.01" placeholder="Venda" oninput="calcNFTotal()"><button type="button" onclick="this.parentElement.remove();calcNFTotal()" style="background:rgba(255,59,59,.1);border:1px solid rgba(255,59,59,.3);color:var(--danger);cursor:pointer;width:32px;height:32px;font-size:1rem;">✕</button>`;
  document.getElementById('containerItensNF')?.appendChild(div);
};

window.calcNFTotal = function() {
  let t=0;
  document.querySelectorAll('#containerItensNF > div').forEach(r=>{
    const qtd=parseFloat(r.querySelector('.nf-qtd')?.value||0);
    const custo=parseFloat(r.querySelector('.nf-custo')?.value||0);
    t+=qtd*custo;
  });
  _st('nfTotal', t.toFixed(2).replace('.',','));
};

window.checkPgtoNF = function() {
  const show=['Boleto','Parcelado'].includes(_v('nfPgtoForma'));
  if(document.getElementById('divParcelasNF')) document.getElementById('divParcelasNF').style.display=show?'block':'none';
};

window.salvarNF = async function() {
  const itens=[];
  document.querySelectorAll('#containerItensNF > div').forEach(r=>{
    const desc=r.querySelector('.nf-desc')?.value;
    if(desc) itens.push({desc, qtd:parseFloat(r.querySelector('.nf-qtd')?.value||1), custo:parseFloat(r.querySelector('.nf-custo')?.value||0), venda:parseFloat(r.querySelector('.nf-venda')?.value||0)});
  });
  if(!itens.length){toastWarn('⚠ Adicione ao menos um item');return;}

  const batch=J.db.batch();
  let totalNF=0;

  for(const item of itens){
    totalNF+=item.qtd*item.custo;
    const existente=J.estoque.find(p=>p.desc.toLowerCase()===item.desc.toLowerCase());
    if(existente){
      batch.update(J.db.collection('estoqueItems').doc(existente.id),{qtd:(existente.qtd||0)+item.qtd,custo:item.custo,venda:item.venda,updatedAt:new Date().toISOString()});
    } else {
      batch.set(J.db.collection('estoqueItems').doc(),{tenantId:J.tid,desc:item.desc,qtd:item.qtd,custo:item.custo,venda:item.venda,min:1,und:'UN',createdAt:new Date().toISOString()});
    }
  }

  const formasPagas=['Dinheiro','PIX'];
  const st=formasPagas.includes(_v('nfPgtoForma'))?'Pago':'Pendente';
  const nPar=parseInt(_v('nfParcelas')||1);
  const nfNum=_v('nfNumero')||'s/n';
  const fornNome=J.fornecedores.find(f=>f.id===_v('nfFornec'))?.nome||'Fornecedor';

  for(let i=0;i<nPar;i++){
    const d=new Date(_v('nfVenc')||new Date()); d.setMonth(d.getMonth()+i);
    batch.set(J.db.collection('financeiro').doc(),{
      tenantId:J.tid,tipo:'Saída',status:st,
      desc:`NF ${nfNum} — ${fornNome}${nPar>1?` (${i+1}/${nPar})`:''}`,
      valor:parseFloat((totalNF/nPar).toFixed(2)),
      pgto:_v('nfPgtoForma'),venc:d.toISOString().split('T')[0],
      createdAt:new Date().toISOString()
    });
  }

  await batch.commit();
  toastOk('✓ NF lançada e estoque atualizado');
  fecharModal('modalNF');
  audit('ESTOQUE/NF',`Entrada NF ${nfNum} — ${fornNome} | ${itens.length} itens`);
};

// ── PAGAMENTO RH ───────────────────────────────────────────
window.prepPgtoRH = function() {
  ['rhPgtoValor','rhPgtoObs'].forEach(f=>_sv(f,''));
  _sv('rhPgtoData',new Date().toISOString().split('T')[0]);
  _sv('rhPgtoTipo','Vale / Adiantamento'); _sv('rhPgtoForma','PIX');
  if(document.getElementById('rhPgtoFunc'))
    document.getElementById('rhPgtoFunc').innerHTML='<option value="">Selecione...</option>'+J.equipe.map(f=>`<option value="${f.id}">${f.nome} (${f.cargo||''})</option>`).join('');
};

window.salvarPgtoRH = async function() {
  if(!_v('rhPgtoFunc')||!_v('rhPgtoValor')){toastWarn('⚠ Selecione colaborador e informe o valor');return;}
  const func=J.equipe.find(f=>f.id===_v('rhPgtoFunc'));
  const valor=parseFloat(_v('rhPgtoValor'));
  const tipo=_v('rhPgtoTipo'); const obs=_v('rhPgtoObs');
  const batch=J.db.batch();

  let restante = valor;

  // 1. Abater de comissões pendentes (Seja Vale ou Comissão, abate do saldo a receber do funcionário)
  const comPend = J.financeiro.filter(f => f.isComissao && f.mecId === func.id && f.status === 'Pendente').sort((a,b)=>a.venc>b.venc?1:-1);

  for (const c of comPend) {
    if (restante <= 0) break;
    if (c.valor <= restante) {
      // Paga a comissão integralmente
      batch.update(J.db.collection('financeiro').doc(c.id), {status: 'Pago', pgto: _v('rhPgtoForma'), updatedAt: new Date().toISOString()});
      restante -= c.valor;
    } else {
      // Pagamento parcial (corta o valor da pendente e cria um recibo pago para a diferença)
      batch.update(J.db.collection('financeiro').doc(c.id), {valor: c.valor - restante, updatedAt: new Date().toISOString()});
      batch.set(J.db.collection('financeiro').doc(), {
        tenantId: J.tid, tipo: 'Saída', status: 'Pago',
        desc: `${c.desc} (Pgto Parcial)`,
        valor: restante, pgto: _v('rhPgtoForma'), venc: _v('rhPgtoData'),
        isComissao: true, mecId: func.id, vinculo: `E_${func.id}`,
        createdAt: new Date().toISOString()
      });
      restante = 0;
    }
  }

  // 2. Se o Vale for maior que as comissões pendentes (ou se for um Salário Fixo sem saldo)
  if (restante > 0) {
    batch.set(J.db.collection('financeiro').doc(), {
      tenantId: J.tid, tipo: 'Saída', status: 'Pago',
      desc: `RH: ${tipo} — ${func.nome}${obs ? ` (${obs})` : ''}`,
      valor: restante, pgto: _v('rhPgtoForma'), venc: _v('rhPgtoData'),
      isRH: true, isComissao: true, mecId: func.id, vinculo: `E_${func.id}`,
      createdAt: new Date().toISOString()
    });
  }

  await batch.commit();
  toastOk('✓ Pagamento RH registrado no caixa');
  audit('RH',`${tipo} de ${moeda(valor)} para ${func.nome}`);
  fecharModal('modalPgtoRH');
  if (window.calcComissoes) calcComissoes();
};
// ── EXPORTAR CSV ───────────────────────────────────────────
window.exportarFinanceiro = function() {
  if(!J.financeiro.length){toastWarn('⚠ Nenhum dado para exportar');return;}
  let base=[...J.financeiro];
  const bT=_v('filtroFinTipo'),bS=_v('filtroFinStatus'),bM=_v('filtroFinMes');
  if(bT) base=base.filter(f=>f.tipo===bT);
  if(bS) base=base.filter(f=>f.status===bS);
  if(bM) base=base.filter(f=>(f.venc||'').startsWith(bM));
  base.sort((a,b)=>(b.venc||'')>(a.venc||'')?1:-1);
  let csv='Vencimento;Tipo;Descricao;Pagamento;Valor;Status;Nota\n';
  base.forEach(f=>{
    csv+=`${dtBr(f.venc)};${f.tipo||''};${(f.desc||'').replace(/;/g,',')};${f.pgto||''};${(f.valor||0).toFixed(2).replace('.',',')};${f.status||''};${(f.nota||'').replace(/;/g,',')}\n`;
  });
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`Financeiro_JARVIS_${Date.now()}.csv`;
  a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toastOk('✓ CSV exportado');
  audit('FINANCEIRO','Exportou relatório CSV');
};
