import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import americanGpsLogo from "@/assets/american-gps-logo.png.asset.json";
import "./landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistema de Gestão — Clientes, Serviços e Caixa" },
      {
        name: "description",
        content:
          "Painel de controle para gerenciar clientes, lançar produtos e serviços, acompanhar o caixa e gerar fechamento mensal.",
      },
      { property: "og:title", content: "Sistema de Gestão — Clientes, Serviços e Caixa" },
      {
        property: "og:description",
        content:
          "Painel de controle para gerenciar clientes, lançar produtos e serviços, acompanhar o caixa e gerar fechamento mensal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sistema de Gestão" },
      {
        name: "twitter:description",
        content:
          "Painel de controle para gerenciar clientes, lançar produtos e serviços, acompanhar o caixa e gerar fechamento mensal.",
      },
    ],
  }),
  component: LandingPage,
});

const IMG_ABOUT =
  "https://res.cloudinary.com/dalwymbky/image/upload/v1782346528/b2_j1oc3v.png";

function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add("landing-body");
    document.documentElement.classList.add("is-ready");

    const root = rootRef.current;
    if (!root) return;


    const splitWords = (el: Element) => {
      let idx = 0;
      const walk = (node: Node) => {
        const children = Array.from(node.childNodes);
        for (const child of children) {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.nodeValue || "";
            const frag = document.createDocumentFragment();
            const parts = text.split(/(\s+)/);
            for (const part of parts) {
              if (!part) continue;
              if (/^\s+$/.test(part)) {
                frag.appendChild(document.createTextNode(part));
              } else {
                const span = document.createElement("span");
                span.className = "reveal-word";
                span.style.setProperty("--word-index", String(idx++));
                span.textContent = part;
                frag.appendChild(span);
              }
            }
            (child as ChildNode).replaceWith(frag);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            walk(child);
          }
        }
      };
      walk(el);
    };
    root.querySelectorAll(".reveal-write").forEach(splitWords);

    const revealTargets = root.querySelectorAll(
      ".reveal-media, .reveal-side, .reveal-up, .reveal-mark, .reveal-write",
    );
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.22, rootMargin: "0px 0px -8% 0px" },
      );
      revealTargets.forEach((t) => io.observe(t));
    } else {
      revealTargets.forEach((t) => t.classList.add("is-visible"));
    }

    const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>(".faq-item__trigger"));
    const handlers: Array<() => void> = [];
    triggers.forEach((t) => {
      const handler = () => {
        const expanded = t.getAttribute("aria-expanded") === "true";
        triggers.forEach((other) => {
          other.setAttribute("aria-expanded", "false");
          const ans = other.parentElement?.querySelector<HTMLElement>(".faq-item__answer");
          if (ans) ans.hidden = true;
        });
        if (!expanded) {
          t.setAttribute("aria-expanded", "true");
          const ans = t.parentElement?.querySelector<HTMLElement>(".faq-item__answer");
          if (ans) ans.hidden = false;
        }
      };
      t.addEventListener("click", handler);
      handlers.push(() => t.removeEventListener("click", handler));
    });

    return () => {
      timers.forEach((id) => window.clearInterval(id));
      document.removeEventListener("visibilitychange", globalPlay);
      window.removeEventListener("pageshow", globalPlay);
      window.removeEventListener("focus", globalPlay);
      window.removeEventListener("touchstart", globalPlay);
      window.removeEventListener("touchend", globalPlay);
      window.removeEventListener("click", globalPlay);
      handlers.forEach((h) => h());
      document.body.classList.remove("landing-body");
    };
  }, []);

  return (
    <div ref={rootRef} className="landing page-shell" lang="pt-BR">
      <section className="hero hero--plain">
        <div className="hero__grid">
          <div className="hero__content">
            <h1 className="hero__title">
              <span>GERENCIE CLIENTES,</span>
              <br />
              <span>SERVIÇOS E CAIXA</span>
              <br />
              <span>EM UM SÓ PAINEL</span>
            </h1>
            <p className="hero__sub">
              Painel de Controle para cadastrar clientes, lançar produtos e serviços, acompanhar o caixa por semana ou mês e gerar fechamento mensal com um clique.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" to="/auth">
                Acessar o Painel
              </Link>
            </div>
          </div>
          <figure className="hero__brand">
            <img src={americanGpsLogo.url} alt="American GPS" />
          </figure>
        </div>
        <div className="hero__line" aria-hidden="true" />
      </section>

      <section className="section-dark about-block">
        <div className="about-block__inner">
          <figure className="about-block__media reveal-media">
            <img src={IMG_ABOUT} alt="" />
          </figure>
          <div className="about-block__content reveal-side">
            <h2 className="about-block__title">
              O CAOS DA
              <br />
              GESTÃO MANUAL
            </h2>
            <div className="about-block__tags">
              <span className="about-block__tag">papéis soltos</span>
              <span className="about-block__tag">planilhas quebradas</span>
              <span className="about-block__tag">caixa no escuro</span>
            </div>
            <p className="about-block__copy">
              Anotar cliente em caderno, controlar caixa em planilha, cobrar de memória e ainda tentar lembrar o que foi pago e o que ficou em aberto virou uma operação pesada para quem toca o negócio sozinho.
            </p>
          </div>
        </div>
      </section>

      <section className="section-dark services-block">
        <div className="services-block__inner">
          <h2 className="services-block__title">O QUE O PAINEL DE CONTROLE OFERECE</h2>
          <div className="services-grid">
            <article className="service-card reveal-up" style={{ transitionDelay: "0ms" }}>
              <div className="service-card__icon service-card__icon--headset" />
              <h3 className="service-card__title">Cadastro de Clientes</h3>
              <p className="service-card__copy">
                Cadastre clientes com contato e observações. Busque pelo nome e abra o histórico completo em segundos.
              </p>
            </article>
            <article className="service-card reveal-up" style={{ transitionDelay: "180ms" }}>
              <div className="service-card__icon service-card__icon--play" />
              <h3 className="service-card__title">Controle de Caixa</h3>
              <p className="service-card__copy">
                Total do período somado automaticamente, com filtros semanal e mensal, separando produtos, serviços, pagos e em aberto.
              </p>
            </article>
            <article className="service-card reveal-up" style={{ transitionDelay: "360ms" }}>
              <div className="service-card__icon service-card__icon--screen" />
              <h3 className="service-card__title">Fechamento Mensal</h3>
              <p className="service-card__copy">
                Um clique para gerar o recibo do mês com todos os itens do cliente, pronto para imprimir ou salvar em PDF.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section-dark comparison-block">
        <div className="comparison-block__inner">
          <h2 className="comparison-block__title">VEJA A DIFERENÇA NA PRÁTICA</h2>
          <div className="comparison-grid">
            <article className="comparison-card comparison-card--neg reveal-up">
              <h3 className="comparison-card__title">Sem o Painel</h3>
              <ul className="comparison-list">
                {[
                  "Cliente perdido em anotações soltas",
                  "Caixa somado no braço, com erros",
                  "Cobrança feita de memória",
                  "Fechamento demora horas para montar",
                ].map((t) => (
                  <li key={t} className="reveal-mark">
                    {t}
                  </li>
                ))}
              </ul>
            </article>
            <article className="comparison-card comparison-card--pos reveal-up">
              <h3 className="comparison-card__title">Com o Painel</h3>
              <ul className="comparison-list">
                {[
                  "Histórico completo por cliente com busca",
                  "Total do período somado automaticamente",
                  "Status pago/em aberto por lançamento",
                  "Recibo do mês gerado em um clique",
                ].map((t) => (
                  <li key={t} className="reveal-mark">
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <div className="comparison-block__cta">
            <Link className="button button--comparison" to="/auth">
              Acessar o Painel
            </Link>
          </div>
        </div>
      </section>

      <section className="section-dark quote-block">
        <div className="quote-block__inner">
          <div className="quote-panel">
            <p className="quote-text reveal-write">
              O sistema não substitui o seu atendimento, <em>ele organiza a sua operação.</em> Menos improviso, mais controle real do dia a dia.
            </p>
            <p className="quote-meta reveal-write reveal-write--delay">
              Cadastro, lançamento, caixa e fechamento em um único fluxo — pensado para quem gerencia clientes e serviços todos os dias.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
