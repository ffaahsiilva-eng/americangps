import type { ReceiptCompany } from "@/lib/receipt-print";
import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";

export type BillingService = {
  date: string; // YYYY-MM-DD
  plate: string;
  service: string;
  kind: string;
  amount: number;
  noteNumber: number;
};

export type BillingClient = {
  clientId: string;
  clientName: string;
  document: string;
  phone: string | null;
  total: number;
  services: BillingService[];
  plates: string[];
};

export function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function monthRange(monthValue: string) {
  const [yStr, mStr] = monthValue.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${yStr}-${mStr}-01`,
    to: `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`,
    label: `${MONTH_NAMES[month - 1]}/${year}`,
    short: `${mStr}/${yStr}`,
  };
}

/** Descrição gravada: "Serviço — PLACA · MODELO". Separa serviço e veículo. */
export function splitDescription(description: string) {
  const [service, ...rest] = description.split(" — ");
  const vehicle = rest.join(" — ").trim();
  const plate = vehicle ? (vehicle.split("·")[0] ?? "").trim() : "";
  return { service: (service ?? description).trim(), vehicle, plate };
}

export function categoryLabel(kind: string) {
  return CATEGORY_LABEL[kind as ServiceCategory] ?? kind;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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

export type ClosingContext = {
  company: ReceiptCompany;
  logoUrl: string;
  monthLabel: string;
  client: BillingClient;
};

export async function buildClosingPdfBlob(ctx: ClosingContext): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const logoData = await urlToDataUrl(ctx.logoUrl).catch(() => null);
  const empresa = ctx.company.name || "AMERICAN GPS";

  const drawHeader = () => {
    if (logoData) {
      try { doc.addImage(logoData, "PNG", margin, margin, 58, 58); } catch { /* ignore */ }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(empresa, margin + 72, margin + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let hy = margin + 32;
    if (ctx.company.cnpj) { doc.text(`CNPJ: ${ctx.company.cnpj}`, margin + 72, hy); hy += 11; }
    if (ctx.company.address) { doc.text(ctx.company.address, margin + 72, hy); hy += 11; }
    const contact = [ctx.company.phone, ctx.company.email].filter(Boolean).join(" · ");
    if (contact) { doc.text(contact, margin + 72, hy); hy += 11; }
    const bottom = Math.max(margin + 64, hy + 4);
    doc.setLineWidth(1);
    doc.line(margin, bottom, pageW - margin, bottom);
    return bottom + 18;
  };

  let y = drawHeader();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FECHAMENTO MENSAL", margin, y);
  y += 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Cliente: ${ctx.client.clientName}`, margin, y); y += 13;
  if (ctx.client.document) { doc.text(`Documento: ${ctx.client.document}`, margin, y); y += 13; }
  doc.text(`Período: ${ctx.monthLabel}`, margin, y); y += 20;

  // Tabela
  const cols = [
    { label: "DATA", x: margin, w: 62 },
    { label: "PLACA", x: margin + 62, w: 90 },
    { label: "SERVIÇO", x: margin + 152, w: pageW - margin * 2 - 152 - 80 },
    { label: "VALOR", x: pageW - margin - 80, w: 80 },
  ];

  const drawTableHead = () => {
    doc.setFillColor(20, 20, 20);
    doc.rect(margin, y - 11, pageW - margin * 2, 18, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(cols[0]!.label, cols[0]!.x + 4, y + 1);
    doc.text(cols[1]!.label, cols[1]!.x + 4, y + 1);
    doc.text(cols[2]!.label, cols[2]!.x + 4, y + 1);
    doc.text(cols[3]!.label, pageW - margin - 4, y + 1, { align: "right" });
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    y += 18;
  };

  drawTableHead();

  const sorted = [...ctx.client.services].sort(
    (a, b) => a.date.localeCompare(b.date) || a.plate.localeCompare(b.plate),
  );

  doc.setFontSize(9);
  for (const s of sorted) {
    const nameLines = doc.splitTextToSize(s.service, cols[2]!.w - 8) as string[];
    const rowH = Math.max(14, nameLines.length * 11 + 4);
    if (y + rowH > pageH - 70) {
      doc.addPage();
      y = drawHeader();
      drawTableHead();
      doc.setFontSize(9);
    }
    doc.text(fmtDate(s.date), cols[0]!.x + 4, y + 5);
    doc.text(s.plate || "—", cols[1]!.x + 4, y + 5);
    doc.text(nameLines, cols[2]!.x + 4, y + 5);
    doc.text(fmtBRL(s.amount), pageW - margin - 4, y + 5, { align: "right" });
    y += rowH;
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(margin, y - 4, pageW - margin, y - 4);
    doc.setDrawColor(0);
  }

  y += 14;
  if (y > pageH - 90) { doc.addPage(); y = drawHeader(); }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL DE SERVIÇOS: ${sorted.length}`, margin, y); y += 16;
  doc.setFontSize(13);
  doc.text(`TOTAL DO FATURAMENTO: ${fmtBRL(ctx.client.total)}`, margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Fechamento mensal · ${ctx.client.clientName} · ${ctx.monthLabel}`,
    pageW / 2,
    pageH - 20,
    { align: "center" },
  );

  return doc.output("blob");
}

export type ExcelRow = {
  date: string;
  client: string;
  document: string;
  plate: string;
  service: string;
  amount: number;
  notes: string;
};

export async function buildExcelBlob(rows: ExcelRow[], sheetName = "Fechamento"): Promise<Blob> {
  const XLSX = await import("xlsx");
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const aoa: (string | number)[][] = [
    ["Data", "Cliente", "Documento", "Placa", "Serviço", "Valor", "Observações"],
    ...rows.map((r) => [
      fmtDate(r.date), r.client, r.document, r.plate, r.service, r.amount, r.notes,
    ]),
    [],
    ["", "", "", "", "TOTAL FATURADO", total, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 14 },
    { wch: 46 }, { wch: 14 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 28) || "Fechamento");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Lê CSV ou XLSX e devolve as linhas normalizadas para importação. */
export type ImportRow = {
  date: string;
  client: string;
  document: string;
  plate: string;
  service: string;
  amount: number;
  notes: string;
};

function normalizeKey(k: string) {
  return k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseAmount(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!s) return 0;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  return "";
}

export async function parseImportFile(file: File): Promise<ImportRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const pick = (row: Record<string, unknown>, keys: string[]) => {
    for (const [k, v] of Object.entries(row)) {
      if (keys.includes(normalizeKey(k))) return v;
    }
    return "";
  };

  return raw
    .map((row) => ({
      date: parseDate(pick(row, ["data", "date", "data do servico", "dt"])),
      client: String(pick(row, ["cliente", "client", "nome", "nome do cliente"]) ?? "").trim(),
      document: String(pick(row, ["documento", "cpf", "cnpj", "cpf/cnpj", "doc"]) ?? "").trim(),
      plate: String(pick(row, ["placa", "veiculo", "veiculo/placa", "plate"]) ?? "").trim().toUpperCase(),
      service: String(pick(row, ["servico", "service", "descricao", "item"]) ?? "").trim(),
      amount: parseAmount(pick(row, ["valor", "value", "preco", "total", "amount"])),
      notes: String(pick(row, ["observacoes", "observacao", "obs", "notes"]) ?? "").trim(),
    }))
    .filter((r) => r.client && r.service && r.date);
}
