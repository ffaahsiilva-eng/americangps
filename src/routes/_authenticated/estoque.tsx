import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/lib/app-shell";
import { supabase } from "@/integrations/supabase/client";
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

type InventoryItem = {
  id: string;
  category: ServiceCategory;
  group_name: string;
  name: string;
  price: number | null;
  sort_order: number;
};

type Draft = {
  id?: string;
  category: ServiceCategory;
  group_name: string;
  name: string;
  price: string;
};

const EMPTY_DRAFT: Draft = { category: "instalacao", group_name: "", name: "", price: "" };

function EstoquePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ServiceCategory>("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setLoading(false); return; }

    const { data, error: err } = await supabase
      .from("inventory_items")
      .select("id, category, group_name, name, price, sort_order")
      .order("category")
      .order("sort_order")
      .order("name");

    if (err) { setError(err.message); setLoading(false); return; }

    if (!data || data.length === 0) {
      // Seed from catalog on first visit
      const rows: Array<Omit<InventoryItem, "id"> & { owner_id: string }> = [];
      let order = 0;
      (Object.keys(SERVICE_CATALOG) as ServiceCategory[]).forEach((category) => {
        SERVICE_CATALOG[category].forEach((g) => {
          g.items.forEach((item) => {
            rows.push({
              owner_id: uid,
              category,
              group_name: g.group,
              name: item,
              price: null,
              sort_order: order++,
            });
          });
        });
      });
      const { data: inserted, error: insErr } = await supabase
        .from("inventory_items")
        .insert(rows)
        .select("id, category, group_name, name, price, sort_order");
      if (insErr) { setError(insErr.message); setLoading(false); return; }
      setItems((inserted ?? []) as InventoryItem[]);
    } else {
      setItems(data as InventoryItem[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const r of items) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    return { total: items.length, byCategory };
  }, [items]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((it) => {
      const matchesSearch = !s || it.name.toLowerCase().includes(s) || it.group_name.toLowerCase().includes(s);
      const matchesCategory = filter === "all" || it.category === filter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, { category: ServiceCategory; group: string; items: InventoryItem[] }> = {};
    for (const it of filtered) {
      const key = `${it.category}::${it.group_name}`;
      if (!map[key]) map[key] = { category: it.category, group: it.group_name, items: [] };
      map[key].items.push(it);
    }
    return Object.values(map);
  }, [filtered]);

  const knownGroups = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.group_name && set.add(i.group_name));
    return Array.from(set).sort();
  }, [items]);

  async function saveDraft() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { setError("Informe o nome do item."); return; }
    setSaving(true);
    setError(null);

    const priceValue = editing.price.trim() === "" ? null : Number(editing.price.replace(",", "."));
    if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      setError("Preço inválido."); setSaving(false); return;
    }

    if (editing.id) {
      const { error: err } = await supabase
        .from("inventory_items")
        .update({
          category: editing.category,
          group_name: editing.group_name.trim(),
          name,
          price: priceValue,
        })
        .eq("id", editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setError("Sessão expirada."); setSaving(false); return; }
      const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0);
      const { error: err } = await supabase.from("inventory_items").insert({
        owner_id: uid,
        category: editing.category,
        group_name: editing.group_name.trim(),
        name,
        price: priceValue,
        sort_order: maxOrder + 1,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setEditing(null);
    setSaving(false);
    await load();
  }

  async function removeItem(id: string) {
    if (!confirm("Remover este item do estoque?")) return;
    const { error: err } = await supabase.from("inventory_items").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <AppShell>
      <div className="row row--between" style={{ marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="app-title">Estoque</h1>
          <p className="app-subtitle" style={{ marginBottom: 0 }}>
            Catálogo completo de produtos, kits e serviços. Edite ou adicione itens conforme necessário.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setEditing({ ...EMPTY_DRAFT })}>
          + Novo item
        </button>
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

      {error && (
        <div className="panel" style={{ marginBottom: 16, borderColor: "#ef4444", color: "#fca5a5" }}>
          {error}
        </div>
      )}

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

      {loading ? (
        <div className="panel" style={{ textAlign: "center" }}>Carregando…</div>
      ) : (
        <div className="estoque-list">
          {grouped.length > 0 ? (
            grouped.map((g) => (
              <div className="estoque-group" key={`${g.category}-${g.group}`}>
                <div className="estoque-group__head">
                  <span className={`chip ${CATEGORY_CHIP[g.category]}`}>{CATEGORY_LABEL[g.category]}</span>
                  <span className="estoque-group__title">{g.group || "Sem grupo"}</span>
                </div>
                <ul className="estoque-group__items">
                  {g.items.map((item) => (
                    <li key={item.id} className="estoque-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {item.name}
                        {item.price != null && (
                          <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 13 }}>
                            R$ {item.price.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </span>
                      <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setEditing({
                            id: item.id,
                            category: item.category,
                            group_name: item.group_name,
                            name: item.name,
                            price: item.price != null ? String(item.price) : "",
                          })}
                        >
                          Editar
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={() => removeItem(item.id)}>
                          Excluir
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="panel" style={{ textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>Nenhum item encontrado.</p>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? "Editar item" : "Novo item"}</h2>
            <form onSubmit={(e) => { e.preventDefault(); saveDraft(); }}>
              <div className="field">
                <label>Categoria</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as ServiceCategory })}
                >
                  <option value="instalacao">{CATEGORY_LABEL.instalacao}</option>
                  <option value="desinstalacao">{CATEGORY_LABEL.desinstalacao}</option>
                  <option value="manutencao">{CATEGORY_LABEL.manutencao}</option>
                </select>
              </div>
              <div className="field">
                <label>Grupo</label>
                <input
                  list="estoque-group-list"
                  value={editing.group_name}
                  onChange={(e) => setEditing({ ...editing, group_name: e.target.value })}
                  placeholder="Ex.: Sighra Light, SmartGate, Complementos..."
                />
                <datalist id="estoque-group-list">
                  {knownGroups.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div className="field">
                <label>Nome do item</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Nome do produto, kit ou serviço"
                  required
                />
              </div>
              <div className="field">
                <label>Preço sugerido (opcional)</label>
                <input
                  inputMode="decimal"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="row" style={{ gap: 10, justifyContent: "flex-end", marginTop: 12, flexShrink: 0 }}>
                <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
