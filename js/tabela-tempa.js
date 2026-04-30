/**
 * thIAguinho ERP — Tabela Tempária SINDIREPA-SP
 *
 * Carrega o JSON completo e fornece busca rápida.
 * Indexação em memória para pesquisa instantânea.
 *
 * APIs públicas:
 *   - window.tempaCarregar()       → baixa JSON do GitHub Pages
 *   - window.tempaPesquisar()      → executa busca da UI (Jarvis tela)
 *   - window.tempaBuscarPorTexto() → API programática usada pela IA e pela O.S.
 *   - window.tempaSugerirTempo()   → adiciona tempo da Tabela à OS aberta
 *
 * Powered by thIAguinho Soluções Digitais
 */
(function() {
  'use strict';

  // Estado global do módulo
  const TT = {
    carregada: false,
    carregando: false,
    dados: null,         // { _metadata, sistemas, itens }
    indice: null,        // mapa palavra-chave → array de itens (busca rápida)
    erro: null
  };
  window._tabelaTempa = TT;

  // ───────────────────────────────────────────────────────────────
  // CARREGAMENTO LAZY (só baixa quando o gestor abre a aba)
  // ───────────────────────────────────────────────────────────────
  window.tempaCarregar = async function() {
    if (TT.carregada || TT.carregando) return TT.dados;
    TT.carregando = true;
    try {
      // Tenta primeiro a versão minificada (mais rápida)
      const resp = await fetch('data/tabela-tempa.min.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      TT.dados = await resp.json();
      TT.carregada = true;
      _construirIndice(TT.dados.itens);
      console.log('[TabelaTempa] Carregada:', TT.dados._metadata.totalItens, 'itens');
      return TT.dados;
    } catch (e) {
      TT.erro = e.message;
      console.error('[TabelaTempa] Falha ao carregar:', e);
      throw e;
    } finally {
      TT.carregando = false;
    }
  };

  function _construirIndice(itens) {
    // Tokeniza tudo em minúsculas removendo acentos para busca rápida
    TT.indice = itens.map(it => ({
      ref: it,
      busca: _norm(it.sistema) + ' ' + _norm(it.operacao) + ' ' + _norm(it.item) + ' ' + it.codigo
    }));
  }

  function _norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove acentos
      .replace(/[^a-z0-9 ]/g, ' ')        // remove pontuação
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ───────────────────────────────────────────────────────────────
  // API DE BUSCA (programática — usada pela IA e pela OS)
  // ───────────────────────────────────────────────────────────────
  window.tempaBuscarPorTexto = function(texto, opts) {
    if (!TT.carregada || !TT.indice) return [];
    opts = opts || {};
    const limite = opts.limite || 50;
    const sistemaFiltro = opts.sistema || '';
    const termos = _norm(texto).split(' ').filter(t => t.length >= 2);
    if (termos.length === 0 && !sistemaFiltro) return [];

    const resultados = [];
    for (const entry of TT.indice) {
      // Filtro por sistema se especificado
      if (sistemaFiltro && entry.ref.sistema !== sistemaFiltro) continue;
      // Todos os termos devem aparecer
      let bateu = true;
      for (const t of termos) {
        if (!entry.busca.includes(t)) { bateu = false; break; }
      }
      if (bateu) {
        resultados.push(entry.ref);
        if (resultados.length >= limite) break;
      }
    }
    return resultados;
  };

  // ───────────────────────────────────────────────────────────────
  // UI DA TELA TABELA TEMPÁRIA NO JARVIS
  // ───────────────────────────────────────────────────────────────
  window.tempaInicializarTela = async function() {
    const tbody = document.getElementById('tempaTbody');
    const cont = document.getElementById('tempaContador');
    const sel = document.getElementById('tempaSistema');
    if (!tbody) return;

    if (!TT.carregada) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--cyan);">⏳ Carregando Tabela Tempária SINDIREPA-SP completa...</td></tr>';
      try {
        await window.tempaCarregar();
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">⚠ Erro ao carregar: ${e.message}<br><small>Verifique se o arquivo data/tabela-tempa.min.json está no GitHub Pages.</small></td></tr>`;
        if (cont) cont.textContent = 'Erro';
        return;
      }
    }

    if (cont) cont.textContent = `${TT.dados._metadata.totalItens.toLocaleString('pt-BR')} itens · ${TT.dados._metadata.totalSistemas} sistemas`;

    // Popula select de sistemas (uma vez só)
    if (sel && sel.options.length <= 1) {
      const optsHTML = ['<option value="">Todos os sistemas</option>']
        .concat(TT.dados.sistemas.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`))
        .join('');
      sel.innerHTML = optsHTML;
    }

    window.tempaPesquisar();
  };

  window.tempaPesquisar = function() {
    if (!TT.carregada) {
      window.tempaInicializarTela();
      return;
    }

    const tbody = document.getElementById('tempaTbody');
    const status = document.getElementById('tempaStatus');
    const inp = document.getElementById('tempaSearch');
    const sel = document.getElementById('tempaSistema');

    const termo = inp ? inp.value.trim() : '';
    const sistema = sel ? sel.value : '';

    let resultados;
    if (!termo && !sistema) {
      resultados = TT.dados.itens.slice(0, 100);  // primeiros 100
    } else {
      resultados = window.tempaBuscarPorTexto(termo, { sistema, limite: 200 });
    }

    if (status) {
      if (!termo && !sistema) {
        status.textContent = `Mostrando 100 itens iniciais. Use a busca para filtrar nos ${TT.dados._metadata.totalItens.toLocaleString('pt-BR')} itens.`;
      } else {
        status.textContent = `${resultados.length} resultado(s) encontrado(s)`;
      }
    }

    if (resultados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">Nenhum item encontrado. Tente outros termos.</td></tr>`;
      return;
    }

    tbody.innerHTML = resultados.map(it => {
      const tempoFmt = it.tempo.toFixed(2).replace('.', ',');
      const tempoHHmm = _hToHHmm(it.tempo);
      return `<tr>
        <td><span class="pill pill-cyan" style="font-family:var(--fm);font-size:0.65rem;">${_esc(it.codigo)}</span></td>
        <td style="font-size:0.78rem;color:var(--text);">${_esc(it.sistema)}</td>
        <td><span style="font-family:var(--fm);font-size:0.7rem;color:var(--warn);">${_esc(it.operacao)}</span></td>
        <td style="font-size:0.8rem;">${_esc(it.item)}</td>
        <td style="text-align:right;font-family:var(--fm);font-weight:700;color:var(--success);">${tempoFmt}h<br><small style="color:var(--muted);font-weight:400;">${tempoHHmm}</small></td>
        <td style="text-align:center;">
          <button class="btn-ghost" style="font-size:0.65rem;padding:5px 10px;" onclick='window.tempaCopiarItem(${JSON.stringify(it).replace(/'/g, "&apos;")})' title="Copiar para a área de transferência">📋</button>
        </td>
      </tr>`;
    }).join('');
  };

  // ───────────────────────────────────────────────────────────────
  // FERRAMENTAS AUXILIARES
  // ───────────────────────────────────────────────────────────────
  window.tempaCopiarItem = function(it) {
    const txt = `${it.sistema} | ${it.operacao} | ${it.item} | ${it.tempo.toFixed(2).replace('.', ',')}h`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => {
        if (window.toast) window.toast('✓ Item copiado: ' + txt.substring(0, 60), 'ok');
      });
    } else {
      if (window.toast) window.toast('Item: ' + txt, 'ok');
    }
  };

  // ───────────────────────────────────────────────────────────────
  // INTEGRAÇÃO COM A IA — chamada quando o gestor pergunta tempo
  // Detecta intenções tipo "quanto tempo para trocar pastilha"
  // e devolve resposta enriquecida com dados reais da tabela.
  // ───────────────────────────────────────────────────────────────
  window.tempaConsultarParaIA = async function(textoPergunta) {
    if (!TT.carregada) {
      try { await window.tempaCarregar(); }
      catch(e) { return null; }
    }
    const resultados = window.tempaBuscarPorTexto(textoPergunta, { limite: 8 });
    if (resultados.length === 0) return null;
    return {
      total: resultados.length,
      itens: resultados,
      resumo: resultados.map(it =>
        `• [${it.codigo}] ${it.operacao} ${it.item} (${it.sistema}): ${it.tempo.toFixed(2).replace('.', ',')}h`
      ).join('\n')
    };
  };

  // ───────────────────────────────────────────────────────────────
  // INTEGRAÇÃO COM A O.S. — Modal único com seleção por serviço
  // ───────────────────────────────────────────────────────────────
  // Comportamento:
  //   1. Lê todos os serviços lançados na OS
  //   2. Para CADA serviço, faz uma busca na Tabela e mostra TODAS as ocorrências
  //   3. Gestor seleciona qual usar via radio button
  //   4. Checkbox global: "Aplicar valor da hora-mecânica?" (default: ligado)
  //   5. Se aplicar: preenche TMO+valor (tempo × R$/h)
  //   6. Se não aplicar (cliente governo): preenche só horas, valor fica em branco
  //   7. Se não encontrou nada na Tabela: deixa o serviço como está
  // ───────────────────────────────────────────────────────────────
  window.tempaSugerirParaOS = async function() {
    if (!TT.carregada) {
      try { await window.tempaCarregar(); }
      catch(e) {
        if (window.toast) window.toast('⚠ Tabela Tempária não carregou. Verifique se data/tabela-tempa.min.json está no GitHub Pages.', 'err');
        return;
      }
    }

    // 1. Lê serviços lançados
    const linhas = document.querySelectorAll('#containerServicosOS > div');
    if (linhas.length === 0) {
      if (window.toast) window.toast('⚠ Adicione pelo menos um serviço antes de sugerir tempos.', 'warn');
      return;
    }

    // 2. Detecta tipo de cliente e valor/hora do cadastro do cliente/oficina
    const ehViatura = window._osClienteGovernamental && window._osClienteGovernamental();
    const dadosGov = ehViatura && window._osDadosGovernamental ? window._osDadosGovernamental() : null;
    const valorHoraOficina = (window.JOS?.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(
      dadosGov?.valorHora || window.J?.valorHoraMecanica || 120
    );
    const UOS = window.JOS || window.JarvisOSUtils || {};
    const veiculoAtual = window._osVeiculoAtual ? window._osVeiculoAtual() : {};
    const fmtHora = v => (UOS.parseNumberBR ? UOS.parseNumberBR(v) : parseFloat(String(v || 0).replace(',', '.')) || 0).toFixed(2).replace('.', ',');
    const secaoPorItem = it => ehViatura && UOS.inferPMSPValorHora ? UOS.inferPMSPValorHora(it, { veiculo: veiculoAtual }) : null;

    // 3. Para cada linha, busca na Tabela
    const buscas = [];
    linhas.forEach((row, idx) => {
      const inputDesc = row.querySelector('.serv-desc');
      const inputValor = row.querySelector('.serv-valor');
      if (!inputDesc) return;
      const desc = (inputDesc.value || '').trim();
      if (!desc) return;
      const resultados = window.tempaBuscarPorTexto(desc, { limite: 30 });
      buscas.push({
        idx,
        rowEl: row,
        descOriginal: desc,
          valorAtual: (window.JOS?.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(inputValor?.value || 0),
        resultados
      });
    });

    if (buscas.length === 0) {
      if (window.toast) window.toast('Nenhum serviço com descrição.', 'warn');
      return;
    }

    // 4. Monta modal único
    let modal = document.getElementById('modalTempaSugest');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalTempaSugest';
      modal.className = 'overlay';
      document.body.appendChild(modal);
    }

    const seccoesHTML = buscas.map((b, i) => {
      if (b.resultados.length === 0) {
        return `<div class="tempa-sec" style="margin-bottom:18px;padding:12px;background:rgba(255,184,0,0.06);border:1px solid rgba(255,184,0,0.25);border-radius:4px;">
          <div style="font-family:var(--fm);font-size:0.7rem;color:var(--warn);margin-bottom:4px;">⚠ SERVIÇO ${i+1} — NÃO ENCONTRADO NA TABELA</div>
          <div style="font-size:0.85rem;color:var(--text);">"${_esc(b.descOriginal)}"</div>
          <div style="font-size:0.7rem;color:var(--muted);margin-top:6px;font-style:italic;">Permanece como está, edite manualmente.</div>
        </div>`;
      }

      const opcoes = b.resultados.map((it, j) => {
        const secao = secaoPorItem(it);
        const secaoHtml = ehViatura
          ? `<br><small style="color:${secao ? 'var(--success)' : 'var(--warn)'};font-family:var(--fm);font-size:0.62rem;">${secao ? `${_esc(secao.label)} · R$ ${fmtHora(secao.valor)}/h` : 'SEM SECAO OFICIAL AUTOMATICA · usuario escolhe/preenche na OS'}</small>`
          : '';
        return `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(0,212,255,0.04);border:1px solid var(--border);border-radius:3px;margin-bottom:4px;cursor:pointer;font-size:0.78rem;">
            <input type="radio" name="tempaSel${i}" value="${j}" ${j === 0 ? 'checked' : ''} style="cursor:pointer;flex-shrink:0;">
            <div style="flex:1;">
              <div style="color:var(--text);font-weight:600;">${_esc(it.operacao)} ${_esc(it.item)}</div>
              <small style="color:var(--muted);font-family:var(--fm);font-size:0.65rem;">${_esc(it.sistema)} · cód. ${_esc(it.codigo)}</small>${secaoHtml}
            </div>
            <div style="font-family:var(--fm);font-weight:700;color:var(--success);font-size:0.85rem;text-align:right;flex-shrink:0;min-width:70px;">
              ${it.tempo.toFixed(2).replace('.', ',')}h
              <br><small style="color:var(--muted);font-weight:400;">${_hToHHmm(it.tempo)}</small>
            </div>
          </label>
        `;
      }).join('');

      return `<div class="tempa-sec" data-idx="${b.idx}" style="margin-bottom:20px;">
        <div style="font-family:var(--fm);font-size:0.75rem;color:var(--cyan);margin-bottom:6px;letter-spacing:0.5px;">
          SERVIÇO ${i+1}: <span style="color:var(--text);">"${_esc(b.descOriginal)}"</span>
        </div>
        <div style="font-size:0.65rem;color:var(--muted);margin-bottom:8px;">
          ${b.resultados.length} ocorrência(s) na Tabela — selecione a que se aplica:
        </div>
        ${opcoes}
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div class="modal" style="max-width:780px;width:96%;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-head">
          <div class="modal-title">📖 SUGERIR TEMPOS — TABELA TEMPÁRIA SINDIREPA</div>
          <button class="modal-close" onclick="document.getElementById('modalTempaSugest').classList.remove('open')">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto;padding:18px;">
          <div style="background:${ehViatura ? 'rgba(167,139,250,0.08)' : 'rgba(0,212,255,0.06)'};border:1px solid ${ehViatura ? 'var(--purple, #A78BFA)' : 'var(--cyan)'};border-radius:4px;padding:12px;margin-bottom:18px;">
            ${ehViatura ?
              `<div style="font-family:var(--fm);font-size:0.7rem;color:var(--purple,#A78BFA);font-weight:700;margin-bottom:6px;">🛡 CLIENTE GOVERNAMENTAL DETECTADO</div>
              <div style="font-size:0.78rem;color:var(--text);line-height:1.5;">
                Este orçamento é para viatura/órgão público. As horas (TMO) virão da Tabela Tempária e o valor/hora será sugerido pela seção oficial PMSP quando houver correspondência. Se não houver seção segura, fica sem seleção para preenchimento manual na O.S.
              </div>` :
              `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="tempaAplicarValor" checked style="width:18px;height:18px;cursor:pointer;">
                <div>
                  <div style="font-family:var(--fm);font-size:0.7rem;color:var(--cyan);font-weight:700;">APLICAR VALOR DA HORA-MECÂNICA: R$ ${valorHoraOficina.toFixed(2)}/h</div>
                  <div style="font-size:0.7rem;color:var(--muted);margin-top:2px;">
                    Desmarque se este serviço usa tabela externa de preços (você preenche depois manualmente).
                  </div>
                </div>
              </label>`
            }
          </div>

          ${seccoesHTML}
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" onclick="document.getElementById('modalTempaSugest').classList.remove('open')">CANCELAR</button>
          <button class="btn-primary" onclick="window._tempaAplicarSelecionados()">✓ APLICAR SELECIONADOS</button>
        </div>
      </div>
    `;

    // Guarda dados pra aplicação
    window._tempaBuscasAtivas = buscas;
    window._tempaEhViatura = ehViatura;
    window._tempaValorHora = valorHoraOficina;
    window._tempaVeiculoAtual = veiculoAtual;

    modal.classList.add('open');
  };

  // Aplica as seleções escolhidas pelo usuário
  window._tempaAplicarSelecionados = function() {
    const buscas = window._tempaBuscasAtivas || [];
    const ehViatura = window._tempaEhViatura;
    const valorHora = window._tempaValorHora;
    const aplicarValor = ehViatura ? true : (document.getElementById('tempaAplicarValor')?.checked ?? true);

    let aplicados = 0;
    let semOpcao = 0;
    let semSecao = 0;

    buscas.forEach((b, i) => {
      if (b.resultados.length === 0) {
        semOpcao++;
        return;
      }
      const sel = document.querySelector(`input[name="tempaSel${i}"]:checked`);
      if (!sel) return;
      const itemEscolhido = b.resultados[parseInt(sel.value)];
      if (!itemEscolhido) return;

      const inputDesc = b.rowEl.querySelector('.serv-desc');
      const inputValor = b.rowEl.querySelector('.serv-valor');
      const inputTempo = b.rowEl.querySelector('.serv-tempo'); // novo campo TMO
      const inputHora = b.rowEl.querySelector('.serv-valor-hora');

      // P5: substitui descrição com nome oficial da Tabela (editável depois)
      if (inputDesc) {
        inputDesc.value = itemEscolhido.operacao + ' ' + itemEscolhido.item;
      }
      // Preenche TMO (horas) sempre
      if (inputTempo) {
        inputTempo.value = itemEscolhido.tempo.toFixed(2).replace('.', ',');
      }
      const UOS = window.JOS || window.JarvisOSUtils || {};
      const secaoInfo = ehViatura && UOS.inferPMSPValorHora ? UOS.inferPMSPValorHora(itemEscolhido, { veiculo: window._tempaVeiculoAtual || {} }) : null;

      if (ehViatura) {
        if (secaoInfo && typeof window.aplicarSecaoMaoObraOS === 'function') {
          window.aplicarSecaoMaoObraOS(b.rowEl, secaoInfo.key, { recalcular: true });
        } else {
          semSecao++;
          if (typeof window.aplicarSecaoMaoObraOS === 'function') window.aplicarSecaoMaoObraOS(b.rowEl, '', { recalcular: false });
          if (inputHora && b.rowEl.dataset.valorHoraManual !== '1') inputHora.value = '';
          if (inputValor && b.rowEl.dataset.valorManual !== '1') inputValor.value = '0,00';
        }
      } else if (aplicarValor && inputValor) {
        // Só sobrescreve se está zerado (não machuca valor manual)
        const atual = (window.JOS?.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(inputValor.value || 0);
        if (atual <= 0) {
          inputValor.value = (itemEscolhido.tempo * valorHora).toFixed(2).replace('.', ',');
        }
      }
      // Garante metadados da tabela para exportação/detalhamento
      b.rowEl.dataset.tempoTabela = itemEscolhido.tempo;
      b.rowEl.dataset.codigoTabela = itemEscolhido.codigo;
      b.rowEl.dataset.sistemaTabela = itemEscolhido.sistema;
      b.rowEl.dataset.secaoHora = secaoInfo?.key || b.rowEl.dataset.secaoHora || '';
      b.rowEl.dataset.secaoHoraLabel = secaoInfo?.label || b.rowEl.dataset.secaoHoraLabel || '';
      b.rowEl.dataset.valorHoraSecao = secaoInfo?.valor || b.rowEl.dataset.valorHoraSecao || '';

      aplicados++;
    });

    if (typeof window.calcOSTotal === 'function') window.calcOSTotal();

    if (aplicados > 0) {
      const txt = ehViatura
        ? `✓ ${aplicados} serviço(s) com TMO aplicado. Valor/hora oficial preenchido quando a seção foi identificada.`
        : (aplicarValor
          ? `✓ ${aplicados} serviço(s) preenchido(s) com TMO + valor (R$ ${valorHora.toFixed(2)}/h)`
          : `✓ ${aplicados} serviço(s) com TMO preenchido. Valores em branco para preenchimento manual.`);
      if (window.toast) window.toast(txt, 'ok');
    }
    if (semOpcao > 0 && window.toast) {
      window.toast(`⚠ ${semOpcao} serviço(s) não encontrado(s) na Tabela. Permaneceram editáveis.`, 'warn');
    }
    if (semSecao > 0 && window.toast) {
      window.toast(`⚠ ${semSecao} serviço(s) ficaram sem seção oficial automática. Selecione ou preencha manualmente na O.S.`, 'warn');
    }

    document.getElementById('modalTempaSugest').classList.remove('open');
  };

  // Reseta valor da hora (caso queira mudar)
  window.tempaResetarValorHora = function() {
    sessionStorage.removeItem('thiaguinho_valorHoraMec');
    if (window.toast) window.toast('Valor da hora resetado.', 'ok');
  };

  // ───────────────────────────────────────────────────────────────
  // UTILS
  // ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function _hToHHmm(h) {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (hh === 0) return `${mm}min`;
    if (mm === 0) return `${hh}h`;
    return `${hh}h${String(mm).padStart(2, '0')}`;
  }

  // Auto-init quando alguém clica no menu Tabela Tempária
  if (typeof window.ir === 'function' && !window._irOriginalTempa) {
    window._irOriginalTempa = window.ir;
    window.ir = function(rota, el) {
      window._irOriginalTempa(rota, el);
      if (rota === 'tabelatempa') setTimeout(window.tempaInicializarTela, 50);
    };
  }
})();

/* Powered by thIAguinho Soluções Digitais */
