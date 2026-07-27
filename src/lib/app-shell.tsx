import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import "@/routes/app.css";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkClass = (target: string) => (path.startsWith(target) ? "active" : "");

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link to="/painel" className="app-nav__brand">
          Sistema de Gestão
        </Link>
        <div className="app-nav__links">
          <Link to="/painel" className={linkClass("/painel")}>
            Painel
          </Link>
          <Link to="/clientes" className={linkClass("/clientes")}>
            Clientes
          </Link>
          <button className="app-nav__signout" onClick={signOut}>
            Sair
          </button>
        </div>
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}

export function fmtBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
