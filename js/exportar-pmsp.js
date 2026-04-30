(function() {
  'use strict';

  const TEMPLATE_URL = 'assets/templates/I-30003_PLANILHA_DE_CUSTOS.xlsx';
  const SERV_START = 19;
  const SERV_END = 74;
  const PECA_START = 77;
  const PECA_END = 122;

  const U = () => window.JarvisOSUtils || window.JOS || {};
  const n = value => U().parseNumberBR ? U().parseNumberBR(value) : (parseFloat(String(value || 0).replace(',', '.')) || 0);

  function setCell(ws, addr, value, opts = {}) {
    const cell = ws[addr] || {};
    delete cell.f;
    cell.v = value == null ? '' : value;
    cell.t = typeof cell.v === 'number' ? 'n' : 's';
    if (opts.formula) {
      cell.f = opts.formula;
      cell.t = 'n';
    }
    ws[addr] = cell;
  }

  function clearRow(ws, row, cols) {
    cols.forEach(col => setCell(ws, col + row, ''));
  }

  function dataExtenso(cidade) {
    const hoje = new Date();
    const meses = ['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    return `${(cidade || 'SAO PAULO').toUpperCase()}, ${hoje.getDate()} DE ${meses[hoje.getMonth()]} DE ${hoje.getFullYear()}.`;
  }

  function oesNumero(cli, os) {
    const modelo = cli.govOesModelo || 'ORC ###/2026';
    return modelo.replace(/###/g, String(os.id || '').slice(-3).toUpperCase());
  }

  window.exportarOrcamentoPMSP = async function() {
    try {
      if (typeof XLSX === 'undefined') {
        window.toast?.('Biblioteca XLSX nao carregou. Recarregue a pagina.', 'err');
        return;
      }

    const osId = document.getElementById('osId')?.value;
    if (!osId) {
      window.toast?.('Salve a O.S. antes de exportar.', 'warn');
      return;
    }

    const os = (window.J?.os || []).find(o => o.id === osId);
    if (!os) {
      window.toast?.('O.S. nao encontrada.', 'err');
      return;
    }

    const cli = (window.J?.clientes || []).find(c => c.id === os.clienteId);
    if (!cli || cli.tipoCliente !== 'governo') {
      window.toast?.('Esta exportacao e exclusiva para clientes governamentais.', 'err');
      return;
    }

    const veiculo = (window.J?.veiculos || []).find(v => v.id === os.veiculoId) || {};
    const tenant = window.J || {};
    const resp = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Modelo PMSP nao encontrado: ' + TEMPLATE_URL);
    const buffer = await resp.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellStyles: true, cellNF: true, cellFormula: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    const cabecalho = (cli.govCabecalho || '').trim() || 'SECRETARIA DA SEGURANCA PUBLICA\nPOLICIA MILITAR DO ESTADO DE SAO PAULO';
    setCell(ws, 'B1', cabecalho);
    setCell(ws, 'A3', `REFERENCIA: ORDEM E EXECUCAO DE SERVICOS No ${oesNumero(cli, os)}`);
    setCell(ws, 'A5', `MARCA: ${(veiculo.marca || '').toUpperCase()}`);
    setCell(ws, 'C5', `MODELO: ${(veiculo.modelo || '').toUpperCase()}`);
    setCell(ws, 'E5', `ANO: ${veiculo.ano || ''}`);
    setCell(ws, 'G5', `PLACA: ${(veiculo.placa || os.placa || '').toUpperCase()}`);
    setCell(ws, 'A6', `CHASSIS: ${(veiculo.chassis || '').toUpperCase()}`);
    setCell(ws, 'D6', `PATRIMONIO: ${veiculo.patrimonio || ''}`);
    setCell(ws, 'A7', `KM: ${os.km || veiculo.km || ''}`);
    setCell(ws, 'C7', `PREFIXO: ${(veiculo.prefixo || '').toUpperCase()}`);
    setCell(ws, 'E7', `OPM DETENTORA: ${cli.govUnidade || cli.nome || ''}`);
    setCell(ws, 'A9', `RAZAO SOCIAL : ${tenant.tnome || ''}`);
    setCell(ws, 'E9', `CNPJ: ${tenant.cnpj || ''}`);
    setCell(ws, 'A10', `ENDERECO: ${tenant.endereco || ''}`);
    setCell(ws, 'A11', `TELEFONE: ${tenant.telefone || ''}`);
    setCell(ws, 'D11', `ORCAMENTISTA: ${tenant.orcamentista || tenant.nome || ''}`);
    setCell(ws, 'A12', `REPRESENTANTE LEGAL: ${tenant.representante || tenant.nome || ''}`);
    setCell(ws, 'A14', `UNIDADE : ${cli.govUnidade || cli.nome || ''}`);
    setCell(ws, 'E14', `CNPJ: ${cli.doc || ''}`);
    setCell(ws, 'A15', `ENDERECO: ${[cli.rua, cli.num, cli.bairro, cli.cidade].filter(Boolean).join(', ')}`);
    setCell(ws, 'A17', `FISCAL DO CONTRATO: ${cli.govFiscal || ''}`);

    const servicos = (os.servicos || []).filter(s => s.desc || s.valor || s.tempo);
    const pecas = (os.pecas || []).filter(p => p.desc || p.codigo);
    const descMO = n(os.descMO != null ? os.descMO : cli.govDescMO);
    const descPeca = n(os.descPeca != null ? os.descPeca : cli.govDescPeca);
    const valorHoraCliente = n(cli.govValorHora || 0);

    for (let r = SERV_START; r <= SERV_END; r++) clearRow(ws, r, ['B','D','E','F','G','H']);
    let totalTMO = 0;
    let totalMO = 0;
    servicos.slice(0, SERV_END - SERV_START + 1).forEach((s, idx) => {
      const r = SERV_START + idx;
      const tempo = n(s.tempo || 0);
      const valorBrutoServico = n(s.valor || 0);
      const resolvido = U().resolvePMSPServico ? U().resolvePMSPServico(s, { veiculo, fallbackValorHora: valorHoraCliente }) : {};
      const valorHora = n(s.valorHora || s.valorHoraSecao || resolvido.valorHora || 0) ||
        (tempo > 0 && valorBrutoServico > 0 ? +(valorBrutoServico / tempo).toFixed(2) : 0) ||
        valorHoraCliente;
      const sistemaServico = resolvido.secaoHoraLabel || s.secaoHoraLabel || s.sistemaTabela || s.sistema || '';
      const totalFinal = +(valorHora * tempo * (1 - descMO)).toFixed(2);
      totalTMO += tempo;
      totalMO += totalFinal;
      setCell(ws, 'B' + r, sistemaServico);
      setCell(ws, 'D' + r, s.desc || '');
      setCell(ws, 'E' + r, tempo);
      setCell(ws, 'F' + r, valorHora);
      setCell(ws, 'G' + r, descMO);
      setCell(ws, 'H' + r, totalFinal, { formula: `SUM(F${r}*(1-G${r}))*E${r}` });
    });
    setCell(ws, 'E75', +totalTMO.toFixed(2), { formula: `SUM(E${SERV_START}:E${SERV_END})` });
    setCell(ws, 'H75', +totalMO.toFixed(2), { formula: `SUM(H${SERV_START}:H${SERV_END})` });

    for (let r = PECA_START; r <= PECA_END; r++) clearRow(ws, r, ['B','D','E','F','G','H']);
    let totalPecas = 0;
    pecas.slice(0, PECA_END - PECA_START + 1).forEach((p, idx) => {
      const r = PECA_START + idx;
      const qtd = n(p.qtd || p.q || 1) || 1;
      const valorUnit = n(p.venda || p.valor || p.v);
      const totalFinal = +(qtd * valorUnit * (1 - descPeca)).toFixed(2);
      totalPecas += totalFinal;
      setCell(ws, 'B' + r, p.codigo || p.cod || 'sem oem');
      setCell(ws, 'D' + r, p.desc || p.descricao || '');
      setCell(ws, 'E' + r, qtd);
      setCell(ws, 'F' + r, valorUnit);
      setCell(ws, 'G' + r, descPeca);
      setCell(ws, 'H' + r, totalFinal, { formula: `(F${r}*(1-G${r}))*E${r}` });
    });
    setCell(ws, 'H123', +totalPecas.toFixed(2), { formula: `SUM(H${PECA_START}:H${PECA_END})` });

    const transporte = n(os.transporteKm || 0);
    const contrato = +(totalPecas + totalMO + transporte).toFixed(2);
    setCell(ws, 'G126', +totalPecas.toFixed(2), { formula: 'H123' });
    setCell(ws, 'G127', +totalMO.toFixed(2), { formula: 'H75' });
    setCell(ws, 'G128', contrato, { formula: 'SUM(G126:G127)' });
    setCell(ws, 'G129', contrato, { formula: 'G128' });
    setCell(ws, 'A130', dataExtenso(cli.cidade || tenant.cidade));
    setCell(ws, 'A134', String(tenant.representante || tenant.nome || '').toUpperCase());

    if (servicos.length > SERV_END - SERV_START + 1 || pecas.length > PECA_END - PECA_START + 1) {
      const overflow = [['TIPO','CODIGO','DESCRICAO','QTD/TMO','VALOR']];
      servicos.slice(SERV_END - SERV_START + 1).forEach(s => overflow.push(['SERVICO', s.codigoTabela || '', s.desc || '', n(s.tempo || 0), n(s.valor || 0)]));
      pecas.slice(PECA_END - PECA_START + 1).forEach(p => overflow.push(['PECA', p.codigo || '', p.desc || '', n(p.qtd || 1), n(p.venda || 0)]));
      const wsOverflow = XLSX.utils.aoa_to_sheet(overflow);
      XLSX.utils.book_append_sheet(wb, wsOverflow, 'Itens excedentes');
      window.toast?.('A planilha excedeu o espaco do modelo; itens extras foram adicionados em aba separada.', 'warn');
    }

    const fname = `${(veiculo.prefixo || os.id.slice(-6).toUpperCase())}_PLANILHA_DE_CUSTOS.xlsx`;
    XLSX.writeFile(wb, fname, { bookType: 'xlsx', cellStyles: true });
      window.toast?.(`Orcamento PMSP exportado: ${fname}`, 'ok');
    } catch (e) {
      console.error('[PMSP XLSX]', e);
      window.toast?.('Erro ao exportar PMSP: ' + e.message, 'err');
    }
  };
})();
