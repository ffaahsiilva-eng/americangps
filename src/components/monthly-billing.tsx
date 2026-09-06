import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSaleNotes, createSaleNote } from "@/lib/sales.functions";
import { listClients, createClient } from "@/lib/clients.functions";
import { getCompanySettings } from "@/lib/company.functions";
import americanGpsLogo from "@/assets/american-gps-logo.jpg";
import {
  buildClosingPdfBlob,
  buildExcelBlob,
  categoryLabel,
  downloadBlob,
  fmtBRL,
  fmtDate,
  monthRange,
  parseImportFile,
  splitDescription,
  type BillingClient,
  type ImportRow,
} from "@/lib/billing";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyBilling() {
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState("");
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importState, setImportState] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const listNotesFn = useServerFn(listSaleNotes);
  const listClientsFn = useServerFn(listClients);
  const createClientFn = useServerFn(createClient);
  const createNoteFn = useServerFn(createSaleNote);
  const getCompanyFn = useServerFn(getCompanySettings);

  const range = useMemo(() => monthRange(month), [month]);

  const notes = useQuery({
    queryKey: ["billing-notes", range.from, range.to],
    queryFn: () => listNotesFn({ data: { from: range.from, to: range.to, limit: 1000 } }),
  });

  const company = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => getCompanyFn({}),
  });

  const clients: BillingClient[] = useMemo(() => {
    const map = new Map<string, BillingClient>();
    for (const n of notes.data ?? []) {
      const key = n.client_id;
      const bucket =
        map.get(key) ??
        {
          clientId: key,
          clientName: n.client?.name || "Cliente",
          document: (n.client as { document?: string | null } | null)?.document || "",
          phone: n.client?.phone ?? null,
          total: 0,
          services: [],
          plates: [],
        };
      for (const it of n.sales ?? []) {
        const { service, plate } = splitDescription(it.description);
        bucket.services.push({
          date: n.occurred_at ?? "",
          plate,
          service,
          kind: it.kind,
          amount: Number(it.amount ?? 0),
          noteNumber: n.note_number ?? 0,
        });
        bucket.total += Number(it.amount ?? 0);
        if (plate && !bucket.plates.includes(plate)) bucket.plates.push(plate);
      }
      map.set(key, bucket);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [notes.data]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.document.toLowerCase().includes(q) ||
        c.plates.some((p) => p.toLowerCase().includes(q)),
    );
  }, [clients, filter]);

  const totals = useMemo(() => {
    const plates = new Set<string>();
    let total = 0;
    let services = 0;
    for (const c of filtered) {
      total += c.total;
      services += c.services.length;
      c.plates.forEach((p) => plates.add(`${c.clientId}:${p}`));
    }
    return { total, services, clients: filtered.length, vehicles: plates.size };
  }, [filtered]);

  const detail = filtered.find((c) => c.clientId === openClient) ?? null;

  async function downloadPdf(c: BillingClient) {
    setBusy(true);
    try {
      const blob = await buildClosingPdfBlob({
        company: company.data ?? {},
        logoUrl: americanGpsLogo,
        monthLabel: range.label,
        client: c,
      });
      downloadBlob(blob, `Fechamento_${c.clientName.replace(/\W+/g, "_")}_${month}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExcel(list: BillingClient[], filename: string) {
    setBusy(true);
    try {
      const rows = list.flatMap((c) =>
        [...c.services]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s) => ({
            date: s.date,
            client: c.clientName,
            document: c.document,
            plate: s.plate,
            service: s.service,
            amount: s.amount,
            notes: `${categoryLabel(s.kind)} · Nota ${String(s.noteNumber).padStart(6, "0")}`,
          })),
      );
      if (rows.length === 0) {
        alert("Nenhum serviço no período selecionado.");
        return;
      }
      const blob = await buildExcelBlob(rows, range.label.replace("/", "-"));
      downloadBlob(blob, filename);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setImportState("Lendo arquivo…");
    try {
      const rows = await parseImportFile(file);
      if (rows.length === 0) {
        setImportState("Nenhuma linha válida encontrada. Use as colunas: Data, Cliente, Documento, Placa, Serviço, Valor, Observações.");
        return;
      }

      const existingClients = await listClientsFn({ data: {} });
      const clientByName = new Map(
        existingClients.map((c) => [c.name.trim().toLowerCase(), c]),
      );

      // Notas já existentes no intervalo das linhas importadas (para não duplicar)
      const dates = rows.map((r) => r.date).sort();
      const existingNotes = await listNotesFn({
        data: { from: dates[0]!, to: dates[dates.length - 1]!, limit: 1000 },
      });
      const seen = new Set<string>();
      for (const n of existingNotes) {
        for (const it of n.sales ?? []) {
          seen.add(
            `${n.client_id}|${n.occurred_at}|${it.description.trim().toLowerCase()}|${Number(it.amount).toFixed(2)}`,
          );
        }
      }

      // Agrupa por cliente + data
      const groups = new Map<string, { row: ImportRow; items: ImportRow[] }>();
      let imported = 0;
      let skipped = 0;
      let createdClients = 0;

      for (const r of rows) {
        const key = `${r.client.trim().toLowerCase()}|${r.date}`;
        const g = groups.get(key) ?? { row: r, items: [] };
        g.items.push(r);
        groups.set(key, g);
      }

      for (const [, g] of groups) {
        const nameKey = g.row.client.trim().toLowerCase();
        let client = clientByName.get(nameKey);
        if (!client) {
          setImportState(`Criando cliente ${g.row.client}…`);
          const created = await createClientFn({
            data: { name: g.row.client.trim(), document: g.row.document || undefined },
          });
          client = { id: created.id, name: g.row.client.trim() } as (typeof existingClients)[number];
          clientByName.set(nameKey, client);
          createdClients += 1;
        }

        const items = g.items
          .map((r) => {
            const description = [r.service, r.plate].filter(Boolean).join(" — ");
            const suffix = r.notes ? ` · ${r.notes}` : "";
            return {
              kind: "servico" as const,
              description: `${description}${suffix}`.slice(0, 300),
              amount: Number(r.amount) || 0,
            };
          })
          .filter((it) => {
            const dedupeKey = `${client!.id}|${g.row.date}|${it.description.trim().toLowerCase()}|${it.amount.toFixed(2)}`;
            if (seen.has(dedupeKey)) {
              skipped += 1;
              return false;
            }
            seen.add(dedupeKey);
            return true;
          });

        if (items.length === 0) continue;
        setImportState(`Importando ${g.row.client} (${g.row.date})…`);
        await createNoteFn({
          data: {
            client_id: client.id,
            occurred_at: g.row.date,
            payment_method: null,
            paid: false,
            items,
          },
        });
        imported += items.length;
      }

      qc.invalidateQueries({ queryKey: ["billing-notes"] });
      qc.invalidateQueries({ queryKey: ["recent-notes"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setImportState(
        `Importação concluída: ${imported} serviço(s) importado(s), ${skipped} duplicado(s) ignorado(s), ${createdClients} cliente(s) novo(s).`,
      );
    } catch (e) {
      console.error(e);
      setImportState(`Falha na importação: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div className="row row--between" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 300, fontSize: "1.4rem", letterSpacing: "-.02em" }}>
            Faturamento de {range.label}
          </h2>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
            Serviços agrupados por cliente no período selecionado.
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              background: "rgba(255,255,255,.04)",
              color: "#f3f3f1",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 12,
              padding: "10px 12px",
              fontFamily: "inherit",
              minHeight: 44,
            }}
          />
          <button
            className="button--ghost"
            disabled={busy}
            onClick={() => downloadExcel(filtered, `Faturamento_${month}.xlsx`)}
          >
            📊 Baixar Excel
          </button>
          <button className="button--ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            ⬆️ Importar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
        </div>
      </div>

      {importState && (
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            color: "#dfc19a",
            background: "rgba(223,193,154,.08)",
            border: "1px solid rgba(223,193,154,.2)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          {importState}
        </p>
      )}

      <div className="stats stats--two" style={{ marginBottom: 16 }}>
        <div className="stat stat--accent">
          <div className="stat__label">Faturamento total do mês</div>
          <div className="stat__value">{fmtBRL(totals.total)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Clientes com serviços</div>
          <div className="stat__value">{totals.clients}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Serviços realizados</div>
          <div className="stat__value">{totals.services}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Veículos atendidos</div>
          <div className="stat__value">{totals.vehicles}</div>
        </div>
      </div>

      <div className="field" style={{ maxWidth: 460 }}>
        <label htmlFor="billing-filter">Filtrar</label>
        <input
          id="billing-filter"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar cliente por nome, documento ou placa..."
        />
      </div>

      {notes.isLoading ? (
        <p style={{ color: "rgba(255,255,255,.5)" }}>Carregando faturamento…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
          Nenhum serviço encontrado para {range.label}.
        </p>
      ) : (
        <div className="client-grid">
          {filtered.map((c) => (
            <div key={c.clientId} className="client-card" style={{ cursor: "default" }}>
              <div className="stat__label">Cliente</div>
              <h3 className="client-card__name">{c.clientName}</h3>
              {c.document && (
                <p className="client-card__meta" style={{ marginBottom: 6 }}>
                  Documento: {c.document}
                </p>
              )}
              <p className="client-card__meta" style={{ marginBottom: 4 }}>
                Faturamento no mês:{" "}
                <strong style={{ color: "#dfc19a" }}>{fmtBRL(c.total)}</strong>
              </p>
              <p className="client-card__meta" style={{ marginBottom: 8 }}>
                Serviços realizados: {c.services.length}
              </p>
              {c.plates.length > 0 && (
                <p className="client-card__meta" style={{ marginBottom: 12 }}>
                  Veículos / Placas: {c.plates.join(", ")}
                </p>
              )}
              <button
                className="button--ghost button--sm"
                onClick={() => setOpenClient(c.clientId)}
              >
                Ver fechamento
              </button>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <ClosingModal
          client={detail}
          monthLabel={range.label}
          busy={busy}
          onClose={() => setOpenClient(null)}
          onPdf={() => downloadPdf(detail)}
          onExcel={() =>
            downloadExcel(
              [detail],
              `Fechamento_${detail.clientName.replace(/\W+/g, "_")}_${month}.xlsx`,
            )
          }
        />
      )}
    </div>
  );
}

function ClosingModal({
  client,
  monthLabel,
  busy,
  onClose,
  onPdf,
  onExcel,
}: {
  client: BillingClient;
  monthLabel: string;
  busy: boolean;
  onClose: () => void;
  onPdf: () => void;
  onExcel: () => void;
}) {
  const services = [...client.services].sort(
    (a, b) => a.date.localeCompare(b.date) || a.plate.localeCompare(b.plate),
  );
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.7)",
        backdropFilter: "blur(4px)",
        zIndex: 80,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel neon-panel"
        style={{ width: "100%", maxWidth: 780, margin: "40px 0" }}
      >
        <div className="row row--between" style={{ marginBottom: 16, gap: 12 }}>
          <div>
            <div className="stat__label">Fechamento mensal</div>
            <h2 style={{ margin: "6px 0 0", fontWeight: 300, fontSize: "1.4rem" }}>
              {client.clientName}
            </h2>
            {client.document && (
              <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
                Documento: {client.document}
              </p>
            )}
            <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
              Período: {monthLabel}
            </p>
          </div>
          <button className="button--ghost button--sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Placa</th>
                <th>Serviço</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={`${s.noteNumber}-${i}`}>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.plate || "—"}</td>
                  <td>
                    {s.service}
                    <br />
                    <span style={{ color: "rgba(255,255,255,.4)", fontSize: ".76rem" }}>
                      {categoryLabel(s.kind)} · Nota {String(s.noteNumber).padStart(6, "0")}
                    </span>
                  </td>
                  <td className="num">{fmtBRL(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stats stats--two" style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="stat">
            <div className="stat__label">Total de serviços</div>
            <div className="stat__value">{services.length}</div>
          </div>
          <div className="stat stat--accent">
            <div className="stat__label">Total do faturamento</div>
            <div className="stat__value">{fmtBRL(client.total)}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="button--ghost" disabled={busy} onClick={onPdf}>
            📄 Baixar PDF
          </button>
          <button className="button--ghost" disabled={busy} onClick={onExcel}>
            📊 Baixar Excel
          </button>
        </div>
      </div>
    </div>
  );
}
