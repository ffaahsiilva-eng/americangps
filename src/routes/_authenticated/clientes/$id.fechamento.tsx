import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMonthlyClosing } from "@/lib/cash.functions";
import americanGpsLogo from "@/assets/american-gps-logo.png.asset.json";
import "../../app.css";

const searchSchema = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const Route = createFileRoute("/_authenticated/clientes/$id/fechamento")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Fechamento — Sistema de Gestão" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClosingPage,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const KIND_LABEL: Record<string, string> = {
  produto: "Produto",
  servico: "Serviço",
  instalacao: "Instalação",
  desinstalacao: "Desinstalação",
  manutencao: "Manutenção",
};

function ClosingPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const month = search.mes || currentMonth();
  const fn = useServerFn(getMonthlyClosing);

  const q = useQuery({
    queryKey: ["closing", id, month],
    queryFn: () => fn({ data: { clientId: id, month } }),
  });

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  if (q.isLoading) {
    return (
      <div className="invoice-page">
        <p>Carregando fechamento...</p>
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="invoice-page">
        <p>Erro ao carregar fechamento.</p>
        <Link to="/clientes/$id" params={{ id }}>
          Voltar
        </Link>
      </div>
    );
  }

  const { client, company, invoiceNumber, items, total, pago, aberto } = q.data;
  const invoiceStr = String(invoiceNumber).padStart(6, "0");

  return (
    <div className="invoice-page">
      <div className="invoice-actions no-print">
        <Link to="/clientes/$id" params={{ id }} className="secondary">
          Voltar
        </Link>
        <button onClick={() => window.print()}>Exportar / Salvar em PDF</button>
      </div>

      <div className="invoice">
        <div className="invoice__header">
          <div className="invoice__brandBlock">
            <img src={americanGpsLogo.url} alt="Logomarca" className="invoice__logo" />
            <div>
              <div className="invoice__brand">{company?.name || "Sua Empresa"}</div>
              {company?.cnpj && <div className="invoice__meta">CNPJ: {company.cnpj}</div>}
              {company?.address && <div className="invoice__meta">{company.address}</div>}
              {(company?.phone || company?.email) && (
                <div className="invoice__meta">
                  {[company.phone, company.email].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="invoice__meta">Nota Nº</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{invoiceStr}</div>
            <div className="invoice__meta" style={{ marginTop: 8 }}>
              Referência: <strong>{monthLabel}</strong>
            </div>
            <div className="invoice__meta">
              Emitido em {new Date().toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>

        <h1 className="invoice__title">Nota de Fechamento</h1>

        <div className="invoice__client">
          <h2>Cliente</h2>
          <div style={{ fontSize: "1.1rem", fontWeight: 500 }}>{client.name}</div>
          {client.email && <div className="invoice__meta">{client.email}</div>}
          {client.phone && <div className="invoice__meta">{client.phone}</div>}
        </div>

        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Status</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#888" }}>
                  Nenhum lançamento neste mês.
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr key={s.id}>
                <td>{fmtDate(s.occurred_at)}</td>
                <td>{KIND_LABEL[s.kind] || s.kind}</td>
                <td>{s.description}</td>
                <td>{s.paid ? "Pago" : "Em aberto"}</td>
                <td className="num">{fmtBRL(Number(s.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice__totals">
          <div>Total pago: {fmtBRL(pago)}</div>
          <div>Total em aberto: {fmtBRL(aberto)}</div>
          <div className="grand">Total geral: {fmtBRL(total)}</div>
        </div>

        <div className="invoice__footer">
          Documento gerado eletronicamente pelo Sistema de Gestão · Nota Nº {invoiceStr}
        </div>
      </div>
    </div>
  );
}
