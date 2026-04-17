/**
 * JARVIS ERP — financeiro.js
 * DRE, Fluxo de Caixa, NF Entrada com Importação XML, Comissões, Exportação
 */

'use strict';

window.renderFinanceiro = function() {
    const buscaTipo = $v('filtroFinTipo');
    const buscaStatus = $v('filtroFinStatus');
    const buscaMes = $v('filtroFinMes');

    let base = [...J.financeiro];
    if (buscaTipo) base = base.filter(f => f.tipo === buscaTipo);
    if (buscaStatus) base = base.filter(f => f.status === buscaStatus);
    if (buscaMes) base = base.filter(f => (f.venc || '').startsWith(buscaMes));

    base.sort((a, b) => (b.venc || '') > (a.venc || '') ? 1 : -1);

    let entradas = 0, saidas = 0;
    J.financeiro.filter(f => f.status === 'Pago').forEach(f => {
        if (f.tipo === 'Entrada') entradas += (f.valor || 0);
        else saidas += (f.valor || 0);
    });

    if ($('dreEntradas')) $('dreEntradas').innerText = moeda(entradas);
    if ($('dreSaidas')) $('dreSaidas').innerText = moeda(saidas);
    
    const saldo = entradas - saidas;
    if ($('dreSaldo')) {
        $('dreSaldo').innerText = moeda(saldo);
        $('dreSaldo').style.color = saldo >= 0 ? 'var(--cyan)' : 'var(--danger)';
    }

    const tb = $('tbFinanceiro');
    if (!tb) return;
    
    if(!$('btnExportCSV') && $('filtroFinMes')) {
        const btnCsv = document.createElement('button');
        btnCsv.id = 'btnExportCSV';
        btnCsv.className = 'btn-outline';
        btnCsv.innerHTML = '📄 EXPORTAR CSV';
        btnCsv.onclick = window.exportarFinanceiro;
        $('filtroFinMes').parentElement.appendChild(btnCsv);
    }

    tb.innerHTML = base.map(f => {
        const stCls = f.status === 'Pago' ? 'pill-green' : 'pill-warn'; 
        const tipCls = f.tipo === 'Entrada' ? 'pill-green' : 'pill-danger';
        const atrasado = f.status === 'Pendente' && f.venc && new Date(f.venc) < new Date();
        const corValor = f.tipo === 'Entrada' ? 'var(--success)' : 'var(--danger)';
        
        let vinculoNome = '';
        if(f.vinculo) {
            if(f.vinculo.startsWith('F_')) {
                const forn = J.fornecedores.find(x => x.id === f.vinculo.replace('F_',''));
                if(forn) vinculoNome = `<br><small style="color:var(--cyan)">Fornecedor: ${forn.nome}</small>`;
            } else if(f.vinculo.startsWith('E_')) {
                const eq = J.equipe.find(x => x.id === f.vinculo.replace('E_',''));
                if(eq) vinculoNome = `<br><small style="color:var(--purple)">Colaborador: ${eq.nome}</small>`;
            }
        }

        return `<tr style="${atrasado ? 'background:rgba(255,59,59,0.05);' : ''}">
            <td style="font-family:var(--fm);font-size:0.75rem">${dtBr(f.venc)}</td>
            <td><span class="pill ${tipCls}">${f.tipo}</span></td>
            <td>${f.desc} ${vinculoNome}</td>
            <td style="font-family:var(--fm);font-size:0.75rem">${f.pgto || '-'}</td>
            <td style="font-family:var(--fm);font-weight:700;color:${corValor}">${moeda(f.valor)}</td>
            <td><span class="pill ${stCls}">${f.status}</span></td>
            <td>
                <button class="btn-ghost" onclick="prepFin('${f.id}');abrirModal('modalFin')" title="Editar">✏</button>
                <button class="btn-danger" onclick="toggleStatusFin('${f.id}','${f.status}')" title="${f.status === 'Pago' ? 'Marcar como Pendente' : 'Marcar como Pago'}">
                    ${f.status === 'Pago' ? '⌛' : '✓'}
                </button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">Nenhum lançamento encontrado</td></tr>';
};

window.prepFin = function(id = null) {
    ['finId', 'finDesc', 'finValor', 'finNota'].forEach(f => { if ($(f)) $(f).value = ''; });
    
    if ($('finTipo')) $('finTipo').value = 'Entrada'; 
    if ($('finStatus')) $('finStatus').value = 'Pago'; 
    if ($('finPgto')) $('finPgto').value = 'PIX'; 
    if ($('finVenc')) $('finVenc').value = new Date().toISOString().split('T')[0];
    if ($('finVinculo')) $('finVinculo').value = '';

    if (id) {
        const f = J.financeiro.find(x => x.id === id); 
        if (!f) return;
        if ($('finId')) $('finId').value = f.id; 
        if ($('finDesc')) $('finDesc').value = f.desc || ''; 
        if ($('finValor')) $('finValor').value = f.valor || 0;
        if ($('finTipo')) $('finTipo').value = f.tipo || 'Entrada'; 
        if ($('finStatus')) $('finStatus').value = f.status || 'Pago';
        if ($('finPgto')) $('finPgto').value = f.pgto || 'PIX'; 
        if ($('finVenc')) $('finVenc').value = f.venc || ''; 
        if ($('finNota')) $('finNota').value = f.nota || '';
        if ($('finVinculo')) $('finVinculo').value = f.vinculo || '';
    }
};

window.salvarFin = async function() {
    if (!$v('finDesc') || !$v('finValor')) { window.toast('⚠ Preencha descrição e valor', 'warn'); return; }
    
    const payload = {
        tenantId: J.tid, 
        tipo: $v('finTipo'), 
        desc: $v('finDesc'), 
        valor: parseFloat($v('finValor') || 0), 
        pgto: $v('finPgto'), 
        venc: $v('finVenc'), 
        status: $v('finStatus'), 
        nota: $v('finNota'), 
        vinculo: $v('finVinculo') || '',
        updatedAt: new Date().toISOString()
    };
    
    const id = $v('finId');
    if (id) {
        await db.collection('financeiro').doc(id).update(payload);
        window.toast('✓ LANÇAMENTO ATUALIZADO'); 
        audit('FINANCEIRO', 'Editou ' + payload.tipo + ': ' + payload.desc);
    } else { 
        payload.createdAt = new Date().toISOString(); 
        await db.collection('financeiro').add(payload); 
        window.toast('✓ LANÇAMENTO REGISTRADO'); 
        audit('FINANCEIRO', 'Lançou ' + payload.tipo + ': ' + payload.desc);
    }
    fecharModal('modalFin');
};

window.toggleStatusFin = async function(id, status) {
    const novoStatus = status === 'Pago' ? 'Pendente' : 'Pago';
    await db.collection('financeiro').doc(id).update({ status: novoStatus, updatedAt: new Date().toISOString() }); 
    window.toast(`✓ STATUS ALTERADO PARA ${novoStatus.toUpperCase()}`);
};

window.prepNF = function() {
    if ($('nfData')) $('nfData').value = new Date().toISOString().split('T')[0]; 
    if ($('nfNumero')) $('nfNumero').value = ''; 
    if ($('containerItensNF')) $('containerItensNF').innerHTML = '';
    if ($('nfTotal')) $('nfTotal').innerText = '0,00'; 
    if ($('nfPgtoForma')) $('nfPgtoForma').value = 'Dinheiro'; 
    if (typeof window.popularSelects === 'function') window.popularSelects(); 
    window.adicionarItemNF();
    window.checkPgtoNF();
};

window.lerXMLNFe = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");

            const getTag = (node, tag) => {
                const el = node.getElementsByTagName(tag)[0] || node.getElementsByTagNameNS("*", tag)[0];
                return el ? el.textContent : '';
            };

            const nNF = getTag(xmlDoc, "nNF");
            const dhEmi = getTag(xmlDoc, "dhEmi");
            if (nNF && $('nfNumero')) $('nfNumero').value = nNF;
            if (dhEmi && $('nfData')) $('nfData').value = dhEmi.split('T')[0];

            const nomeEmit = getTag(xmlDoc, "xNome");
            if (nomeEmit && $('nfFornec')) {
                let f = J.fornecedores.find(x => x.nome.toLowerCase() === nomeEmit.toLowerCase());
                if(f) $('nfFornec').value = f.id;
            }

            const detNodes = xmlDoc.getElementsByTagName("det").length > 0 
                ? xmlDoc.getElementsByTagName("det") 
                : xmlDoc.getElementsByTagNameNS("*", "det");

            if (detNodes.length > 0 && $('containerItensNF')) {
                $('containerItensNF').innerHTML = ''; 
                
                Array.from(detNodes).forEach(det => {
                    const xProd = getTag(det, "xProd");
                    const qCom = parseFloat(getTag(det, "qCom") || 1);
                    const vUnCom = parseFloat(getTag(det, "vUnCom") || 0);

                    const pecaExistente = J.estoque.find(p => p.desc.toLowerCase() === xProd.toLowerCase());
                    const vVenda = pecaExistente ? (pecaExistente.venda || 0) : (vUnCom * 1.5);

                    const div = document.createElement('div');
                    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
                    div.innerHTML = `
                        <input class="j-input nf-desc" value="${xProd}" placeholder="Descrição do item">
                        <input type="number" class="j-input nf-qtd" value="${qCom}" min="1" oninput="window.calcNFTotal()">
                        <input type="number" class="j-input nf-custo" value="${vUnCom.toFixed(2)}" step="0.01" placeholder="Custo" oninput="window.calcNFTotal()">
                        <input type="number" class="j-input nf-venda" value="${vVenda.toFixed(2)}" step="0.01" placeholder="Venda" oninput="window.calcNFTotal()">
                        <button type="button" onclick="this.parentElement.remove();window.calcNFTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
                    `;
                    $('containerItensNF').appendChild(div);
                });
                
                window.calcNFTotal();
                window.toast('✓ XML IMPORTADO COM SUCESSO');
                audit('ESTOQUE/NF', `Importou XML da NFe ${nNF} de ${nomeEmit}`);
            } else {
                window.toast('⚠ Nenhum produto encontrado no XML', 'warn');
            }
        } catch(err) {
            window.toast('✕ Arquivo XML inválido ou corrompido', 'err');
            console.error(err);
        }
        
        if($('xmlInputFile')) $('xmlInputFile').value = '';
    };
    reader.readAsText(file);
};

window.adicionarItemNF = function() {
    const div = document.createElement('div');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
        <input class="j-input nf-desc" placeholder="Descrição do item" oninput="window.sugerirItemEstoqueNF(this)">
        <input type="number" class="j-input nf-qtd" value="1" min="1" oninput="window.calcNFTotal()">
        <input type="number" class="j-input nf-custo" value="0" step="0.01" placeholder="Custo" oninput="window.calcNFTotal()">
        <input type="number" class="j-input nf-venda" value="0" step="0.01" placeholder="Venda" oninput="window.calcNFTotal()">
        <button type="button" onclick="this.parentElement.remove();window.calcNFTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    if ($('containerItensNF')) $('containerItensNF').appendChild(div);
};

window.sugerirItemEstoqueNF = function(input) {
    const val = input.value.toLowerCase().trim();
    if (val.length < 3) return;
    const existente = J.estoque.find(p => p.desc.toLowerCase() === val);
    if (existente) {
        const row = input.parentElement;
        const custoInp = row.querySelector('.nf-custo');
        const vendaInp = row.querySelector('.nf-venda');
        if (custoInp && parseFloat(custoInp.value) === 0) custoInp.value = existente.custo || 0;
        if (vendaInp && parseFloat(vendaInp.value) === 0) vendaInp.value = existente.venda || 0;
        window.calcNFTotal();
    }
};

window.calcNFTotal = function() {
    let t = 0; 
    document.querySelectorAll('#containerItensNF > div').forEach(r => { 
        const qtd = parseFloat(r.querySelector('.nf-qtd')?.value || 0);
        const custo = parseFloat(r.querySelector('.nf-custo')?.value || 0);
        t += (qtd * custo); 
    });
    if ($('nfTotal')) $('nfTotal').innerText = t.toFixed(2).replace('.', ',');
};

window.checkPgtoNF = function() { 
    if ($('divParcelasNF') && $('nfPgtoForma')) {
        $('divParcelasNF').style.display = ['Parcelado', 'Boleto'].includes($v('nfPgtoForma')) ? 'block' : 'none'; 
    }
};

window.salvarNF = async function() {
    const itens = [];
    document.querySelectorAll('#containerItensNF > div').forEach(r => {
        const desc = r.querySelector('.nf-desc')?.value;
        if (desc) itens.push({
            desc,
            qtd: parseFloat(r.querySelector('.nf-qtd')?.value || 1),
            custo: parseFloat(r.querySelector('.nf-custo')?.value || 0),
            venda: parseFloat(r.querySelector('.nf-venda')?.value || 0)
        });
    });
    
    if (!itens.length) { window.toast('⚠ Adicione ao menos um item', 'warn'); return; }
    
    const batch = db.batch(); 
    let totalNF = 0;
    
    for (const item of itens) {
        totalNF += item.qtd * item.custo;
        const existente = J.estoque.find(p => p.desc.toLowerCase() === item.desc.toLowerCase());
        if (existente) { 
            batch.update(db.collection('estoqueItems').doc(existente.id), {
                qtd: (existente.qtd || 0) + item.qtd,
                custo: item.custo,
                venda: item.venda,
                updatedAt: new Date().toISOString()
            }); 
        } else { 
            batch.set(db.collection('estoqueItems').doc(), {
                tenantId: J.tid, desc: item.desc, qtd: item.qtd, custo: item.custo, venda: item.venda, min: 1, und: 'UN', createdAt: new Date().toISOString()
            }); 
        }
    }
    
    const formas = ['Dinheiro', 'PIX']; 
    const st = formas.includes($v('nfPgtoForma')) ? 'Pago' : 'Pendente';
    const nPar = parseInt($v('nfParcelas') || 1);
    
    for (let i = 0; i < nPar; i++) {
        const d = new Date($v('nfVenc') || new Date()); d.setMonth(d.getMonth() + i);
        batch.set(db.collection('financeiro').doc(), {
            tenantId: J.tid, tipo: 'Saída', status: st,
            desc: `NF ${$v('nfNumero') || 's/n'} — ${J.fornecedores.find(f => f.id === $v('nfFornec'))?.nome || 'Fornecedor'} ${nPar > 1 ? `(${i + 1}/${nPar})` : ''}`,
            valor: totalNF / nPar, pgto: $v('nfPgtoForma'), venc: d.toISOString().split('T')[0], createdAt: new Date().toISOString()
        });
    }
    
    await batch.commit(); 
    window.toast('✓ NF LANÇADA E ESTOQUE SOMADO'); 
    fecharModal('modalNF'); 
    audit('ESTOQUE/NF', 'Entrada NF ' + ($v('nfNumero') || 's/n'));
};

window.calcComissoes = function() {
    const comissoes = {}; 
    J.equipe.forEach(f => { comissoes[f.id] = { nome: f.nome, val: 0 }; });
    
    J.financeiro.filter(f => f.isComissao && f.mecId && f.status === 'Pendente').forEach(f => { 
        if (comissoes[f.mecId]) comissoes[f.mecId].val += f.valor || 0; 
    });
    
    if ($('boxComissoes')) {
        $('boxComissoes').innerHTML = Object.values(comissoes).filter(c => c.val > 0).map(c => `
            <div class="com-card">
                <div>
                    <div class="com-nome">${c.nome}</div>
                    <div style="font-family:var(--fm);font-size:0.6rem;color:var(--muted)">A PAGAR</div>
                </div>
                <div class="com-val">${moeda(c.val)}</div>
            </div>
        `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px;">Sem pendências</div>';
    }
};

window.prepPgtoRH = function() {
    ['rhPgtoValor','rhPgtoObs'].forEach(f=>{if($(f)) $(f).value='';});
    if($('rhPgtoData')) $('rhPgtoData').value = new Date().toISOString().split('T')[0];
    if($('rhPgtoTipo')) $('rhPgtoTipo').value = 'Vale / Adiantamento';
    if($('rhPgtoForma')) $('rhPgtoForma').value = 'PIX';
    if($('rhPgtoFunc')) $('rhPgtoFunc').innerHTML = '<option value="">Selecione...</option>' + J.equipe.map(f=>`<option value="${f.id}">${f.nome} (${f.cargo})</option>`).join('');
};

window.salvarPgtoRH = async function() {
    if(!$v('rhPgtoFunc') || !$v('rhPgtoValor')) { window.toast('⚠ Selecione o colaborador e informe o valor','warn'); return; }
    const func = J.equipe.find(f=>f.id===$v('rhPgtoFunc'));
    const valor = parseFloat($v('rhPgtoValor'));
    const tipo = $v('rhPgtoTipo');
    const obs = $v('rhPgtoObs');

    const payload = {
        tenantId: J.tid,
        tipo: 'Saída',
        status: 'Pago',
        desc: `RH: ${tipo} - ${func.nome}` + (obs ? ` (${obs})` : ''),
        valor: valor,
        pgto: $v('rhPgtoForma'),
        venc: $v('rhPgtoData'),
        isRH: true,
        mecId: func.id,
        vinculo: `E_${func.id}`,
        createdAt: new Date().toISOString()
    };

    const batch = db.batch();
    
    if(tipo === 'Pagamento Comissão') {
        let restante = valor;
        const comissoesPendentes = J.financeiro.filter(f => f.isComissao && f.mecId === func.id && f.status === 'Pendente').sort((a,b)=> a.venc > b.venc ? 1 : -1);
        for(let c of comissoesPendentes) {
            if(restante <= 0) break;
            if(c.valor <= restante) {
                batch.update(db.collection('financeiro').doc(c.id), {status: 'Pago', updatedAt: new Date().toISOString()});
                restante -= c.valor;
            } else {
                batch.update(db.collection('financeiro').doc(c.id), {valor: c.valor - restante, updatedAt: new Date().toISOString()});
                restante = 0;
            }
        }
    }

    batch.set(db.collection('financeiro').doc(), payload);
    await batch.commit();

    window.toast('✓ LANÇAMENTO DE RH REGISTRADO NO CAIXA');
    audit('RH/EQUIPE', `Registrou ${tipo} de ${moeda(valor)} para ${func.nome}`);
    fecharModal('modalPgtoRH');
    if(typeof window.calcComissoes === 'function') window.calcComissoes();
};

window.exportarFinanceiro = function() {
    if (J.financeiro.length === 0) { window.toast('⚠ Nenhum dado para exportar', 'warn'); return; }
    
    const buscaTipo = $v('filtroFinTipo');
    const buscaStatus = $v('filtroFinStatus');
    const buscaMes = $v('filtroFinMes');

    let base = [...J.financeiro];
    if (buscaTipo) base = base.filter(f => f.tipo === buscaTipo);
    if (buscaStatus) base = base.filter(f => f.status === buscaStatus);
    if (buscaMes) base = base.filter(f => (f.venc || '').startsWith(buscaMes));
    base.sort((a, b) => (b.venc || '') > (a.venc || '') ? 1 : -1);

    let csv = "Vencimento;Tipo_Lancamento;Descricao;Forma_Pagamento;Valor;Status;Auditoria_Notas\n";
    
    base.forEach(f => {
        const venc = dtBr(f.venc);
        const tipo = f.tipo || '';
        const desc = (f.desc || '').replace(/;/g, ','); 
        const pgto = f.pgto || '';
        const valor = (f.valor || 0).toFixed(2).replace('.', ',');
        const status = f.status || '';
        const obs = (f.nota || '').replace(/;/g, ',');
        
        csv += `${venc};${tipo};${desc};${pgto};${valor};${status};${obs}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Fluxo_de_Caixa_JARVIS_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.toast('✓ RELATÓRIO EXPORTADO EM CSV');
    audit('FINANCEIRO', 'Exportou relatório CSV do caixa');
};
