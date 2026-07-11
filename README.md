# Coast FIRE Calculator

An interactive React component for calculating your **Coast FIRE number** — the portfolio value at which compound growth alone, with no further contributions, gets you to a full retirement number by your target retirement age.

Unlike a basic `spend ÷ 4%` calculator, this model:

- Solves with a **year-by-year simulation** (bisection search) instead of a single closed-form formula, so it can handle income that starts partway through retirement
- Nets **Social Security and other guaranteed income** (VA disability, military retired pay, a pension, etc.) against annual spend, capturing the "bridge" years before that income starts
- Solves for a **legacy/beneficiary target** — the balance left over at your plan-to age — instead of only solving for "spend it to zero"
- Surfaces four ratio-based metrics (coast ratio, guaranteed income coverage, bridge years, required growth rate) alongside the dollar figures

## Preview

The calculator renders as a self-contained card: input panel → key metrics → verdict → balance-over-time chart, with an info modal explaining the underlying math.

## Why simulation instead of a formula

The textbook Coast FIRE formula is:

```
Coast number = Target number ÷ (1 + r)ⁿ
```

That works when withdrawal need is constant for the entire retirement. It breaks down once guaranteed income enters the picture, because withdrawal need *steps down* the moment Social Security (or other income) starts. This component instead:

1. Picks a candidate starting balance at retirement
2. Simulates it forward year-by-year, growing at the real return rate and subtracting `max(spend − guaranteed income, 0)` each year
3. Uses bisection search to find the smallest starting balance whose ending balance (at your plan-to age) is at least your legacy target
4. Discounts that required balance back to today at the same real return rate to get your Coast FIRE number

This also produces the two scenario paths shown on the chart: with vs. without guaranteed income.

## Features

- **Retirement basics** — current age, retirement age, plan-to age (life expectancy), expected real return, annual spend, current invested assets
- **Guaranteed income** — Social Security (monthly amount + claiming age) and Other guaranteed income (monthly amount + start age), each independently timed
- **Legacy target** — an amount to leave to a beneficiary at your plan-to age, priced into the required balance
- **Key metrics row**
  - **Coast ratio** — current assets ÷ required coast number
  - **Guaranteed income coverage** — % of annual spend that guaranteed income replaces once fully phased in
  - **Bridge years** — years of full self-funding needed before all guaranteed income has started
  - **Required real CAGR** (or **Cushion**, if already past coast) — the annual growth rate needed on current assets alone to reach the coast number by retirement
- **Chart** — projected balance from retirement to plan-to age, with and without guaranteed income, plus a reference line for the legacy target
- **Info modal** — explains the Coast FIRE concept, the formula, and what assumptions the model makes
- Inputs avoid the common controlled-`<input type="number">` leading-zero bug (fields render empty rather than `0`, and select-on-focus for fast overwriting)

## Installation

This is a single self-contained component (`CoastFireCalculator.jsx`). Drop it into any React project.

**Dependencies:**

```bash
npm install react recharts
```

**Usage:**

```jsx
import CoastFireCalculator from "./CoastFireCalculator";

function App() {
  return <CoastFireCalculator />;
}

export default App;
```

The component has no required props and manages its own state internally.

## Assumptions & limitations

This is a planning aid, not financial advice. Known simplifications:

- Constant real spending and a constant real rate of return — **no sequence-of-returns risk** is modeled (a single bad early year isn't captured; consider running the numbers at a few different return assumptions instead of trusting one point estimate)
- Guaranteed income amounts should be entered as **real, today's-dollar figures** (assumes any cost-of-living adjustments are already netted out)
- **Non-means-tested** income (Social Security, VA disability compensation, military retired pay, most pensions) is treated as a fixed floor. **Means-tested** benefits (e.g., a needs-based VA pension) would phase out as assets grow and shouldn't be modeled with this tool as-is
- No modeling of taxes — ordinary income tax on withdrawals, the taxability of Social Security benefits, or the Medicare eligibility gap before 65
- No modeling of estate tax on the legacy/beneficiary amount, which depends on jurisdiction and estate size at death
- Assumes contributions stop entirely at "today" for the coast calculation, by definition — if you're still contributing, your actual required growth rate is lower than the "Required real CAGR" metric shown

## Tech stack

- React (hooks: `useState`, `useMemo`)
- [Recharts](https://recharts.org/) for the balance chart
- Inline styles, no CSS framework dependency

## License

MIT — use, modify, and redistribute freely.
