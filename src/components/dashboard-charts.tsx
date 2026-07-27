import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const NEON = "#ffffff";
const NEON_DIM = "rgba(255,255,255,.55)";
const NEON_FAINT = "rgba(255,255,255,.12)";

const CATEGORY_LABEL: Record<string, string> = {
  instalacao: "Instalação",
  desinstalacao: "Desinstalação",
  manutencao: "Manutenção",
  produto: "Produto",
  servico: "Serviço",
};

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transf.",
  aberto: "Em aberto",
};

// Neon gray-scale palette (all "neon white")
const PIE_COLORS = [
  "#ffffff",
  "rgba(255,255,255,.78)",
  "rgba(255,255,255,.6)",
  "rgba(255,255,255,.42)",
  "rgba(255,255,255,.28)",
  "rgba(255,255,255,.18)",
];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function NeonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(0,0,0,.9)",
        border: "1px solid rgba(255,255,255,.35)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 0 24px rgba(255,255,255,.25)",
        fontFamily: "inherit",
        fontSize: 12,
        color: "#fff",
      }}
    >
      {label ? <div style={{ opacity: 0.6, marginBottom: 4 }}>{label}</div> : null}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <span style={{ opacity: 0.75 }}>{p.name}</span>
          <b>{fmtBRL(Number(p.value))}</b>
        </div>
      ))}
    </div>
  );
}

type Series = {
  days: Array<{ label: string; total: number; pago: number; aberto: number }>;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
};

export function DashboardCharts({ data }: { data: Series | undefined }) {
  const days = data?.days ?? [];
  const catData = Object.entries(data?.byCategory ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: CATEGORY_LABEL[k] ?? k, value: v }));
  const methodData = Object.entries(data?.byMethod ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: METHOD_LABEL[k] ?? k, value: v }));

  const hasSeries = days.some((d) => d.total > 0);
  const hasCat = catData.length > 0;
  const hasMethod = methodData.length > 0;

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        marginBottom: 24,
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      }}
    >
      <div className="panel neon-panel" style={{ gridColumn: "1 / -1" }}>
        <ChartTitle title="Entradas por dia" subtitle="Pago vs Em aberto" />
        <div style={{ width: "100%", height: 260 }}>
          {hasSeries ? (
            <ResponsiveContainer>
              <AreaChart data={days} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPago" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={NEON} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradAberto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke={NEON_FAINT} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={NEON_DIM}
                  tickLine={false}
                  axisLine={{ stroke: NEON_FAINT }}
                  fontSize={11}
                />
                <YAxis
                  stroke={NEON_DIM}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v) => `R$${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip content={<NeonTooltip />} cursor={{ stroke: NEON_DIM, strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  name="Em aberto"
                  dataKey="aberto"
                  stroke="rgba(255,255,255,.55)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#gradAberto)"
                />
                <Area
                  type="monotone"
                  name="Pago"
                  dataKey="pago"
                  stroke={NEON}
                  strokeWidth={2.2}
                  fill="url(#gradPago)"
                  style={{ filter: "url(#glow)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      <div className="panel neon-panel">
        <ChartTitle title="Receita por categoria" />
        <div style={{ width: "100%", height: 240 }}>
          {hasCat ? (
            <ResponsiveContainer>
              <BarChart data={catData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON} stopOpacity={1} />
                    <stop offset="100%" stopColor={NEON} stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={NEON_FAINT} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={NEON_DIM}
                  tickLine={false}
                  axisLine={{ stroke: NEON_FAINT }}
                  fontSize={11}
                />
                <YAxis
                  stroke={NEON_DIM}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v) => `R$${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip content={<NeonTooltip />} cursor={{ fill: "rgba(255,255,255,.05)" }} />
                <Bar
                  dataKey="value"
                  name="Total"
                  fill="url(#gradBar)"
                  radius={[6, 6, 0, 0]}
                  style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,.35))" }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      <div className="panel neon-panel">
        <ChartTitle title="Forma de pagamento" />
        <div style={{ width: "100%", height: 240 }}>
          {hasMethod ? (
            <ResponsiveContainer>
              <PieChart>
                <Tooltip content={<NeonTooltip />} />
                <Pie
                  data={methodData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="rgba(0,0,0,.6)"
                  strokeWidth={1}
                  style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,.4))" }}
                >
                  {methodData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>
        {hasMethod ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 12 }}>
            {methodData.map((m, i) => (
              <span key={m.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.85 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: PIE_COLORS[i % PIE_COLORS.length],
                    boxShadow: "0 0 8px rgba(255,255,255,.5)",
                  }}
                />
                {m.name} · {fmtBRL(m.value)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChartTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.55)",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 12, opacity: 0.45, marginTop: 2 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,.35)",
        fontSize: 13,
      }}
    >
      Sem dados no período.
    </div>
  );
}
