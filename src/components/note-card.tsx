
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSaleNote, deleteSaleNote } from "@/lib/sales.functions";
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
  const [showEdit, setShowEdit] = useState(false);
  const [editMethod, setEditMethod] = useState(note.payment_method || "");
  const [editDate, setEditDate] = useState(note.occurred_at || "");

  const qc = useQueryClient();
  const updateFn = useServerFn(updateSaleNote);
  const deleteFn = useServerFn(deleteSaleNote);

  const updateMut = useMutation({
    mutationFn: async (data: any) => await updateFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-notes"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
      setShowEdit(false);
    }
  });

  const deleteMut = useMutation({
    mutationFn: async () => await deleteFn({ data: { id: note.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-notes"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
      setShowEdit(false);
    }
  });

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

      {showEdit && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal__head" style={{ marginBottom: 16 }}>
              <h2 className="modal__title">Editar Lançamento</h2>
              <button className="modal__close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            
            <div className="field">
              <label>Data</label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>

            <div className="field">
              <label>Pagamento</label>
              <select value={editMethod} onChange={e => setEditMethod(e.target.value)}>
                <option value="">Em aberto</option>
                <option value="pix">PIX</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
                <option value="fechamento">Fechamento Mensal</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button 
                className="button--primary" 
                style={{ flex: 1 }}
                disabled={updateMut.isPending}
                onClick={() => updateMut.mutate({ 
                  id: note.id, 
                  occurred_at: editDate, 
                  payment_method: editMethod || null,
                  paid: !!editMethod
                })}
              >
                {updateMut.isPending ? "Salvando..." : "Salvar"}
              </button>
              
              <button 
                className="button--ghost" 
                style={{ color: "#ff5e5e" }}
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir permanentemente este lançamento?")) {
                    deleteMut.mutate();
                  }
                }}
              >
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
