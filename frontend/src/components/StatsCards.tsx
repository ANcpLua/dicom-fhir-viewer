import type { StatsResponse } from "../lib/types.js";

export interface StatsCardsProps {
  readonly stats: StatsResponse;
}

interface StatCard {
  readonly label: string;
  readonly value: number;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards: ReadonlyArray<StatCard> = [
    { label: "Patients", value: stats.totalPatients },
    { label: "Imaging Studies", value: stats.totalStudies },
    { label: "Instances", value: stats.totalInstances },
    { label: "Distinct Modalities", value: stats.modalityDistribution.length },
  ];

  const maxModalityCount = Math.max(1, ...stats.modalityDistribution.map((m) => m.count));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, idx) => (
          <StatTile key={card.label} card={card} delay={idx * 60} />
        ))}
      </div>

      <section className="surface p-5">
        <h3 className="section-label mb-4">
          Modality distribution
        </h3>
        {stats.modalityDistribution.length === 0 ? (
          <p className="text-ink-500 italic text-[13px]">No series yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {stats.modalityDistribution.map((entry) => (
              <li key={entry.modality} className="flex items-center gap-3">
                <span className="w-12 text-[11px] font-mono text-ink-300 tracking-wide font-medium">
                  {entry.modality}
                </span>
                <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${(entry.count / maxModalityCount) * 100}%`,
                      background:
                        "linear-gradient(90deg, #3b82f6 0%, #60a5fa 60%, #93c5fd 100%)",
                      boxShadow: "0 0 10px rgba(96,165,250,0.35)",
                    }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-[13px] text-ink-200 font-medium">
                  {entry.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface p-5">
        <h3 className="section-label mb-4">
          Studies over time
        </h3>
        {stats.studiesByDate.length === 0 ? (
          <p className="text-ink-500 italic text-[13px]">No studies yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {stats.studiesByDate.map((entry) => (
              <li
                key={entry.date}
                className="flex justify-between items-center py-2 text-[13px]"
              >
                <span className="tabular-nums font-mono text-ink-300">{entry.date}</span>
                <span className="tabular-nums text-ink-200 font-medium">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({ card, delay }: { readonly card: StatCard; readonly delay: number }) {
  return (
    <div
      className="surface p-4 relative overflow-hidden group transition-all duration-200 hover:border-accent-500/15 hover:shadow-[0_0_24px_-6px_rgba(96,165,250,0.12)] animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-accent-400/30 transition-all duration-200"
      />
      <p className="section-label">
        {card.label}
      </p>
      <p className="text-[30px] font-semibold tabular-nums mt-2.5 tracking-tight text-ink-50 leading-none">
        {card.value}
      </p>
    </div>
  );
}
