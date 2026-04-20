/**
 * JARVIS ERP — ia.js
 * Gemini AI Integration
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
  window.adicionarMsgIA('bot', '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid var(--cyan);border-right-color:transparent;border-radius:50%;animation:jspin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span> Processando...');

  const key = window.J && window.J.gemini;
  if(!key || !String(key).trim()){
    // Mensagem honesta: explica exatamente O QUE ESTÁ FALTANDO e COMO RESOLVER
    document.getElementById('iaMsgs').lastChild?.remove();
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
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', '⚠ Base de dados ainda carregando. Aguarde alguns segundos e tente novamente.');
    return;
  }

  const ctx = `Oficina: ${window.J.tnome}. Mecânicos: ${(window.J.equipe||[]).map(f=>f.nome).join(', ') || '—'}. Veículos: ${(window.J.veiculos||[]).length}. O.S. Pátio: ${(window.J.os||[]).filter(o=>!['Cancelado','Pronto','Entregue'].includes(o.status)).length}. Peças críticas: ${(window.J.estoque||[]).filter(p=>(p.qtd||0)<=(p.min||0)).map(p=>p.desc).join(', ') || 'nenhuma'}.`;
  const histOS = (window.J.os||[]).slice(-10).map(o=>{const v=(window.J.veiculos||[]).find(x=>x.id===o.veiculoId);return `OS: ${v?.placa||o.placa||'?'}, Sts: ${o.status}, Tot: ${window.moeda ? window.moeda(o.total) : o.total}`;}).join('\n');
  const systemPrompt = `Você é o thIAguinho, IA para gestão de oficinas.\n\nCONTEXTO:\n${ctx}\n\nÚLTIMAS O.S.:\n${histOS}\n\nResponda em português de forma técnica, direta e como um consultor sênior. Não alucine dados. Formate com tags HTML simples se necessário.\n\nPowered by thIAguinho Soluções Digitais.`;

  window.iaHistorico.push({role: 'user', text: msg});

  try {
    const contents = window.iaHistorico.map(h => ({role: h.role === 'user' ? 'user' : 'model', parts: [{text: h.text}]}));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({contents, systemInstruction: {parts: [{text: systemPrompt}]}})
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

    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', resp.replace(/\n/g, '<br>'));
  } catch(e) {
    document.getElementById('iaMsgs').lastChild?.remove();
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
