// script.js — offline with per-image captions editable + JPEG compression ≤1MB + drag & drop + 1/2 fotos por página
(() => {
  const { jsPDF } = window.jspdf || {};
  const input = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const btn = document.getElementById("generate");
  const statusEl = document.getElementById("status");
  const reportEl = document.getElementById("reportNumber");
  const logoImg = document.getElementById("logo");

  let previewItems = []; // {file, dataUrl, captionInput}

  // compress and convert image to JPEG ≤1MB
  const compressImageToJPEG = (file, maxMB = 1) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let quality = 0.9;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length / 1024 / 1024 > maxMB && quality > 0.05) {
          quality -= 0.05;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        fetch(dataUrl).then(r => r.blob()).then(blob => resolve(blob));
      };
      reader.readAsDataURL(file);
    });
  };

  // convert logo to dataURL
  const logoToDataURL = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = logoImg.naturalWidth || 200;
    canvas.height = logoImg.naturalHeight || 60;
    ctx.drawImage(logoImg, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  };

  // render preview thumbnails with drag & drop
  const renderPreview = () => {
    preview.innerHTML = "";
    previewItems.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "thumb";
      div.draggable = true;
      div.dataset.index = idx;

      const imgEl = document.createElement("img");
      imgEl.src = item.dataUrl;
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.file.name;
      const caption = document.createElement("input");
      caption.className = "caption";
      caption.type = "text";
      caption.placeholder = "Legenda da foto (opcional)";
      caption.value = item.captionInput?.value || "";
      div.appendChild(imgEl);
      div.appendChild(name);
      div.appendChild(caption);
      preview.appendChild(div);

      // store input reference
      item.captionInput = caption;

      // drag & drop events
      div.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", idx); div.style.opacity = "0.5"; });
      div.addEventListener("dragend", e => { div.style.opacity = "1"; });
      div.addEventListener("dragover", e => e.preventDefault());
      div.addEventListener("drop", e => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain"));
        const to = idx;
        if (from === to) return;
        const moved = previewItems.splice(from,1)[0];
        previewItems.splice(to,0,moved);
        renderPreview();
      });
    });
  };

  input.addEventListener("change", async e => {
    const files = Array.from(e.target.files);
    if (!files.length) { statusEl.textContent = ''; return; }
    statusEl.textContent = `${files.length} imagem(ns) selecionada(s)`;

    for (const f of files) {
      const blob = await compressImageToJPEG(f, 1);
      const dataUrl = URL.createObjectURL(blob);
      previewItems.push({ file: f, dataUrl, captionInput: null });
    }
    renderPreview();
    input.value = "";
  });

  btn.addEventListener("click", async () => {
    if (!previewItems.length) { alert("Selecione imagens."); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("Biblioteca jsPDF não encontrada."); return; }

    // escolha 1 ou 2 fotos por página
    let fotosPorPagina = parseInt(prompt("Quantas fotos por página? (1 ou 2)", "2"));
    if (![1,2].includes(fotosPorPagina)) fotosPorPagina = 2;

    btn.disabled = true;
    statusEl.textContent = "Gerando...";

    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const headerH = 22;
    const footerH = 12;
    const usableH = pageH - margin - headerH - footerH;
    const gap = 8;
    const slotH = (usableH - (fotosPorPagina-1)*gap) / fotosPorPagina;
    const usableW = pageW - margin *2;
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
      doc.text("Fotos da data da fiscalização", pageW/2, y, { align: "center" });
      const pageStr = `Página ${p} de ${total}`;
      const pw = doc.getTextWidth(pageStr);
      doc.text(pageStr, pageW - margin - pw, y);
    };

    const images = previewItems.map(pi => ({ dataUrl: pi.dataUrl, caption: pi.captionInput.value.trim() }));

    let pageIndex = 0;
    for (let i=0; i<images.length; i+=fotosPorPagina){
      pageIndex++;
      if (pageIndex>1) pdf.addPage();
      drawHeader(pdf, reportEl.value.trim());

      for (let slot = 0; slot < fotosPorPagina; slot++){
        const idx = i + slot;
        if (idx >= images.length) break;

        const boxX = margin + 6;
        const boxY = margin + headerH + 6 + slot*(slotH + gap);
        const boxW = usableW - 12;
        const boxH = slotH - 12;

        const img = new Image();
        img.src = images[idx].dataUrl;
        await new Promise(res=>{ img.onload=res; img.onerror=res; });

        const pxW = img.naturalWidth || 800;
        const pxH = img.naturalHeight || 600;
        const ratio = Math.min(boxW/pxW, boxH/pxH);
        const wmm = pxW * ratio;
        const hmm = pxH * ratio;
        const x = boxX + (boxW - wmm)/2;
        const y = boxY + (boxH - hmm)/2;

        pdf.addImage(images[idx].dataUrl, 'JPEG', x, y, wmm, hmm, undefined, 'FAST');
        pdf.setDrawColor(150); pdf.setLineWidth(0.6);
        pdf.rect(x-1.5, y-1.5, wmm+3, hmm+3, 'S');

        const caption = images[idx].caption || '';
        if(caption){
          pdf.setFontSize(10);
          const capY = y + hmm + 4;
          const lines = pdf.splitTextToSize(caption, boxW-12);
          pdf.text(lines, boxX, capY);
        }
      }
    }

    const total = pdf.getNumberOfPages();
    for (let p=1; p<=total; p++){ pdf.setPage(p); drawFooter(pdf, p, total); }

    const safeReport = (reportEl.value || 'relatorio').replace(/[^a-zA-Z0-9-_]/g, '_');
    pdf.save(`Relatorio_Fiscalizacao_${safeReport}.pdf`);
    statusEl.textContent = "PDF salvo.";
    btn.disabled = false;
  });
})();
