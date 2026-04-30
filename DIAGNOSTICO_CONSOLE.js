/**
 * ═══════════════════════════════════════════════════════════════
 * JARVIS ERP — SCRIPT DE DIAGNÓSTICO COMPLETO
 * Cole no console do DevTools com o jarvis.html aberto e logado
 * Powered by thIAguinho Soluções Digitais
 * ═══════════════════════════════════════════════════════════════
 */
(function() {
  const ok  = (msg) => console.log('%c ✅ ' + msg, 'color:#00ff88;font-weight:bold');
  const err = (msg) => console.log('%c ❌ ' + msg, 'color:#ff3b3b;font-weight:bold');
  const warn= (msg) => console.log('%c ⚠️  ' + msg, 'color:#fbbf24;font-weight:bold');
  const inf = (msg) => console.log('%c ℹ️  ' + msg, 'color:#00d4ff');
  const sep = ()    => console.log('%c' + '─'.repeat(60), 'color:#444');

  console.clear();
  console.log('%c JARVIS ERP — DIAGNÓSTICO COMPLETO', 'background:#0a0a1a;color:#00d4ff;font-size:1.2rem;font-weight:bold;padding:8px 20px;border-radius:4px;');
  sep();

  // ─── 1. ESTADO GLOBAL J{} ───────────────────────────────────
  console.log('%c 1. ESTADO GLOBAL window.J', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  if (!window.J) { err('window.J não existe — jarvis.html não carregou corretamente'); }
  else {
    ok('window.J existe');
    inf('tid (oficina): '     + (window.J.tid    || '❌ VAZIO'));
    inf('role (perfil): '     + (window.J.role   || '❌ VAZIO'));
    inf('gemini key: '        + (window.J.gemini ? '✓ configurada (' + window.J.gemini.slice(0,8)+'...)' : '❌ NÃO configurada'));
    inf('OS carregadas: '     + (window.J.os?.length      ?? 0));
    inf('Clientes: '          + (window.J.clientes?.length ?? 0));
    inf('Veículos: '          + (window.J.veiculos?.length ?? 0));
    inf('Estoque items: '     + (window.J.estoque?.length  ?? 0));
    inf('Financeiro: '        + (window.J.financeiro?.length ?? 0));
    inf('Equipe: '            + (window.J.equipe?.length    ?? 0));
    if (!window.J.tid)  err('J.tid vazio — verifique se está logado e se config.js está carregado');
    if (!window.J.role) err('J.role vazio — sessionStorage j_role não foi setado no login');
  }
  sep();

  // ─── 2. FIREBASE / FIRESTORE ────────────────────────────────
  console.log('%c 2. FIREBASE / FIRESTORE', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  if (window.firebase?.apps?.length > 0) ok('Firebase inicializado (' + window.firebase.apps[0].name + ')');
  else err('Firebase NÃO inicializado');
  if (window.db) ok('window.db (Firestore) existe');
  else err('window.db não existe — initFirebase() falhou ou config.js não carregou');
  sep();

  // ─── 3. MÓDULOS JS ──────────────────────────────────────────
  console.log('%c 3. MÓDULOS JS CARREGADOS', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  const fncs = {
    'os.js → salvarOS':              window.salvarOS,
    'os.js → calcOSTotal':           window.calcOSTotal,
    'os.js → buscarHistoricoOS':     window.buscarHistoricoOS,
    'os.js → importarCilia':         window.importarCilia,
    'os.js → adicionarPecaReal':     window.adicionarPecaReal,
    'os.js → adicionarPecaRealRow':  window.adicionarPecaRealRow,
    'os.js → verificarStatusOS':     window.verificarStatusOS,
    'os.js → escutarOS':             window.escutarOS,
    'ia.js → iaPerguntar':           window.iaPerguntar,
    'financeiro.js → renderFinanceiro': window.renderFinanceiro,
    'tabela-tempa.js → initTempa':   window.initTempa,
    'exportar-pmsp.js → exportarOrcamentoPMSP': window.exportarOrcamentoPMSP,
  };
  Object.entries(fncs).forEach(([nome, fn]) => {
    if (typeof fn === 'function') ok(nome);
    else err(nome + ' — FUNÇÃO NÃO EXISTE');
  });
  sep();

  // ─── 4. ELEMENTOS HTML DO MODAL OS ──────────────────────────
  console.log('%c 4. ELEMENTOS HTML DO MODAL OS', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  const els = [
    'modalOS','osStatus','osCliente','osVeiculo','osPlaca',
    'containerServicosOS','containerPecasOS','containerPecasReais',
    'blocoReais','histBuscaPlaca','histBuscaTermo','histBuscaResultado',
    'ciliaFileInput','osTotalVal','areaPgtoOS','areaEntregaPara',
    'osProxRev','osProxKm','tabOS1','tabOS2','tabOS3'
  ];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) ok('#' + id + ' existe');
    else err('#' + id + ' NÃO ENCONTRADO no DOM');
  });
  sep();

  // ─── 5. TESTE: PARSER CÍLIA (simula o PDF real) ─────────────
  console.log('%c 5. TESTE PARSER CÍLIA (formato real)', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  const linhasCiliaTest = [
    'T R&I 0,00 1.00 BOMBA DE COMBUSTÍVEL Cód: 172029382R Oficina R$ 1.795,30 % 48,00 R$ 933,56',
    'T R&I 0,00 1.00 AMORTECEDOR DIANT Cód: 543020714R Oficina R$ 549,90 % 48,00 R$ 285,95',
    'T R&I 0,00 1.00 BATENTE DO AMORTECEDOR DIANT Cód: 540505149R Oficina R$ 72,10 % 48,00 R$ 37,49',
    'T R&I 0,00 1.00 COXIM DO AMORTECEDOR DIANT Cód: 6001547499 Oficina R$ 84,20 % 48,00 R$ 43,78',
    'T R&I 0,00 1.00 BICO INJETOR DE COMBUSTÍVEL Cód: 8200207049 Oficina R$ 169,30 % 48,00 R$ 88,04',
  ];
  const brl = s => parseFloat((s||'0').replace(/[^\d,]/g,'').replace(',','.')) || 0;
  const rgx = /(?:[TR](?:\s+R&I)?)\s+[\d,]+\s+([\d,]+)\s+(.+?)\s+C[oó]d[:\.]?\s*([A-Z0-9\-\.\/]+)\s+\w+\s+R\$\s*([\d\.,]+)\s+%\s*[\d,]+\s+R\$\s*([\d\.,]+)/i;
  let ciliaOk = 0;
  linhasCiliaTest.forEach(linha => {
    const m = linha.match(rgx);
    if (m) {
      ciliaOk++;
      ok(`Cília OK → [${m[3]}] ${m[2].trim()} × ${m[1]} = R$ ${brl(m[5]).toFixed(2)}`);
    } else {
      err('Cília FALHOU → ' + linha.slice(0,60));
    }
  });
  if (ciliaOk === linhasCiliaTest.length) ok('Parser Cília: TODOS os ' + ciliaOk + ' itens reconhecidos ✓');
  else err('Parser Cília: apenas ' + ciliaOk + '/' + linhasCiliaTest.length + ' reconhecidos');
  sep();

  // ─── 6. TESTE: BUSCA HISTÓRICA ───────────────────────────────
  console.log('%c 6. TESTE BUSCA HISTÓRICA', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  if (!window.J?.os?.length) {
    warn('Nenhuma OS em J.os — não é possível testar a busca. Verifique se Firestore carregou.');
  } else {
    const primeiraOS = window.J.os[0];
    const placa = (primeiraOS.placa||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (!placa) { warn('Primeira OS não tem placa registrada.'); }
    else {
      const hits = window.J.os.filter(o => (o.placa||'').toUpperCase().replace(/[^A-Z0-9]/g,'') === placa);
      ok('Busca por placa "' + placa + '" retorna ' + hits.length + ' OS(s)');
      inf('Serviços na primeira OS: ' + (primeiraOS.servicos?.length ?? 0));
      inf('Peças na primeira OS: '    + (primeiraOS.pecas?.length    ?? 0));
      inf('PeçasReais na primeira OS: '+ (primeiraOS.pecasReais?.length ?? 0));
    }
  }
  sep();

  // ─── 7. TESTE: IA GEMINI ─────────────────────────────────────
  console.log('%c 7. IA GEMINI', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  const gemKey = window.J?.gemini || window.J?.oficina?.apiKeys?.gemini;
  if (!gemKey) {
    err('Chave Gemini NÃO encontrada em J.gemini');
    warn('Solução: no Firestore, acesse oficinas/{id_oficina} e adicione o campo apiKeys.gemini com sua chave do Google AI Studio');
  } else {
    ok('Chave Gemini encontrada: ' + gemKey.slice(0,8) + '...');
    inf('Para testar, tente enviar uma mensagem no chat da IA no jarvis.html');
  }
  sep();

  // ─── 8. PERMISSÕES (RBAC) ───────────────────────────────────
  console.log('%c 8. PERMISSÕES (RBAC)', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  const role = (window.J?.role||'').toLowerCase();
  inf('Role atual: ' + (role || 'não definida'));
  const isDono = ['admin','superadmin'].includes(role);
  if (isDono) ok('É admin/superadmin → blocoReais DEVE estar visível ao abrir uma OS');
  else        warn('Role não é admin → blocoReais ficará oculto (correto para mecânico/atendente)');
  sep();

  // ─── 9. SESSIONSSTORAGE ─────────────────────────────────────
  console.log('%c 9. SESSIONSTORAGE', 'color:#a78bfa;font-weight:bold;font-size:1rem;');
  ['j_tid','j_role','j_nome','j_gemini'].forEach(k => {
    const v = sessionStorage.getItem(k);
    if (v) ok(k + ' = ' + (k==='j_gemini'?v.slice(0,8)+'...':v));
    else   err(k + ' = VAZIO');
  });
  sep();

  // ─── RESUMO FINAL ────────────────────────────────────────────
  console.log('%c DIAGNÓSTICO CONCLUÍDO — verifique os itens ❌ acima', 'background:#0a0a1a;color:#fbbf24;font-size:1rem;font-weight:bold;padding:6px 16px;border-radius:4px;');
})();
