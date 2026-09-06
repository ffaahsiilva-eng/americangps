import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, fmtBRL } from "@/lib/app-shell";
import { getCashSummary, getCashSeries } from "@/lib/cash.functions";
import { listSaleNotes } from "@/lib/sales.functions";
import { getCompanySettings } from "@/lib/company.functions";
import americanGpsLogo from "@/assets/american-gps-logo.jpg";
import { sanitizeWhatsappPhone, type ReceiptItem } from "@/lib/receipt-print";
import type { ServiceCategory } from "@/lib/service-catalog";
import { NoteCard } from "@/components/note-card";
import {
  buildMonthlyReportPdfBlob,
  downloadBlob,
  type ReportClient,
} from "@/lib/monthly-report";
import { DashboardCharts } from "@/components/dashboard-charts";
import { MonthlyBilling } from "@/components/monthly-billing";



export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — AMERICAN GPS" },
      { name: "description", content: "Finanças AMERICAN GPS." },
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
  const today = new Date();
  const [reportMonth, setReportMonth] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  );
  const [downloading, setDownloading] = useState(false);
  const summaryFn = useServerFn(getCashSummary);
  const listNotesFn = useServerFn(listSaleNotes);
  const getCompanyFn = useServerFn(getCompanySettings);
  const seriesFn = useServerFn(getCashSeries);

  const series = useQuery({
    queryKey: ["cash-series", range],
    queryFn: () => seriesFn({ data: { range } }),
  });



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

  async function handleDownloadReport() {
    if (downloading) return;
    setDownloading(true);
    try {
      const [yStr, mStr] = reportMonth.split("-");
      const year = Number(yStr);
      const month = Number(mStr);
      const from = `${yStr}-${mStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;

      const notes = await listNotesFn({ data: { from, to, limit: 200 } });
      if (!notes || notes.length === 0) {
        alert("Nenhuma nota encontrada para o mês selecionado.");
        return;
      }

      const byClient = new Map<string, ReportClient>();
      for (const n of notes) {
        const key = n.client_id;
        const clientName = n.client?.name || "Cliente";
        const clientPhone = n.client?.phone || null;
        const bucket =
          byClient.get(key) ?? { clientName, clientPhone, notes: [] };
        bucket.notes.push({
          note_number: n.note_number ?? 0,
          occurred_at: n.occurred_at ?? "",
          payment_method: n.payment_method ?? null,
          paid: n.paid ?? false,
          total: Number(n.total ?? 0),
          items: (n.sales ?? []).map((it) => ({
            kind: it.kind as ServiceCategory,
            description: it.description,
            amount: Number(it.amount),
          })),
        });
        byClient.set(key, bucket);
      }
      // Sort notes ascending by date within each client, and clients by name
      const clients = Array.from(byClient.values())
        .map((c) => ({
          ...c,
          notes: [...c.notes].sort((a, b) =>
            a.occurred_at.localeCompare(b.occurred_at),
          ),
        }))
        .sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));

      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
      ];
      const monthLabel = `${monthNames[month - 1]}/${year}`;

      const blob = await buildMonthlyReportPdfBlob({
        company: company.data ?? {},
        logoUrl: americanGpsLogo,
        monthLabel,
        fromDate: from,
        toDate: to,
        clients,
      });
      downloadBlob(blob, `Relatorio_${yStr}-${mStr}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar o relatório.");
    } finally {
      setDownloading(false);
    }
  }


  return (
    <AppShell>
      <h1 className="app-title">FINANÇAS AMERICAN GPS</h1>
      <p className="app-subtitle">
        Resumo automático das movimentações financeiras, receitas, pagamentos e serviços.
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

      <DashboardCharts data={series.data} />

      <MonthlyBilling />



      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="row row--between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 300, fontSize: "1.2rem", letterSpacing: "-.02em" }}>
              Relatório mensal
            </h2>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
              PDF com todos os clientes do mês, separados e organizados por nota.
            </p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="input"
              style={{ minWidth: 160 }}
            />
            <button
              className="button button--primary"
              onClick={handleDownloadReport}
              disabled={downloading}
            >
              {downloading ? "Gerando…" : "📄 Baixar relatório"}
            </button>
          </div>
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
                logoUrl: americanGpsLogo,
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
