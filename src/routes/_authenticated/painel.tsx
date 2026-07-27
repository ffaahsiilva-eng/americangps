import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, fmtBRL, fmtDate } from "./-shell";
import { getCashSummary } from "@/lib/cash.functions";
import { listSales } from "@/lib/sales.functions";

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

function PainelPage() {
  const [range, setRange] = useState<"week" | "month">("month");
  const summaryFn = useServerFn(getCashSummary);
  const listFn = useServerFn(listSales);

  const summary = useQuery({
    queryKey: ["cash-summary", range],
    queryFn: () => summaryFn({ data: { range } }),
  });

  const recent = useQuery({
    queryKey: ["recent-sales"],
    queryFn: () => listFn({ data: { limit: 15 } }),
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

      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Status</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {recent.data.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.occurred_at)}</td>
                  <td>
                    <span className={`chip chip--${s.kind}`}>{s.kind}</span>
                  </td>
                  <td>{s.description}</td>
                  <td>
                    <span className={`chip chip--${s.paid ? "pago" : "aberto"}`}>
                      {s.paid ? "Pago" : "Em aberto"}
                    </span>
                  </td>
                  <td className="num">{fmtBRL(Number(s.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
            Nenhum lançamento ainda. Cadastre clientes e adicione vendas/serviços na aba Clientes.
          </p>
        )}
      </div>
    </AppShell>
  );
}
