import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell, fmtBRL, fmtDate } from "@/lib/app-shell";
import { getClient, deleteClient } from "@/lib/clients.functions";
import { listSales, createSale, toggleSalePaid, deleteSale } from "@/lib/sales.functions";
import { SERVICE_CATALOG, CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";

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
  const listSalesFn = useServerFn(listSales);
  const createSaleFn = useServerFn(createSale);
  const togglePaidFn = useServerFn(toggleSalePaid);
  const deleteSaleFn = useServerFn(deleteSale);
  const deleteClientFn = useServerFn(deleteClient);

  const client = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClientFn({ data: { id } }),
  });

  const { from, to } = useMemo(() => monthRange(month), [month]);

  const sales = useQuery({
    queryKey: ["sales", id, from, to],
    queryFn: () => listSalesFn({ data: { clientId: id, from, to } }),
  });

  const createMut = useMutation({
    mutationFn: async (items: Array<{
      kind: "produto" | "servico" | "instalacao" | "desinstalacao" | "manutencao";
      description: string;
      amount: number;
      occurred_at: string;
      paid: boolean;
    }>) => {
      for (const it of items) {
        await createSaleFn({ data: { ...it, client_id: id } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["cash-summary"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
      setModalOpen(false);
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ saleId, paid }: { saleId: string; paid: boolean }) =>
      togglePaidFn({ data: { id: saleId, paid } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["cash-summary"] });
    },
  });

  const deleteSaleMut = useMutation({
    mutationFn: (saleId: string) => deleteSaleFn({ data: { id: saleId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["cash-summary"] });
    },
  });

  const totals = useMemo(() => {
    const items = sales.data ?? [];
    let total = 0;
    let pago = 0;
    for (const s of items) {
      const a = Number(s.amount);
      total += a;
      if (s.paid) pago += a;
    }
    return { total, pago, aberto: total - pago };
  }, [sales.data]);

  return (
    <AppShell>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link to="/clientes" className="app-nav__signout" style={{ textDecoration: "none" }}>
          ← Voltar
        </Link>
      </div>

      <div className="row row--between" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="app-title" style={{ marginBottom: 4 }}>
            {client.data?.name || "..."}
          </h1>
          <p className="app-subtitle" style={{ marginBottom: 0 }}>
            {[client.data?.email, client.data?.phone].filter(Boolean).join(" · ") ||
              "Sem contato cadastrado"}
          </p>
        </div>
        <div className="row">
          <button className="button button--primary" onClick={() => setModalOpen(true)}>
            Adicionar venda/serviço
          </button>
          <Link
            to="/clientes/$id/fechamento"
            params={{ id }}
            search={{ mes: month }}
            className="button--ghost active"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
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

      <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
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
          Itens do mês
        </h2>
        {sales.data && sales.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Status</th>
                <th className="num">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.data.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.occurred_at)}</td>
                  <td>
                    <span className={`chip chip--${s.kind}`}>{s.kind}</span>
                  </td>
                  <td>{s.description}</td>
                  <td>
                    <button
                      className={`chip chip--${s.paid ? "pago" : "aberto"}`}
                      style={{ border: "none", cursor: "pointer" }}
                      onClick={() => toggleMut.mutate({ saleId: s.id, paid: !s.paid })}
                    >
                      {s.paid ? "Pago" : "Em aberto"}
                    </button>
                  </td>
                  <td className="num">{fmtBRL(Number(s.amount))}</td>
                  <td>
                    <button
                      className="button--ghost button--sm button--danger"
                      onClick={() => {
                        if (confirm("Excluir este lançamento?")) deleteSaleMut.mutate(s.id);
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
            Nenhum lançamento neste mês.
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
          onClose={() => setModalOpen(false)}
          onSubmit={(data) => createMut.mutate(data)}
          loading={createMut.isPending}
          error={createMut.error?.message}
        />
      )}
    </AppShell>
  );
}

function SaleModal({
  onClose,
  onSubmit,
  loading,
  error,
}: {
  onClose: () => void;
  onSubmit: (data: {
    kind: "produto" | "servico" | "instalacao" | "desinstalacao" | "manutencao";
    description: string;
    amount: number;
    occurred_at: string;
    paid: boolean;
  }) => void;
  loading: boolean;
  error?: string;
}) {
  const [category, setCategory] = useState<ServiceCategory>("instalacao");
  const [service, setService] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [paid, setPaid] = useState(false);

  const total = useMemo(() => {
    const q = parseFloat(qty.replace(",", ".")) || 0;
    const u = parseFloat(unit.replace(",", ".")) || 0;
    return q * u;
  }, [qty, unit]);

  const groups = SERVICE_CATALOG[category];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Adicionar serviço</h2>
        {error && <div className="auth-error">{error}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!service) return;
            if (total <= 0) return;
            const q = parseFloat(qty.replace(",", ".")) || 1;
            const description = q > 1 ? `${service} (x${q})` : service;
            onSubmit({
              kind: category,
              description,
              amount: total,
              occurred_at: occurredAt,
              paid,
            });
          }}
        >
          <div className="grid-cols-2">
            <div className="field">
              <label>Categoria *</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as ServiceCategory);
                  setService("");
                }}
              >
                <option value="instalacao">{CATEGORY_LABEL.instalacao}</option>
                <option value="desinstalacao">{CATEGORY_LABEL.desinstalacao}</option>
                <option value="manutencao">{CATEGORY_LABEL.manutencao}</option>
              </select>
            </div>
            <div className="field">
              <label>Data *</label>
              <input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>Serviço *</label>
            <select value={service} onChange={(e) => setService(e.target.value)} required>
              <option value="">Selecione um serviço...</option>
              {groups.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((it) => (
                    <option key={it} value={it}>
                      {it}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid-cols-2">
            <div className="field">
              <label>Quantidade</label>
              <input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="field">
              <label>Valor unitário (R$) *</label>
              <input
                inputMode="decimal"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="grid-cols-2">
            <div className="field">
              <label>Total</label>
              <input value={fmtBRL(total)} readOnly />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={paid ? "1" : "0"} onChange={(e) => setPaid(e.target.value === "1")}>
                <option value="0">Em aberto</option>
                <option value="1">Pago</option>
              </select>
            </div>
          </div>
          <div className="row row--between">
            <button type="button" className="button--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
