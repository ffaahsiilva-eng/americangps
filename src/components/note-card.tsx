import { useState } from "react";
import { CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";
import { fmtBRL, fmtDate } from "@/lib/app-shell";
import {
  openPrintReceipt,
  openWhatsappReceipt,
  type ReceiptItem,
} from "@/lib/receipt-print";

type SaleItem = {
  id: string;
  kind: string;
  description: string;
  amount: number;
};

type NoteCardProps = {
  note: {
    id: string;
    note_number: number;
    occurred_at: string;
    payment_method: string | null;
    paid: boolean;
    total: number;
    sales: SaleItem[];
  };
  method: string;
  noteStr: string;
  ctx: {
    company: Record<string, unknown>;
    logoUrl: string;
    clientName: string;
    clientPhone: string | null;
    items: ReceiptItem[];
    total: number;
    method: string | null;
    dateStr: string;
    invoiceNumber: number;
  };
  canWhats: boolean;
};

function noteSummary(sales: SaleItem[]) {
  const count = sales.length;
  if (count === 0) return "Nenhum item";
  const byKind = sales.reduce<Record<string, number>>((acc, it) => {
    acc[it.kind] = (acc[it.kind] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(byKind).map(
    ([kind, c]) =>
      `${c} ${CATEGORY_LABEL[kind as ServiceCategory]?.toLowerCase() ?? kind}`,
  );
  return `${count} ${count === 1 ? "item" : "itens"} (${parts.join(", ")})`;
}

export function NoteCard({ note, method, noteStr, ctx, canWhats }: NoteCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="note-card">
      <div className="note-card__head">
        <div>
          <div className="note-card__num">Nota Nº {noteStr}</div>
          <div className="note-card__meta">
            {fmtDate(note.occurred_at)} · {method}
          </div>
          <div className="note-card__summary">{noteSummary(note.sales ?? [])}</div>
        </div>
        <div className="note-card__totals">
          <span className={`chip chip--${note.paid ? "pago" : "aberto"}`}>
            {note.paid ? "Pago" : "Em aberto"}
          </span>
          <div className="note-card__total">{fmtBRL(Number(note.total))}</div>
        </div>
      </div>

      {open && (
        <ul className="note-card__items">
          {(note.sales ?? []).map((it) => (
            <li key={it.id}>
              <span className={`chip chip--${it.kind}`}>{it.kind}</span>
              <span className="note-card__desc">{it.description}</span>
              <span className="note-card__amount">{fmtBRL(Number(it.amount))}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="note-card__actions">
        <button
          type="button"
          className="button--ghost button--sm"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Ocultar itens" : "Ver itens"}
        >
          {open ? "▲ Ocultar itens" : "▼ Ver itens"}
        </button>
        <button
          type="button"
          className="button--ghost button--sm"
          onClick={() => openPrintReceipt(ctx)}
          title="Imprimir ou salvar em PDF"
        >
          🖨️ PDF / Imprimir
        </button>
        <button
          type="button"
          className="button--ghost button--sm"
          onClick={() => openWhatsappReceipt(ctx)}
          disabled={!canWhats}
          title={canWhats ? "Reenviar para WhatsApp" : "Cliente sem telefone cadastrado"}
        >
          💬 WhatsApp
        </button>
      </div>
    </div>
  );
}
