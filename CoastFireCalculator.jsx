import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ---- Core math -------------------------------------------------------

/** Simulate a real (inflation-adjusted) portfolio balance from retirement
 * to end-of-plan age, netting out guaranteed income against spend each year. */
function simulatePath(
  startBalance,
  retAge,
  planAge,
  r,
  spend,
  ssAmt,
  ssAge,
  vaAmt,
  vaAge
) {
  let bal = startBalance;
  const path = [{ age: retAge, balance: bal }];
  for (let age = retAge; age < planAge; age++) {
    let guaranteed = 0;
    if (age >= ssAge) guaranteed += ssAmt * 12;
    if (age >= vaAge) guaranteed += vaAmt * 12;
    const need = Math.max(spend - guaranteed, 0);
    bal = bal * (1 + r) - need;
    path.push({ age: age + 1, balance: bal });
  }
  return path;
}

/** Bisection search for the smallest starting balance at retirement that
 * survives to planAge with at least `bequest` left over (a legacy target;
 * pass 0 for the classic "spend it to zero" case). */
function requiredBalance(
  retAge,
  planAge,
  r,
  spend,
  ssAmt,
  ssAge,
  vaAmt,
  vaAge,
  bequest = 0
) {
  let lo = 0;
  let hi = Math.max(spend * 40, bequest * 2, 100000);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const path = simulatePath(mid, retAge, planAge, r, spend, ssAmt, ssAge, vaAmt, vaAge);
    const end = path[path.length - 1].balance;
    if (end < bequest) lo = mid;
    else hi = mid;
  }
  return hi;
}

const fmtUSD = (n) =>
  "$" + Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtUSDk = (n) => "$" + (n / 1000).toFixed(0) + "k";

// ---- UI pieces --------------------------------------------------------

function Field({ label, value, onChange, step = 1, prefix, suffix }) {
  // Render empty instead of "0" so typing a digit doesn't concatenate into
  // a leading zero (e.g. "0" + "5" -> "05") the way controlled number
  // inputs otherwise do when the underlying state starts at 0.
  const display = value === 0 ? "" : value;

  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <div style={styles.inputWrap}>
        {prefix && <span style={styles.affix}>{prefix}</span>}
        <input
          type="number"
          value={display}
          step={step}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { onChange(0); return; }
            const parsed = parseFloat(raw);
            onChange(Number.isNaN(parsed) ? 0 : parsed);
          }}
          onFocus={(e) => e.target.select()}
          style={{
            ...styles.input,
            paddingLeft: prefix ? 22 : 10,
            paddingRight: suffix ? 26 : 10,
          }}
        />
        {suffix && <span style={{ ...styles.affix, ...styles.affixRight }}>{suffix}</span>}
      </div>
    </label>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent || "#1a1a18" }}>{value}</div>
    </div>
  );
}

function CoastFireInfoModal({ onClose }) {
  return (
    <div
      style={styles.modalOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={styles.modalBox}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coast-fire-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <h2 id="coast-fire-modal-title" style={styles.modalTitle}>
            What is Coast FIRE?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={styles.modalClose}
          >
            ×
          </button>
        </div>

        <div style={styles.modalBody}>
          <p>
            <strong>Coast FIRE</strong> is the portfolio value where, if you
            stopped contributing entirely today, compound growth alone would
            carry it to your full retirement number by your target
            retirement age. Below that number you still need to keep saving;
            above it, your job only needs to cover current living
            expenses — further investing becomes optional, not required.
          </p>

          <p style={styles.modalSubhead}>The core formula</p>
          <p style={styles.formula}>Coast number = Target number ÷ (1 + r)ⁿ</p>
          <p>
            where <em>r</em> is your expected real (inflation-adjusted)
            return and <em>n</em> is years until retirement. It's a present
            value calculation — the target number discounted back to today.
          </p>

          <p style={styles.modalSubhead}>What this calculator adds</p>
          <ul style={styles.modalList}>
            <li>
              <strong>Guaranteed income (Social Security / other):</strong>{" "}
              instead of a flat subtraction, income is modeled as starting at
              a specific age, which creates a "bridge" period where your
              portfolio still funds 100% of spending. The target number is
              solved with a year-by-year simulation, not a single formula.
            </li>
            <li>
              <strong>Legacy target:</strong> instead of solving for the
              balance that hits zero at your plan-to age, the solver targets
              a balance that leaves your chosen amount behind.
            </li>
          </ul>

          <p style={styles.modalSubhead}>What it assumes away</p>
          <ul style={styles.modalList}>
            <li>Constant real spending and a constant real return — no sequence-of-returns variance.</li>
            <li>No taxes on withdrawals, Social Security benefit taxation, or Medicare gap.</li>
            <li>Guaranteed income entered as real, today's-dollar amounts (any cost-of-living adjustments already accounted for).</li>
            <li>Non-means-tested income (e.g., VA disability, military retired pay) is treated as fixed; means-tested benefits that phase out with rising assets aren't modeled this way.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}



export default function CoastFireCalculator() {
  const [showInfo, setShowInfo] = useState(false);
  const [curAge, setCurAge] = useState(35);
  const [retAge, setRetAge] = useState(55);
  const [planAge, setPlanAge] = useState(90);
  const [returnPct, setReturnPct] = useState(6);
  const [spend, setSpend] = useState(100000);
  const [current, setCurrent] = useState(500000);

  const [ssAmt, setSsAmt] = useState(2200);
  const [ssAge, setSsAge] = useState(67);
  const [vaAmt, setVaAmt] = useState(1500);
  const [vaAge, setVaAge] = useState(55);
  const [bequest, setBequest] = useState(0);

  const results = useMemo(() => {
    const r = returnPct / 100;
    const n = Math.max(retAge - curAge, 0);

    const balNoGuarantee = requiredBalance(retAge, planAge, r, spend, 0, 999, 0, 999, bequest);
    const balWithGuarantee = requiredBalance(
      retAge, planAge, r, spend, ssAmt, ssAge, vaAmt, vaAge, bequest
    );

    const coastBase = balNoGuarantee / Math.pow(1 + r, n);
    const coastAdj = balWithGuarantee / Math.pow(1 + r, n);
    const saved = coastBase - coastAdj;

    const projectedAtRetirement = current * Math.pow(1 + r, n);
    const pathNo = simulatePath(
      projectedAtRetirement, retAge, planAge, r, spend, 0, 999, 0, 999
    );
    const pathWith = simulatePath(
      projectedAtRetirement, retAge, planAge, r, spend, ssAmt, ssAge, vaAmt, vaAge
    );

    const chartData = pathNo.map((p, i) => ({
      age: p.age,
      withoutGuarantee: Math.round(p.balance),
      withGuarantee: Math.round(pathWith[i].balance),
    }));

    // --- Ratio metrics ---
    const coastRatioPct = coastAdj > 0 ? (current / coastAdj) * 100 : 0;

    const guaranteedAnnual = ssAmt * 12 + vaAmt * 12;
    const coveragePct = spend > 0 ? (guaranteedAnnual / spend) * 100 : 0;

    const latestBenefitStartAge = Math.max(ssAge, vaAge);
    const bridgeYears = Math.max(latestBenefitStartAge - retAge, 0);

    let requiredCagrPct = null;
    if (n > 0 && current > 0 && coastAdj > current) {
      requiredCagrPct = (Math.pow(coastAdj / current, 1 / n) - 1) * 100;
    }
    const cushionPct =
      current > 0 && coastAdj > 0 && current >= coastAdj
        ? (current / coastAdj - 1) * 100
        : null;

    return {
      coastBase,
      coastAdj,
      saved,
      isPastCoast: current >= coastAdj,
      isPastCoastBase: current >= coastBase,
      gapAdj: coastAdj - current,
      gapBase: coastBase - current,
      chartData,
      n,
      coastRatioPct,
      coveragePct,
      bridgeYears,
      requiredCagrPct,
      cushionPct,
    };
  }, [curAge, retAge, planAge, returnPct, spend, current, ssAmt, ssAge, vaAmt, vaAge, bequest]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.eyebrow}>Coast FIRE / retirement modeling</div>
          <div style={styles.titleRow}>
            <h1 style={styles.h1}>Coast FIRE Calculator</h1>
            <button
              onClick={() => setShowInfo(true)}
              style={styles.infoButton}
              aria-label="What is Coast FIRE?"
              title="What is Coast FIRE?"
            >
              i
            </button>
          </div>
          <p style={styles.subhead}>
            With Social Security &amp; veteran income modeled as a step-change
            in required withdrawals, not a flat subtraction.
          </p>
        </header>

        {showInfo && <CoastFireInfoModal onClose={() => setShowInfo(false)} />}

        <section style={styles.panel}>
          <div style={styles.groupLabel}>Retirement basics</div>
          <div style={styles.grid}>
            <Field label="Current age" value={curAge} onChange={setCurAge} />
            <Field label="Retirement age" value={retAge} onChange={setRetAge} />
            <Field label="Plan to age" value={planAge} onChange={setPlanAge} />
            <Field label="Expected real return" value={returnPct} onChange={setReturnPct} step={0.1} suffix="%" />
            <Field label="Annual spend in retirement" value={spend} onChange={setSpend} step={1000} prefix="$" />
            <Field label="Current invested assets" value={current} onChange={setCurrent} step={1000} prefix="$" />
          </div>

          <div style={{ ...styles.groupLabel, marginTop: 28 }}>
            Guaranteed income (today's real dollars)
          </div>
          <div style={styles.grid}>
            <Field label="Social Security, monthly" value={ssAmt} onChange={setSsAmt} step={50} prefix="$" />
            <Field label="Social Security claiming age" value={ssAge} onChange={setSsAge} />
            <Field label="Other guaranteed income, monthly" value={vaAmt} onChange={setVaAmt} step={50} prefix="$" />
            <Field label="Other guaranteed income start age" value={vaAge} onChange={setVaAge} />
          </div>

          <div style={{ ...styles.groupLabel, marginTop: 28 }}>Legacy</div>
          <div style={styles.grid}>
            <Field
              label={`Amount to leave to beneficiary at age ${planAge}`}
              value={bequest}
              onChange={setBequest}
              step={10000}
              prefix="$"
            />
          </div>
        </section>

        <section style={styles.statsRow}>
          <StatCard label="Coast FIRE (no guaranteed income)" value={fmtUSD(results.coastBase)} />
          <StatCard label="Coast FIRE (with Social Security + other income)" value={fmtUSD(results.coastAdj)} accent="#2a6f4f" />
          <StatCard label="Reduction from guaranteed income" value={fmtUSD(results.saved)} accent="#2a5f9e" />
        </section>

        <section style={styles.verdict}>
          {results.isPastCoast ? (
            <p style={styles.verdictText}>
              <strong style={{ color: "#2a6f4f" }}>Past coast FIRE.</strong>{" "}
              You're {fmtUSD(current - results.coastAdj)} above the adjusted
              threshold — contributions are optional from here
              {bequest > 0 && <> and the ${(bequest / 1000).toFixed(0)}k legacy target is already priced in</>}.
            </p>
          ) : (
            <p style={styles.verdictText}>
              <strong>Not yet there.</strong> You need{" "}
              {fmtUSD(results.gapAdj)} more invested today to coast with Social Security + other income
              {bequest > 0 && <> and leave {fmtUSD(bequest)} to your beneficiary</>} factored in
              {results.gapBase > 0 && (
                <> ({fmtUSD(results.gapBase)} more if you ignore guaranteed income)</>
              )}
              .
            </p>
          )}
        </section>

        <section style={styles.ratioRow}>
          <StatCard
            label="Coast ratio"
            value={`${results.coastRatioPct.toFixed(0)}%`}
            accent={results.coastRatioPct >= 100 ? "#2a6f4f" : "#1a1a18"}
          />
          <StatCard
            label="Guaranteed income coverage"
            value={`${results.coveragePct.toFixed(0)}%`}
          />
          <StatCard
            label="Bridge years (self-funded)"
            value={results.bridgeYears}
          />
          <StatCard
            label={results.requiredCagrPct !== null ? "Required real CAGR" : "Cushion above coast"}
            value={
              results.requiredCagrPct !== null
                ? `${results.requiredCagrPct.toFixed(1)}%`
                : results.cushionPct !== null
                ? `+${results.cushionPct.toFixed(0)}%`
                : "—"
            }
            accent={results.requiredCagrPct === null ? "#2a6f4f" : undefined}
          />
        </section>

        <section style={styles.chartSection}>
          <div style={styles.chartTitle}>
            Portfolio balance from retirement to age {planAge}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={results.chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e3db" vertical={false} />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 12, fill: "#7a7970" }}
                axisLine={{ stroke: "#d8d6cc" }}
                tickLine={false}
                label={{ value: "Age", position: "insideBottom", offset: -4, fontSize: 12, fill: "#7a7970" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#7a7970" }}
                tickFormatter={fmtUSDk}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <ReferenceLine y={0} stroke="#c94f4f" strokeDasharray="2 2" />
              {bequest > 0 && (
                <ReferenceLine
                  y={bequest}
                  stroke="#b8935a"
                  strokeDasharray="2 2"
                  label={{ value: "Legacy target", position: "insideTopRight", fontSize: 11, fill: "#8a6f3f" }}
                />
              )}
              <Tooltip
                formatter={(value, name) => [
                  fmtUSD(value),
                  name === "withGuarantee" ? "With Social Security + other income" : "Without guaranteed income",
                ]}
                labelFormatter={(age) => `Age ${age}`}
                contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e3db" }}
              />
              <Line
                type="monotone"
                dataKey="withoutGuarantee"
                stroke="#a8a693"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="withGuarantee"
                stroke="#2a5f9e"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={styles.legendRow}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, background: "#2a5f9e" }} />
              With Social Security + other income
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, background: "#a8a693", borderTop: "2px dashed #a8a693" }} />
              Without guaranteed income
            </span>
          </div>
        </section>

        <footer style={styles.footnote}>
          Simulation assumes constant real spend and a constant real return
          (no sequence-of-returns variance). Social Security and other
          guaranteed income are treated as fixed real (already
          inflation-adjusted) monthly amounts starting at the ages given.
          Non-means-tested income (e.g., VA disability compensation,
          military retired pay, a pension) doesn't get reduced as assets
          grow; a means-tested benefit would phase out as your portfolio
          grows, so it isn't a fixed floor and shouldn't be modeled this way
          if that's your income source. The legacy amount is a real-dollar
          target left at the plan-to age, not a fixed nominal bequest — it
          isn't reduced for estate taxes, which depend on jurisdiction and
          the size of the estate at death. Not tax, benefits, or investment
          advice.
        </footer>
      </div>
    </div>
  );
}

// ---- Styles -------------------------------------------------------------

const styles = {
  page: {
    minHeight: "100%",
    background: "#faf9f5",
    color: "#1a1a18",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "32px 16px",
  },
  container: { maxWidth: 720, margin: "0 auto" },
  header: { marginBottom: 20 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  infoButton: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid #c9c7ba",
    background: "#ffffff",
    color: "#5d5c53",
    fontSize: 13,
    fontStyle: "italic",
    fontFamily: "Georgia, serif",
    lineHeight: 1,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(26,26,24,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 100,
  },
  modalBox: {
    background: "#ffffff",
    borderRadius: 14,
    maxWidth: 520,
    width: "100%",
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px",
    borderBottom: "1px solid #e5e3db",
    position: "sticky",
    top: 0,
    background: "#ffffff",
  },
  modalTitle: { fontSize: 17, fontWeight: 600, margin: 0 },
  modalClose: {
    border: "none",
    background: "transparent",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
    color: "#8a8877",
    padding: 4,
  },
  modalBody: {
    padding: "16px 20px 22px",
    fontSize: 13.5,
    lineHeight: 1.6,
    color: "#3a3930",
  },
  modalSubhead: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8a8877",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginTop: 18,
    marginBottom: 6,
  },
  formula: {
    fontFamily: "'SF Mono', Menlo, monospace",
    fontSize: 14,
    background: "#f2f0e6",
    border: "1px solid #e5e3db",
    borderRadius: 8,
    padding: "10px 12px",
    margin: "4px 0 10px",
  },
  modalList: { margin: "4px 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 },
  ratioRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8a8877",
    fontWeight: 600,
    marginBottom: 6,
  },
  h1: {
    fontSize: 28,
    fontWeight: 600,
    margin: "0 0 8px",
    letterSpacing: "-0.01em",
  },
  subhead: { fontSize: 14, color: "#5d5c53", margin: 0, lineHeight: 1.5, maxWidth: 520 },
  panel: {
    background: "#ffffff",
    border: "1px solid #e5e3db",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8a8877",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 13, color: "#4a4940" },
  inputWrap: { position: "relative" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    fontSize: 14,
    border: "1px solid #d8d6cc",
    borderRadius: 8,
    background: "#faf9f5",
    color: "#1a1a18",
    outline: "none",
  },
  affix: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 13,
    color: "#8a8877",
    pointerEvents: "none",
  },
  affixRight: { left: "auto", right: 10 },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e3db",
    borderRadius: 12,
    padding: "14px 16px",
  },
  statLabel: { fontSize: 12, color: "#8a8877", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 600 },
  verdict: {
    background: "#f2f0e6",
    border: "1px solid #e5e3db",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 20,
  },
  verdictText: { fontSize: 14, margin: 0, lineHeight: 1.5, color: "#3a3930" },
  chartSection: {
    background: "#ffffff",
    border: "1px solid #e5e3db",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  chartTitle: { fontSize: 13, fontWeight: 600, color: "#4a4940", marginBottom: 8 },
  legendRow: { display: "flex", gap: 20, marginTop: 8, paddingLeft: 4 },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#5d5c53",
  },
  legendSwatch: { width: 14, height: 2, borderRadius: 2, display: "inline-block" },
  footnote: { fontSize: 11.5, color: "#8a8877", lineHeight: 1.6, marginTop: 4 },
};
