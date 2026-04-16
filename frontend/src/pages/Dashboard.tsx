import { StatsCards } from "../components/StatsCards.js";
import { useStats } from "../hooks/useStats.js";

export function Dashboard() {
  const { stats, loading, error, refetch } = useStats();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="section-label mb-1.5">
            Overview
          </p>
          <h2 className="text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
            Dashboard
          </h2>
          <p className="text-[13px] text-ink-400 mt-1">
            Silver-layer FHIR store — live snapshot of patients, studies and modalities.
          </p>
        </div>
        <button type="button" onClick={refetch} className="btn-ghost">
          Refresh
        </button>
      </header>

      {loading && <p className="text-ink-400 italic text-sm">Loading stats…</p>}
      {error && (
        <p role="alert" className="text-red-400 text-sm">
          Error: {error}
        </p>
      )}
      {!loading && !error && stats !== null && <StatsCards stats={stats} />}
    </div>
  );
}
