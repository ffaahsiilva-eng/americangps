import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/lib/app-shell";
import { getCompanySettings, saveCompanySettings } from "@/lib/company.functions";
import cadastroPlanilha from "@/assets/cadastro-american-gps.xlsx.asset.json";

export const Route = createFileRoute("/_authenticated/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa — Sistema de Gestão" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmpresaPage,
});

function EmpresaPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCompanySettings);
  const saveFn = useServerFn(saveCompanySettings);

  const q = useQuery({ queryKey: ["company"], queryFn: () => getFn({}) });

  const [form, setForm] = useState({ name: "", cnpj: "", address: "", phone: "", email: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) {
      setForm({
        name: q.data.name || "",
        cnpj: q.data.cnpj || "",
        address: q.data.address || "",
        phone: q.data.phone || "",
        email: q.data.email || "",
      });
    }
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <AppShell>
      <h1 className="app-title" style={{ marginBottom: 4 }}>Dados da Empresa</h1>
      <p className="app-subtitle">Usados nos fechamentos e notas geradas em PDF.</p>

      <a
        className="button button--primary"
        href={cadastroPlanilha.url}
        download="cadastro-american-gps.xlsx"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8 }}
      >
        ⬇️ Baixar planilha de cadastro (.xlsx)
      </a>



      <div className="panel" style={{ maxWidth: 720, marginTop: 24 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <div className="field">
            <label>Razão social / Nome *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid-cols-2">
            <div className="field">
              <label>CNPJ</label>
              <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>E-mail</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Endereço</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="row row--between" style={{ alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,.55)", fontSize: ".9rem" }}>
              {saved ? "Salvo ✓" : mut.error ? String(mut.error.message) : ""}
            </span>
            <button type="submit" className="button button--primary" disabled={mut.isPending}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
