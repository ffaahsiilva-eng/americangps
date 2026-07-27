import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";
import type { ReceiptCompany } from "@/lib/receipt-print";

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export type ReportNote = {
  note_number: number;
  occurred_at: string;
  payment_method: string | null;
  paid: boolean;
  total: number;
  items: Array<{ kind: ServiceCategory; description: string; amount: number }>;
};

export type ReportClient = {
  clientName: string;
  clientPhone?: string | null;
  notes: ReportNote[];
};

export type MonthlyReportContext = {
  company: ReceiptCompany;
  logoUrl: string;
  monthLabel: string; // "Outubro/2026"
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  clients: ReportClient[];
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
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

export async function buildMonthlyReportPdfBlob(ctx: MonthlyReportContext): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const logoData = await urlToDataUrl(ctx.logoUrl).catch(() => null);
  const empresa = ctx.company.name || "AMERICAN GPS";

  const drawHeader = () => {
    if (logoData) {
      try { doc.addImage(logoData, "PNG", margin, margin, 60, 60); } catch { /* ignore */ }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(empresa, margin + 74, margin + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let hy = margin + 32;
    if (ctx.company.cnpj) { doc.text(`CNPJ: ${ctx.company.cnpj}`, margin + 74, hy); hy += 11; }
    if (ctx.company.address) { doc.text(ctx.company.address, margin + 74, hy); hy += 11; }
    const contact = [ctx.company.phone, ctx.company.email].filter(Boolean).join(" · ");
    if (contact) { doc.text(contact, margin + 74, hy); hy += 11; }
    const headerBottom = Math.max(margin + 66, hy + 4);
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.line(margin, headerBottom, pageW - margin, headerBottom);
    return headerBottom + 16;
  };

  const drawFooter = (pageNum: number, pageTotal: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Relatório mensal · ${ctx.monthLabel} · Página ${pageNum} de ${pageTotal}`,
      pageW / 2,
      pageH - 20,
      { align: "center" },
    );
    doc.setTextColor(0);
  };

  y = drawHeader();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Relatório Mensal — ${ctx.monthLabel}`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Período: ${fmtDate(ctx.fromDate)} a ${fmtDate(ctx.toDate)}`, margin, y);
  doc.setTextColor(0);
  y += 18;

  // Summary
  const grandTotal = ctx.clients.reduce(
    (s, c) => s + c.notes.reduce((ss, n) => ss + Number(n.total || 0), 0),
    0,
  );
  const totalNotes = ctx.clients.reduce((s, c) => s + c.notes.length, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    `Clientes: ${ctx.clients.length}   ·   Notas: ${totalNotes}   ·   Total: ${fmtBRL(grandTotal)}`,
    margin,
    y,
  );
  y += 20;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin - 30) {
      doc.addPage();
      y = drawHeader();
    }
  };

  const colDescX = margin + 12;
  const colQtyX = pageW - margin - 200;
  const colUnitX = pageW - margin - 130;
  const colTotalX = pageW - margin;

  for (const client of ctx.clients) {
    // Start each client on a fresh area (new page if not enough space)
    ensureSpace(80);
    // Client heading
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.setFillColor(20, 20, 20);
    doc.rect(margin, y, pageW - margin * 2, 22, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(client.clientName.toUpperCase(), margin + 8, y + 15);
    const clientTotal = client.notes.reduce((s, n) => s + Number(n.total || 0), 0);
    doc.text(fmtBRL(clientTotal), pageW - margin - 8, y + 15, { align: "right" });
    doc.setTextColor(0);
    y += 30;

    if (client.clientPhone) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Tel: ${client.clientPhone}`, margin, y);
      doc.setTextColor(0);
      y += 12;
    }

    for (const note of client.notes) {
      ensureSpace(50);
      // Note header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const noteStr = `Nota Nº ${String(note.note_number).padStart(4, "0")}`;
      const methodLabel = note.payment_method
        ? METHOD_LABEL[note.payment_method] ?? note.payment_method
        : "Em aberto";
      doc.text(`${noteStr}  ·  ${fmtDate(note.occurred_at)}`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(
        `${methodLabel}${note.paid ? " · Pago" : ""}`,
        pageW - margin,
        y,
        { align: "right" },
      );
      doc.setTextColor(0);
      y += 12;

      // Column heads
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("DESCRIÇÃO", colDescX, y);
      doc.text("QTD", colQtyX, y, { align: "right" });
      doc.text("UNIT.", colUnitX, y, { align: "right" });
      doc.text("TOTAL", colTotalX, y, { align: "right" });
      doc.setTextColor(0);
      y += 4;
      doc.setDrawColor(200);
      doc.line(margin, y, pageW - margin, y);
      y += 10;

      // Group by category
      const groups = new Map<ServiceCategory, typeof note.items>();
      for (const it of note.items) {
        const arr = groups.get(it.kind) ?? [];
        arr.push(it);
        groups.set(it.kind, arr);
      }

      for (const [cat, list] of groups) {
        ensureSpace(18);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text(CATEGORY_LABEL[cat].toUpperCase(), colDescX, y);
        doc.setTextColor(0);
        y += 11;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        for (const it of list) {
          ensureSpace(14);
          const desc = doc.splitTextToSize(it.description, colQtyX - colDescX - 10);
          doc.text(desc, colDescX, y);
          doc.text("1", colQtyX, y, { align: "right" });
          doc.text(fmtBRL(Number(it.amount)), colUnitX, y, { align: "right" });
          doc.text(fmtBRL(Number(it.amount)), colTotalX, y, { align: "right" });
          y += Math.max(12, desc.length * 11);
        }
      }

      // Note total
      ensureSpace(20);
      doc.setDrawColor(150);
      doc.line(margin + 200, y, pageW - margin, y);
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Total da nota", colUnitX, y, { align: "right" });
      doc.text(fmtBRL(Number(note.total)), colTotalX, y, { align: "right" });
      y += 18;
    }

    // Client subtotal box
    ensureSpace(30);
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.rect(pageW - margin - 220, y, 220, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Subtotal do cliente", pageW - margin - 212, y + 15);
    doc.text(fmtBRL(clientTotal), pageW - margin - 8, y + 15, { align: "right" });
    y += 34;
  }

  // Grand total
  ensureSpace(60);
  y += 6;
  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.rect(pageW - margin - 260, y, 260, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL GERAL DO MÊS", pageW - margin - 252, y + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(fmtBRL(grandTotal), pageW - margin - 10, y + 34, { align: "right" });

  // Footer on all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
