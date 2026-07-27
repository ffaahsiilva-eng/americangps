import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import "./landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Future Editorial Hero" },
      {
        name: "description",
        content:
          "Treinamento para aprender a usar IA na gestão de redes sociais com método prático, estrutura clara e aplicação real.",
      },
      { property: "og:title", content: "Future Editorial Hero" },
      {
        property: "og:description",
        content:
          "Treinamento para aprender a usar IA na gestão de redes sociais com método prático, estrutura clara e aplicação real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Future Editorial Hero" },
      {
        name: "twitter:description",
        content:
          "Treinamento para aprender a usar IA na gestão de redes sociais com método prático, estrutura clara e aplicação real.",
      },
    ],
  }),
  component: LandingPage,
});

const HERO_VIDEO_DESKTOP =
  "https://res.cloudinary.com/dalwymbky/video/upload/v1782346534/hero2_gtrjg7.mp4";
const HERO_VIDEO_MOBILE =
  "https://res.cloudinary.com/dalwymbky/video/upload/v1782346535/hero2mobile_vy9zzi.mp4";
const IMG_ABOUT =
  "https://res.cloudinary.com/dalwymbky/image/upload/v1782346528/b2_j1oc3v.png";
const IMG_DELIVERABLE =
  "https://res.cloudinary.com/dalwymbky/image/upload/v1782346527/i1_va5clt.png";

const FAQ_ITEMS = [
  {
    q: "Esse treinamento é para iniciantes?",
    a: "Sim. A proposta é ensinar como usar IA na gestão das redes sociais mesmo para quem ainda não tem um processo estruturado.",
  },
  {
    q: "Eu preciso entender de tecnologia para aplicar?",
    a: "Não. O treinamento pode ser apresentado de forma prática, com foco no uso direto das ferramentas no contexto das redes sociais.",
  },
  {
    q: "Esse conteúdo serve para negócios e perfis pessoais?",
    a: "Sim. A lógica de planejamento, criação e otimização com IA pode ser adaptada para diferentes nichos, marcas e posicionamentos.",
  },
  {
    q: "Eu vou receber materiais prontos para usar?",
    a: "A estrutura já prevê espaço para incluir prompts, modelos, exemplos e recursos práticos que acelerem a aplicação.",
  },
  {
    q: "Em quanto tempo eu consigo começar a aplicar?",
    a: "A proposta da oferta é permitir aplicação rápida, para que a pessoa já consiga usar IA na rotina logo nas primeiras etapas.",
  },
];

function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add("landing-body");
    document.documentElement.classList.add("is-ready");

    const root = rootRef.current;
    if (!root) return;

    // Hero video autoplay resilience
    const videos = Array.from(
      root.querySelectorAll<HTMLVideoElement>(".hero__video, .hero__video--mobile"),
    );
    const timers: number[] = [];
    videos.forEach((v) => {
      v.muted = true;
      v.defaultMuted = true;
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      v.controls = false;
      v.setAttribute("disablepictureinpicture", "");
      (v as any).disableRemotePlayback = true;
      const tryPlay = () => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      };
      tryPlay();
      v.addEventListener("loadeddata", tryPlay);
      v.addEventListener("pause", tryPlay);
      v.addEventListener("ended", tryPlay);
      let count = 0;
      const id = window.setInterval(() => {
        count++;
        if (v.paused) tryPlay();
        if (count > 20 || (!v.paused && v.currentTime > 2)) window.clearInterval(id);
      }, 1200);
      timers.push(id);
    });
    const globalPlay = () => videos.forEach((v) => v.paused && v.play().catch(() => {}));
    document.addEventListener("visibilitychange", globalPlay);
    window.addEventListener("pageshow", globalPlay);
    window.addEventListener("focus", globalPlay);
    window.addEventListener("touchstart", globalPlay, { passive: true });
    window.addEventListener("touchend", globalPlay, { passive: true });
    window.addEventListener("click", globalPlay);

    // Word split for .reveal-write
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

    // IntersectionObserver reveals
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

    // FAQ
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
      {/* HERO */}
      <section className="hero">
        <div className="hero__media">
          <video
            className="hero__video"
            src={HERO_VIDEO_DESKTOP}
            autoPlay
            muted
            loop
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5"
            x5-video-player-fullscreen="false"
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            tabIndex={-1}
            aria-hidden="true"
          />
          <video
            className="hero__video--mobile"
            src={HERO_VIDEO_MOBILE}
            autoPlay
            muted
            loop
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5"
            x5-video-player-fullscreen="false"
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        <div className="hero__grid">
          <h1 className="hero__title">
            <span>DOMINE A IA E</span>
            <br />
            <span>TRANSFORME SUAS</span>
            <br />
            <span>REDES SOCIAIS</span>
          </h1>
          <p className="hero__sub">
            Aprenda a usar inteligência artificial para planejar, produzir, organizar e acelerar a gestão das suas redes sociais com mais clareza, consistência e menos sobrecarga no dia a dia.
          </p>
          <div className="hero__actions">
            <a className="button button--primary" href="#buy">
              Quero Dominar a IA Agora
            </a>
          </div>
        </div>
        <div className="hero__line" aria-hidden="true" />
      </section>

      {/* ABOUT */}
      <section className="section-dark about-block">
        <div className="about-block__inner">
          <figure className="about-block__media reveal-media">
            <img src={IMG_ABOUT} alt="" />
          </figure>
          <div className="about-block__content reveal-side">
            <h2 className="about-block__title">
              O CAOS DA
              <br />
              ROTINA DIGITAL
            </h2>
            <div className="about-block__tags">
              <span className="about-block__tag">falta de tempo</span>
              <span className="about-block__tag">bloqueio criativo</span>
              <span className="about-block__tag">atraso constante</span>
            </div>
            <p className="about-block__copy">
              Criar conteúdo, manter frequência, responder demandas, pensar em calendário e ainda tentar crescer nas redes virou uma operação pesada para quem faz tudo sozinho ou depende de processos lentos.
            </p>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="section-dark services-block">
        <div className="services-block__inner">
          <h2 className="services-block__title">O QUE VOCÊ GANHA COM O SOCIAL IA PRO</h2>
          <div className="services-grid">
            <article className="service-card reveal-up" style={{ transitionDelay: "0ms" }}>
              <div className="service-card__icon service-card__icon--headset" />
              <h3 className="service-card__title">Mais Agilidade</h3>
              <p className="service-card__copy">
                Aprenda a usar IA para acelerar ideias, roteiros, legendas, planejamentos e tarefas que hoje consomem horas da sua semana.
              </p>
            </article>
            <article className="service-card reveal-up" style={{ transitionDelay: "180ms" }}>
              <div className="service-card__icon service-card__icon--play" />
              <h3 className="service-card__title">Mais Clareza</h3>
              <p className="service-card__copy">
                Tenha um processo objetivo para organizar conteúdo, manter consistência e parar de depender apenas de improviso.
              </p>
            </article>
            <article className="service-card reveal-up" style={{ transitionDelay: "360ms" }}>
              <div className="service-card__icon service-card__icon--screen" />
              <h3 className="service-card__title">Mais Escala</h3>
              <p className="service-card__copy">
                Descubra como usar ferramentas de IA para produzir melhor sem perder identidade, estratégia e qualidade de comunicação.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="section-dark comparison-block">
        <div className="comparison-block__inner">
          <h2 className="comparison-block__title">VEJA A DIFERENÇA NA PRÁTICA</h2>
          <div className="comparison-grid">
            <article className="comparison-card comparison-card--neg reveal-up">
              <h3 className="comparison-card__title">Sem o Social IA Pro</h3>
              <ul className="comparison-list">
                {[
                  "Demora para criar conteúdo",
                  "Falta de constância nas postagens",
                  "Decisões baseadas em improviso",
                  "Mais desgaste e menos produção",
                ].map((t) => (
                  <li key={t} className="reveal-mark">
                    {t}
                  </li>
                ))}
              </ul>
            </article>
            <article className="comparison-card comparison-card--pos reveal-up">
              <h3 className="comparison-card__title">Com o Social IA Pro</h3>
              <ul className="comparison-list">
                {[
                  "Produção mais rápida e estruturada",
                  "Processo claro para publicar com frequência",
                  "Uso estratégico de prompts e ferramentas",
                  "Mais resultado com menos esforço operacional",
                ].map((t) => (
                  <li key={t} className="reveal-mark">
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <div className="comparison-block__cta">
            <a className="button button--comparison" href="#buy">
              Quero Dominar a IA Agora
            </a>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="section-dark quote-block">
        <div className="quote-block__inner">
          <div className="quote-panel">
            <p className="quote-text reveal-write">
              Você não vai apenas usar ferramentas, <em>vai aprender um método aplicável.</em> O foco é transformar IA em processo real para gerenciar redes sociais.
            </p>
            <p className="quote-meta reveal-write reveal-write--delay">
              Em vez de dicas soltas ou promessas genéricas, o treinamento mostra como encaixar a IA na rotina, com lógica, fluxo e uso prático.
            </p>
          </div>
        </div>
      </section>

      {/* DELIVERABLES */}
      <section className="section-light deliverables-block">
        <div className="deliverables-block__inner">
          <div className="deliverables-block__header">
            <h2 className="deliverables-block__title">
              O QUE VOCÊ
              <br />
              VAI RECEBER
            </h2>
          </div>
          <div className="deliverables-grid">
            {[
              {
                t: "Treinamento Base",
                c: "A base completa para entender como aplicar IA no seu processo de criação, organização e gestão de conteúdo.",
                off: false,
              },
              {
                t: "Prompts Prontos",
                c: "Modelos práticos para acelerar ideias, roteiros, legendas e tarefas que hoje travam sua produção no dia a dia.",
                off: true,
              },
              {
                t: "Fluxo de Produção",
                c: "Um caminho claro para organizar publicação, manter constância e transformar IA em rotina de execução real.",
                off: false,
              },
              {
                t: "Aplicação Estratégica",
                c: "Direcionamento para usar IA com mais intenção, sem perder posicionamento, clareza da marca e consistência na comunicação.",
                off: true,
              },
            ].map((d, i) => (
              <article
                key={d.t}
                className={`deliverable-card reveal-up${d.off ? " deliverable-card--offset" : ""}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <img src={IMG_DELIVERABLE} alt="" />
                <div className="deliverable-card__caption">
                  <h3 className="deliverable-card__title">{d.t}</h3>
                  <p className="deliverable-card__copy">{d.c}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* OFFER */}
      <section className="section-dark offer-block" id="buy">
        <div className="offer-block__inner">
          <div className="offer-card reveal-up">
            <span className="offer-eyebrow">Oferta</span>
            <h2 className="offer-title">TREINAMENTO IA PARA REDES SOCIAIS</h2>
            <ul className="offer-list">
              <li>Acesso ao treinamento completo</li>
              <li>Método prático de aplicação da IA</li>
              <li>Modelos para produção de conteúdo</li>
              <li>Estrutura para gestão mais eficiente</li>
            </ul>
            <div className="offer-price">
              <span className="offer-price__label">Investimento</span>
              <span className="offer-price__value">R$497</span>
            </div>
            <a className="button button--offer" href="#buy">
              Quero Garantir Meu Acesso Agora
            </a>
          </div>
        </div>
      </section>

      {/* GUARANTEE */}
      <section className="section-dark guarantee-block">
        <div className="guarantee-block__inner">
          <div className="guarantee-card reveal-up">
            <div className="guarantee-seal">
              <div className="guarantee-ring">
                <div className="guarantee-seven">
                  <span className="guarantee-seven__back">7</span>
                  <span className="guarantee-seven__front">7</span>
                  <span className="guarantee-seven__glow" />
                </div>
              </div>
            </div>
            <div className="guarantee-content">
              <span className="guarantee-content__eyebrow">Garantia</span>
              <h2 className="guarantee-content__title">7 dias de garantia</h2>
              <p className="guarantee-content__copy">
                Você pode apresentar aqui sua garantia para reduzir objeções e aumentar a confiança de quem está quase entrando no treinamento.
              </p>
              <p className="guarantee-content__note">
                Substitua este texto pelos termos reais da garantia, prazo e condições.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-dark faq-block">
        <div className="faq-block__inner">
          <div className="faq-block__header">
            <span className="faq-eyebrow">FAQ</span>
            <h2 className="faq-block__title">PERGUNTAS FREQUENTES</h2>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="faq-item">
                <button
                  type="button"
                  className="faq-item__trigger"
                  aria-expanded="false"
                >
                  <span>{item.q}</span>
                  <span className="faq-item__icon" aria-hidden="true" />
                </button>
                <div className="faq-item__answer" hidden>
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-minimal section-dark">
        <p>Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
