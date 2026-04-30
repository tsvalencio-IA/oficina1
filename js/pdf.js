/**
 * JARVIS ERP — pdf.js
 * Laudo Técnico PDF profissional
 * Usa jsPDF + jsPDF-AutoTable + QR code via API do Google
 */

'use strict';

window.gerarPDFOS = async function() {
  if (typeof window.jspdf === 'undefined') {
    toastErr('Biblioteca PDF não carregada. Verifique a conexão.');
    return;
  }

  const { jsPDF } = window.jspdf;
  setLoading('btnGerarPDFOS', true, 'Gerando PDF...');

  try {
    const osId    = _v('osId');
    const veiculo = J.veiculos.find(x => x.id === _v('osVeiculo'));
    const cliente = J.clientes.find(x => x.id === _v('osCliente'));
    const mec     = J.equipe.find(x => x.id === _v('osMec'));
    const brand   = window.JARVIS_BRAND || {};

    const doc = new jsPDF('p', 'mm', 'a4');
    const pw  = doc.internal.pageSize.getWidth();
    const ph  = doc.internal.pageSize.getHeight();
    const ml  = 14, mr = pw - 14;
    let y     = 0;

    // ─── COR DE MARCA ───────────────────────────────────────
    const brandHex = brand.color || '#3B82F6';
    const [bR, bG, bB] = _hexToRGB(brandHex);

    // ─── CABEÇALHO ──────────────────────────────────────────
    // Faixa de cor sólida no topo
    doc.setFillColor(bR, bG, bB);
    doc.rect(0, 0, pw, 32, 'F');

    // Nome da oficina
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(J.tnome.toUpperCase(), ml, 13);

    // Tagline / slogan
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 235, 255);
    doc.text(brand.tagline || 'Gestão Automotiva', ml, 21);

    // Data de emissão (direita)
    doc.setFontSize(8);
    doc.setTextColor(200, 220, 255);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`, mr, 13, { align: 'right' });

    // OS ID
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const osNum = osId ? `OS #${osId.slice(-6).toUpperCase()}` : 'NOVA O.S.';
    doc.text(osNum, mr, 21, { align: 'right' });

    y = 40;

    // ─── SUBTÍTULO ──────────────────────────────────────────
    doc.setFillColor(245, 248, 255);
    doc.rect(0, 32, pw, 10, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bR, bG, bB);
    doc.text('LAUDO TÉCNICO DE SERVIÇOS', pw / 2, 38, { align: 'center' });
    doc.setDrawColor(bR, bG, bB);
    doc.setLineWidth(0.5);
    doc.line(0, 42, pw, 42);

    y = 48;

    // ─── BLOCO: DADOS DO CLIENTE E VEÍCULO ─────────────────
    _sectionHeader(doc, 'DADOS DO CLIENTE E VEÍCULO', ml, y, pw, bR, bG, bB);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    const col1 = ml, col2 = pw / 2 + 4;

    // Linha 1
    _labelValue(doc, 'CLIENTE', cliente?.nome || '—', col1, y, col2, y);
    _labelValue(doc, 'WHATSAPP', cliente?.wpp  || '—', col2, y, pw, y);
    y += 7;

    // Linha 2
    _labelValue(doc, 'VEÍCULO', `${veiculo?.modelo || '—'} ${veiculo?.ano || ''}`, col1, y, col2, y);
    _labelValue(doc, 'PLACA',   veiculo?.placa || '—',  col2, y, pw, y);
    y += 7;

    // Linha 3
    _labelValue(doc, 'KM NA ENTRADA', _v('osKm') ? Number(_v('osKm')).toLocaleString('pt-BR') + ' km' : '—', col1, y, col2, y);
    _labelValue(doc, 'COR', veiculo?.cor || '—', col2, y, pw, y);
    y += 7;

    // Linha 4
    _labelValue(doc, 'DATA DE ENTRADA', dtBr(_v('osData')),  col1, y, col2, y);
    _labelValue(doc, 'MECÂNICO', mec?.nome || 'Não atribuído', col2, y, pw, y);
    y += 10;

    // ─── BLOCO: DEFEITO E DIAGNÓSTICO ───────────────────────
    _sectionHeader(doc, 'DEFEITO RECLAMADO / SERVIÇO SOLICITADO', ml, y, pw, bR, bG, bB);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    const descLines = doc.splitTextToSize(_v('osDescricao') || '—', pw - 28);
    doc.text(descLines, ml, y);
    y += descLines.length * 5 + 4;

    if (_v('osDiagnostico')) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bR, bG, bB);
      doc.text('Diagnóstico Técnico:', ml, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      const diagLines = doc.splitTextToSize(_v('osDiagnostico'), pw - 28);
      doc.text(diagLines, ml, y);
      y += diagLines.length * 5 + 4;
    }
    y += 4;

    // ─── TABELA DE SERVIÇOS ──────────────────────────────────
    _sectionHeader(doc, 'SERVIÇOS E PEÇAS', ml, y, pw, bR, bG, bB);
    y += 4;

    const rows = [];
    document.querySelectorAll('#containerPecasOS .peca-row').forEach(row => {
      const sel  = row.querySelector('.peca-sel');
      const opt  = sel?.options[sel?.selectedIndex];
      const qtd  = parseFloat(row.querySelector('.peca-qtd')?.value  || 0);
      const vend = parseFloat(row.querySelector('.peca-venda')?.value || 0);
      const sub  = qtd * vend;
      if (qtd > 0) {
        rows.push([
          opt?.dataset.desc || opt?.text || '—',
          qtd.toString(),
          moeda(vend),
          moeda(sub)
        ]);
      }
    });

    const mo = parseFloat(_v('osMaoObra') || 0);
    if (mo > 0) rows.unshift(['Mão de Obra', '1', moeda(mo), moeda(mo)]);

    if (rows.length) {
      doc.autoTable({
        startY: y,
        head:   [['DESCRIÇÃO', 'QTD', 'VALOR UNIT.', 'SUBTOTAL']],
        body:   rows,
        theme:  'grid',
        margin: { left: ml, right: ml },
        headStyles: {
          fillColor: [bR, bG, bB],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40]
        },
        alternateRowStyles: { fillColor: [248, 250, 255] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 15,  halign: 'center' },
          2: { cellWidth: 28,  halign: 'right'  },
          3: { cellWidth: 28,  halign: 'right', fontStyle: 'bold' }
        }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // ─── TOTAL ──────────────────────────────────────────────
    const total = parseFloat(_v('osTotalHidden') || 0);
    doc.setFillColor(bR, bG, bB);
    doc.roundedRect(mr - 65, y, 65, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', mr - 60, y + 6);
    doc.setFontSize(13);
    doc.text(moeda(total), mr - 4, y + 9, { align: 'right' });
    y += 20;

    // ─── CHECKLIST ──────────────────────────────────────────
    if (y < ph - 60) {
      _sectionHeader(doc, 'CHECKLIST DE ENTREGA', ml, y, pw, bR, bG, bB);
      y += 7;

      const checks = [
        ['Painel / Instrumentos', _chk('chkPainel')],
        ['Pressão dos Pneus',    _chk('chkPressao')],
        ['Carroceria / Carenagem', _chk('chkCarroceria')],
        ['Documentos no veículo', _chk('chkDocumentos')]
      ];

      const checksCols = [
        ['Pneu Dianteiro', _v('chkPneuDia') ? _v('chkPneuDia') + '% desgaste' : '—'],
        ['Pneu Traseiro',  _v('chkPneuTra') ? _v('chkPneuTra') + '% desgaste' : '—'],
        ['Combustível',    _v('chkComb') || '—']
      ];

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);

      checks.forEach((c, i) => {
        const cx = ml + (i % 2 === 0 ? 0 : (pw / 2));
        if (i % 2 === 0 && i > 0) y += 6;
        const ok = c[1];
        doc.setTextColor(ok ? 0 : 220, ok ? 140 : 40, ok ? 20 : 40);
        doc.text(`${ok ? '✔' : '✘'} ${c[0]}`, cx, y);
        doc.setTextColor(40, 40, 40);
        if (i % 2 === 1) y += 6;
      });

      y += 4;
      checksCols.forEach(c => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${c[0]}: `, ml, y);
        doc.setFont('helvetica', 'normal');
        doc.text(c[1], ml + doc.getTextWidth(`${c[0]}: `), y);
        y += 5;
      });

      if (_v('chkObs')) {
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Avarias prévias: ', ml, y);
        doc.setFont('helvetica', 'normal');
        const obsLines = doc.splitTextToSize(_v('chkObs'), pw - 28);
        doc.text(obsLines, ml + 28, y);
        y += obsLines.length * 5;
      }
      y += 6;
    }

    // ─── FORMA DE PAGAMENTO ─────────────────────────────────
    if (_v('osPgtoForma')) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bR, bG, bB);
      doc.text(`Forma de Pagamento: `, ml, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(_v('osPgtoForma'), ml + 40, y);
      y += 8;
    }

    // ─── QR CODE (link para portal do cliente) ───────────────
    const portalUrl = `${window.location.origin}/cliente.html?id=${osId || 'demo'}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(portalUrl)}`;

    try {
      const qrImg = await _loadImage(qrUrl);
      const qrX   = mr - 24;
      const qrY   = ph - 50;
      doc.addImage(qrImg, 'PNG', qrX, qrY, 20, 20);
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text('Acompanhe sua O.S.', qrX + 10, qrY + 22, { align: 'center' });
    } catch (e) { /* QR opcional */ }

    // ─── ÁREA DE ASSINATURA ─────────────────────────────────
    const sigY = ph - 45;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(ml, sigY, ml + 65, sigY);
    doc.line(pw / 2 + 4, sigY, pw / 2 + 69, sigY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('Assinatura do Cliente', ml + 32, sigY + 4, { align: 'center' });
    doc.text('Assinatura do Técnico', pw / 2 + 36, sigY + 4, { align: 'center' });

    // ─── PÁGINA DE FOTOS / PROVAS DA O.S. (NOVO) ────────────────
    // Se a OS tem fotos no Cloudinary, monta uma grade de miniaturas em página nova
    const fotosOS = (os.media || os.fotos || []).filter(m => {
      // Aceita strings (URLs) ou objetos {url, ...}
      if (!m) return false;
      const url = typeof m === 'string' ? m : (m.url || m.secure_url || '');
      return url && /^https?:\/\//i.test(url);
    }).map(m => typeof m === 'string' ? m : (m.url || m.secure_url));

    if (fotosOS.length > 0) {
      doc.addPage();
      let yFotos = 18;
      // Cabeçalho da página de fotos
      doc.setFillColor(bR, bG, bB);
      doc.rect(0, 0, pw, 14, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('GALERIA DE PROVAS — ' + osNum, ml, 9);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${fotosOS.length} foto(s) registrada(s) durante o atendimento`, pw - mr, 9, { align: 'right' });

      // Grid 2 colunas × N linhas; cada thumb 85×60mm
      const cols = 2;
      const thumbW = (pw - ml - mr - 8) / cols;  // 8mm gap
      const thumbH = thumbW * 0.7;  // proporção 4:3 ish
      yFotos = 22;

      for (let i = 0; i < fotosOS.length; i++) {
        const col = i % cols;
        const x = ml + col * (thumbW + 8);

        // Quebra de página se for estourar
        if (yFotos + thumbH > ph - 20) {
          doc.addPage();
          yFotos = 18;
        }

        try {
          // Carrega imagem do Cloudinary (com transformação para reduzir tamanho)
          const url = fotosOS[i];
          // Se for Cloudinary, aplica transformação para 600x450 jpg (mais leve)
          let urlFinal = url;
          if (url.includes('cloudinary.com') && url.includes('/upload/')) {
            urlFinal = url.replace('/upload/', '/upload/w_600,h_450,c_fill,q_auto,f_jpg/');
          }
          const img = await _loadImage(urlFinal, 5000);  // timeout 5s
          // Determina formato pela extensão
          const fmt = /\.png/i.test(url) ? 'PNG' : 'JPEG';
          doc.addImage(img, fmt, x, yFotos, thumbW, thumbH, undefined, 'FAST');
          // Borda
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.rect(x, yFotos, thumbW, thumbH);
          // Legenda
          doc.setFontSize(6.5);
          doc.setTextColor(120, 120, 120);
          doc.text(`Foto ${i + 1}/${fotosOS.length}`, x + 1, yFotos + thumbH + 3);
        } catch (e) {
          // Falha ao carregar — desenha placeholder
          doc.setFillColor(245, 245, 245);
          doc.rect(x, yFotos, thumbW, thumbH, 'F');
          doc.setFontSize(7);
          doc.setTextColor(180, 180, 180);
          doc.text('(imagem indisponível)', x + thumbW / 2, yFotos + thumbH / 2, { align: 'center' });
          console.warn('Foto não carregou:', fotosOS[i]);
        }

        // Quando completa a linha, avança yFotos
        if (col === cols - 1) yFotos += thumbH + 8;
      }
      // Volta para a última página da OS para não bagunçar o rodapé
      doc.setPage(1);
    }

    // ─── RODAPÉ COM ASSINATURA thIAguinho ─────────────────────
    // Aplica em TODAS as páginas (inclusive as de fotos)
    const totalPaginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFillColor(245, 247, 250);
      doc.rect(0, ph - 18, pw, 18, 'F');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      const footerText = brand.footer || `${J.tnome}`;
      doc.text(footerText, ml, ph - 12);
      // Assinatura "Powered by thIAguinho" centralizada
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Powered by thIAguinho Soluções Digitais', pw / 2, ph - 8, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bR, bG, bB);
      doc.text(osNum + ' · pág ' + p + '/' + totalPaginas, mr, ph - 8, { align: 'right' });
    }
    doc.setPage(1);

    // ─── SALVAR ─────────────────────────────────────────────
    const fileName = `Laudo_${veiculo?.placa || 'OS'}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
    toastOk(`PDF gerado com sucesso — ${fileName}`);
    audit('PDF', `Gerou laudo da O.S. ${osNum}`);

  } catch (e) {
    toastErr('Erro ao gerar PDF: ' + e.message);
    console.error(e);
  } finally {
    setLoading('btnGerarPDFOS', false, '📄 EXPORTAR LAUDO PDF');
  }
};

// ─── HELPERS ────────────────────────────────────────────────

function _sectionHeader(doc, text, x, y, pw, r, g, b) {
  doc.setFillColor(r, g, b, 0.08);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(r, g, b);
  doc.rect(x, y - 4, pw - 28, 6, 'S');
  doc.setFillColor(r, g, b);
  doc.rect(x, y - 4, 3, 6, 'F');
  doc.text(text, x + 6, y);
  doc.setTextColor(40, 40, 40);
}

function _labelValue(doc, label, value, lx, ly, vx, vy) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(label + ':', lx, ly);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(String(value || '—'), lx, ly + 4.5);
}

function _hexToRGB(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16)
  ];
}

function _loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}
