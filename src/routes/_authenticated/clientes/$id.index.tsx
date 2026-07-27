import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell, fmtBRL, fmtDate } from "@/lib/app-shell";
import { getClient, deleteClient } from "@/lib/clients.functions";
import { createSaleNote, listSaleNotes } from "@/lib/sales.functions";
import { getCompanySettings } from "@/lib/company.functions";
import { SERVICE_CATALOG, CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";
import americanGpsLogo from "@/assets/american-gps-logo.png.asset.json";
import {
  openPrintReceipt,
  openWhatsappReceipt,
  sanitizeWhatsappPhone,
  type ReceiptItem,
} from "@/lib/receipt-print";

import { NoteCard } from "@/components/note-card";


export const Route = createFileRoute("/_authenticated/clientes/$id/")({
  head: () => ({
    meta: [
      { title: "Cliente — Sistema de Gestão" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientDetail,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};


function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function ClientDetail() {
  const { id } = Route.useParams();
  const [month, setMonth] = useState(currentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const qc = useQueryClient();

  const getClientFn = useServerFn(getClient);
  const listNotesFn = useServerFn(listSaleNotes);
  const createNoteFn = useServerFn(createSaleNote);
  const deleteClientFn = useServerFn(deleteClient);
  const getCompanyFn = useServerFn(getCompanySettings);


  const client = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClientFn({ data: { id } }),
  });

  const company = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => getCompanyFn({}),
  });

  const { from, to } = useMemo(() => monthRange(month), [month]);

  const notes = useQuery({
    queryKey: ["sale-notes", id, from, to],
    queryFn: () => listNotesFn({ data: { clientId: id, from, to } }),
  });

  type FinalizedContext = {
    items: ReceiptItem[];
    method: string | null;
    dateStr: string;
    total: number;
  };
  const [receipt, setReceipt] = useState<FinalizedContext | null>(null);

  const createMut = useMutation({
    mutationFn: async (ctx: {
      items: ReceiptItem[];
      method: "pix" | "credito" | "debito" | "dinheiro" | "transferencia" | null;
      dateStr: string;
    }) => {
      const paid = ctx.method !== null;
      await createNoteFn({
        data: {
          client_id: id,
          occurred_at: ctx.dateStr,
          payment_method: ctx.method,
          paid,
          items: ctx.items.map((it) => ({
            kind: it.category,
            description: it.qty > 1 ? `${it.service} (x${it.qty})` : it.service,
            amount: it.total,
          })),
        },
      });
      return ctx;
    },
    onSuccess: (ctx) => {
      qc.invalidateQueries({ queryKey: ["sale-notes"] });
      qc.invalidateQueries({ queryKey: ["cash-summary"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
      setModalOpen(false);
      const total = ctx.items.reduce((s, i) => s + i.total, 0);
      setReceipt({ items: ctx.items, method: ctx.method, dateStr: ctx.dateStr, total });
    },
  });

  const totals = useMemo(() => {
    const list = notes.data ?? [];
    let total = 0;
    let pago = 0;
    for (const n of list) {
      const a = Number(n.total);
      total += a;
      if (n.paid) pago += a;
    }
    return { total, pago, aberto: total - pago };
  }, [notes.data]);


  return (
    <AppShell>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link to="/clientes" className="app-nav__signout" style={{ textDecoration: "none" }}>
          ← Voltar
        </Link>
      </div>

      <div className="row row--between" style={{ marginBottom: 8, gap: 16 }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h1 className="app-title" style={{ marginBottom: 4 }}>
            {client.data?.name || "..."}
          </h1>
          <p className="app-subtitle" style={{ marginBottom: 0, wordBreak: "break-word" }}>
            {[client.data?.email, client.data?.phone].filter(Boolean).join(" · ") ||
              "Sem contato cadastrado"}
          </p>
        </div>
        <div className="row" style={{ flex: "1 1 auto" }}>
          <button
            className="button button--primary"
            onClick={() => setModalOpen(true)}
            style={{ flex: "1 1 200px" }}
          >
            Adicionar venda/serviço
          </button>
          <Link
            to="/clientes/$id/fechamento"
            params={{ id }}
            search={{ mes: month }}
            className="button--ghost active"
            style={{ textDecoration: "none", flex: "1 1 180px", justifyContent: "center" }}
          >
            Gerar fechamento
          </Link>
        </div>
      </div>


      {client.data?.notes && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="stat__label" style={{ marginBottom: 8 }}>
            Observações
          </div>
          <p style={{ margin: 0, color: "rgba(255,255,255,.72)" }}>{client.data.notes}</p>
        </div>
      )}

      <div className="row" style={{ margin: "32px 0 20px" }}>
        <div className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
          <label>Levantamento do mês</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="stats stats--three">
        <div className="stat stat--accent">
          <div className="stat__label">Total do mês</div>
          <div className="stat__value">{fmtBRL(totals.total)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Pago</div>
          <div className="stat__value">{fmtBRL(totals.pago)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Em aberto</div>
          <div className="stat__value">{fmtBRL(totals.aberto)}</div>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ margin: "0 0 16px", fontWeight: 300, fontSize: "1.4rem", letterSpacing: "-.02em" }}>
          Notas do mês
        </h2>
        {notes.data && notes.data.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {notes.data.map((n) => {
              const method = n.payment_method
                ? PAYMENT_LABEL[n.payment_method] || n.payment_method
                : "Em aberto";
              const noteStr = String(n.note_number).padStart(6, "0");
              const receiptItems: ReceiptItem[] = (n.sales ?? []).map((it) => ({
                category: it.kind as ServiceCategory,
                service: it.description,
                qty: 1,
                unit: Number(it.amount),
                total: Number(it.amount),
              }));
              const ctx = {
                company: company.data ?? {},
                logoUrl: americanGpsLogo.url,
                clientName: client.data?.name || "",
                clientPhone: client.data?.phone || null,
                items: receiptItems,
                total: Number(n.total),
                method: n.payment_method,
                dateStr: n.occurred_at,
                invoiceNumber: n.note_number,
              };
              const canWhats = !!sanitizeWhatsappPhone(client.data?.phone);
              return (
                <NoteCard
                  key={n.id}
                  note={n}
                  method={method}
                  noteStr={noteStr}
                  ctx={ctx}
                  canWhats={canWhats}
                />
              );
            })}
          </div>
        ) : (
          <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
            Nenhuma nota neste mês.
          </p>
        )}
      </div>


      <div className="row" style={{ marginTop: 32 }}>
        <button
          className="button--ghost button--danger"
          onClick={async () => {
            if (!confirm("Excluir cliente e todo o histórico?")) return;
            await deleteClientFn({ data: { id } });
            window.location.href = "/clientes";
          }}
        >
          Excluir cliente
        </button>
      </div>

      {modalOpen && (
        <SaleModal
          clientName={client.data?.name || ""}
          onClose={() => setModalOpen(false)}
          onSubmit={(data) => createMut.mutate(data)}
          loading={createMut.isPending}
          error={createMut.error?.message}
        />
      )}

      {receipt && (
        <ReceiptActions
          clientName={client.data?.name || ""}
          clientPhone={client.data?.phone || null}
          company={company.data ?? {}}
          data={receipt}
          onClose={() => setReceipt(null)}
        />
      )}

    </AppShell>
  );
}

type ItemDraft = {
  key: string;
  category: ServiceCategory;
  service: string;
  qty: string;
  unit: string;
};

type AddedItem = {
  key: string;
  category: ServiceCategory;
  service: string;
  qty: number;
  unit: number;
  total: number;
};

function emptyDraft(): ItemDraft {
  return {
    key: Math.random().toString(36).slice(2),
    category: "instalacao",
    service: "",
    qty: "1",
    unit: "",
  };
}

function SaleModal({
  clientName,
  onClose,
  onSubmit,
  loading,
  error,
}: {
  clientName: string;
  onClose: () => void;
  onSubmit: (data: {
    items: ReceiptItem[];
    method: "pix" | "credito" | "debito" | "dinheiro" | "transferencia" | null;
    dateStr: string;
  }) => void;
  loading: boolean;
  error?: string;
}) {

  const [draft, setDraft] = useState<ItemDraft>(emptyDraft());
  const [items, setItems] = useState<AddedItem[]>([]);
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [showPayment, setShowPayment] = useState(false);

  const getCompanyFn = useServerFn(getCompanySettings);
  const company = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => getCompanyFn({}),
  });

  const groups = SERVICE_CATALOG[draft.category];
  const draftQty = parseFloat(draft.qty.replace(",", ".")) || 0;
  const draftUnit = parseFloat(draft.unit.replace(",", ".")) || 0;
  const draftTotal = draftQty * draftUnit;
  const canAdd = draft.service && draftTotal > 0;

  const total = items.reduce((s, it) => s + it.total, 0);

  function addItem() {
    if (!canAdd) return;
    setItems((prev) => [
      ...prev,
      {
        key: Math.random().toString(36).slice(2),
        category: draft.category,
        service: draft.service,
        qty: draftQty,
        unit: draftUnit,
        total: draftTotal,
      },
    ]);
    setDraft(emptyDraft());
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function confirmPayment(method: "pix" | "credito" | "debito" | "dinheiro" | "transferencia" | null) {
    if (items.length === 0) return;
    const payload: ReceiptItem[] = items.map((it) => ({
      category: it.category,
      service: it.service,
      qty: it.qty,
      unit: it.unit,
      total: it.total,
    }));
    onSubmit({ items: payload, method, dateStr: occurredAt });
  }


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const now = new Date();
  const nowStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="pos-overlay">
      <div className="pos-shell">
        {/* LEFT: entry + list */}
        <div className="pos-main">
          <div className="pos-header">
            <div>
              <div className="pos-eyebrow">Frente de caixa</div>
              <h2 className="pos-title">Adicionar serviços</h2>
              <div className="pos-sub">{clientName}</div>
            </div>
            <button className="button--ghost button--sm" onClick={onClose}>
              Fechar (ESC)
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="pos-entry">
            <div className="pos-entry__grid">
              <div className="field">
                <label>Categoria</label>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as ServiceCategory, service: "" })
                  }
                >
                  <option value="instalacao">{CATEGORY_LABEL.instalacao}</option>
                  <option value="desinstalacao">{CATEGORY_LABEL.desinstalacao}</option>
                  <option value="manutencao">{CATEGORY_LABEL.manutencao}</option>
                </select>
              </div>
              <div className="field pos-entry__service">
                <label>Serviço</label>
                <select
                  value={draft.service}
                  onChange={(e) => setDraft({ ...draft, service: e.target.value })}
                >
                  <option value="">Selecione um serviço…</option>
                  {groups.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="pos-entry__row2">
                <div className="field">
                  <label>Qtd</label>
                  <input
                    inputMode="decimal"
                    value={draft.qty}
                    onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Valor unit. (R$)</label>
                  <input
                    inputMode="decimal"
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    placeholder="0,00"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                  />
                </div>
                <div className="field pos-entry__subtotal">
                  <label>Subtotal</label>
                  <div className="pos-entry__subtotal-value">{fmtBRL(draftTotal)}</div>
                </div>
                <button
                  type="button"
                  className="button button--primary pos-entry__add"
                  onClick={addItem}
                  disabled={!canAdd}
                >
                  + Adicionar item
                </button>
              </div>
            </div>
          </div>

          <div className="pos-list">
            <div className="pos-list__head">
              <span>#</span>
              <span>Descrição do item</span>
              <span className="num">Qtd</span>
              <span className="num">Unit.</span>
              <span className="num">Subtotal</span>
              <span></span>
            </div>
            <div className="pos-list__body">
              {items.length === 0 ? (
                <div className="pos-list__empty">
                  Nenhum item adicionado. Selecione um serviço acima e clique em <strong>Adicionar item</strong>.
                </div>
              ) : (
                items.map((it, idx) => (
                  <div className="pos-list__row" key={it.key}>
                    <span className="pos-list__num">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="pos-list__desc">
                      <strong>{it.service}</strong>
                      <em>{CATEGORY_LABEL[it.category]}</em>
                    </span>
                    <span className="num">{it.qty}</span>
                    <span className="num">{fmtBRL(it.unit)}</span>
                    <span className="num pos-list__sub">{fmtBRL(it.total)}</span>
                    <button
                      type="button"
                      className="pos-list__remove"
                      onClick={() => removeItem(it.key)}
                      aria-label="Remover"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pos-footer">
            <div className="pos-footer__meta">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Data</label>
                <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              </div>
            </div>
            <button
              type="button"
              className="button button--primary pos-finalize"
              onClick={() => setShowPayment(true)}
              disabled={loading || items.length === 0}
            >
              {loading ? "Salvando…" : `Finalizar · ${fmtBRL(total)}`}
            </button>
          </div>
        </div>

        {/* RIGHT: receipt preview */}
        <aside className="pos-aside">
          <div className="pos-aside__head">Pré-visualização do cupom</div>
          <div className="receipt">
            <div className="receipt__title">*** {(company.data?.name || "SUA EMPRESA").toUpperCase()} ***</div>
            {company.data?.address && <div className="receipt__center">{company.data.address}</div>}
            {(company.data?.phone || company.data?.email) && (
              <div className="receipt__center">
                {[company.data?.phone, company.data?.email].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="receipt__center">{nowStr}</div>
            <div className="receipt__center">CLIENTE: {clientName || "—"}</div>
            <div className="receipt__sep" />
            <div className="receipt__center">CUPOM PRÉVIA</div>
            <div className="receipt__sep" />
            {items.length === 0 ? (
              <div className="receipt__empty">Adicione itens para visualizar…</div>
            ) : (
              (() => {
                const groupsMap = new Map<ServiceCategory, typeof items>();
                items.forEach((it) => {
                  const arr = groupsMap.get(it.category) ?? [];
                  arr.push(it);
                  groupsMap.set(it.category, arr);
                });
                let n = 0;
                return Array.from(groupsMap.entries()).map(([cat, list]) => {
                  const catTotal = list.reduce((s, i) => s + i.total, 0);
                  return (
                    <div className="receipt__group" key={cat}>
                      <div className="receipt__group-title">-- {CATEGORY_LABEL[cat].toUpperCase()} --</div>
                      {list.map((it) => {
                        n += 1;
                        return (
                          <div className="receipt__item" key={it.key}>
                            <div className="receipt__item-name">
                              {String(n).padStart(2, "0")} {it.service.toUpperCase()}
                            </div>
                            <div className="receipt__item-row">
                              <span>
                                {it.qty} UN X {fmtBRL(it.unit)}
                              </span>
                              <span>{fmtBRL(it.total)}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="receipt__row receipt__row--sub">
                        <span>SUBTOTAL {CATEGORY_LABEL[cat].toUpperCase()}</span>
                        <span>{fmtBRL(catTotal)}</span>
                      </div>
                    </div>
                  );
                });
              })()
            )}

            <div className="receipt__sep" />
            <div className="receipt__row">
              <span>SUBTOTAL</span>
              <span>{fmtBRL(total)}</span>
            </div>
            <div className="receipt__row receipt__row--total">
              <span>TOTAL</span>
              <span>{fmtBRL(total)}</span>
            </div>
            <div className="receipt__sep" />
            <div className="receipt__center receipt__foot">Obrigado pela preferência!</div>
          </div>
        </aside>
      </div>

      {showPayment && (
        <div className="pay-overlay" onClick={() => !loading && setShowPayment(false)}>
          <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pay-modal__head">
              <div>
                <div className="pos-eyebrow">Forma de pagamento</div>
                <h3 className="pay-modal__title">Como foi pago?</h3>
                <div className="pay-modal__sub">Total {fmtBRL(total)}</div>
              </div>
              <button className="button--ghost button--sm" onClick={() => setShowPayment(false)} disabled={loading}>
                Cancelar
              </button>
            </div>
            <div className="pay-grid">
              {[
                { key: "pix", label: "PIX", icon: "◈" },
                { key: "credito", label: "Crédito", icon: "▭" },
                { key: "debito", label: "Débito", icon: "▯" },
                { key: "dinheiro", label: "Dinheiro", icon: "$" },
                { key: "transferencia", label: "Transferência", icon: "⇄" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="pay-option"
                  disabled={loading}
                  onClick={() => confirmPayment(m.key as "pix" | "credito" | "debito" | "dinheiro" | "transferencia")}
                >
                  <span className="pay-option__icon">{m.icon}</span>
                  <span className="pay-option__label">{m.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="button--ghost pay-open-later"
              disabled={loading}
              onClick={() => confirmPayment(null)}
            >
              Deixar em aberto
            </button>
            {loading && <div className="pay-loading">Salvando…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptActions({
  clientName,
  clientPhone,
  company,
  data,
  onClose,
}: {
  clientName: string;
  clientPhone: string | null;
  company: {
    name?: string | null;
    cnpj?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  data: {
    items: ReceiptItem[];
    method: string | null;
    dateStr: string;
    total: number;
  };
  onClose: () => void;
}) {
  const ctx = {
    company,
    logoUrl: americanGpsLogo.url,
    clientName,
    clientPhone,
    items: data.items,
    total: data.total,
    method: data.method,
    dateStr: data.dateStr,
  };
  const hasPhone = !!sanitizeWhatsappPhone(clientPhone);

  return (
    <div className="pay-overlay" onClick={onClose}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pay-modal__head">
          <div>
            <div className="pos-eyebrow">Venda finalizada</div>
            <h3 className="pay-modal__title">O que deseja fazer?</h3>
            <div className="pay-modal__sub">
              Total {data.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <button className="button--ghost button--sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="pay-grid">
          <button
            type="button"
            className="pay-option"
            onClick={() => openPrintReceipt(ctx)}
          >
            <span className="pay-option__icon">🖨</span>
            <span className="pay-option__label">Imprimir / Salvar PDF</span>
          </button>
          <button
            type="button"
            className="pay-option"
            disabled={!hasPhone}
            title={hasPhone ? "" : "Cliente sem telefone cadastrado"}
            onClick={() => openWhatsappReceipt(ctx)}
          >
            <span className="pay-option__icon">💬</span>
            <span className="pay-option__label">Enviar WhatsApp</span>
          </button>
        </div>
        {!hasPhone && (
          <div className="pay-modal__sub" style={{ marginTop: 8, textAlign: "center" }}>
            Cadastre um telefone no cliente para enviar por WhatsApp.
          </div>
        )}
      </div>
    </div>
  );
}


