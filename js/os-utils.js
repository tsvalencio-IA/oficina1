(function() {
  'use strict';

  const U = {};

  U.escapeHtml = function(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  };

  U.normalizeText = function(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  U.normalizePlate = function(value) {
    return String(value == null ? '' : value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  U.parseNumberBR = function(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    let s = String(value == null ? '' : value).trim();
    if (!s) return 0;
    s = s.replace(/\s/g, '').replace(/R\$/gi, '').replace(/%/g, '');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      s = s.replace(',', '.');
    }
    s = s.replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  U.formatInputMoney = function(value) {
    const n = U.parseNumberBR(value);
    return n ? n.toFixed(2).replace('.', ',') : '0,00';
  };

  U.moeda = function(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(U.parseNumberBR(value));
  };

  U.getCliente = function(os, clientes, fallbackCliente) {
    if (fallbackCliente) return fallbackCliente;
    return (clientes || []).find(c => c.id === os?.clienteId) || null;
  };

  U.getValorHoraCliente = function(cliente, fallback) {
    return U.parseNumberBR(cliente?.govValorHora || cliente?.valorHora || fallback || 0);
  };

  U.PMSP_VALORES_HORA = [
    { key: 'mecanica_eletrica_otto', grupo: 'mecanica_eletrica', porte: 'otto', label: 'MECANICA E ELETRICA GERAL EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 152.25 },
    { key: 'mecanica_eletrica_diesel', grupo: 'mecanica_eletrica', porte: 'diesel', label: 'MECANICA E ELETRICA GERAL EM VEICULOS MEDIOS A DIESEL', valor: 188.02 },
    { key: 'mecanica_eletrica_pesado', grupo: 'mecanica_eletrica', porte: 'pesado', label: 'MECANICA E ELETRICA GERAL EM ONIBUS E CAMINHOES', valor: 227.00 },
    { key: 'injecao_otto', grupo: 'injecao', porte: 'otto', label: 'INJECAO EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 166.36 },
    { key: 'injecao_diesel', grupo: 'injecao', porte: 'diesel', label: 'INJECAO EM VEICULOS MEDIOS A DIESEL', valor: 222.03 },
    { key: 'injecao_pesado', grupo: 'injecao', porte: 'pesado', label: 'INJECAO EM ONIBUS E CAMINHOES', valor: 252.00 },
    { key: 'retifica_ajuste_otto', grupo: 'retifica_ajuste', porte: 'otto', label: 'RETIFICA (AJUSTE E MONTAGEM) EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 159.25 },
    { key: 'retifica_ajuste_diesel', grupo: 'retifica_ajuste', porte: 'diesel', label: 'RETIFICA (AJUSTE E MONTAGEM) EM VEICULOS MEDIOS A DIESEL', valor: 235.65 },
    { key: 'retifica_ajuste_pesado', grupo: 'retifica_ajuste', porte: 'pesado', label: 'RETIFICA (AJUSTE E MONTAGEM) EM ONIBUS E CAMINHOES', valor: 249.46 },
    { key: 'retifica_usinagem_otto', grupo: 'retifica_usinagem', porte: 'otto', label: 'RETIFICA (USINAGEM) EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 157.96 },
    { key: 'retifica_usinagem_diesel', grupo: 'retifica_usinagem', porte: 'diesel', label: 'RETIFICA (USINAGEM) EM VEICULOS MEDIOS A DIESEL', valor: 195.52 },
    { key: 'retifica_usinagem_pesado', grupo: 'retifica_usinagem', porte: 'pesado', label: 'RETIFICA (USINAGEM) EM ONIBUS E CAMINHOES', valor: 236.58 },
    { key: 'cambio_leve', grupo: 'cambio', porte: 'leve', label: 'CAMBIO EM VEICULOS PEQUENOS E MEDIOS', valor: 196.07 },
    { key: 'cambio_pesado', grupo: 'cambio', porte: 'pesado', label: 'CAMBIO EM ONIBUS E CAMINHOES', valor: 263.05 },
    { key: 'capotaria_leve', grupo: 'capotaria', porte: 'leve', label: 'CAPOTARIA EM VEICULOS PEQUENOS E MEDIOS', valor: 160.26 },
    { key: 'capotaria_pesado', grupo: 'capotaria', porte: 'pesado', label: 'CAPOTARIA EM VEICULOS ONIBUS E CAMINHOES', valor: 245.38 },
    { key: 'funilaria_pintura_leve', grupo: 'funilaria_pintura', porte: 'leve', label: 'FUNILARIA, LANTERNAGEM E PINTURA EM VEICULOS PEQUENOS E MEDIOS', valor: 166.31 },
    { key: 'funilaria_pintura_pesado', grupo: 'funilaria_pintura', porte: 'pesado', label: 'FUNILARIA, LANTERNAGEM E PINTURA EM ONIBUS E CAMINHAO', valor: 267.32 },
    { key: 'borracharia_leve', grupo: 'borracharia', porte: 'leve', label: 'BORRACHARIA EM VEICULOS PEQUENOS E MEDIOS', valor: 105.38 },
    { key: 'borracharia_pesado', grupo: 'borracharia', porte: 'pesado', label: 'BORRACHARIA EM ONIBUS E CAMINHOES', valor: 177.36 },
    { key: 'lavagem_leve', grupo: 'lavagem', porte: 'leve', label: 'LAVAGEM EM VEICULOS PEQUENOS E MEDIOS', valor: 129.47 },
    { key: 'lavagem_pesado', grupo: 'lavagem', porte: 'pesado', label: 'LAVAGEM EM ONIBUS E CAMINHAO', valor: 193.31 },
    { key: 'polimento_leve', grupo: 'polimento', porte: 'leve', label: 'POLIMENTO EM VEICULOS PEQUENOS E MEDIOS', valor: 160.91 },
    { key: 'polimento_pesado', grupo: 'polimento', porte: 'pesado', label: 'POLIMENTO EM ONIBUS E CAMINHAO', valor: 240.26 }
  ];

  U.getPMSPValorHora = function(key) {
    return U.PMSP_VALORES_HORA.find(item => item.key === key) || null;
  };

  U.getPMSPValoresHora = function() {
    return U.PMSP_VALORES_HORA.slice();
  };

  U.getPMSPPorteVeiculo = function(veiculo) {
    const text = U.normalizeText([
      veiculo?.tipo,
      veiculo?.marca,
      veiculo?.modelo,
      veiculo?.combustivel,
      veiculo?.obs
    ].filter(Boolean).join(' '));
    if (/\b(onibus|microonibus|caminhao|caminhoes|truck|carreta|semi reboque|van pesada)\b/.test(text)) return 'pesado';
    if (/\b(diesel|trailblazer|s10|hilux|ranger|amarok|frontier|l200|ducato|sprinter|master|daily|hr|bongo|vito)\b/.test(text)) return 'diesel';
    return 'otto';
  };

  function rateForGroup(grupo, porte) {
    const p = porte || 'otto';
    const isPesado = p === 'pesado';
    if (['cambio', 'capotaria', 'funilaria_pintura', 'borracharia', 'lavagem', 'polimento'].includes(grupo)) {
      return U.PMSP_VALORES_HORA.find(item => item.grupo === grupo && item.porte === (isPesado ? 'pesado' : 'leve')) || null;
    }
    return U.PMSP_VALORES_HORA.find(item => item.grupo === grupo && item.porte === p) ||
      U.PMSP_VALORES_HORA.find(item => item.grupo === grupo && item.porte === 'otto') ||
      null;
  }

  U.inferPMSPValorHora = function(input, options) {
    const opts = options || {};
    const veiculo = opts.veiculo || input?.veiculo || {};
    const porte = opts.porte || U.getPMSPPorteVeiculo(veiculo);
    const text = U.normalizeText([
      input?.secaoHoraLabel,
      input?.sistemaTabela,
      input?.sistema,
      input?.operacao,
      input?.item,
      input?.desc,
      input?.descricao
    ].filter(Boolean).join(' '));
    if (!text) return null;

    const stored = U.getPMSPValorHora(input?.secaoHora || input?.secaoHoraKey || input?.valorHoraKey || '');
    if (stored) return { ...stored, origem: 'selecionado' };

    let grupo = '';
    if (/\b(retifica|retific)\b/.test(text)) grupo = /\b(usinagem|usinar|torno|plainar)\b/.test(text) ? 'retifica_usinagem' : 'retifica_ajuste';
    else if (/\b(cambio|caixa de marcha|transmissao|embreagem)\b/.test(text)) grupo = 'cambio';
    else if (/\b(capotaria|tape[c]?aria|tapecaria|banco|assento|encosto|forro|estof)\b/.test(text)) grupo = 'capotaria';
    else if (/\b(funilaria|lanternagem|pintura|pintar|para choque|parachoque|lataria)\b/.test(text)) grupo = 'funilaria_pintura';
    else if (/\b(borracharia|pneu|pneus|roda|rodas|calota|balanceamento)\b/.test(text)) grupo = 'borracharia';
    else if (/\b(lavagem|lavar|higienizacao|higienizar|limpeza interna|limpeza externa)\b/.test(text)) grupo = 'lavagem';
    else if (/\b(polimento|polir|cristalizacao|cristalizar)\b/.test(text)) grupo = 'polimento';
    else if (/\b(injecao|injetor|bico|bicos|alimentacao|combustivel|bomba de combustivel|tanque|carburador)\b/.test(text)) grupo = 'injecao';
    else if (/\b(mecanica|eletrica|eletrico|freio|suspensao|amortec|direcao|arrefecimento|radiador|motor|correia|oleo|filtro|vela|farol|lampada|bateria|alternador|compressor|ar condicionado|climatizacao)\b/.test(text)) grupo = 'mecanica_eletrica';

    const rate = grupo ? rateForGroup(grupo, porte) : null;
    return rate ? { ...rate, origem: 'inferido', porte } : null;
  };

  U.resolvePMSPServico = function(servico, options) {
    const opts = options || {};
    const tempo = U.parseNumberBR(servico?.tempo || 0);
    const valorServico = U.parseNumberBR(servico?.valor || 0);
    const escolhido = U.getPMSPValorHora(servico?.secaoHora || servico?.secaoHoraKey || '');
    const inferido = escolhido || U.inferPMSPValorHora(servico, opts);
    const valorHoraInformado = U.parseNumberBR(servico?.valorHora || servico?.valorHoraSecao || servico?.precoHora || 0);
    const valorHoraDerivado = tempo > 0 && valorServico > 0 ? +(valorServico / tempo).toFixed(2) : 0;
    const valorHora = valorHoraInformado || inferido?.valor || valorHoraDerivado || U.parseNumberBR(opts.fallbackValorHora || 0);
    const secaoHora = servico?.secaoHora || inferido?.key || '';
    const secaoHoraLabel = servico?.secaoHoraLabel || inferido?.label || servico?.sistemaTabela || servico?.sistema || '';
    return {
      secaoHora,
      secaoHoraLabel,
      valorHora,
      valorHoraTabela: inferido?.valor || 0,
      valorHoraOrigem: servico?.secaoHora ? 'selecionado' : (inferido?.origem || (valorHoraInformado ? 'manual' : 'fallback'))
    };
  };

  U.getDescontosCliente = function(cliente, os) {
    const descMO = os?.descMO != null ? U.parseNumberBR(os.descMO) : U.parseNumberBR(cliente?.govDescMO || 0);
    const descPeca = os?.descPeca != null ? U.parseNumberBR(os.descPeca) : U.parseNumberBR(cliente?.govDescPeca || 0);
    return { descMO, descPeca };
  };

  U.getVehicle = function(os, veiculos) {
    return (veiculos || []).find(v => v.id === os?.veiculoId) || {};
  };

  U.buildBudgetItems = function(os, cliente) {
    const descontos = U.getDescontosCliente(cliente, os);
    const servicos = (os?.servicos || []).map((s, index) => {
      const valorUnit = U.parseNumberBR(s.valor);
      const qtd = 1;
      const bruto = +(valorUnit * qtd).toFixed(2);
      const final = +(bruto * (1 - descontos.descMO)).toFixed(2);
      return {
        key: 'servico-' + index,
        tipo: 'servico',
        labelTipo: 'Servico',
        index,
        codigo: s.codigoTabela || s.codigo || '',
        sistema: s.secaoHoraLabel || s.sistemaTabela || s.sistema || '',
        desc: s.desc || '',
        tempo: U.parseNumberBR(s.tempo),
        qtd,
        valorUnit,
        valorHora: U.parseNumberBR(s.valorHora || 0) || (U.parseNumberBR(s.tempo) > 0 ? +(valorUnit / U.parseNumberBR(s.tempo)).toFixed(2) : 0),
        valorBruto: bruto,
        valorFinal: final
      };
    });
    const pecas = (os?.pecas || []).map((p, index) => {
      const qtd = U.parseNumberBR(p.qtd || p.q || 1) || 1;
      const valorUnit = U.parseNumberBR(p.venda || p.valor || p.v);
      const bruto = +(qtd * valorUnit).toFixed(2);
      const final = +(bruto * (1 - descontos.descPeca)).toFixed(2);
      return {
        key: 'peca-' + index,
        tipo: 'peca',
        labelTipo: 'Peca',
        index,
        codigo: p.codigo || p.cod || '',
        sistema: p.sistemaTabela || p.sistema || '',
        desc: p.desc || p.descricao || '',
        tempo: 0,
        qtd,
        valorUnit,
        valorBruto: bruto,
        valorFinal: final
      };
    });
    return servicos.concat(pecas).filter(it => it.desc || it.codigo || it.valorBruto > 0);
  };

  U.getApprovedKeys = function(os) {
    const keys = new Set();
    const fromApproval = os?.aprovacao?.itens || os?.itensAprovados || [];
    fromApproval.forEach(item => {
      if (typeof item === 'string') keys.add(item);
      else if (item?.key) keys.add(item.key);
    });
    return keys;
  };

  U.hasApproval = function(os) {
    return !!((os?.aprovacao && Array.isArray(os.aprovacao.itens)) || Array.isArray(os?.itensAprovados));
  };

  U.splitCiliaTokens = function(textOrTokens) {
    if (Array.isArray(textOrTokens)) return textOrTokens.map(t => String(t || '').trim()).filter(Boolean);
    return String(textOrTokens || '')
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);
  };

  function isCodigoMarker(t) {
    return /^c.?d[:.]?$/i.test(U.normalizeText(t).replace(/\s/g, ''));
  }

  function isMoneyToken(t) {
    return /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(String(t || '')) || /^-?\d+,\d{2}$/.test(String(t || ''));
  }

  function extractCiliaPrices(text) {
    const s = String(text || '');
    const money = Array.from(s.matchAll(/R\$\s*([\d.]+,\d{2}|\d+,\d{2}|\d+\.\d{2})/gi)).map(m => m[1]);
    const desconto = s.match(/%\s*([\d.,]+)/);
    return {
      bruto: U.parseNumberBR(money[0] || 0),
      liquido: U.parseNumberBR(money.length > 1 ? money[money.length - 1] : 0),
      desconto: U.parseNumberBR(desconto?.[1] || 0)
    };
  }

  function cleanCiliaCode(value) {
    const code = String(value || '').trim();
    const n = U.normalizeText(code);
    if (!code || /^-+$/.test(code)) return '';
    if (/^(oficina|seguradora|fornecedor|cliente)$/i.test(n)) return '';
    return code;
  }

  function stripCiliaSummaryTail(text) {
    return String(text || '')
      .replace(/\bTotal\s+Pe.{0,3}as:?[\s\S]*$/i, '')
      .replace(/\bTotal\s+Geral:?[\s\S]*$/i, '')
      .trim();
  }

  function isNumericToken(t) {
    return /^\d+(?:[,.]\d+)?$/.test(String(t || ''));
  }

  function isCiliaSummaryOrServiceBoundary(line) {
    const n = U.normalizeText(line);
    const loose = n.replace(/\?/g, 'c');
    return loose.includes('total pecas') ||
      loose.includes('total geral') ||
      loose.includes('subtotal') ||
      loose.includes('mao de obra do orcamento') ||
      loose.includes('total mao de obra') ||
      loose.startsWith('servicos') ||
      loose.includes(' servicos ');
  }

  function ciliaPieceLinesOnly(lines) {
    let inParts = false;
    let sawHeader = false;
    const selected = [];
    (lines || []).forEach(line => {
      const n = U.normalizeText(line);
      const isPartsHeader =
        n.includes('pecas e mao de obra') ||
        (n.includes('operacoes') && n.includes('descricao/codigo')) ||
        (n.includes('qtd') && n.includes('descricao/codigo') && n.includes('preco'));
      if (isPartsHeader) {
        inParts = true;
        sawHeader = true;
        return;
      }
      if (inParts && isCiliaSummaryOrServiceBoundary(line)) {
        inParts = false;
        return;
      }
      if (inParts) selected.push(line);
    });
    return sawHeader ? selected : (lines || []).filter(line => !isCiliaSummaryOrServiceBoundary(line));
  }

  function peelCiliaDescriptionAndQty(text) {
    let tokens = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    let i = 0;
    const numericBeforeDesc = [];
    while (i < tokens.length) {
      if (/^(T|R|P|R&I|RI)$/i.test(tokens[i])) { i++; continue; }
      if (isNumericToken(tokens[i])) {
        numericBeforeDesc.push({ idx: i, value: tokens[i] });
        i++;
        continue;
      }
      break;
    }

    let descTokens = tokens.slice(i);
    const trailingNumbers = [];
    while (descTokens.length && isNumericToken(descTokens[descTokens.length - 1])) trailingNumbers.unshift(descTokens.pop());

    let qtd = 1;
    if (numericBeforeDesc.length) qtd = U.parseNumberBR(numericBeforeDesc[numericBeforeDesc.length - 1].value) || 1;
    if (trailingNumbers.length) qtd = U.parseNumberBR(trailingNumbers[trailingNumbers.length - 1]) || qtd || 1;

    const desc = descTokens
      .join(' ')
      .replace(/\b(Oficina|Seguradora|Fornecedor|Cliente)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { desc, qtd };
  }

  function isCiliaPartHeaderText(text) {
    const n = U.normalizeText(text);
    return n.includes('pecas e mao de obra') ||
      (n.includes('operacoes') && n.includes('qtd')) ||
      (n.includes('descricao/codigo') && n.includes('preco'));
  }

  function isCiliaPartsTotalText(text) {
    const n = U.normalizeText(text).replace(/\?/g, 'c');
    return n.includes('total pecas') || n.startsWith('servicos');
  }

  function isCiliaMoneyText(text) {
    return /^R\$\s*[\d.]+,\d{2}$/i.test(String(text || '').trim()) ||
      /^R\$\s*\d+\.\d{2}$/i.test(String(text || '').trim());
  }

  function comparePdfSpans(a, b) {
    return (a.page - b.page) || (b.y - a.y) || (a.x - b.x);
  }

  function isAfterPdfStart(sp, start) {
    if (!start) return true;
    return sp.page > start.page || (sp.page === start.page && sp.y < start.y);
  }

  function isBeforePdfEnd(sp, end) {
    if (!end) return true;
    return sp.page < end.page || (sp.page === end.page && sp.y > end.y);
  }

  U.isSaneCiliaPieces = function(pieces) {
    const list = pieces || [];
    if (!list.length) return false;
    const badDesc = list.filter(p => {
      const n = U.normalizeText(p.desc);
      return !n ||
        n === 'r$' ||
        n.startsWith('r$ ') ||
        n.includes('total pecas') ||
        n.includes('servicos') ||
        n.includes('descricao da peca') ||
        n.includes('descricao/codigo') ||
        n.includes('fornecimento') ||
        n.includes('desconto');
    }).length;
    const badQty = list.filter(p => {
      const qtd = U.parseNumberBR(p.qtd || 0);
      return !qtd || qtd > 99;
    }).length;
    return badDesc / list.length <= 0.12 && badQty / list.length <= 0.12;
  };

  U.parseCiliaPiecesFromSpans = function(spans) {
    const all = (spans || [])
      .map((sp, idx) => ({
        text: String(sp.text || sp.str || '').replace(/\s+/g, ' ').trim(),
        x: Number(sp.x ?? sp.transform?.[4] ?? 0),
        y: Number(sp.y ?? sp.transform?.[5] ?? 0),
        page: Number(sp.page || sp.pageNumber || 1),
        idx
      }))
      .filter(sp => sp.text)
      .sort(comparePdfSpans);

    if (!all.length) return [];
    const start = all.find(sp => isCiliaPartHeaderText(sp.text));
    const end = all.find(sp => isAfterPdfStart(sp, start) && isCiliaPartsTotalText(sp.text));
    const inParts = all.filter(sp => isAfterPdfStart(sp, start) && isBeforePdfEnd(sp, end));

    const anchors = inParts.filter(sp =>
      sp.x >= 88 && sp.x <= 125 &&
      /^\d+(?:[,.]\d+)$/.test(sp.text) &&
      !sp.text.includes(',') // no Cilia PDF, "Qtd" vem como 1.00/2.00; tempos usam virgula
    ).sort(comparePdfSpans);

    const pieces = [];
    anchors.forEach((anchor, index) => {
      const prev = anchors[index - 1];
      const upperFromPrev = prev && prev.page === anchor.page ? prev.y - 7 : Infinity;
      const upper = Math.min(anchor.y + 12, upperFromPrev);
      const lower = anchor.y - 11;

      const rowSpans = inParts
        .filter(sp => sp.page === anchor.page && Math.abs(sp.y - anchor.y) <= 2.8)
        .sort((a, b) => a.x - b.x);

      const descSpans = inParts
        .filter(sp => sp.page === anchor.page && sp.x >= 120 && sp.x <= 345 && sp.y <= upper && sp.y >= lower)
        .sort(comparePdfSpans);

      const descParts = [];
      let codigo = '';
      descSpans.forEach(sp => {
        if (/^C.?d[:.]?/i.test(sp.text)) {
          const m = sp.text.match(/^C.?d[:.]?\s*(.*)$/i);
          codigo = cleanCiliaCode(m?.[1] || '') || codigo;
          return;
        }
        if (isCiliaPartHeaderText(sp.text) || isCiliaPartsTotalText(sp.text)) return;
        if (isCiliaMoneyText(sp.text)) return;
        descParts.push(sp.text);
      });

      const money = rowSpans.filter(sp => isCiliaMoneyText(sp.text));
      const brutoSpan = money.find(sp => sp.x >= 400 && sp.x < 490) || money[0];
      const liquidoSpan = money.find(sp => sp.x >= 520) || money[money.length - 1];
      const descontoSpan = rowSpans.find(sp => /%\s*[\d.,]+/.test(sp.text));
      const desc = descParts.join(' ').replace(/\s+/g, ' ').trim();
      if (!desc && !codigo) return;

      pieces.push({
        codigo: codigo || 'sem oem',
        desc,
        qtd: U.parseNumberBR(anchor.text) || 1,
        venda: U.parseNumberBR(brutoSpan?.text || 0),
        ciliaValorLiquido: liquidoSpan && liquidoSpan !== brutoSpan ? U.parseNumberBR(liquidoSpan.text) : 0,
        ciliaDesconto: U.parseNumberBR(String(descontoSpan?.text || '').replace('%', ''))
      });
    });

    return U.normalizeCiliaPieces(pieces);
  };

  U.normalizeCiliaPiece = function(piece) {
    const p = { ...(piece || {}) };
    let desc = String(p.desc || p.descricao || '').replace(/\s+/g, ' ').trim();
    let codigo = cleanCiliaCode(p.codigo || p.cod || '');
    const prices = extractCiliaPrices(desc);
    const codInDesc = desc.match(/C.?d[:.]\s*([A-Z0-9./-]+)/i);
    if (!codigo && codInDesc) codigo = cleanCiliaCode(codInDesc[1]);

    desc = desc
      .replace(/C.?d[:.]\s*[A-Z0-9./-]+/gi, ' ')
      .replace(/R\$\s*[\d.]+,\d{2}/gi, ' ')
      .replace(/R\$\s*\d+\.\d{2}/gi, ' ')
      .replace(/%\s*[\d.,]+/g, ' ')
      .replace(/\b(Oficina|Seguradora|Fornecedor|Cliente)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const peeled = peelCiliaDescriptionAndQty(desc);
    const normalized = {
      ...p,
      codigo: codigo || 'sem oem',
      desc: peeled.desc,
      qtd: U.parseNumberBR(p.qtd || p.quantidade || 0) || peeled.qtd || 1,
      venda: U.parseNumberBR(p.venda || p.valor || p.precoBruto || 0) || prices.bruto || U.parseNumberBR(p.ciliaValorLiquido || 0) || prices.liquido || 0,
      ciliaValorLiquido: U.parseNumberBR(p.ciliaValorLiquido || p.valorLiquido || 0) || prices.liquido || 0,
      ciliaDesconto: U.parseNumberBR(p.ciliaDesconto || p.desconto || 0) || prices.desconto || 0
    };
    return normalized;
  };

  U.normalizeCiliaPieces = function(pieces) {
    return (pieces || [])
      .map(U.normalizeCiliaPiece)
      .filter(p => {
        const n = U.normalizeText(p.desc);
        if (!p.desc && p.codigo === 'sem oem') return false;
        if (isCiliaSummaryOrServiceBoundary(p.desc)) return false;
        if (n === 'total' || n === 'preco' || n === 'desconto') return false;
        return p.codigo || p.desc || U.parseNumberBR(p.venda) > 0;
      });
  };

  U.parseCiliaPiecesFromLines = function(lines) {
    const sectionLines = ciliaPieceLinesOnly(lines);
    const blockPieces = [];
    sectionLines
      .join('\n')
      .split(/\n(?=\s*(?:T\s+)?(?:R&I|RI|R|P)\b)/i)
      .forEach(block => {
        const original = stripCiliaSummaryTail(String(block || '').replace(/\s+/g, ' ').trim());
        if (!original || isCiliaSummaryOrServiceBoundary(original)) return;
        if (!/^(?:T\s+)?(?:R&I|RI|R|P)\b/i.test(original)) return;

        const codeMatch = original.match(/C.?d[:.]\s*([A-Z0-9./-]*)/i);
        const codigo = cleanCiliaCode(codeMatch?.[1]) || 'sem oem';
        const beforeCode = original.split(/C.?d[:.]/i)[0];
        const prices = extractCiliaPrices(original);
        const semPreco = /C.?d[:.]?.*-\s+-\s+-\s+-\s*$/i.test(original);
        if (!prices.bruto && !prices.liquido && !semPreco) return;

        const peeled = peelCiliaDescriptionAndQty(beforeCode);
        if (!peeled.desc && codigo === 'sem oem') return;
        blockPieces.push({
          codigo,
          desc: peeled.desc,
          qtd: peeled.qtd || 1,
          venda: prices.bruto || 0,
          ciliaValorLiquido: prices.liquido || 0,
          ciliaDesconto: prices.desconto || 0
        });
      });
    if (blockPieces.length) return U.normalizeCiliaPieces(blockPieces);

    const out = [];
    sectionLines.forEach(line => {
      const original = stripCiliaSummaryTail(String(line || '').replace(/\s+/g, ' ').trim());
      if (!original || !/R\$/i.test(original)) return;
      if (isCiliaSummaryOrServiceBoundary(original)) return;
      const prices = extractCiliaPrices(original);
      if (!prices.bruto && !prices.liquido) return;

      const beforePrice = original.split(/R\$/i)[0].replace(/\s+/g, ' ').trim();
      let codigo = '';
      let descPart = beforePrice;

      const codMarker = beforePrice.match(/^(.*)\s+C.?d[:.]\s*([A-Z0-9./-]+)(?:\s+\w+)?\s*$/i);
      if (codMarker) {
        descPart = codMarker[1].trim();
        codigo = cleanCiliaCode(codMarker[2]);
      } else {
        const first = beforePrice.match(/^([A-Z0-9][A-Z0-9./-]{3,})\s+(.+)$/);
        if (first && /\d/.test(first[1]) && !/^\d+[,.]\d+$/.test(first[1]) && !/^(TOTAL|PRECO|VALOR)$/i.test(first[1])) {
          codigo = cleanCiliaCode(first[1]);
          descPart = first[2].trim();
        }
      }

      if (!codigo && !descPart) return;
      const peeled = peelCiliaDescriptionAndQty(descPart);
      if (!peeled.desc && !codigo) return;
      out.push({
        codigo,
        desc: peeled.desc,
        qtd: peeled.qtd || 1,
        venda: prices.bruto || prices.liquido || 0,
        ciliaValorLiquido: prices.liquido || 0,
        ciliaDesconto: prices.desconto || 0
      });
    });
    return U.normalizeCiliaPieces(out);
  };

  U.parseCiliaPiecesFromTokens = function(textOrTokens) {
    const tokens = U.splitCiliaTokens(textOrTokens);
    const pieces = [];
    if (!tokens.length) return pieces;

    const startIdx = tokens.findIndex((t, i) =>
      U.normalizeText(t).startsWith('operac') &&
      U.normalizeText(tokens.slice(i, i + 12).join(' ')).includes('descricao/codigo')
    );
    const totalIdx = tokens.findIndex((t, i) =>
      U.normalizeText(t) === 'total' && U.normalizeText(tokens[i + 1] || '').startsWith('pec')
    );
    const windowTokens = tokens.slice(startIdx >= 0 ? startIdx : 0, totalIdx > 0 ? totalIdx : tokens.length);
    const codeIdxs = [];
    windowTokens.forEach((t, i) => {
      if (isCodigoMarker(t) && windowTokens[i + 1]) codeIdxs.push(i);
    });

    if (codeIdxs.length) {
      const firstCodeIdx = codeIdxs[0];
      const numericBefore = [];
      for (let i = 0; i < firstCodeIdx; i++) {
        if (/^\d+(?:\.\d+)?$/.test(windowTokens[i])) numericBefore.push({ idx: i, value: windowTokens[i] });
      }
      const qtyTokens = numericBefore.slice(-codeIdxs.length);
      const firstDescIdx = qtyTokens.length ? qtyTokens[qtyTokens.length - 1].idx + 1 : Math.max(0, firstCodeIdx - 1);
      const moneyPairs = [];
      for (let i = codeIdxs[codeIdxs.length - 1] + 2; i < windowTokens.length - 1; i++) {
        if (/^R\$/i.test(windowTokens[i]) && isMoneyToken(windowTokens[i + 1])) {
          moneyPairs.push(windowTokens[i + 1]);
          i++;
        }
      }

      for (let i = 0; i < codeIdxs.length; i++) {
        const markerIdx = codeIdxs[i];
        const nextMarkerIdx = codeIdxs[i + 1] || windowTokens.length;
        const descStart = i === 0 ? firstDescIdx : codeIdxs[i - 1] + 2;
        const descTokens = windowTokens.slice(descStart, markerIdx);
        const cleanDesc = descTokens
          .filter(t => !/^(T|R|P|R&I|Oficina)$/i.test(t))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const qtd = U.parseNumberBR(qtyTokens[i]?.value || 1) || 1;
        const bruto = U.parseNumberBR(moneyPairs[i * 2] || 0);
        const liquido = U.parseNumberBR(moneyPairs[i * 2 + 1] || 0);
        if (cleanDesc || windowTokens[markerIdx + 1]) {
          pieces.push({
            codigo: windowTokens[markerIdx + 1] || '',
            desc: cleanDesc,
            qtd,
            venda: bruto || liquido,
            ciliaValorLiquido: liquido
          });
        }
        if (nextMarkerIdx <= markerIdx) break;
      }
    }

    if (pieces.length) return U.normalizeCiliaPieces(pieces);

    const text = tokens.join(' ');
    const lineRegex = /(?:[TRP](?:\s+R&I)?)?\s*[\d,.]+\s+([\d,.]+)\s+(.+?)\s+C.?d[:.]\s*([A-Z0-9./-]+)\s+\w+\s+R\$\s*([\d.,]+)\s+%\s*[\d.,]+\s+R\$\s*([\d.,]+)/gi;
    let m;
    while ((m = lineRegex.exec(text))) {
      pieces.push({
        codigo: m[3].trim(),
        desc: m[2].replace(/\s+/g, ' ').trim(),
        qtd: U.parseNumberBR(m[1]) || 1,
        venda: U.parseNumberBR(m[4]),
        ciliaValorLiquido: U.parseNumberBR(m[5])
      });
    }
    return U.normalizeCiliaPieces(pieces);
  };

  U.openApprovalModal = function(os, options) {
    options = options || {};
    const cliente = U.getCliente(os, options.clientes, options.cliente);
    const items = U.buildBudgetItems(os, cliente);
    return new Promise(resolve => {
      if (!items.length) {
        if (typeof options.toast === 'function') options.toast('Nenhum item de orcamento para aprovar.', 'warn');
        resolve(null);
        return;
      }

      let overlay = document.getElementById('modalAprovacaoItensOS');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalAprovacaoItensOS';
        overlay.className = 'overlay';
        document.body.appendChild(overlay);
      }
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.78);display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);overflow:auto;';

      const allChecked = options.defaultAll !== false;
      const renderRow = item => `
        <label style="display:grid;grid-template-columns:26px 90px 1fr 110px;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.14);border-radius:4px;margin-bottom:6px;cursor:pointer;">
          <input type="checkbox" class="aprov-item" value="${U.escapeHtml(item.key)}" ${allChecked ? 'checked' : ''} style="width:18px;height:18px;">
          <span style="font-family:var(--fm,var(--mono,monospace));font-size:.68rem;color:${item.tipo === 'peca' ? 'var(--success,#00ff88)' : 'var(--cyan,#00d4ff)'};font-weight:700;">${item.labelTipo}</span>
          <span style="font-size:.82rem;color:var(--text,#e8f4ff);line-height:1.35;">
            ${item.codigo ? `<code style="font-size:.72rem;color:var(--warn,#ffb800);">${U.escapeHtml(item.codigo)}</code> ` : ''}
            ${U.escapeHtml(item.desc || '-')}
            <small style="display:block;color:var(--muted,#7a9ab8);font-family:var(--fm,var(--mono,monospace));font-size:.68rem;margin-top:2px;">
              ${item.tipo === 'servico' ? `Secao: ${U.escapeHtml(item.sistema || 'Manual')} | Horas/TMO: ${String(item.tempo || 0).replace('.', ',')}h | Valor/h: ${U.moeda(item.valorHora || 0)}` : `Qtd: ${item.qtd} x ${U.moeda(item.valorUnit)}`}
            </small>
          </span>
          <span style="text-align:right;font-family:var(--fm,var(--mono,monospace));font-weight:700;color:var(--success,#00ff88);">${U.moeda(item.valorFinal)}</span>
        </label>`;

      overlay.innerHTML = `
        <div class="modal" style="max-width:820px;width:96%;max-height:92vh;display:flex;flex-direction:column;background:var(--surf,var(--bg1,#0c1426));border:1px solid var(--border2,var(--border,#24435e));border-radius:6px;color:var(--text,#e8f4ff);box-shadow:0 20px 80px rgba(0,0,0,.45);">
          <div class="modal-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border2,var(--border,#24435e));">
            <div class="modal-title">APROVACAO DO ORCAMENTO - SELECIONE OS ITENS</div>
            <button class="modal-close" type="button" data-aprov-cancel style="width:32px;height:32px;background:transparent;border:1px solid var(--border2,var(--border,#24435e));color:var(--text,#e8f4ff);border-radius:4px;cursor:pointer;">×</button>
          </div>
          <div class="modal-body" style="overflow:auto;padding:18px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              <button type="button" class="btn-ghost" data-aprov-all>MARCAR TUDO</button>
              <button type="button" class="btn-ghost" data-aprov-none>DESMARCAR TUDO</button>
            </div>
            <div style="font-size:.78rem;color:var(--muted,#7a9ab8);line-height:1.45;margin-bottom:12px;">
              O orcamento completo sera mantido na O.S. como historico. O financeiro e o fluxo aprovado usarao somente os itens marcados aqui.
            </div>
            ${items.map(renderRow).join('')}
          </div>
          <div class="modal-foot" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 18px;border-top:1px solid var(--border2,var(--border,#24435e));flex-wrap:wrap;">
            <div style="font-family:var(--fm,var(--mono,monospace));font-size:.78rem;color:var(--muted,#7a9ab8);" data-aprov-total></div>
            <div style="display:flex;gap:8px;">
              <button class="btn-ghost" type="button" data-aprov-cancel>CANCELAR</button>
              <button class="btn-primary" type="button" data-aprov-confirm>APROVAR SELECIONADOS</button>
            </div>
          </div>
        </div>`;

      function selectedItems() {
        const selected = new Set(Array.from(overlay.querySelectorAll('.aprov-item:checked')).map(i => i.value));
        return items.filter(it => selected.has(it.key));
      }

      function updateTotal() {
        const sel = selectedItems();
        const total = sel.reduce((acc, it) => acc + U.parseNumberBR(it.valorFinal), 0);
        const el = overlay.querySelector('[data-aprov-total]');
        if (el) el.textContent = `${sel.length}/${items.length} item(ns) - Total aprovado: ${U.moeda(total)}`;
      }

      overlay.querySelector('[data-aprov-all]')?.addEventListener('click', () => {
        overlay.querySelectorAll('.aprov-item').forEach(i => { i.checked = true; });
        updateTotal();
      });
      overlay.querySelector('[data-aprov-none]')?.addEventListener('click', () => {
        overlay.querySelectorAll('.aprov-item').forEach(i => { i.checked = false; });
        updateTotal();
      });
      overlay.querySelectorAll('.aprov-item').forEach(i => i.addEventListener('change', updateTotal));
      overlay.querySelectorAll('[data-aprov-cancel]').forEach(btn => btn.addEventListener('click', () => {
        overlay.classList.remove('open');
        overlay.style.display = 'none';
        resolve(null);
      }));
      overlay.querySelector('[data-aprov-confirm]')?.addEventListener('click', () => {
        const sel = selectedItems();
        if (!sel.length) {
          if (typeof options.toast === 'function') options.toast('Selecione ao menos um item aprovado.', 'warn');
          return;
        }
        const total = +sel.reduce((acc, it) => acc + U.parseNumberBR(it.valorFinal), 0).toFixed(2);
        overlay.classList.remove('open');
        overlay.style.display = 'none';
        resolve({
          status: sel.length === items.length ? 'total' : 'parcial',
          totalOrcamento: +items.reduce((acc, it) => acc + U.parseNumberBR(it.valorFinal), 0).toFixed(2),
          totalAprovado: total,
          itens: sel,
          keys: sel.map(it => it.key),
          totalItens: items.length
        });
      });
      updateTotal();
      overlay.classList.add('open');
      overlay.style.display = 'flex';
    });
  };

  U.aprovarOrcamentoComSelecao = async function(options) {
    const db = options?.db || window.db;
    const osId = options?.osId;
    if (!db || !osId) return null;
    const snap = await db.collection('ordens_servico').doc(osId).get();
    if (!snap.exists) throw new Error('O.S. nao encontrada.');
    const os = { id: osId, ...snap.data() };
    const approval = await U.openApprovalModal(os, {
      clientes: options.clientes,
      cliente: options.cliente,
      toast: options.toast || window.toast
    });
    if (!approval) return null;
    const actor = options.actorName || 'Usuario';
    const actorType = options.actorType || 'portal';
    const novoStatus = options.novoStatus || 'Aprovado';
    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    timeline.push({
      dt: new Date().toISOString(),
      user: actor,
      acao: `${actor} APROVOU o orcamento (${approval.status}) - ${approval.itens.length}/${approval.totalItens} item(ns) - Total aprovado ${U.moeda(approval.totalAprovado)}`
    });
    const payload = {
      status: novoStatus,
      aprovacao: {
        status: approval.status,
        aprovadoEm: new Date().toISOString(),
        aprovadoPor: actor,
        aprovadoPorTipo: actorType,
        totalOrcamento: approval.totalOrcamento,
        totalAprovado: approval.totalAprovado,
        itens: approval.itens
      },
      itensAprovados: approval.keys,
      totalAprovado: approval.totalAprovado,
      timeline,
      updatedAt: new Date().toISOString()
    };
    await db.collection('ordens_servico').doc(osId).update(payload);
    return payload;
  };

  U.autoDescribeFields = function(root) {
    root = root || document;
    root.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (el.type === 'hidden') return;
      const explicit = el.getAttribute('aria-label') || el.getAttribute('title');
      if (explicit) return;
      let text = '';
      const id = el.id;
      if (id) {
        const label = root.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) text = label.textContent.trim();
      }
      if (!text) text = el.closest('.form-group')?.querySelector('label')?.textContent?.trim() || '';
      if (!text) text = el.getAttribute('placeholder') || el.textContent?.trim() || el.name || el.id || '';
      if (text) {
        el.setAttribute('title', text);
        el.setAttribute('aria-label', text);
      }
    });
  };

  window.JarvisOSUtils = U;
  window.JOS = U;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => U.autoDescribeFields(document));
  } else {
    U.autoDescribeFields(document);
  }
})();
