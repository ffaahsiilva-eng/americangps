import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/lib/app-shell";
import { SERVICE_CATALOG, CATEGORY_LABEL, type ServiceCategory } from "@/lib/service-catalog";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Sistema de Gestão" },
      { name: "description", content: "Catálogo de produtos e serviços disponíveis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EstoquePage,
});

const CATEGORY_CHIP: Record<ServiceCategory, string> = {
  instalacao: "chip--instalacao",
  desinstalacao: "chip--desinstalacao",
  manutencao: "chip--manutencao",
};

function EstoquePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ServiceCategory>("all");

  const allItems = useMemo(() => {
    const rows: { category: ServiceCategory; group: string; item: string }[] = [];
    (Object.keys(SERVICE_CATALOG) as ServiceCategory[]).forEach((category) => {
      SERVICE_CATALOG[category].forEach((g) => {
        g.items.forEach((item) => rows.push({ category, group: g.group, item }));
      });
    });
    return rows;
  }, []);

  const totals = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const r of allItems) {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    }
    return { total: allItems.length, byCategory };
  }, [allItems]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allItems.filter((it) => {
      const matchesSearch = !s || it.item.toLowerCase().includes(s) || it.group.toLowerCase().includes(s);
      const matchesCategory = filter === "all" || it.category === filter;
      return matchesSearch && matchesCategory;
    });
  }, [allItems, search, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, { category: ServiceCategory; group: string; items: string[] }> = {};
    for (const it of filtered) {
      const key = `${it.category}::${it.group}`;
      if (!map[key]) map[key] = { category: it.category, group: it.group, items: [] };
      map[key].items.push(it.item);
    }
    return Object.values(map);
  }, [filtered]);

  return (
    <AppShell>
      <div className="row row--between" style={{ marginBottom: 24, gap: 16 }}>
        <div>
          <h1 className="app-title">Estoque</h1>
          <p className="app-subtitle" style={{ marginBottom: 0 }}>
            Catálogo completo de produtos, kits e serviços disponíveis.
          </p>
        </div>
      </div>

      <div className="stats stats--three" style={{ marginBottom: 20 }}>
        <div className="stat stat--accent">
          <div className="stat__label">Total de itens</div>
          <div className="stat__value">{totals.total}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Instalação</div>
          <div className="stat__value">{totals.byCategory.instalacao ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Desinstalação</div>
          <div className="stat__value">{totals.byCategory.desinstalacao ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Manutenção</div>
          <div className="stat__value">{totals.byCategory.manutencao ?? 0}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 240px", minWidth: 0 }}>
            <label htmlFor="estoque-search">Buscar item</label>
            <input
              id="estoque-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome do produto, kit ou grupo..."
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "0 1 200px", minWidth: 0 }}>
            <label htmlFor="estoque-filter">Categoria</label>
            <select
              id="estoque-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | ServiceCategory)}
            >
              <option value="all">Todas</option>
              <option value="instalacao">{CATEGORY_LABEL.instalacao}</option>
              <option value="desinstalacao">{CATEGORY_LABEL.desinstalacao}</option>
              <option value="manutencao">{CATEGORY_LABEL.manutencao}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="estoque-list">
        {grouped.length > 0 ? (
          grouped.map((g) => (
            <div className="estoque-group" key={`${g.category}-${g.group}`}>
              <div className="estoque-group__head">
                <span className={`chip ${CATEGORY_CHIP[g.category]}`}>{CATEGORY_LABEL[g.category]}</span>
                <span className="estoque-group__title">{g.group}</span>
              </div>
              <ul className="estoque-group__items">
                {g.items.map((item) => (
                  <li key={item} className="estoque-item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="panel" style={{ textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
              Nenhum item encontrado.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
