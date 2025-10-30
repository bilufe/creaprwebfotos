/* app.js (versão 2)
   - Ajusta o tamanho das imagens no PDF
   - Permite escolher 1 ou 2 fotos por página
*/
const gallery = document.getElementById('gallery');
const fileInput = document.getElementById('fileInput');
const generatePdfBtn = document.getElementById('generatePdf');
const reportNumberInput = document.getElementById('reportNumber');
const photosPerPageSelect = document.getElementById('photosPerPage');

let items = []; // {id, file, dataUrl, caption, order}

function uid(){ return Math.random().toString(36).slice(2,9); }

fileInput.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files||[]);
  for(const f of files){
    if(!f.type.startsWith('image/')) continue;
    const id = uid();
    const dataUrl = await fileToDataURL(f);
    items.push({id, file: f, dataUrl, caption:'', order: items.length});
  }
  renderGallery();
  fileInput.value = '';
});

async function fileToDataURL(file){
  return new Promise(res=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.readAsDataURL(file);
  });
}

function renderGallery(){
  gallery.innerHTML = '';
  items.sort((a,b)=>a.order-b.order);
  items.forEach(it=>{
    const card = document.createElement('div'); card.className='card'; card.draggable=true; card.dataset.id=it.id;
    const img = document.createElement('img'); img.className='thumb'; img.src=it.dataUrl;
    const input = document.createElement('input'); input.className='caption'; input.placeholder='Legenda...'; input.value=it.caption;
    input.addEventListener('input', e=>{ it.caption = e.target.value; });
    const actions = document.createElement('div'); actions.className='actions';
    const up = document.createElement('button'); up.textContent='↑'; up.title='Subir'; up.addEventListener('click', ()=> moveItem(it.id, -1));
    const down = document.createElement('button'); down.textContent='↓'; down.title='Descer'; down.addEventListener('click', ()=> moveItem(it.id, 1));
    const remove = document.createElement('button'); remove.textContent='Remover'; remove.addEventListener('click', ()=>{ items = items.filter(x=>x.id!==it.id); renderGallery(); });
    actions.appendChild(up); actions.appendChild(down); actions.appendChild(remove);
    card.appendChild(img); card.appendChild(input); card.appendChild(actions);
    gallery.appendChild(card);
  });
}

function moveItem(id, delta){
  const idx = items.findIndex(x=>x.id===id);
  if(idx<0) return;
  const newIdx = Math.max(0, Math.min(items.length-1, idx+delta));
  const [it] = items.splice(idx,1);
  items.splice(newIdx,0,it);
  items.forEach((x,i)=>x.order=i);
  renderGallery();
}

// Compress image to ~1 MB
async function compressImageDataUrl(dataUrl, targetMaxBytes=1_000_000){
  const img = await loadImage(dataUrl);
  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  let [w,h] = [img.width, img.height];
  const maxDim = 2000;
  if(Math.max(w,h) > maxDim){
    const scale = maxDim / Math.max(w,h);
    w = Math.round(w*scale); h = Math.round(h*scale);
  }
  canvas.width = w; canvas.height = h;
  ctx.drawImage(img,0,0,w,h);

  let qLow=0.3, qHigh=0.95, q=0.9;
  let blob = await canvasToBlob(canvas, q);
  for(let i=0;i<8;i++){
    if(blob.size <= targetMaxBytes) { qLow = q; q = (q + qHigh)/2; }
    else { qHigh = q; q = (q + qLow)/2; }
    blob = await canvasToBlob(canvas, q);
  }
  while(blob.size > targetMaxBytes && (w>400 || h>400)){
    w = Math.round(w*0.9); h = Math.round(h*0.9);
    canvas.width = w; canvas.height = h;
    ctx = canvas.getContext('2d');
    ctx.drawImage(img,0,0,w,h);
    blob = await canvasToBlob(canvas, qLow);
  }
  return blob;
}

function loadImage(dataUrl){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>res(i);
    i.onerror=rej;
    i.src=dataUrl;
  });
}
function canvasToBlob(canvas, quality){
  return new Promise(res=>canvas.toBlob(res, 'image/jpeg', quality));
}

generatePdfBtn.addEventListener('click', async ()=>{
  if(items.length===0){ alert('Nenhuma imagem.'); return; }
  const reportNumber = reportNumberInput.value.trim() || 'xxxx/7-xxxxxx-x';
  const photosPerPage = parseInt(photosPerPageSelect.value);
  const jsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : (window.jsPDF || null);
  if(!jsPDF){ alert('Biblioteca jsPDF não carregada.'); return; }
  await generateWithJsPDF(reportNumber, jsPDF, photosPerPage);
});

async function generateWithJsPDF(reportNumber, jsPDFClass, photosPerPage){
  const doc = new jsPDFClass({unit:'mm', format:'a4'});
  const pageW = 210, pageH = 297;
  const margin = 12;
  const usableW = pageW - margin*2;
  const usableH = pageH - margin*2 - 20;
  const dateStr = new Date().toLocaleDateString();

  function addHeaderFooter(pdf){
    pdf.setFontSize(10);
    pdf.text(`Fotografias do Relatório de Fiscalização nº ${reportNumber}`, margin, 10);
    pdf.setFontSize(8);
    pdf.text(`${dateStr}`, margin, pageH - 6);
  }

  const perPage = photosPerPage === 1 ? 1 : 2;
  for(let i=0;i<items.length;i+=perPage){
    if(i>0) doc.addPage();
    addHeaderFooter(doc);
    for(let col=0; col<perPage; col++){
      const idx = i+col;
      if(idx >= items.length) break;
      const item = items[idx];
      const blob = await compressImageDataUrl(item.dataUrl, 1_000_000);
      const dataUrl = await blobToDataURL(blob);
      const img = await loadImage(dataUrl);

      // Calcula o espaço por imagem
      let slotH = (usableH / perPage) - (perPage===2?8:0);
      let slotW = usableW;
      const x = margin;
      const y = margin + 12 + col*(slotH + 12);

      // Ajusta proporção para preencher o quadro (mantendo borda mínima)
      const ratio = Math.min(slotW/img.width, slotH/img.height);
      const wmm = img.width * ratio;
      const hmm = img.height * ratio;
      const xpos = x + (slotW - wmm)/2;
      const ypos = y + (slotH - hmm)/2;

      // Insere imagem e legenda
      doc.addImage(dataUrl, 'JPEG', xpos, ypos, wmm, hmm, undefined, 'FAST');
      doc.setFontSize(9);
      doc.text(item.caption || ' ', margin+2, y + slotH - 3, {maxWidth: usableW-4});
    }
  }
  const outName = `Fotos_Relatorio_${reportNumber.replace(/\s+/g,'_') || 'relatorio'}.pdf`.replace(/[:\/\?<>\*|"]/g,'_');
  doc.save(outName);
}

function blobToDataURL(blob){
  return new Promise(res=>{
    const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob);
  });
}

renderGallery();
