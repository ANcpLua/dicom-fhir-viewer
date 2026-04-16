import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/studies", label: "Study Browser", end: false },
  { to: "/fhir", label: "FHIR Explorer", end: false },
] as const;

export function AppShell() {
  return (
    <div className="min-h-screen grid grid-cols-[15rem_1fr]">
      <aside className="surface m-3 mr-0 rounded-xl flex flex-col p-5 sticky top-3 h-[calc(100vh-1.5rem)]">
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <h1 className="text-[14px] font-semibold tracking-tight text-ink-50">
              DICOM / FHIR
            </h1>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "group relative flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[13px] font-medium",
                  "transition-all duration-150 ease-out",
                  isActive
                    ? "bg-white/[0.06] text-ink-50"
                    : "text-ink-400 hover:text-ink-200 hover:bg-white/[0.025]",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={[
                      "absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[2px] rounded-full",
                      "bg-accent-400 transition-all duration-200",
                      isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
                    ].join(" ")}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto" />
      </aside>

      <main className="p-6 lg:p-8 overflow-auto">
        <div className="mx-auto max-w-[72rem]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function LogoMark() {
  return (
    <div
      aria-hidden="true"
      className="relative h-8 w-8 shrink-0 rounded-[10px] overflow-hidden"
      style={{
        background:
          "conic-gradient(from 220deg at 50% 50%, #60a5fa, #8b5cf6, #22d3ee, #60a5fa)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.25), 0 3px 10px -3px rgba(59,130,246,0.45)",
      }}
    >
      <div className="absolute inset-[2.5px] rounded-[8px] bg-ink-900 flex items-center justify-center">
        <span className="text-[11px] font-bold tracking-tight text-ink-100">D/F</span>
      </div>
    </div>
  );
}
