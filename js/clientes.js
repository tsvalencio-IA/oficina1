/**
 * JARVIS ERP — clientes.js / estoque.js / equipe.js
 * CRM, Veículos, Estoque, NF, Fornecedores, Equipe, RH
 * INCLUI: Comissões Duplas (% Peça e % M.O.) e Endereço Completo.
 */

'use strict';

// ============================================================
// CLIENTES
// ============================================================
window.renderClientes = function() {
  _sh('tbClientes', J.clientes.map(c => {
    const nVeics = J.veiculos.filter(v => v.clienteId === c.id).length;
    const totalOS = J.os.filter(o => o.clienteId === c.id && o.status === 'Concluido')
      .reduce((a, o) => a + (o.total || 0), 0);
    return `<tr>
      <td>
        <div style="font-weight:600">${c.nome}</div>
        <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-muted)">${c.doc || ''}</div>
      </td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${c.wpp || '—'}</td>
      <td><span class="badge badge-brand">${nVeics}</span></td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem;color:var(--success)">${moeda(totalOS)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepCliente('edit','${c.id}');openModal('modalCliente')" style="margin-right:4px">✏</button>
        ${c.wpp ? `<button class="btn btn-success btn-sm" onclick="_wppCliente('${c.id}')" style="margin-right:4px" title="WhatsApp">💬</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deletarCliente('${c.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(5, '👥', 'Nenhum cliente cadastrado'));
};

window.prepCliente = function(mode, id = null) {
  ['cliId','cliNome','cliWpp','cliDoc','cliEmail','cliLogin','cliPin','cliCep','cliRua','cliNum','cliBairro','cliCidade'].forEach(f => _sv(f, ''));
  _sv('cliPin', randId(6));

  if (mode === 'edit' && id) {
    const c = J.clientes.find(x => x.id === id);
    if (!c) return;
    _sv('cliId',     c.id);
    _sv('cliNome',  c.nome  || '');
    _sv('cliWpp',   c.wpp   || '');
    _sv('cliDoc',   c.doc   || '');
    _sv('cliEmail', c.email || '');
    _sv('cliLogin', c.login || '');
    _sv('cliPin',   c.pin   || '');
    _sv('cliCep',   c.cep   || '');
    _sv('cliRua',   c.rua   || '');
    _sv('cliNum',   c.num   || '');
    _sv('cliBairro',c.bairro|| '');
    _sv('cliCidade',c.cidade|| '');
  }
};

window.salvarCliente = async function() {
  if (!_v('cliNome')) { toastWarn('Nome é obrigatório'); return; }
  const p = {
    tenantId:  J.tid,
    nome:      _v('cliNome'),
    wpp:       _v('cliWpp'),
    doc:       _v('cliDoc'),
    email:     _v('cliEmail'),
    login:     _v('cliLogin'),
    pin:       _v('cliPin'),
    cep:       _v('cliCep'),
    rua:       _v('cliRua'),
    num:       _v('cliNum'),
    bairro:    _v('cliBairro'),
    cidade:    _v('cliCidade'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('cliId');
  if (id) await J.db.collection('clientes').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('clientes').add(p); }

  toastOk('Cliente salvo!');
  closeModal('modalCliente');
  audit('CLIENTES', `Salvou cliente ${p.nome}`);
};

window.deletarCliente = async function(id) {
  const ok = await confirmar('Deletar este cliente? Esta ação não pode ser desfeita.', 'Atenção');
  if (!ok) return;
  await J.db.collection('clientes').doc(id).delete();
  toastOk('Cliente removido');
  audit('CLIENTES', `Deletou cliente ${id}`);
};

window._wppCliente = function(cid) {
  const c = J.clientes.find(x => x.id === cid);
  if (!c?.wpp) return;
  abrirWpp(c.wpp, `Olá ${c.nome}! Aqui é a ${J.tnome}. 👋`);
};

// ============================================================
// VEÍCULOS
// ============================================================
window.renderVeiculos = function() {
  _sh('tbVeiculos', J.veiculos.map(v => {
    const c = J.clientes.find(x => x.id === v.clienteId);
    return `<tr>
      <td><span class="placa">${v.placa || '—'}</span></td>
      <td>${badgeTipo(v.tipo || 'carro')}</td>
      <td>
        <div style="font-weight:600">${v.modelo || '—'}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${v.ano || ''} ${v.cor ? '· ' + v.cor : ''}</div>
      </td>
      <td>${c?.nome || '—'}</td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${v.km ? Number(v.km).toLocaleString('pt-BR') + ' km' : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepVeiculo('edit','${v.id}');openModal('modalVeiculo')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarVeiculo('${v.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(6, '🚗', 'Nenhum veículo cadastrado'));
};

window.prepVeiculo = function(mode, id = null) {
  ['veicId','veicPlaca','veicModelo','veicAno','veicCor','veicKm','veicObs'].forEach(f => _sv(f, ''));
  _sv('veicTipo', 'carro');
  popularSelects();

  if (mode === 'edit' && id) {
    const v = J.veiculos.find(x => x.id === id);
    if (!v) return;
    _sv('veicId',     v.id);
    _sv('veicTipo',   v.tipo      || 'carro');
    _sv('veicDono',   v.clienteId || '');
    _sv('veicPlaca',  v.placa     || '');
    _sv('veicModelo', v.modelo    || '');
    _sv('veicAno',    v.ano       || '');
    _sv('veicCor',    v.cor       || '');
    _sv('veicKm',     v.km        || '');
    _sv('veicObs',    v.obs       || '');
  }
};

window.salvarVeiculo = async function() {
  if (!_v('veicPlaca') || !_v('veicModelo')) {
    toastWarn('Placa e modelo são obrigatórios');
    return;
  }
  const p = {
    tenantId:  J.tid,
    tipo:      _v('veicTipo'),
    clienteId: _v('veicDono'),
    placa:     _v('veicPlaca').toUpperCase().replace(/\s/g, ''),
    modelo:    _v('veicModelo'),
    ano:       _v('veicAno'),
    cor:       _v('veicCor'),
    km:        _v('veicKm'),
    obs:       _v('veicObs'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('veicId');
  if (id) await J.db.collection('veiculos').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('veiculos').add(p); }

  toastOk('Veículo salvo!');
  closeModal('modalVeiculo');
  audit('VEÍCULOS', `Salvou veículo ${p.placa}`);
};

window.deletarVeiculo = async function(id) {
  const ok = await confirmar('Deletar este veículo?');
  if (!ok) return;
  await J.db.collection('veiculos').doc(id).delete();
  toastOk('Veículo removido');
};

// ============================================================
// ESTOQUE
// ============================================================
window.renderEstoque = function() {
  _sh('tbEstoque', J.estoque.map(p => {
    const crit = (p.qtd || 0) <= (p.min || 0);
    const margem = p.custo > 0 ? (((p.venda - p.custo) / p.custo) * 100).toFixed(0) : 0;
    return `<tr class="${crit ? 'row-critical' : ''}">
      <td style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--text-muted)">${p.codigo || '—'}</td>
      <td>
        <div style="font-weight:600">${p.desc}</div>
        <div style="font-size:0.68rem;color:var(--text-muted)">${p.und || 'UN'}</div>
      </td>
      <td style="font-family:var(--ff-mono)">${moeda(p.custo)}</td>
      <td style="font-family:var(--ff-mono);color:var(--success)">${moeda(p.venda)}</td>
      <td>
        <span style="font-family:var(--ff-mono);font-size:0.75rem;color:${margem >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${margem}%
        </span>
      </td>
      <td style="font-family:var(--ff-mono);font-weight:700;color:${crit ? 'var(--danger)' : 'var(--text-primary)'}">${p.qtd || 0}</td>
      <td style="font-family:var(--ff-mono);color:var(--text-muted)">${p.min || 0}</td>
      <td>${crit ? badgeStatus('Cancelado') : badgeStatus('Concluido')}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepPeca('edit','${p.id}');openModal('modalPeca')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarPeca('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(9, '📦', 'Nenhum item no estoque'));
};

window.prepPeca = function(mode, id = null) {
  ['pecaId','pecaCodigo','pecaDesc','pecaCusto','pecaVenda','pecaQtd','pecaMin'].forEach(f => _sv(f, ''));
  _sv('pecaUnd', 'UN');
  _st('pecaMargem', '—');

  if (mode === 'edit' && id) {
    const p = J.estoque.find(x => x.id === id);
    if (!p) return;
    _sv('pecaId',     p.id);
    _sv('pecaCodigo', p.codigo || '');
    _sv('pecaDesc',   p.desc   || '');
    _sv('pecaCusto',  p.custo  || 0);
    _sv('pecaVenda',  p.venda  || 0);
    _sv('pecaQtd',    p.qtd    || 0);
    _sv('pecaMin',    p.min    || 0);
    _sv('pecaUnd',    p.und    || 'UN');
    calcMargem();
  }
};

window.calcMargem = function() {
  const c = parseFloat(_v('pecaCusto') || 0);
  const v = parseFloat(_v('pecaVenda') || 0);
  const el = _$('pecaMargem');
  if (!el) return;
  if (c > 0 && v > 0) {
    const m = ((v - c) / c * 100).toFixed(1);
    el.textContent = `${m}% de margem`;
    el.style.color = parseFloat(m) >= 0 ? 'var(--success)' : 'var(--danger)';
  } else {
    el.textContent = '—';
    el.style.color = 'var(--text-muted)';
  }
};

window.salvarPeca = async function() {
  if (!_v('pecaDesc')) { toastWarn('Descrição é obrigatória'); return; }
  const p = {
    tenantId:  J.tid,
    codigo:    _v('pecaCodigo'),
    desc:      _v('pecaDesc'),
    custo:     parseFloat(_v('pecaCusto') || 0),
    venda:     parseFloat(_v('pecaVenda') || 0),
    qtd:       parseInt(_v('pecaQtd')    || 0),
    min:       parseInt(_v('pecaMin')    || 0),
    und:       _v('pecaUnd'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('pecaId');
  if (id) await J.db.collection('estoqueItems').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('estoqueItems').add(p); }

  toastOk('Peça salva!');
  closeModal('modalPeca');
  audit('ESTOQUE', `Salvou peça ${p.desc}`);
};

window.deletarPeca = async function(id) {
  const ok = await confirmar('Deletar esta peça do estoque?');
  if (!ok) return;
  await J.db.collection('estoqueItems').doc(id).delete();
  toastOk('Peça removida');
};

// ============================================================
// FORNECEDORES
// ============================================================
window.renderFornecedores = function() {
  _sh('tbFornec', J.fornecedores.map(f => `
    <tr>
      <td><div style="font-weight:600">${f.nome}</div></td>
      <td style="font-size:0.78rem;color:var(--text-secondary)">${f.segmento || '—'}</td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${f.wpp || '—'}</td>
      <td style="white-space:nowrap">
        ${f.wpp ? `<button class="btn btn-success btn-sm" onclick="abrirWpp('${f.wpp}','')" style="margin-right:4px">💬</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="prepFornec('edit','${f.id}');openModal('modalFornec')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarFornec('${f.id}')">🗑</button>
      </td>
    </tr>
  `).join('') || tableEmpty(4, '🏭', 'Nenhum fornecedor cadastrado'));
};

window.prepFornec = function(mode = 'add', id = null) {
  ['fornecId','fornecNome','fornecSeg','fornecWpp','fornecEmail'].forEach(f => _sv(f, ''));
  if (mode === 'edit' && id) {
    const f = J.fornecedores.find(x => x.id === id);
    if (!f) return;
    _sv('fornecId',    f.id);
    _sv('fornecNome',  f.nome      || '');
    _sv('fornecSeg',   f.segmento  || '');
    _sv('fornecWpp',   f.wpp       || '');
    _sv('fornecEmail', f.email     || '');
  }
};

window.salvarFornec = async function() {
  if (!_v('fornecNome')) { toastWarn('Nome é obrigatório'); return; }
  const p = {
    tenantId:  J.tid,
    nome:      _v('fornecNome'),
    segmento:  _v('fornecSeg'),
    wpp:       _v('fornecWpp'),
    email:     _v('fornecEmail'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('fornecId');
  if (id) await J.db.collection('fornecedores').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('fornecedores').add(p); }

  toastOk('Fornecedor salvo!');
  closeModal('modalFornec');
};

window.deletarFornec = async function(id) {
  const ok = await confirmar('Deletar este fornecedor?');
  if (!ok) return;
  await J.db.collection('fornecedores').doc(id).delete();
  toastOk('Fornecedor removido');
};

// ============================================================
// EQUIPE / RH
// ============================================================
window.renderEquipe = function() {
  _sh('tbEquipe', J.equipe.map(f => `
    <tr>
      <td>
        <div style="font-weight:600">${f.nome}</div>
        <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-muted)">${f.wpp || ''}</div>
      </td>
      <td><span class="badge badge-brand">${JARVIS_CONST.CARGOS[f.cargo] || f.cargo}</span></td>
      <td style="font-family:var(--ff-mono);font-size:0.75rem;color:var(--text-secondary)">${f.usuario}</td>
      <td>
        <span style="font-family:var(--ff-mono);font-size:0.82rem;font-weight:700;color:var(--success)">
          ${f.comissaoPecas || 0}% / ${f.comissaoMO || 0}%
        </span>
      </td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepFunc('edit','${f.id}');openModal('modalFunc')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarFunc('${f.id}')">🗑</button>
      </td>
    </tr>
  `).join('') || tableEmpty(5, '👷', 'Nenhum colaborador cadastrado'));
};

window.prepFunc = function(mode, id = null) {
  ['funcId','funcNome','funcWpp','funcComissaoPecas','funcComissaoMO','funcUser','funcPass'].forEach(f => _sv(f, ''));
  _sv('funcCargo', 'mecanico');
  if (mode === 'edit' && id) {
    const f = J.equipe.find(x => x.id === id);
    if (!f) return;
    _sv('funcId',       f.id);
    _sv('funcNome',     f.nome      || '');
    _sv('funcWpp',      f.wpp       || '');
    _sv('funcCargo',    f.cargo     || 'mecanico');
    _sv('funcComissaoPecas', f.comissaoPecas  || 0);
    _sv('funcComissaoMO',    f.comissaoMO     || 0);
    _sv('funcUser',     f.usuario   || '');
    _sv('funcPass',     f.senha     || '');
  }
};

window.salvarFunc = async function() {
  if (!_v('funcNome') || !_v('funcUser') || !_v('funcPass')) {
    toastWarn('Preencha nome, usuário e senha');
    return;
  }
  const p = {
    tenantId:  J.tid,
    nome:      _v('funcNome'),
    wpp:       _v('funcWpp'),
    cargo:     _v('funcCargo'),
    comissaoPecas:  parseFloat(_v('funcComissaoPecas') || 0),
    comissaoMO:     parseFloat(_v('funcComissaoMO') || 0),
    usuario:   _v('funcUser'),
    senha:     _v('funcPass'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('funcId');
  if (id) await J.db.collection('funcionarios').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('funcionarios').add(p); }

  toastOk('Colaborador salvo!');
  closeModal('modalFunc');
  audit('EQUIPE', `Salvou colaborador ${p.nome}`);
};

window.deletarFunc = async function(id) {
  const ok = await confirmar('Remover este colaborador? O acesso será revogado imediatamente.', 'Atenção');
  if (!ok) return;
  await J.db.collection('funcionarios').doc(id).delete();
  toastOk('Colaborador removido');
  audit('EQUIPE', `Removeu colaborador ${id}`);
};
