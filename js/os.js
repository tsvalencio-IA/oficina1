/**
 * JARVIS ERP — os.js v3
 * O.S., Kanban, Timeline Rica (Chevron-style), Prioridade, Responsáveis
 */

'use strict';

// ============================================================
// DASHBOARD
// ============================================================
window.renderDashboard = function() {
  const agora = new Date();
  const mes   = agora.getMonth(), ano = agora.getFullYear();

  const fat = J.os
    .filter(o => o.status === 'Concluido' && o.updatedAt)
    .reduce((acc, o) => {
      const d = new Date(o.updatedAt);
      return (d.getMonth() === mes && d.getFullYear() === ano) ? acc + (o.total || 0) : acc;
    }, 0);

  _st('kFat',    moeda(fat));
  _st('kPatio',  J.os.filter(o => !['Cancelado','Concluido'].includes(o.status)).length);
  _st('kStock',  J.estoque.filter(p => (p.qtd || 0) <= (p.min || 0)).length);

  const vencidos = J.financeiro.filter(f =>
    f.status === 'Pendente' && f.venc && new Date(f.venc) < agora
  ).length;
  _st('kVenc', vencidos);

  // Agenda do dia
  const hoje = agora.toISOString().split('T')[0];
  _st('kAgenda', J.agendamentos.filter(a => a.data === hoje && a.status !== 'Convertido').length);

  // Últimas OS
  const recent = [...J.os].sort((a, b) => (b.updatedAt||'') > (a.updatedAt||'') ? 1 : -1).slice(0, 6);
  _sh('dashRecentOS', recent.map(o => {
    const v = J.veiculos.find(x => x.id === o.veiculoId);
    const c = J.clientes.find(x => x.id === o.clienteId);
    const mec = J.equipe.find(x => x.id === o.mecId);
    return `<tr>
      <td><span class="placa">${v?.placa || '—'}</span></td>
      <td>${c?.nome || '—'}</td>
      <td>${mec?.nome || '—'}</td>
      <td>${badgeStatus(o.status)}</td>
      <td style="font-family:var(--ff-mono);font-weight:700;color:var(--success)">${moeda(o.total)}</td>
    </tr>`;
  }).join('') || tableEmpty(5, '📋', 'Nenhuma O.S. registrada'));

  // Estoque crítico
  const crit = J.estoque.filter(p => (p.qtd || 0) <= (p.min || 0)).slice(0, 5);
  _sh('dashAlertStock', crit.map(p => `
    <tr class="row-critical">
      <td>${p.desc || p.codigo}</td>
      <td style="font-family:var(--ff-mono);font-weight:700;color:var(--danger)">${p.qtd || 0}</td>
      <td style="font-family:var(--ff-mono);color:var(--text-muted)">${p.min || 0}</td>
      <td>${badgeStatus('Cancelado')}</td>
    </tr>
  `).join('') || tableEmpty(4, '✅', 'Estoque em dia'));

  // Atualiza painel de atenção
  if (window.atualizarPainelAtencao) atualizarPainelAtencao();
};

// ============================================================
// KANBAN
// ============================================================
const _KANBAN_STATUS = ['Aguardando','Orcamento','Aprovado','Andamento','Concluido'];
const _STATUS_COR = {
  Aguardando: 'var(--text-muted)',
  Orcamento:  'var(--warn)',
  Aprovado:   'var(--brand)',
  Andamento:  '#F97316',
  Concluido:  'var(--success)'
};
const _STATUS_CLASSE = {
  Aguardando: 'card-triagem',
  Orcamento:  'card-orcamento',
  Aprovado:   'card-aprovado',
  Andamento:  'card-servico',
  Concluido:  'card-pronto'
};

window.renderKanban = function() {
  const busca       = (_v('searchOS') || '').toLowerCase();
  const filtroNicho = _v('filtroNichoKanban');
  const cols = {}, cnts = {};
  _KANBAN_STATUS.forEach(s => { cols[s] = []; cnts[s] = 0; });

  J.os.filter(o => o.status !== 'Cancelado').forEach(o => {
    const v = J.veiculos.find(x => x.id === o.veiculoId);
    const c = J.clientes.find(x => x.id === o.clienteId);
    if (busca && !v?.placa?.toLowerCase().includes(busca) && !c?.nome?.toLowerCase().includes(busca)) return;
    if (filtroNicho && v?.tipo !== filtroNicho) return;
    if (cols[o.status]) { cols[o.status].push({ os: o, v, c }); cnts[o.status]++; }
  });

  _KANBAN_STATUS.forEach(s => {
    const cntEl = _$(`cnt-${s}`); if (cntEl) cntEl.textContent = cnts[s];
    const colEl = _$(`kb-${s}`);  if (!colEl) return;

    if (!cols[s].length) {
      colEl.innerHTML = `<div class="empty-state" style="padding:20px 10px">
        <div style="font-size:1.2rem;margin-bottom:4px;opacity:0.4">📭</div>
        <div style="font-size:0.68rem;color:var(--text-muted)">Nenhuma O.S.</div>
      </div>`;
      return;
    }

    colEl.innerHTML = cols[s]
      .sort((a, b) => {
        // Prioridade: vermelho > amarelo > verde > sem prioridade
        const prioOrder = { vermelho: 0, amarelo: 1, verde: 2 };
        const pa = prioOrder[a.os.prioridade] ?? 3;
        const pb = prioOrder[b.os.prioridade] ?? 3;
        if (pa !== pb) return pa - pb;
        return new Date(b.os.updatedAt || 0) - new Date(a.os.updatedAt || 0);
      })
      .map(({ os, v, c }) => {
        const mec   = J.equipe.find(f => f.id === os.mecId);
        const prioHTML = os.prioridade && os.prioridade !== 'verde'
          ? `<div class="prio-badge prio-${os.prioridade}" title="Urgência: ${os.prioridade}"></div>` : '';
        const prevStatus = _KANBAN_STATUS[_KANBAN_STATUS.indexOf(os.status) - 1];
        const nextStatus = _KANBAN_STATUS[_KANBAN_STATUS.indexOf(os.status) + 1];
        const btnPrev = prevStatus && pode('moverStatus')
          ? `<button class="btn-move-kanban" data-id="${os.id}" data-status="${prevStatus}" title="Voltar" onclick="event.stopPropagation();_moverOSStatus('${os.id}','${prevStatus}')">‹</button>` : '';
        const btnNext = nextStatus && pode('moverStatus')
          ? `<button class="btn-move-kanban btn-next" data-id="${os.id}" data-status="${nextStatus}" title="Avançar" onclick="event.stopPropagation();_moverOSStatus('${os.id}','${nextStatus}')">›</button>` : '';

        return `
          <div class="kanban-card ${_STATUS_CLASSE[os.status] || ''}"
               onclick="prepOS('edit','${os.id}');openModal('modalOS')"
               title="${c?.nome || ''} — ${v?.modelo || ''}">
            ${prioHTML}
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <div class="kanban-card-placa">${v?.placa || 'S/PLACA'}</div>
                <div class="kanban-card-cliente">${c?.nome || '—'}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;margin-left:4px">
                ${btnNext}${btnPrev}
              </div>
            </div>
            <div class="kanban-card-desc">${os.desc || 'Sem descrição'}</div>
            <div class="kanban-card-footer">
              ${badgeTipo(v?.tipo || 'carro')}
              <span class="t-caption">${dtBr(os.data)}</span>
            </div>
            ${os.total ? `<div style="text-align:right;margin-top:6px;font-family:var(--ff-mono);font-size:0.72rem;color:var(--success);font-weight:700">${moeda(os.total)}</div>` : ''}
            ${mec ? `<div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px">🔧 ${mec.nome}</div>` : ''}
          </div>
        `;
      }).join('');
  });
};

// Mover OS pelo botão rápido do kanban
window._moverOSStatus = async function(osId, novoStatus) {
  if (!pode('moverStatus')) { toastWarn('Sem permissão para mover status'); return; }
  const os = J.os.find(x => x.id === osId);
  if (!os) return;

  const tl = [...(os.timeline || [])];
  tl.push({
    dt:    dtISO(),
    user:  J.nome,
    role:  J.role,
    tipo:  'status',
    acao:  `Status: "${os.status}" → "${novoStatus}"`
  });

  await J.db.collection('ordens_servico').doc(osId).update({
    status:    novoStatus,
    updatedAt: dtISO(),
    timeline:  tl,
    ..._responsavelPorEtapa(novoStatus)
  });

  notificarEquipe(`O.S. ${J.veiculos.find(v => v.id === os.veiculoId)?.placa || ''} → ${novoStatus} (${J.nome})`);
  audit('OS', `Moveu OS ${osId.slice(-6)} → ${novoStatus}`);
};

// Registra automaticamente o responsável por cada etapa
function _responsavelPorEtapa(status) {
  const updates = {};
  if (status === 'Orcamento')  updates.respOrcamento  = J.nome;
  if (status === 'Andamento')  updates.respExecucao   = J.nome;
  if (status === 'Concluido')  updates.respEntrega    = J.nome;
  return updates;
}

// ============================================================
// MODAL O.S. — PREP
// ============================================================
window.prepOS = function(mode, id = null) {
  ['osId','osKm','osDiagnostico','osDescricao','chkObs','chkPneuDia','chkPneuTra','osMaoObra']
    .forEach(f => _sv(f, f === 'osMaoObra' ? '0' : ''));

  ['chkPainel','chkPressao','chkCarroceria','chkDocumentos'].forEach(f => _ck(f, false));
  _sv('osStatus',      'Aguardando');
  _sv('osTipoVeiculo', 'carro');
  _sv('osPrioridade',  'verde');
  _sv('osData',        new Date().toISOString().split('T')[0]);
  _sv('chkComb',       'N/A');
  _st('osTotalVal',    '0,00');
  _sv('osTotalHidden', '0');
  _sh('containerPecasOS', '');
  _sh('osMediaGrid', '');
  _sv('osMediaArray', '[]');
  _sh('osTimelineEl', '');
  _sv('osTimelineData', '[]');
  _st('osIdBadge',     'NOVA O.S.');
  _sh('osResponsaveis', '');

  const btnPDF = _$('btnGerarPDFOS');
  if (btnPDF) btnPDF.classList.add('hidden');
  const areaPgto = _$('areaPgtoOS');
  if (areaPgto) areaPgto.classList.add('hidden');

  // Permissões de edição
  const podeEditar = pode('editarCamposOS');
  document.querySelectorAll('.os-edit-only').forEach(el => {
    el.style.display = podeEditar ? '' : 'none';
  });

  popularSelects();
  window._osDetalheAberta = null;

  if (mode === 'edit' && id) {
    const os = J.os.find(x => x.id === id);
    if (!os) return;
    window._osDetalheAberta = id;

    _sv('osId',           os.id);
    _st('osIdBadge',      'OS #' + os.id.slice(-6).toUpperCase());
    _sv('osTipoVeiculo',  os.tipoVeiculo    || 'carro');
    _sv('osStatus',       os.status         || 'Aguardando');
    _sv('osCliente',      os.clienteId      || '');
    _sv('osPrioridade',   os.prioridade     || 'verde');

    filtrarVeiculosOS();
    setTimeout(() => _sv('osVeiculo', os.veiculoId || ''), 80);

    _sv('osMec',          os.mecId          || '');
    _sv('osData',         os.data           || '');
    _sv('osKm',           os.km             || '');
    _sv('osDescricao',    os.desc           || '');
    _sv('osDiagnostico',  os.diagnostico    || '');
    _sv('osMaoObra',      os.maoObra        || 0);
    _sv('chkComb',        os.chkComb        || 'N/A');
    _sv('chkPneuDia',     os.chkPneuDia     || '');
    _sv('chkPneuTra',     os.chkPneuTra     || '');
    _sv('chkObs',         os.chkObs         || '');
    _ck('chkPainel',      os.chkPainel);
    _ck('chkPressao',     os.chkPressao);
    _ck('chkCarroceria',  os.chkCarroceria);
    _ck('chkDocumentos',  os.chkDocumentos);

    _sv('osMediaArray', JSON.stringify(os.media || []));
    renderMediaOS();
    renderTimelineOS(os.timeline || [], os.id);
    _renderResponsaveis(os);

    if (os.pecas?.length) os.pecas.forEach(p => _renderPecaRow(p));
    calcOS();
    verificarStatusOS();
    if (btnPDF) btnPDF.classList.remove('hidden');

    if (os.status === 'Concluido' && os.pgtoForma) {
      _sv('osPgtoForma', os.pgtoForma);
      _sv('osPgtoData',  os.pgtoData || '');
      checkPgtoOS();
    }
  }
};

// Bloco de responsáveis por etapa (Chevron-style)
function _renderResponsaveis(os) {
  const el = _$('osResponsaveis');
  if (!el) return;
  const linha = (label, val) => val
    ? `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--ff-mono);font-size:0.6rem;color:var(--text-muted);min-width:90px">${label}</span>
        <span style="font-size:0.82rem;font-weight:600">${val}</span>
      </div>` : '';
  el.innerHTML = [
    linha('Atendimento:',  os.respAtendimento || os.mecNome),
    linha('Orçamento:',    os.respOrcamento),
    linha('Execução:',     os.respExecucao),
    linha('Entrega:',      os.respEntrega),
  ].filter(Boolean).join('');
}

// ============================================================
// TIMELINE RICA (Chevron-style)
// ============================================================
window.renderTimelineOS = function(timeline, osId) {
  const el = _$('osTimelineEl');
  if (!el) return;

  const tl = [...(timeline || [])].reverse(); // mais recente primeiro

  if (!tl.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-sub">Sem registros na timeline</div></div>`;
    return;
  }

  el.innerHTML = tl.map((entry, idx) => {
    const originalIdx = tl.length - 1 - idx; // índice real no array
    const tipo = entry.tipo || 'log';
    const iconMap   = { status: '🔄', log: '💬', valor: '💰', midia: '📷', km: '📍', sistema: '⚙️' };
    const corMap    = { status: 'var(--brand)', log: 'var(--text-secondary)', valor: 'var(--success)', midia: 'var(--info)', km: 'var(--warn)', sistema: 'var(--text-muted)' };
    const icon      = iconMap[tipo]   || '💬';
    const cor       = corMap[tipo]    || 'var(--text-secondary)';
    const isExcluida = (entry.acao || '').startsWith('ATT EXCLUÍDA');

    const podeDeletar = pode('deletarLog') && !isExcluida && tipo !== 'sistema';
    const btnDel = podeDeletar
      ? `<button class="tl-del-btn" onclick="_deletarEntradaTimeline('${osId}',${originalIdx})" title="Excluir entrada">✕</button>`
      : '';

    const pecas  = entry.pecas  ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px">Peças: ${entry.pecas}</div>` : '';
    const valor  = entry.valor  ? `<div style="font-size:0.75rem;color:var(--success);font-weight:700;margin-top:3px">${moeda(entry.valor)}</div>` : '';
    const roleTag = entry.role  ? `<span class="badge badge-neutral" style="font-size:0.5rem;margin-left:6px">${_roleLabel(entry.role)}</span>` : '';

    return `
      <div class="tl-item ${isExcluida ? 'tl-excluida' : ''}">
        <div class="tl-icon" style="background:rgba(0,0,0,0.2);color:${cor};font-size:0.9rem">${icon}</div>
        <div class="tl-content">
          ${btnDel}
          <div class="tl-header">
            <span style="font-weight:700;font-size:0.82rem">${entry.user || '—'}${roleTag}</span>
            <span class="tl-date">${dtHrBr(entry.dt)}</span>
          </div>
          <div class="tl-action ${isExcluida ? 'tl-action-excluida' : ''}">${entry.acao || ''}</div>
          ${pecas}${valor}
        </div>
      </div>`;
  }).join('');
};

// Deletar entrada da timeline
window._deletarEntradaTimeline = async function(osId, idx) {
  if (!pode('deletarLog')) { toastWarn('Sem permissão'); return; }
  const ok = await confirmar('Remover esta entrada da timeline?');
  if (!ok) return;
  const os = J.os.find(x => x.id === osId);
  if (!os) return;
  const tl = [...(os.timeline || [])];
  // Marca como excluída em vez de deletar (auditoria)
  tl[idx] = {
    ...tl[idx],
    acao:     `ATT EXCLUÍDA POR: ${J.nome}`,
    tipo:     'sistema',
    original: tl[idx].acao
  };
  await J.db.collection('ordens_servico').doc(osId).update({ timeline: tl, updatedAt: dtISO() });
  toastOk('Entrada removida');
  audit('OS/TIMELINE', `Excluiu entrada da O.S. ${osId.slice(-6)}`);
};

// Adicionar entrada manual na timeline (form rápido dentro do modal)
window.adicionarLogTimeline = async function() {
  const osId = _v('osId');
  const desc = _v('logDescricao');
  const pecs = _v('logPecas');
  const val  = parseFloat(_v('logValor') || 0);
  if (!desc) { toastWarn('Descreva o serviço'); return; }
  if (!osId) { toastWarn('Salve a O.S. primeiro'); return; }

  const os = J.os.find(x => x.id === osId);
  const tl = [...(os?.timeline || [])];
  const entry = {
    dt:    dtISO(),
    user:  J.nome,
    role:  J.role,
    tipo:  val > 0 ? 'valor' : 'log',
    acao:  desc,
  };
  if (pecs) entry.pecas = pecs;
  if (val > 0) entry.valor = val;
  tl.push(entry);

  await J.db.collection('ordens_servico').doc(osId).update({ timeline: tl, updatedAt: dtISO() });
  _sv('logDescricao', ''); _sv('logPecas', ''); _sv('logValor', '');
  toastOk('Registro adicionado!');
  notificarEquipe(`Novo log na O.S. ${J.veiculos.find(v => v.id === os?.veiculoId)?.placa || ''} (${J.nome})`);
  audit('OS/LOG', `Adicionou log na O.S. ${osId.slice(-6)}`);

  // Mostra botão de mover status (Chevron-style)
  const moveArea = _$('postLogActions');
  if (moveArea) moveArea.classList.remove('hidden');
};

// ============================================================
// PEÇAS
// ============================================================
window.adicionarPecaOS = function() {
  const div = document.createElement('div');
  div.className = 'peca-row';
  const opts = '<option value="">Selecionar peça...</option>' +
    J.estoque.filter(p => (p.qtd || 0) > 0).map(p =>
      `<option value="${p.id}" data-venda="${p.venda || 0}" data-custo="${p.custo || 0}" data-desc="${(p.desc || '').replace(/"/g,'&quot;')}">[${p.qtd}un] ${p.desc} — ${moeda(p.venda)}</option>`
    ).join('');
  div.innerHTML = `
    <select class="select peca-sel" onchange="_selPeca(this)">${opts}</select>
    <input type="number" class="input peca-qtd"   value="1"  min="1"    oninput="calcOS()">
    <input type="number" class="input peca-custo" value="0"  step="0.01" oninput="calcOS()">
    <input type="number" class="input peca-venda" value="0"  step="0.01" oninput="calcOS()">
    <button type="button" class="btn btn-danger btn-icon" onclick="this.closest('.peca-row').remove();calcOS()">✕</button>
  `;
  _$('containerPecasOS').appendChild(div);
  calcOS();
};

function _renderPecaRow(p) {
  const div = document.createElement('div');
  div.className = 'peca-row';
  const opts = `<option value="${p.estoqueId || ''}">${p.desc || ''}</option>` +
    J.estoque.filter(x => (x.qtd || 0) > 0 || x.id === p.estoqueId).map(x =>
      `<option value="${x.id}" data-venda="${x.venda||0}" data-custo="${x.custo||0}" data-desc="${(x.desc||'').replace(/"/g,'&quot;')}" ${x.id === p.estoqueId ? 'selected' : ''}>[${x.qtd}un] ${x.desc}</option>`
    ).join('');
  div.innerHTML = `
    <select class="select peca-sel" onchange="_selPeca(this)">${opts}</select>
    <input type="number" class="input peca-qtd"   value="${p.qtd   || 1}" min="1"    oninput="calcOS()">
    <input type="number" class="input peca-custo" value="${p.custo || 0}" step="0.01" oninput="calcOS()">
    <input type="number" class="input peca-venda" value="${p.venda || 0}" step="0.01" oninput="calcOS()">
    <button type="button" class="btn btn-danger btn-icon" onclick="this.closest('.peca-row').remove();calcOS()">✕</button>
  `;
  _$('containerPecasOS').appendChild(div);
}

window._selPeca = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  const row = sel.closest('.peca-row');
  if (!row) return;
  row.querySelector('.peca-venda').value = opt.dataset.venda || 0;
  row.querySelector('.peca-custo').value = opt.dataset.custo || 0;
  calcOS();
};

window.calcOS = function() {
  let total = parseFloat(_v('osMaoObra')) || 0;
  document.querySelectorAll('#containerPecasOS .peca-row').forEach(row => {
    const qtd   = parseFloat(row.querySelector('.peca-qtd')?.value   || 0);
    const venda = parseFloat(row.querySelector('.peca-venda')?.value || 0);
    total += qtd * venda;
  });
  _st('osTotalVal', total.toFixed(2).replace('.', ','));
  _sv('osTotalHidden', total);
};

window.verificarStatusOS = function() {
  const s = _v('osStatus');
  const area = _$('areaPgtoOS');
  if (area) area.classList.toggle('hidden', s !== 'Concluido');
};

window.checkPgtoOS = function() {
  const f = _v('osPgtoForma');
  const parDiv = _$('divParcelasOS');
  if (parDiv) parDiv.classList.toggle('hidden', !['Crédito Parcelado','Boleto'].includes(f));
};

// ============================================================
// CLOUDINARY MÍDIA
// ============================================================
window.uploadOsMedia = async function() {
  const file = _$('osFileInput')?.files[0];
  if (!file) { toastWarn('Selecione um arquivo'); return; }

  setLoading('btnUploadMedia', true, 'Enviando...');
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', J.cloudPreset);
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, { method:'POST', body:fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Upload falhou');

    const media = JSON.parse(_v('osMediaArray') || '[]');
    media.push({ url: data.secure_url, type: data.resource_type, name: file.name, ts: dtISO() });
    _sv('osMediaArray', JSON.stringify(media));
    renderMediaOS();
    toastOk('Arquivo enviado!');
  } catch (e) {
    toastErr('Upload falhou: ' + e.message);
  } finally {
    setLoading('btnUploadMedia', false, 'UPLOAD');
    const fi = _$('osFileInput'); if (fi) fi.value = '';
  }
};

window.renderMediaOS = function() {
  const media = JSON.parse(_v('osMediaArray') || '[]');
  if (!media.length) {
    _sh('osMediaGrid', '<div style="color:var(--text-muted);font-size:0.78rem;padding:8px 0">Nenhum arquivo</div>');
    return;
  }
  // Lightbox state
  window._lightboxMedia = media;
  _sh('osMediaGrid', media.map((m, i) => {
    const podeDel = pode('deletarMidia');
    const delBtn  = podeDel ? `<button class="media-del" onclick="_rmMedia(${i})" title="Remover">✕</button>` : '';
    const thumb   = m.type === 'video'
      ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--surf-3);font-size:2rem">▶</div>`
      : `<img src="${m.url}" alt="foto" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.7rem\\'>Indisponível</div>'"  >`;
    return `<div class="media-item">
      ${delBtn}
      <div class="thumbnail-item" onclick="_abrirLightbox(${i})" style="width:100%;height:100%;cursor:pointer">${thumb}</div>
    </div>`;
  }).join(''));
};

window._rmMedia = function(idx) {
  const media = JSON.parse(_v('osMediaArray') || '[]');
  media.splice(idx, 1);
  _sv('osMediaArray', JSON.stringify(media));
  renderMediaOS();
};

// ============================================================
// LIGHTBOX (Chevron-style)
// ============================================================
window._abrirLightbox = function(idx) {
  const media = window._lightboxMedia || [];
  if (!media[idx]) return;
  window._lightboxIdx = idx;

  const lb = _$('lightboxOverlay');
  if (!lb) { window.open(media[idx].url, '_blank'); return; }

  const content = _$('lightboxContent');
  const m = media[idx];
  if (m.type === 'video') {
    content.innerHTML = `<video src="${m.url}" controls style="max-width:100%;max-height:80vh"></video>`;
  } else {
    content.innerHTML = `<img src="${m.url}" referrerpolicy="no-referrer" style="max-width:100%;max-height:80vh;object-fit:contain">`;
  }

  _$('lightboxPrev').style.display = idx > 0 ? 'flex' : 'none';
  _$('lightboxNext').style.display = idx < media.length - 1 ? 'flex' : 'none';

  const dlBtn = _$('lightboxDownload');
  if (dlBtn) { dlBtn.href = m.url; dlBtn.download = m.name || `media_${idx}`; }

  lb.classList.remove('hidden');
  lb.classList.add('flex');
};

window._lightboxNav = function(dir) {
  const idx = (window._lightboxIdx || 0) + dir;
  const media = window._lightboxMedia || [];
  if (idx >= 0 && idx < media.length) _abrirLightbox(idx);
};

window._fecharLightbox = function() {
  const lb = _$('lightboxOverlay');
  if (lb) { lb.classList.add('hidden'); lb.classList.remove('flex'); }
};

// ============================================================
// SALVAR O.S.
// ============================================================
window.salvarOS = async function() {
  const osId = _v('osId');
  if (!_v('osCliente') || !_v('osVeiculo')) { toastWarn('Selecione cliente e veículo'); return; }

  setLoading('btnSalvarOS', true);

  const pecas = [];
  document.querySelectorAll('#containerPecasOS .peca-row').forEach(row => {
    const sel   = row.querySelector('.peca-sel');
    const opt   = sel?.options[sel?.selectedIndex];
    const qtd   = parseFloat(row.querySelector('.peca-qtd')?.value   || 0);
    const custo = parseFloat(row.querySelector('.peca-custo')?.value || 0);
    const venda = parseFloat(row.querySelector('.peca-venda')?.value || 0);
    if (qtd > 0) pecas.push({ estoqueId: sel?.value || null, desc: opt?.dataset.desc || opt?.text || '', qtd, custo, venda });
  });

  // Timeline entry de abertura/edição
  const tl = JSON.parse(_v('osTimelineData') || '[]');
  tl.push({
    dt:   dtISO(), user: J.nome, role: J.role,
    tipo: 'status',
    acao: `${osId ? 'Editou' : 'Abriu'} O.S. — Status: ${_v('osStatus')}`
  });

  const payload = {
    tenantId:    J.tid,
    tipoVeiculo: _v('osTipoVeiculo'),
    clienteId:   _v('osCliente'),
    veiculoId:   _v('osVeiculo'),
    mecId:       _v('osMec') || null,
    mecNome:     J.equipe.find(f => f.id === _v('osMec'))?.nome || null,
    data:        _v('osData'),
    km:          _v('osKm'),
    desc:        _v('osDescricao'),
    diagnostico: _v('osDiagnostico'),
    status:      _v('osStatus'),
    prioridade:  _v('osPrioridade') || 'verde',
    maoObra:     parseFloat(_v('osMaoObra') || 0),
    total:       parseFloat(_v('osTotalHidden') || 0),
    pecas,
    media:       JSON.parse(_v('osMediaArray') || '[]'),
    chkComb:     _v('chkComb'),
    chkPneuDia:  _v('chkPneuDia'),
    chkPneuTra:  _v('chkPneuTra'),
    chkObs:      _v('chkObs'),
    chkPainel:    _chk('chkPainel'),
    chkPressao:   _chk('chkPressao'),
    chkCarroceria:_chk('chkCarroceria'),
    chkDocumentos:_chk('chkDocumentos'),
    timeline:    tl,
    updatedAt:   dtISO(),
    // Registra responsável pela etapa atual
    ..._responsavelPorEtapa(_v('osStatus')),
    respAtendimento: osId ? undefined : J.nome // só na criação
  };

  try {
    if (_v('osStatus') === 'Concluido' && _v('osPgtoForma')) {
      await _processarConclusao(payload, osId);
    }
    if (_v('osProxRev') || _v('osProxKm')) {
      await J.db.collection('agendamentos').add({
        tenantId: J.tid, clienteId: payload.clienteId, veiculoId: payload.veiculoId,
        data: _v('osProxRev') || '', km: _v('osProxKm') || '',
        servico: 'Revisão Programada', status: 'Agendado', createdAt: dtISO()
      });
    }

    const veiculo = J.veiculos.find(v => v.id === payload.veiculoId);
    if (osId) {
      await J.db.collection('ordens_servico').doc(osId).update(payload);
      toastOk('O.S. atualizada!');
      notificarEquipe(`O.S. ${veiculo?.placa || ''} atualizada por ${J.nome}`);
    } else {
      payload.createdAt = dtISO();
      const ref = await J.db.collection('ordens_servico').add(payload);
      toastOk('O.S. criada — #' + ref.id.slice(-6).toUpperCase());
      notificarEquipe(`Nova O.S. ${veiculo?.placa || ''} criada por ${J.nome}`);
    }
    closeModal('modalOS');
    audit('OS', `${osId ? 'Editou' : 'Criou'} O.S. ${payload.veiculoId}`);
  } catch (e) {
    toastErr('Erro: ' + e.message);
  } finally {
    setLoading('btnSalvarOS', false, 'SALVAR O.S.');
  }
};

async function _processarConclusao(payload, osId) {
  const formasPagas = ['Dinheiro','PIX','Débito','Crédito à Vista','Transferência'];
  payload.pgtoForma = _v('osPgtoForma');
  payload.pgtoData  = _v('osPgtoData') || new Date().toISOString().split('T')[0];
  const statusFin   = formasPagas.includes(payload.pgtoForma) ? 'Pago' : 'Pendente';
  const parcelas    = parseInt(_v('osPgtoParcelas') || 1);
  const valorParc   = payload.total / parcelas;
  const veiculo     = J.veiculos.find(v => v.id === payload.veiculoId);
  const cliente     = J.clientes.find(c => c.id === payload.clienteId);
  const batch       = J.db.batch();

  for (let i = 0; i < parcelas; i++) {
    const d = new Date(payload.pgtoData); d.setMonth(d.getMonth() + i);
    batch.set(J.db.collection('financeiro').doc(), {
      tenantId: J.tid, tipo: 'Entrada', status: statusFin,
      desc: `O.S. ${veiculo?.placa||''} — ${cliente?.nome||''} ${parcelas>1?`(${i+1}/${parcelas})`:''}`,
      valor: valorParc, pgto: payload.pgtoForma,
      venc: d.toISOString().split('T')[0], osId: osId || null, createdAt: dtISO()
    });
  }
  for (const p of payload.pecas) {
    if (p.estoqueId) {
      const item = J.estoque.find(x => x.id === p.estoqueId);
      if (item) batch.update(J.db.collection('estoqueItems').doc(p.estoqueId), { qtd: Math.max(0,(item.qtd||0)-p.qtd), updatedAt: dtISO() });
    }
  }
  if (payload.mecId) {
    const mec = J.equipe.find(f => f.id === payload.mecId);
    if (mec && mec.comissao > 0) {
      const valCom = payload.total * (mec.comissao / 100);
      batch.set(J.db.collection('financeiro').doc(), {
        tenantId: J.tid, tipo: 'Saída', status: 'Pendente',
        desc: `Comissão ${mec.nome} — O.S. ${veiculo?.placa||''}`,
        valor: valCom, pgto: 'A Combinar', venc: payload.pgtoData,
        isComissao: true, mecId: payload.mecId, createdAt: dtISO()
      });
    }
  }
  await batch.commit();

  if (cliente?.wpp && window.JARVIS_CONST) {
    const msg = JARVIS_CONST.WPP_MSGS.pronto(cliente.nome, veiculo?.modelo || veiculo?.placa || 'veículo', J.tnome);
    setTimeout(() => {
      if (confirm(`Enviar WhatsApp para ${cliente.nome}?`)) abrirWpp(cliente.wpp, msg);
    }, 600);
  }
}

// ============================================================
// AGENDA
// ============================================================
window.renderAgenda = function() {
  const lista = [...J.agendamentos].sort((a, b) => a.data > b.data ? 1 : -1);
  const hoje  = new Date().toISOString().split('T')[0];
  _sh('tbAgenda', lista.map(a => {
    const c   = J.clientes.find(x => x.id === a.clienteId);
    const v   = J.veiculos.find(x => x.id === a.veiculoId);
    const mec = J.equipe.find(x => x.id === a.mecId);
    const atrasado  = a.data < hoje && a.status === 'Agendado';
    const convertido = a.status === 'Convertido';
    return `<tr style="${atrasado?'background:rgba(244,63,94,0.03)':''}">
      <td style="font-family:var(--ff-mono);font-size:0.8rem">${dtBr(a.data)} ${a.hora||''}</td>
      <td>${c?.nome||'—'}</td>
      <td>${v?`<span class="placa">${v.placa}</span> ${v.modelo}`:' —'}</td>
      <td>${a.servico||'—'}</td>
      <td>${mec?.nome||'—'}</td>
      <td>${atrasado?badgeStatus('Cancelado'):convertido?badgeStatus('Concluido'):badgeStatus('Aguardando')}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepAgenda('edit','${a.id}');openModal('modalAgenda')">✏</button>
        ${!convertido&&pode('criarOS')?`<button class="btn btn-brand btn-sm" style="margin-left:4px" onclick="converterAgendaOS('${a.id}')">→ O.S.</button>`:''}
      </td>
    </tr>`;
  }).join('') || tableEmpty(7, '📅', 'Sem agendamentos'));
};

window.prepAgenda = function(mode, id=null) {
  ['agdId','agdServico'].forEach(f => _sv(f,''));
  _sv('agdData', new Date().toISOString().split('T')[0]);
  _sv('agdHora', '09:00');
  popularSelects();
  if (mode==='edit'&&id) {
    const a=J.agendamentos.find(x=>x.id===id); if(!a) return;
    _sv('agdId',a.id); _sv('agdCliente',a.clienteId||'');
    filtrarVeicsAgenda();
    setTimeout(()=>_sv('agdVeiculo',a.veiculoId||''),80);
    _sv('agdData',a.data||''); _sv('agdHora',a.hora||'');
    _sv('agdServico',a.servico||''); _sv('agdMec',a.mecId||'');
  }
};

window.salvarAgenda = async function() {
  if(!_v('agdCliente')||!_v('agdData')){toastWarn('Cliente e data obrigatórios');return;}
  const p={tenantId:J.tid,clienteId:_v('agdCliente'),veiculoId:_v('agdVeiculo'),
    data:_v('agdData'),hora:_v('agdHora'),servico:_v('agdServico'),
    mecId:_v('agdMec')||null,status:'Agendado',updatedAt:dtISO()};
  const id=_v('agdId');
  if(id) await J.db.collection('agendamentos').doc(id).update(p);
  else{p.createdAt=dtISO();await J.db.collection('agendamentos').add(p);}
  toastOk('Agendamento salvo!'); closeModal('modalAgenda');
  audit('AGENDA',`Agendou ${p.servico} para ${dtBr(p.data)}`);
};

window.converterAgendaOS = async function(agdId) {
  const a=J.agendamentos.find(x=>x.id===agdId); if(!a) return;
  await J.db.collection('agendamentos').doc(agdId).update({status:'Convertido',updatedAt:dtISO()});
  prepOS('add');
  setTimeout(()=>{
    _sv('osCliente',a.clienteId||''); filtrarVeiculosOS();
    setTimeout(()=>_sv('osVeiculo',a.veiculoId||''),80);
    _sv('osDescricao',a.servico||'');
    _sv('osData',a.data||new Date().toISOString().split('T')[0]);
    openModal('modalOS');
  },80);
};

// ============================================================
// AUDITORIA
// ============================================================
window.renderAuditoria = function() {
  _sh('tbAuditoria', J.auditoria.slice(0,200).map(a=>`
    <tr>
      <td style="font-family:var(--ff-mono);font-size:0.7rem;color:var(--text-muted)">${dtHrBr(a.ts)}</td>
      <td><span class="badge badge-brand">${a.modulo||'—'}</span></td>
      <td style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--brand)">${a.usuario||'—'}</td>
      <td><span class="badge badge-neutral" style="font-size:0.5rem">${_roleLabel(a.role||'')}</span></td>
      <td>${a.acao||'—'}</td>
    </tr>
  `).join('')||tableEmpty(5,'🔒','Sem registros de auditoria'));
};

function _roleLabel(role){
  const m={admin:'ADMIN',gestor:'GESTOR',atendente:'ATENDENTE',mecanico:'MECÂNICO',gerente:'GERENTE',cliente:'CLIENTE'};
  return m[role]||(role||'').toUpperCase();
}
