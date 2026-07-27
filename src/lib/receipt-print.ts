import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";

export type ReceiptItem = {
  category: ServiceCategory;
  service: string;
  qty: number;
  unit: number;
  total: number;
};

export type ReceiptCompany = {
  name?: string | null;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type ReceiptContext = {
  company: ReceiptCompany;
  logoUrl: string;
  clientName: string;
  clientPhone?: string | null;
  items: ReceiptItem[];
  total: number;
  method: string | null;
  dateStr: string; // YYYY-MM-DD
  invoiceNumber?: number | null;
};

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function groupByCategory(items: ReceiptItem[]) {
  const map = new Map<ServiceCategory, ReceiptItem[]>();
  for (const it of items) {
    const arr = map.get(it.category) ?? [];
    arr.push(it);
    map.set(it.category, arr);
  }
  return Array.from(map.entries());
}

export function buildReceiptText(ctx: ReceiptContext): string {
  const lines: string[] = [];
  const empresa = ctx.company.name || "AMERICAN GPS";
  lines.push(`*${empresa}*`);
  if (ctx.company.cnpj) lines.push(`CNPJ: ${ctx.company.cnpj}`);
  if (ctx.company.address) lines.push(ctx.company.address);
  if (ctx.company.phone) lines.push(`Tel: ${ctx.company.phone}`);
  lines.push("");
  if (ctx.invoiceNumber) lines.push(`*Nota Nº ${String(ctx.invoiceNumber).padStart(4, "0")}*`);
  lines.push(`Data: ${fmtDate(ctx.dateStr)}`);
  lines.push(`Cliente: ${ctx.clientName}`);
  lines.push("");
  lines.push("*Serviços*");
  for (const [cat, list] of groupByCategory(ctx.items)) {
    lines.push(`— ${CATEGORY_LABEL[cat]} —`);
    for (const it of list) {
      lines.push(`• ${it.service} — ${it.qty} x ${fmtBRL(it.unit)} = ${fmtBRL(it.total)}`);
    }
  }
  lines.push("");
  lines.push(`*TOTAL: ${fmtBRL(ctx.total)}*`);
  if (ctx.method) lines.push(`Pagamento: ${METHOD_LABEL[ctx.method] ?? ctx.method}`);
  else lines.push("Pagamento: Em aberto");
  lines.push("");
  lines.push("Obrigado pela preferência!");
  return lines.join("\n");
}

export function buildReceiptHTML(ctx: ReceiptContext): string {
  const empresa = ctx.company.name || "AMERICAN GPS";
  const rows = groupByCategory(ctx.items)
    .map(([cat, list]) => {
      const catTotal = list.reduce((s, i) => s + i.total, 0);
      const itemsHtml = list
        .map(
          (it) => `
        <tr>
          <td>${escapeHtml(it.service)}</td>
          <td class="num">${it.qty}</td>
          <td class="num">${fmtBRL(it.unit)}</td>
          <td class="num">${fmtBRL(it.total)}</td>
        </tr>`,
        )
        .join("");
      return `
      <tr class="cat"><td colspan="4">${escapeHtml(CATEGORY_LABEL[cat])}</td></tr>
      ${itemsHtml}
      <tr class="subtotal"><td colspan="3">Subtotal ${escapeHtml(CATEGORY_LABEL[cat])}</td><td class="num">${fmtBRL(catTotal)}</td></tr>`;
    })
    .join("");

  const methodLabel = ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : "Em aberto";
  const invoiceLabel = ctx.invoiceNumber ? `Nota Nº ${String(ctx.invoiceNumber).padStart(4, "0")}` : "";

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8" />
<title>Recibo — ${escapeHtml(ctx.clientName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111; margin: 0; padding: 32px; background: #fff; }
  .wrap { max-width: 820px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
  header img { width: 92px; height: 92px; object-fit: contain; }
  header .co { flex: 1; }
  header h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: .04em; }
  header p { margin: 2px 0; font-size: 12px; color: #444; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
  .meta .box { border: 1px solid #ddd; padding: 10px 14px; border-radius: 6px; min-width: 220px; }
  .meta strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #666; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { text-align: left; border-bottom: 2px solid #111; padding: 8px 6px; text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
  tbody td { padding: 6px; border-bottom: 1px solid #eee; }
  tr.cat td { background: #f4f4f4; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .08em; padding: 6px 8px; }
  tr.subtotal td { font-weight: 700; border-top: 1px solid #999; }
  .num { text-align: right; white-space: nowrap; }
  .total { display: flex; justify-content: flex-end; margin-top: 20px; }
  .total .card { border: 2px solid #111; padding: 12px 22px; border-radius: 8px; text-align: right; }
  .total small { display: block; text-transform: uppercase; font-size: 11px; letter-spacing: .1em; color: #666; }
  .total b { font-size: 22px; }
  .pay { margin-top: 10px; text-align: right; font-size: 13px; color: #333; }
  footer { margin-top: 30px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 14px; }
  @media print { body { padding: 0; } .noprint { display: none !important; } }
  .toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
  .toolbar button { background: #111; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }
</style>
</head><body>
<div class="toolbar noprint">
  <button onclick="window.print()">Imprimir / Salvar PDF</button>
  <button onclick="window.close()" style="background:#666">Fechar</button>
</div>
<div class="wrap">
  <header>
    <img src="${escapeHtml(ctx.logoUrl)}" alt="Logomarca" />
    <div class="co">
      <h1>${escapeHtml(empresa)}</h1>
      ${ctx.company.cnpj ? `<p>CNPJ: ${escapeHtml(ctx.company.cnpj)}</p>` : ""}
      ${ctx.company.address ? `<p>${escapeHtml(ctx.company.address)}</p>` : ""}
      ${ctx.company.phone || ctx.company.email ? `<p>${[ctx.company.phone, ctx.company.email].filter((v): v is string => !!v).map(escapeHtml).join(" · ")}</p>` : ""}
    </div>
  </header>
  <div class="meta">
    <div class="box">
      <strong>Cliente</strong>
      ${escapeHtml(ctx.clientName)}
      ${ctx.clientPhone ? `<br/><span style="color:#555">${escapeHtml(ctx.clientPhone)}</span>` : ""}
    </div>
    <div class="box">
      <strong>Documento</strong>
      ${invoiceLabel ? `${escapeHtml(invoiceLabel)}<br/>` : ""}
      Data: ${escapeHtml(fmtDate(ctx.dateStr))}
    </div>
  </div>
  <table>
    <thead><tr><th>Descrição</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total"><div class="card"><small>Total</small><b>${fmtBRL(ctx.total)}</b></div></div>
  <div class="pay">Forma de pagamento: <strong>${escapeHtml(methodLabel)}</strong></div>
  <footer>Obrigado pela preferência!</footer>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openPrintReceipt(ctx: ReceiptContext) {
  const html = buildReceiptHTML(ctx);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Habilite pop-ups para imprimir/salvar em PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export async function buildReceiptPdfBlob(ctx: ReceiptContext): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // Header: try to embed logo
  try {
    const dataUrl = await urlToDataUrl(ctx.logoUrl);
    if (dataUrl) doc.addImage(dataUrl, "PNG", margin, y, 70, 70);
  } catch {
    /* ignore */
  }

  const empresa = ctx.company.name || "AMERICAN GPS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(empresa, margin + 84, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let hy = y + 34;
  if (ctx.company.cnpj) {
    doc.text(`CNPJ: ${ctx.company.cnpj}`, margin + 84, hy);
    hy += 12;
  }
  if (ctx.company.address) {
    doc.text(ctx.company.address, margin + 84, hy);
    hy += 12;
  }
  const contact = [ctx.company.phone, ctx.company.email].filter(Boolean).join(" · ");
  if (contact) {
    doc.text(contact, margin + 84, hy);
    hy += 12;
  }

  y = Math.max(y + 80, hy + 4);
  doc.setDrawColor(0);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Meta boxes
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, y);
  doc.text("DOCUMENTO", pageW / 2 + 10, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(ctx.clientName, margin, y + 14);
  if (ctx.clientPhone) {
    doc.setFontSize(9);
    doc.text(ctx.clientPhone, margin, y + 28);
  }
  const invoiceLabel = ctx.invoiceNumber
    ? `Nota Nº ${String(ctx.invoiceNumber).padStart(4, "0")}`
    : "";
  doc.setFontSize(10);
  if (invoiceLabel) doc.text(invoiceLabel, pageW / 2 + 10, y + 14);
  doc.text(`Data: ${fmtDateSimple(ctx.dateStr)}`, pageW / 2 + 10, y + (invoiceLabel ? 28 : 14));

  y += 46;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Table header
  const colDescX = margin;
  const colQtdX = pageW - margin - 200;
  const colUnitX = pageW - margin - 130;
  const colTotalX = pageW - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIÇÃO", colDescX, y);
  doc.text("QTD", colQtdX, y, { align: "right" });
  doc.text("UNIT.", colUnitX, y, { align: "right" });
  doc.text("TOTAL", colTotalX, y, { align: "right" });
  y += 6;
  doc.setDrawColor(0);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  const groups = new Map<ServiceCategory, ReceiptItem[]>();
  for (const it of ctx.items) {
    const arr = groups.get(it.category) ?? [];
    arr.push(it);
    groups.set(it.category, arr);
  }

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin - 80) {
      doc.addPage();
      y = margin;
    }
  };

  for (const [cat, list] of groups) {
    ensureSpace(30);
    doc.setFillColor(240);
    doc.rect(margin, y - 10, pageW - margin * 2, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(CATEGORY_LABEL[cat].toUpperCase(), margin + 6, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let catTotal = 0;
    for (const it of list) {
      ensureSpace(18);
      const desc = doc.splitTextToSize(it.service, colQtdX - colDescX - 10);
      doc.text(desc, colDescX, y);
      doc.text(String(it.qty), colQtdX, y, { align: "right" });
      doc.text(fmtBRL(it.unit), colUnitX, y, { align: "right" });
      doc.text(fmtBRL(it.total), colTotalX, y, { align: "right" });
      y += Math.max(14, desc.length * 12);
      catTotal += it.total;
    }
    ensureSpace(20);
    doc.setDrawColor(200);
    doc.line(margin + 200, y - 4, pageW - margin, y - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Subtotal ${CATEGORY_LABEL[cat]}`, colUnitX, y + 6, { align: "right" });
    doc.text(fmtBRL(catTotal), colTotalX, y + 6, { align: "right" });
    y += 22;
  }

  ensureSpace(80);
  y += 10;
  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.rect(pageW - margin - 200, y, 200, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL", pageW - margin - 190, y + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(fmtBRL(ctx.total), pageW - margin - 10, y + 40, { align: "right" });
  y += 62;

  const methodLabel = ctx.method
    ? METHOD_LABEL[ctx.method] ?? ctx.method
    : "Em aberto";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Forma de pagamento: ${methodLabel}`, pageW - margin, y, { align: "right" });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Obrigado pela preferência!", pageW / 2, pageH - margin, { align: "center" });

  return doc.output("blob");
}

function fmtDateSimple(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function pdfFilename(ctx: ReceiptContext): string {
  const safeName = ctx.clientName.replace(/[^\w\-]+/g, "_").slice(0, 40) || "cliente";
  const inv = ctx.invoiceNumber ? `_nota${String(ctx.invoiceNumber).padStart(4, "0")}` : "";
  return `Nota_${safeName}${inv}_${ctx.dateStr}.pdf`;
}

export function sanitizeWhatsappPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export async function openWhatsappReceipt(ctx: ReceiptContext): Promise<boolean> {
  const phone = sanitizeWhatsappPhone(ctx.clientPhone);
  if (!phone) {
    alert("Este cliente não tem telefone cadastrado.");
    return false;
  }
  const text = buildReceiptText(ctx);
  const filename = pdfFilename(ctx);

  // Try Web Share API with the PDF file (works on mobile WhatsApp)
  try {
    const blob = await buildReceiptPdfBlob(ctx);
    const file = new File([blob], filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData & { files?: File[] }) => boolean;
      share?: (data: ShareData & { files?: File[] }) => Promise<void>;
    };
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text, title: `Nota — ${ctx.clientName}` });
      return true;
    }

    // Desktop fallback: download PDF and open WhatsApp with the summary text.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) {
    console.error("PDF generation failed", e);
  }

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  return true;
}

const METHOD_LABEL_LOCAL_MARKER = 0; // keep imports below stable
void METHOD_LABEL_LOCAL_MARKER;

