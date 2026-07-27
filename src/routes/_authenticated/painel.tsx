import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, fmtBRL } from "@/lib/app-shell";
import { getCashSummary } from "@/lib/cash.functions";
import { listSaleNotes } from "@/lib/sales.functions";
import { getCompanySettings } from "@/lib/company.functions";
import americanGpsLogo from "@/assets/american-gps-logo.png.asset.json";
import { sanitizeWhatsappPhone, type ReceiptItem } from "@/lib/receipt-print";
import type { ServiceCategory } from "@/lib/service-catalog";
import { NoteCard } from "@/components/note-card";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Sistema de Gestão" },
      { name: "description", content: "Painel de Controle do Sistema de Gestão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelPage,
});

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

function PainelPage() {
  const [range, setRange] = useState<"week" | "month">("month");
  const summaryFn = useServerFn(getCashSummary);
  const listNotesFn = useServerFn(listSaleNotes);
  const getCompanyFn = useServerFn(getCompanySettings);

  const summary = useQuery({
    queryKey: ["cash-summary", range],
    queryFn: () => summaryFn({ data: { range } }),
  });

  const recent = useQuery({
    queryKey: ["recent-notes"],
    queryFn: () => listNotesFn({ data: { limit: 10 } }),
  });

  const company = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => getCompanyFn({}),
  });

  return (
    <AppShell>
      <h1 className="app-title">Painel de Controle</h1>
      <p className="app-subtitle">
        Resumo automático das vendas e serviços. Filtre por período para acompanhar as entradas.
      </p>

      <div className="row" style={{ marginBottom: 24 }}>
        <button
          className={`button--ghost ${range === "week" ? "active" : ""}`}
          onClick={() => setRange("week")}
        >
          Últimos 7 dias
        </button>
        <button
          className={`button--ghost ${range === "month" ? "active" : ""}`}
          onClick={() => setRange("month")}
        >
          Últimos 30 dias
        </button>
      </div>

      <div className="stats">
        <div className="stat stat--accent">
          <div className="stat__label">Total no período</div>
          <div className="stat__value">{fmtBRL(summary.data?.total ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Produtos</div>
          <div className="stat__value">{fmtBRL(summary.data?.produto ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Serviços</div>
          <div className="stat__value">{fmtBRL(summary.data?.servico ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Clientes ativos</div>
          <div className="stat__value">{summary.data?.clients ?? 0}</div>
        </div>
      </div>

      <div className="stats stats--two">
        <div className="stat">
          <div className="stat__label">Pago</div>
          <div className="stat__value">{fmtBRL(summary.data?.pago ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Em aberto</div>
          <div className="stat__value">{fmtBRL(summary.data?.aberto ?? 0)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="row row--between" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontWeight: 300, fontSize: "1.4rem", letterSpacing: "-.02em" }}>
            Últimos lançamentos
          </h2>
        </div>
          {recent.data && recent.data.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {recent.data.map((n) => {
              const method = n.payment_method
                ? PAYMENT_LABEL[n.payment_method] || n.payment_method
                : "Em aberto";
              const noteStr = String(n.note_number).padStart(6, "0");
              const clientName = n.client?.name || "Cliente";
              const clientPhone = n.client?.phone || null;
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
                clientName,
                clientPhone,
                items: receiptItems,
                total: Number(n.total),
                method: n.payment_method,
                dateStr: n.occurred_at,
                invoiceNumber: n.note_number,
              };
              const canWhats = !!sanitizeWhatsappPhone(clientPhone);
              return (
                <NoteCard
                  key={n.id}
                  note={{
                    ...n,
                    sales: n.sales ?? [],
                    note_number: n.note_number ?? 0,
                    total: n.total ?? 0,
                    paid: n.paid ?? false,
                    payment_method: n.payment_method ?? null,
                    occurred_at: n.occurred_at ?? "",
                  }}
                  method={method}
                  noteStr={`${noteStr} · ${clientName}`}
                  ctx={ctx}
                  canWhats={canWhats}
                />
              );
            })}
          </div>
        ) : (
          <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
            Nenhum lançamento ainda. Cadastre clientes e adicione vendas/serviços na aba Clientes.
          </p>
        )}
      </div>
    </AppShell>
  );
}
