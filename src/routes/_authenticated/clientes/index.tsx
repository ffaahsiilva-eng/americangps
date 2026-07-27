import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "./-shell";
import { listClients, createClient } from "@/lib/clients.functions";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Sistema de Gestão" },
      { name: "description", content: "Cadastro e gestão de clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsList,
});

function ClientsList() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const listFn = useServerFn(listClients);
  const createFn = useServerFn(createClient);
  const qc = useQueryClient();

  const clients = useQuery({
    queryKey: ["clients", search],
    queryFn: () => listFn({ data: { search: search || undefined } }),
  });

  const createMut = useMutation({
    mutationFn: (data: {
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
    }) => createFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setModalOpen(false);
    },
  });

  return (
    <AppShell>
      <div className="row row--between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="app-title">Clientes</h1>
          <p className="app-subtitle" style={{ marginBottom: 0 }}>
            Cadastre e acompanhe o histórico mensal de cada cliente.
          </p>
        </div>
        <button className="button button--primary" onClick={() => setModalOpen(true)}>
          Novo cliente
        </button>
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="search">Buscar por nome</label>
        <input
          id="search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Digite o nome do cliente..."
        />
      </div>

      {clients.data && clients.data.length > 0 ? (
        <div className="client-grid" style={{ marginTop: 24 }}>
          {clients.data.map((c) => (
            <Link
              key={c.id}
              to="/clientes/$id"
              params={{ id: c.id }}
              className="client-card"
            >
              <h3 className="client-card__name">{c.name}</h3>
              <p className="client-card__meta">
                {c.email || c.phone || "Sem contato cadastrado"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,.5)", margin: 0 }}>
            {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
          </p>
        </div>
      )}

      {modalOpen && (
        <ClientModal
          onClose={() => setModalOpen(false)}
          onSubmit={(data) => createMut.mutate(data)}
          loading={createMut.isPending}
          error={createMut.error?.message}
        />
      )}
    </AppShell>
  );
}

function ClientModal({
  onClose,
  onSubmit,
  loading,
  error,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; email?: string; phone?: string; notes?: string }) => void;
  loading: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo cliente</h2>
        {error && <div className="auth-error">{error}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              email: email || undefined,
              phone: phone || undefined,
              notes: notes || undefined,
            });
          }}
        >
          <div className="field">
            <label>Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid-cols-2">
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="row row--between">
            <button type="button" className="button--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={loading}>
              {loading ? "Salvando..." : "Salvar cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
