/**
 * JARVIS ERP — pdf.js
 * Laudo Técnico PDF profissional: cabeçalho colorido, tabela de serviços/peças,
 * checklist, assinatura, QR code para portal do cliente
 */
'use strict';

window.gerarPDFOS = async function() {
  if (typeof window.jspdf === 'undefined') { toastErr('Biblioteca PDF não carregada'); return; }
  setLoading && setLoading('btnGerarPDFOS', true, 'Gerando PDF...');

  try {
    const { jsPDF } = window.jspdf;
    const osId    = _v('osId');
    const veiculo = J.veiculos.find(x => x.id === _v('osVeiculo'));
    const cliente = J.clientes.find(x => x.id === _v('osCliente'));
    const mec     = J.equipe.find(x => x.id === _v('osMec'));
    const brand   = window.JARVIS_BRAND || {};

    const doc = new jsPDF('p','mm','a4');
    const pw  = doc.internal.pageSize.getWidth();
    const ph  = doc.internal.pageSize.getHeight();
    const ml  = 14, mr = pw - 14;
    let y = 0;

    const [bR,bG,bB] = _hex2rgb(brand.color||'#3B82F6');

    // ── Cabeçalho ─────────────────────────────────────────
    doc.setFillColor(bR,bG,bB); doc.rect(0,0,pw,34,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text(J.tnome.toUpperCase(), ml, 13);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(210,230,255);
    doc.text(brand.tagline||'Gestão Automotiva', ml, 21);
    doc.setFontSize(8); doc.setTextColor(200,220,255);
    doc.text(`Emitido: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`, mr, 13, {align:'right'});
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    const osNum = osId ? `OS #${osId.slice(-6).toUpperCase()}` : 'NOVA O.S.';
    doc.text(osNum, mr, 21, {align:'right'});

    // ── Subtítulo ─────────────────────────────────────────
    doc.setFillColor(245,248,255); doc.rect(0,34,pw,10,'F');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(bR,bG,bB);
    doc.text('LAUDO TÉCNICO DE SERVIÇOS', pw/2, 40, {align:'center'});
    doc.setDrawColor(bR,bG,bB); doc.setLineWidth(0.5); doc.line(0,44,pw,44);
    y = 50;

    // ── Dados ─────────────────────────────────────────────
    _secHead(doc,'DADOS DO CLIENTE E VEÍCULO',ml,y,pw,bR,bG,bB); y+=8;
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
    const c2=pw/2+4;
    _lv(doc,'CLIENTE',cliente?.nome||'—',ml,y); _lv(doc,'WHATSAPP',cliente?.wpp||'—',c2,y); y+=7;
    _lv(doc,'VEÍCULO',`${veiculo?.modelo||'—'} ${veiculo?.ano||''}`,ml,y); _lv(doc,'PLACA',veiculo?.placa||_v('osPlaca')||'—',c2,y); y+=7;
    _lv(doc,'KM ENTRADA',_v('osKm')?Number(_v('osKm')).toLocaleString('pt-BR')+' km':'—',ml,y); _lv(doc,'COR',veiculo?.cor||'—',c2,y); y+=7;
    _lv(doc,'DATA ENTRADA',dtBr(_v('osData')),ml,y); _lv(doc,'MECÂNICO',mec?.nome||'Não atribuído',c2,y); y+=10;

    // ── Defeito ────────────────────────────────────────────
    _secHead(doc,'DEFEITO RECLAMADO / SERVIÇO',ml,y,pw,bR,bG,bB); y+=7;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
    const descLines=doc.splitTextToSize(_v('osDescricao')||'—',pw-28);
    doc.text(descLines,ml,y); y+=descLines.length*5+4;
    if (_v('osDiagnostico')) {
      doc.setFont('helvetica','bold'); doc.setTextColor(bR,bG,bB); doc.text('Diagnóstico Técnico:',ml,y); y+=5;
      doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
      const diagLines=doc.splitTextToSize(_v('osDiagnostico'),pw-28);
      doc.text(diagLines,ml,y); y+=diagLines.length*5+4;
    }
    y+=4;

    // ── Tabela serviços + peças ────────────────────────────
    _secHead(doc,'ORÇAMENTO DETALHADO',ml,y,pw,bR,bG,bB); y+=4;
    const rows=[];
    document.querySelectorAll('#containerServicosOS > div').forEach(row=>{
      const desc=row.querySelector('.serv-desc')?.value||'Serviço';
      const val=parseFloat(row.querySelector('.serv-valor')?.value||0);
      if(desc||val>0) rows.push([desc,'1 srv',_fmtVal(val),_fmtVal(val)]);
    });
    document.querySelectorAll('#containerPecasOS > div').forEach(row=>{
      const sel=row.querySelector('.peca-sel'); const opt=sel?.options[sel.selectedIndex];
      const qtd=parseFloat(row.querySelector('.peca-qtd')?.value||0);
      const val=parseFloat(row.querySelector('.peca-venda')?.value||0);
      if(qtd>0) rows.push([opt?.dataset.d||opt?.text||'—',qtd.toString(),_fmtVal(val),_fmtVal(qtd*val)]);
    });
    if(rows.length){
      doc.autoTable({startY:y,head:[['DESCRIÇÃO','QTD','VLR UNIT.','SUBTOTAL']],body:rows,theme:'grid',margin:{left:ml,right:ml},headStyles:{fillColor:[bR,bG,bB],textColor:[255,255,255],fontStyle:'bold',fontSize:8},bodyStyles:{fontSize:8,textColor:[40,40,40]},alternateRowStyles:{fillColor:[248,250,255]},columnStyles:{0:{cellWidth:'auto'},1:{cellWidth:18,halign:'center'},2:{cellWidth:28,halign:'right'},3:{cellWidth:28,halign:'right',fontStyle:'bold'}}});
      y=doc.lastAutoTable.finalY+8;
    }

    // ── Total ──────────────────────────────────────────────
    const total=parseFloat(_v('osTotalHidden')||0);
    doc.setFillColor(bR,bG,bB); doc.roundedRect(mr-68,y,68,16,2,2,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('TOTAL:',mr-63,y+7); doc.setFontSize(13);
    doc.text(`R$ ${total.toFixed(2).replace('.',',')}`,mr-4,y+10,{align:'right'});
    y+=22;

    // ── Pagamento ──────────────────────────────────────────
    if(_v('osPgtoForma')){
      doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(bR,bG,bB);
      doc.text('Forma de Pagamento: ',ml,y); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
      doc.text(_v('osPgtoForma'),ml+44,y); y+=8;
    }

    // ── Checklist ──────────────────────────────────────────
    if(y<ph-70){
      _secHead(doc,'CHECKLIST DE ENTREGA',ml,y,pw,bR,bG,bB); y+=7;
      const checks=[['Painel / Instrumentos',_chk('chkPainel')],['Pressão dos Pneus',_chk('chkPressao')],['Carroceria/Carenagem',_chk('chkCarroceria')],['Documentos no Veículo',_chk('chkDocumentos')]];
      doc.setFontSize(8.5); doc.setFont('helvetica','normal');
      checks.forEach((c,i)=>{
        const cx=ml+(i%2===0?0:pw/2); if(i%2===0&&i>0)y+=6;
        doc.setTextColor(c[1]?0:220,c[1]?140:40,c[1]?20:40);
        doc.text(`${c[1]?'✔':'✘'} ${c[0]}`,cx,y); doc.setTextColor(40,40,40);
        if(i%2===1)y+=6;
      });
      y+=4;
      if(_v('chkObs')){
        doc.setFont('helvetica','bold'); doc.text('Avarias: ',ml,y);
        doc.setFont('helvetica','normal');
        const obsl=doc.splitTextToSize(_v('chkObs'),pw-28);
        doc.text(obsl,ml+18,y); y+=obsl.length*5;
      }
      y+=6;
    }

    // ── QR Code ────────────────────────────────────────────
    const portalUrl=`${window.location.origin}/cliente.html?id=${osId||'demo'}`;
    try{
      const qrImg=await _loadImg(`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(portalUrl)}`);
      doc.addImage(qrImg,'PNG',mr-24,ph-50,20,20);
      doc.setFontSize(6.5); doc.setTextColor(100,100,100);
      doc.text('Acompanhe sua O.S.',mr-14,ph-28,{align:'center'});
    }catch(e){}

    // ── Assinatura ─────────────────────────────────────────
    const sigY=ph-44;
    doc.setDrawColor(180,180,180); doc.setLineWidth(0.3);
    doc.line(ml,sigY,ml+65,sigY); doc.line(pw/2+4,sigY,pw/2+69,sigY);
    doc.setFontSize(7); doc.setTextColor(120,120,120);
    doc.text('Assinatura do Cliente',ml+32,sigY+4,{align:'center'});
    doc.text('Assinatura do Técnico',pw/2+36,sigY+4,{align:'center'});

    // ── Rodapé ─────────────────────────────────────────────
    doc.setFillColor(245,248,252); doc.rect(0,ph-16,pw,16,'F');
    doc.setFontSize(6.5); doc.setTextColor(140,140,140);
    doc.text(brand.footer||`${J.tnome} · JARVIS ERP`, pw/2, ph-7, {align:'center'});
    doc.setFont('helvetica','bold'); doc.setTextColor(bR,bG,bB);
    doc.text(osNum, mr, ph-7, {align:'right'});

    const fileName=`Laudo_${veiculo?.placa||_v('osPlaca')||'OS'}_${Date.now()}.pdf`;
    doc.save(fileName);
    toastOk(`✓ PDF gerado — ${fileName}`);
    audit('PDF',`Gerou laudo ${osNum}`);

  } catch(e) {
    toastErr('Erro ao gerar PDF: '+e.message);
    console.error(e);
  } finally {
    setLoading && setLoading('btnGerarPDFOS', false, '📄 EXPORTAR LAUDO PDF');
  }
};

// ── HELPERS PDF ────────────────────────────────────────────
function _secHead(doc, text, x, y, pw, r, g, b) {
  doc.setFillColor(r,g,b); doc.rect(x,y-4,3,6,'F');
  doc.setDrawColor(r,g,b); doc.setLineWidth(0.3);
  doc.rect(x,y-4,pw-28,6,'S');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(r,g,b);
  doc.text(text,x+6,y); doc.setTextColor(40,40,40);
}

function _lv(doc, label, value, x, y) {
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(120,120,120);
  doc.text(label+':', x, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(30,30,30);
  doc.text(String(value||'—'), x, y+4.5);
}

function _hex2rgb(hex) {
  const c=(hex||'#3B82F6').replace('#','');
  return [parseInt(c.substring(0,2),16),parseInt(c.substring(2,4),16),parseInt(c.substring(4,6),16)];
}

function _fmtVal(v) { return `R$ ${parseFloat(v||0).toFixed(2).replace('.',',')}`;  }

function _loadImg(url) {
  return new Promise((res,rej)=>{
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>{
      const cv=document.createElement('canvas');
      cv.width=img.width; cv.height=img.height;
      cv.getContext('2d').drawImage(img,0,0);
      res(cv.toDataURL('image/png'));
    };
    img.onerror=rej; img.src=url;
  });
}
