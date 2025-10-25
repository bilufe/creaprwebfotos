// script.js — offline with per-image captions editable in preview + JPEG compression
(() => {
  const { jsPDF } = window.jspdf || {};
  const input = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const btn = document.getElementById("generate");
  const statusEl = document.getElementById("status");
  const reportEl = document.getElementById("reportNumber");
  const logoImg = document.getElementById("logo");

  let files = [];
  let previewItems = []; // {file, dataUrl, captionInput}

  // compress and convert any image to JPEG with given quality
  const compressImageToJPEG = (file, quality = 0.5) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 1; // opcional: reduzir resolução
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      reader.readAsDataURL(file);
    });
  };

  const logoToDataURL = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = logoImg.naturalWidth || 200;
    canvas.height = logoImg.naturalHeight || 60;
    ctx.drawImage(logoImg, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  };

  input.addEventListener("change", async (e) => {
    files = Array.from(e.target.files);
    preview.innerHTML = "";
    previewItems = [];
    if (!files.length) { statusEl.textContent = ''; return; }
    statusEl.textContent = `${files.length} imagem(ns) selecionada(s)`;

    for (const f of files) {
      const dataUrl = await compressImageToJPEG(f, 0.5); // 50% de qualidade
      const div = document.createElement("div");
      div.className = "thumb";
      const img = document.createElement("img");
      img.src = dataUrl;
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = f.name;
      const caption = document.createElement("input");
      caption.className = "caption";
      caption.type = "text";
      caption.placeholder = "Legenda da foto (opcional)";
      div.appendChild(img);
      div.appendChild(name);
      div.appendChild(caption);
      preview.appendChild(div);
      previewItems.push({ file: f, dataUrl, captionInput: caption });
    }
  });

  btn.addEventListener("click", async () => {
    if (!previewItems.length) { alert("Selecione imagens."); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("Biblioteca jsPDF não encontrada. Coloque 'jspdf.umd.min.js' na mesma pasta."); 
      return;
    }

    btn.disabled = true;
    statusEl.textContent = "Gerando...";
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15, headerH = 22, footerH = 12;
    const usableH = pageH - margin - headerH - footerH;
    const gap = 8;
    const slotH = (usableH - gap) / 2;
    const usableW = pageW - margin * 2;
    const logoData = logoToDataURL();

    const drawHeader = (doc, reportNumber) => {
      try { doc.addImage(logoData, 'PNG', margin, margin-1, 60, 14, undefined, 'FAST'); } catch(e){}
      doc.setFontSize(13); doc.setFont(undefined, 'bold');
      doc.text('Relatório de Fiscalização', margin + 68, margin + 6);
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      const txt = `Relatório nº ${reportNumber || ''}`;
      const w = doc.getTextWidth(txt);
      doc.text(txt, pageW - margin - w, margin + 6);
      doc.setDrawColor(200); doc.setLineWidth(0.25);
      doc.line(margin, margin + headerH - 3, pageW - margin, margin + headerH - 3);
    };

    const drawFooter = (doc, p, total) => {
      doc.setFontSize(9);
      const y = pageH - margin + 6;
      const dateStr = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      doc.text(dateStr, margin, y);
      const pageStr = `Página ${p}${total ? ' / ' + total : ''}`;
      const pw = doc.getTextWidth(pageStr);
      doc.text(pageStr, pageW - margin - pw, y);
    };

    // prepare image data array
    const images = previewItems.map(pi => ({ dataUrl: pi.dataUrl, caption: pi.captionInput.value.trim() }));

    let pageIndex = 0;
    for (let i = 0; i < images.length; i += 2) {
      pageIndex++;
      if (pageIndex > 1) pdf.addPage();
      drawHeader(pdf, reportEl.value.trim());

      for (let slot = 0; slot < 2; slot++) {
        const idx = i + slot;
        if (idx >= images.length) break;

        const boxX = margin + 6;
        const boxY = margin + headerH + 6 + slot * (slotH + gap);
        const boxW = usableW - 12;
        const boxH = slotH - 22;

        const img = new Image();
        img.src = images[idx].dataUrl;
        await new Promise(res => { img.onload = res; img.onerror = res; });
        const pxW = img.naturalWidth || 800;
        const pxH = img.naturalHeight || 600;
        const ratio = Math.min(boxW / pxW, boxH / pxH);
        const wmm = pxW * ratio;
        const hmm = pxH * ratio;
        const x = boxX + (boxW - wmm) / 2;
        const y = boxY + (boxH - hmm) / 2;

        pdf.addImage(images[idx].dataUrl, 'JPEG', x, y, wmm, hmm, undefined, 'FAST');

        pdf.setDrawColor(150); pdf.setLineWidth(0.6);
        pdf.rect(x - 1.5, y - 1.5, wmm + 3, hmm + 3, 'S');

        const caption = images[idx].caption || '';
        if (caption) {
          pdf.setFontSize(10);
          const capY = y + hmm + 6;
          const maxWidth = boxW - 12;
          const lines = pdf.splitTextToSize(caption, maxWidth);
          pdf.text(lines, margin + 6 + (boxW - maxWidth) / 2, capY);
        }
      }
    }

    const total = pdf.getNumberOfPages();
    for (let p = 1; p <= total; p++) { pdf.setPage(p); drawFooter(pdf, p, total); }

    const safeReport = (reportEl.value || 'relatorio').replace(/[^a-zA-Z0-9-_]/g, '_');
    pdf.save(`Relatorio_Fiscalizacao_${safeReport}.pdf`);
    statusEl.textContent = 'PDF salvo.';
    btn.disabled = false;
  });
})();
