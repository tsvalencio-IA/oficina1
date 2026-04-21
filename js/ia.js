/**
 * JARVIS ERP — ia.js
 * Gemini AI Integration with Advanced Auditory & History (24 months)
 *
 * Powered by thIAguinho Soluções Digitais
 */
'use strict';

window.iaHistorico = [];

window.iaPerguntar = async function() {
  const msg = window._v ? window._v('iaInput') : (document.getElementById('iaInput')?.value.trim() || '');
  if(!msg) return;
  if(window._sv) window._sv('iaInput',''); else { const el=document.getElementById('iaInput'); if(el) el.value=''; }

  window.adicionarMsgIA('user', msg);
  window.adicionarMsgIA('bot', '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid var(--cyan);border-right-color:transparent;border-radius:50%;animation:jspin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span> Acessando base de dados...');

  const key = window.J && window.J.gemini;
  if(!key || !String(key).trim()){
    // Mensagem honesta: explica exatamente O QUE ESTÁ FALTANDO e COMO RESOLVER
    const lastBotMsg = document.getElementById('iaMsgs').lastChild;
    if(lastBotMsg) lastBotMsg.remove();
    
    const role = (window.J && window.J.role) || '';
    let instr = '';
    if(role === 'admin' || role === 'superadmin'){
      instr = '<br><br><strong>Como resolver:</strong><br>' +
              '1. Entre no Firebase Console → Firestore Database<br>' +
              '2. Coleção <code>oficinas</code> → documento da sua oficina<br>' +
              '3. Adicione o campo <code>apiKeys.gemini</code> (tipo: map) com sua chave Gemini<br>' +
              '4. Pegue uma chave grátis em <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--cyan);text-decoration:underline">aistudio.google.com/app/apikey</a><br>' +
              '5. Faça logout e login novamente para recarregar a chave na sessão.';
    } else {
      instr = '<br><br>Peça ao administrador da oficina para configurar a chave Gemini no Firestore (campo <code>apiKeys.gemini</code> da coleção <code>oficinas</code>).';
    }
    window.adicionarMsgIA('bot', '⚠ <strong>Chave Gemini não configurada.</strong>' + instr);
    if(window.toast) window.toast('⚠ Configure a chave Gemini para ativar a IA', 'warn');
    return;
  }

  if(!window.J || !Array.isArray(window.J.os)){
    const lastBotMsg = document.getElementById('iaMsgs').lastChild;
    if(lastBotMsg) lastBotMsg.remove();
    window.adicionarMsgIA('bot', '⚠ Base de dados ainda carregando. Aguarde alguns segundos e tente novamente.');
    return;
  }

  // 1. INJEÇÃO DA MEMÓRIA GLOBAL DO GESTOR (Últimos 24 meses + Estoque + Contexto de Auditoria)
  let historyContext = "BASE DE DADOS DE SERVIÇOS DA OFICINA (Últimos 24 meses):\n";
  const limiteData = new Date();
  limiteData.setMonth(limiteData.getMonth() - 24);

  window.J.os.filter(o => {
      const dataOS = new Date(o.createdAt || o.data || o.updatedAt || Date.now());
      return dataOS > limiteData;
  }).forEach(o => {
      const v = (window.J.veiculos || []).find(x => x.id === o.veiculoId);
      historyContext += `[OS #${o.id.slice(-5).toUpperCase()} | Placa: ${v?.placa || o.placa || 'S/P'} | Data: ${o.data || 'N/A'} | Status: ${o.status}]\n`;
      historyContext += `- Relato/Diag: ${o.desc || 'N/A'} | ${o.diagnostico || 'N/A'}\n`;
      if (o.pecas && o.pecas.length > 0) historyContext += `- Peças Trocadas: ${o.pecas.map(p => p.desc).join(', ')}\n`;
      if (o.servicos && o.servicos.length > 0) historyContext += `- Serviços Executados: ${o.servicos.map(s => s.desc).join(', ')}\n`;
      historyContext += `- Valor Total: R$ ${o.total || 0}\n\n`;
  });

  const infoOficina = `Oficina: ${window.J.tnome}. Mecânicos ativos: ${(window.J.equipe||[]).map(f=>f.nome).join(', ') || '—'}. Veículos cadastrados: ${(window.J.veiculos||[]).length}. Peças críticas (abaixo do mínimo): ${(window.J.estoque||[]).filter(p=>(p.qtd||0)<=(p.min||0)).map(p=>p.desc).join(', ') || 'nenhuma'}.`;

  // 2. O PROMPT MESTRE (AUDITORIA E CONSULTORIA SÊNIOR — PADRÃO DOUTOR-IE / BOSCH PRO)
  const systemPrompt = `Você é o thIAguinho, o JARVIS Gestor Automotivo de alto nível.
Seu conhecimento técnico é padrão Doutor-IE e Bosch Mecânico Pro. Seu conhecimento analítico é nível Diretor Operacional SaaS.
Você ajuda o gestor da oficina a analisar lucratividade, investigar orçamentos e AUDITAR GARANTIAS.

DIRETRIZES DE AUDITORIA (EXTREMAMENTE IMPORTANTE):
1. Utilize a "BASE DE DADOS DE SERVIÇOS" fornecida abaixo para todas as respostas referentes a veículos e clientes específicos.
2. Se questionado sobre a quebra de uma peça ou diagnóstico de um carro (placa), VOCÊ É OBRIGADO a varrer a base de dados e verificar se essa placa já esteve na oficina e se essa peça já foi trocada anteriormente.
3. REGRAS DE GARANTIA PADRÃO DO MERCADO BRASILEIRO:
   - Amortecedores: 2 anos ou 50.000 km.
   - Kits de Amortecedor (batente, coifa, coxim): 3 meses ou 10.000 km.
   - Pastilhas e Discos de freio: 3 meses ou 5.000 km.
   - Motor/Injeção/Sensores: 3 meses (garantia legal).
4. ALERTE O GESTOR IMEDIATAMENTE (em negrito e destaque) caso identifique que um mecânico está pedindo para trocar algo que ainda esteja na garantia com base no histórico.
5. Explique tecnicamente por que a peça pode ter falhado prematuramente (reincidência) citando causas-raiz prováveis para evitar prejuízos à oficina.
6. Se for uma análise financeira ou de estoque, forneça insights diretos baseados nos dados do "Cenário Atual".

Cenário Atual da Oficina: ${infoOficina}

${historyContext}

Responda sempre em português do Brasil, de forma clínica, técnica e sem alucinar dados não existentes na base.`;

  window.iaHistorico.push({role: 'user', text: msg});

  try {
    const contents = window.iaHistorico.map(h => ({role: h.role === 'user' ? 'user' : 'model', parts: [{text: h.text}]}));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', 
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
          contents, 
          systemInstruction: {parts: [{text: systemPrompt}]}
      })
    });

    const data = await res.json();
    if(!res.ok){
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      let dica = '';
      if(/API key not valid|API_KEY_INVALID/i.test(errMsg)) dica = '<br><br>A chave Gemini configurada é inválida ou expirou. Gere uma nova em <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--cyan);text-decoration:underline">aistudio.google.com/app/apikey</a>.';
      else if(/quota|RESOURCE_EXHAUSTED/i.test(errMsg)) dica = '<br><br>Cota da chave Gemini esgotada. Aguarde o reset ou gere nova chave.';
      else if(/models\/gemini/i.test(errMsg) && /not found/i.test(errMsg)) dica = '<br><br>O modelo <code>gemini-2.0-flash</code> pode não estar disponível na sua região.';
      throw new Error(errMsg + dica);
    }

    const resp = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
    window.iaHistorico.push({role: 'model', text: resp});

    const lastBotMsg = document.getElementById('iaMsgs').lastChild;
    if(lastBotMsg) lastBotMsg.remove();
    
    window.adicionarMsgIA('bot', resp.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
  } catch(e) {
    const lastBotMsg = document.getElementById('iaMsgs').lastChild;
    if(lastBotMsg) lastBotMsg.remove();
    window.adicionarMsgIA('bot', '⚠ Erro na IA: ' + (e.message || e));
  }
};

window.iaAnalisarDRE = function() {
  if(window._sv) window._sv('iaInput', 'Analise o financeiro atual e sugira melhorias e projeções.');
  else { const el=document.getElementById('iaInput'); if(el) el.value='Analise o financeiro atual e sugira melhorias e projeções.'; }
  if(window.ir) window.ir('ia');
  setTimeout(window.iaPerguntar, 200);
};

window.iaAnalisarEstoque = function() {
  if(window._sv) window._sv('iaInput', 'Quais peças estão em nível crítico para reposição? Sugira ações de compra.');
  else { const el=document.getElementById('iaInput'); if(el) el.value='Quais peças estão em nível crítico para reposição? Sugira ações de compra.'; }
  if(window.ir) window.ir('ia');
  setTimeout(window.iaPerguntar, 200);
};

window.adicionarMsgIA = function(role, html) {
  const el = document.getElementById('iaMsgs'); if(!el) return;
  const div = document.createElement('div'); div.className = 'ia-msg ' + role;
  if(role === 'bot') div.innerHTML = '<strong>thIAguinho:</strong> ' + html; else div.innerHTML = html;
  el.appendChild(div); el.scrollTop = el.scrollHeight;
};

document.getElementById('iaInput')?.addEventListener('keydown', e => {
  if(e.key === 'Enter') window.iaPerguntar();
});

/* Powered by thIAguinho Soluções Digitais */