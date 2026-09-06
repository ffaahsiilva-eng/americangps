import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import americanGpsLogo from "@/assets/american-gps-logo.jpg";
import "@/routes/app.css";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
        <Link to="/painel" className="app-nav__brand" onClick={() => setMenuOpen(false)}>
          <img
            src={americanGpsLogo}
            alt="American GPS"
            className="app-nav__logo"
          />
          <span className="app-nav__brand-label">AMERICAN GPS</span>
        </Link>

        <button
          type="button"
          className="app-nav__toggle"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="app-nav-drawer"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`app-nav__toggle-icon ${menuOpen ? "is-open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className="app-nav__links app-nav__links--desktop">
          <Link to="/painel" className={linkClass("/painel")}>
            Painel
          </Link>
          <Link to="/clientes" className={linkClass("/clientes")}>
            Clientes
          </Link>
          <Link to="/estoque" className={linkClass("/estoque")}>
            Estoque
          </Link>
          <Link to="/empresa" className={linkClass("/empresa")}>
            Empresa
          </Link>
          <button className="app-nav__signout" onClick={signOut}>
            Sair
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="app-nav__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      <div
        id="app-nav-drawer"
        className={`app-nav__drawer ${menuOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        <Link to="/painel" className={linkClass("/painel")} onClick={() => setMenuOpen(false)}>
          Painel
        </Link>
        <Link to="/clientes" className={linkClass("/clientes")} onClick={() => setMenuOpen(false)}>
          Clientes
        </Link>
        <Link to="/estoque" className={linkClass("/estoque")} onClick={() => setMenuOpen(false)}>
          Estoque
        </Link>
        <Link to="/empresa" className={linkClass("/empresa")} onClick={() => setMenuOpen(false)}>
          Empresa
        </Link>
        <button className="app-nav__signout" onClick={signOut}>
          Sair
        </button>
      </div>

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
