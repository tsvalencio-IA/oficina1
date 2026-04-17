/**
 * JARVIS ERP — ia.js
 * Gemini AI Integration
 */
'use strict';

window.iaHistorico = [];

window.iaPerguntar = async function() {
  const msg = window._v('iaInput'); if(!msg) return; 
  window._sv('iaInput','');
  
  window.adicionarMsgIA('user', msg);
  window.adicionarMsgIA('bot', '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:var(--cyan) transparent transparent transparent"></span> Processando...');

  const key = window.J.gemini;
  if(!key){
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', '⚠ Configure a API Key Gemini no painel Superadmin.');
    return;
  }

  const ctx = `Oficina: ${window.J.tnome}. Mecânicos: ${window.J.equipe.map(f=>f.nome).join(', ')}. Veículos: ${window.J.veiculos.length}. O.S. Pátio: ${window.J.os.filter(o=>!['Cancelado','Pronto','Entregue'].includes(o.status)).length}. Peças críticas: ${window.J.estoque.filter(p=>(p.qtd||0)<=(p.min||0)).map(p=>p.desc).join(', ')}.`;
  const histOS = window.J.os.slice(-10).map(o=>{const v=window.J.veiculos.find(x=>x.id===o.veiculoId);return `OS: ${v?.placa}, Sts: ${o.status}, Tot: ${window.moeda(o.total)}`;}).join('\n');
  const systemPrompt = `Você é o thIAguinho, IA para gestão de oficinas.\n\nCONTEXTO:\n${ctx}\n\nÚLTIMAS O.S.:\n${histOS}\n\nResponda em português de forma técnica, direta e como um consultor sênior. Não alucine dados. Formate com tags HTML simples se necessário.`;

  window.iaHistorico.push({role: 'user', text: msg});
  
  try {
    const contents = window.iaHistorico.map(h => ({role: h.role === 'user' ? 'user' : 'model', parts: [{text: h.text}]}));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({contents, systemInstruction: {parts: [{text: systemPrompt}]}})
    });
    
    const data = await res.json();
    if(!res.ok) throw new Error(data.error?.message || 'Erro API');
    
    const resp = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
    window.iaHistorico.push({role: 'model', text: resp});
    
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', resp.replace(/\n/g, '<br>'));
  } catch(e) {
    document.getElementById('iaMsgs').lastChild?.remove();
    window.adicionarMsgIA('bot', '⚠ Erro de conexão com a IA: ' + e.message);
  }
};

window.iaAnalisarDRE = function() { 
  window._sv('iaInput', 'Analise o financeiro atual e sugira melhorias e projeções.'); 
  if(window.ir) window.ir('ia'); 
  setTimeout(window.iaPerguntar, 200); 
};

window.iaAnalisarEstoque = function() { 
  window._sv('iaInput', 'Quais peças estão em nível crítico para reposição? Sugira ações de compra.'); 
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
