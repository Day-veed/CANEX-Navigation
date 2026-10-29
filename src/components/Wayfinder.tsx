"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { findRoute, type StepKind } from "@/lib/routing";
import { CATEGORIES, FLOORS, floorById, footprintOf, getPlace, label, PLACES, type Category, type FloorId, type Place } from "@/lib/venue";
import type { ViewMode } from "./VenueScene";

const VenueScene = dynamic(() => import("./VenueScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[#5d6d67]">Loading 3D map…</div>,
});

const DEFAULT_FROM = "gate-d";
const destinations = PLACES.filter((p) => !p.hidden);

export default function Wayfinder({ initialFrom, initialTo }: { initialFrom?: string; initialTo?: string }) {
  const [fromId, setFromId] = useState(getPlace(initialFrom) && !getPlace(initialFrom)!.hidden ? initialFrom! : DEFAULT_FROM);
  const [toId, setToId] = useState<string | null>(getPlace(initialTo) ? initialTo! : null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [floor, setFloor] = useState<FloorId | null>(null);
  const [view, setView] = useState<ViewMode>("3d");
  const [showFloors, setShowFloors] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const route = useMemo(() => (toId ? findRoute(fromId, toId) : null), [fromId, toId]);
  const results = useMemo(() => search(query, category, floor), [query, category, floor]);
  const to = getPlace(toId);

  // Keep the URL shareable, e.g. a QR code at Gate A can link to ?from=gate-a
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("from", fromId);
    if (toId) params.set("to", toId);
    window.history.replaceState(null, "", `?${params}`);
  }, [fromId, toId]);

  const choose = (id: string) => {
    setToId(id);
    setPanelOpen(true);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Directions to ${to ? label(to) : "CANEX"}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#e9eeeb] text-[#1f2d29]">
      {/* Keep the map out from under the panel so it centres in the visible area. */}
      <div className={`absolute inset-x-0 top-0 transition-[bottom] duration-300 md:bottom-0 md:left-[422px] ${panelOpen ? "bottom-[45dvh]" : "bottom-[60px]"}`}>
        <VenueScene route={route} fromId={fromId} toId={toId} view={view} showFloors={showFloors} onSelect={choose} />
      </div>

      {/* Map controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2 md:right-4 md:top-4">
        <div className="flex overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5">
          {(["3d", "2d"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-2 text-sm font-semibold ${view === v ? "bg-[#1f2d29] text-white" : "text-[#3a4743] hover:bg-black/5"}`}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFloors((s) => !s)}
          className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-md ring-1 ring-black/5 ${showFloors ? "bg-[#1f2d29] text-white" : "bg-white text-[#3a4743] hover:bg-[#f3f5f4]"}`}
        >
          All floors
        </button>
        <Legend />
      </div>

      {/* Panel: bottom sheet on mobile, sidebar on desktop */}
      <aside
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-[max-height] duration-300 md:inset-y-4 md:left-4 md:right-auto md:w-[390px] md:max-h-none md:rounded-3xl md:shadow-xl ${
          panelOpen ? "max-h-[62dvh]" : "max-h-[76px]"
        }`}
      >
        <button onClick={() => setPanelOpen((o) => !o)} className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-black/15 md:hidden" aria-label={panelOpen ? "Collapse panel" : "Expand panel"} />
        <header className="shrink-0 px-5 pb-3 pt-3 md:pt-5">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-extrabold tracking-tight">CANEX</h1>
            <span className="text-sm font-semibold uppercase tracking-wide text-[#0f7b7b]">Find your way</span>
          </div>
          <p className="text-xs text-[#5d6d67]">Wole Soyinka Centre for Culture and Creative Arts</p>
        </header>

        <div className="shrink-0 space-y-2 px-5 pb-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#5d6d67]">You are at</span>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full rounded-xl border border-black/10 bg-[#f6f8f7] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#0f7b7b]">
              <PlaceOptions />
            </select>
          </label>

          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#5d6d67]">Going to</span>
            {to ? (
              <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-[#f6f8f7] px-3 py-2">
                <Swatch category={to.category} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{label(to)}</div>
                  <div className="truncate text-xs text-[#5d6d67]">{floorById(to.floor).name}{footprintOf(to).zone ? ` · ${footprintOf(to).zone}` : ""}</div>
                </div>
                <button
                  onClick={() => {
                    setToId(fromId);
                    setFromId(to.hidden ? DEFAULT_FROM : to.id);
                  }}
                  className="rounded-lg p-1.5 text-[#3a4743] hover:bg-black/5"
                  title="Swap start and destination"
                  aria-label="Swap start and destination"
                >
                  <Icon kind="swap" />
                </button>
                <button onClick={() => setToId(null)} className="rounded-lg p-1.5 text-[#3a4743] hover:bg-black/5" title="Clear destination" aria-label="Clear destination">
                  <Icon kind="close" />
                </button>
              </div>
            ) : (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setPanelOpen(true)}
                placeholder="Search booths, stages, food…  e.g. E21, coffee"
                className="w-full rounded-xl border border-black/10 bg-[#f6f8f7] px-3 py-2.5 text-sm outline-none placeholder:text-[#8a9893] focus:border-[#0f7b7b]"
              />
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/5 px-5 pb-5 pt-3">
          {route && to ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-extrabold">{route.minutes} min</div>
                  <div className="text-xs text-[#5d6d67]">{route.meters > 0 ? `~${route.meters} m walk · ` : ""}estimate, map not to scale</div>
                </div>
                <button onClick={share} className="rounded-xl bg-[#0f7b7b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0c6868]">
                  {copied ? "Link copied" : "Share"}
                </button>
              </div>
              <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-black/10">
                {route.steps.map((s, i) => (
                  <li key={i} className="relative flex gap-3">
                    <span className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${s.kind === "arrive" ? "bg-[#e8451e] text-white" : s.kind === "info" ? "bg-[#fff4d6] text-[#8a6100]" : "bg-[#eef2f0] text-[#1f2d29]"}`}>
                      <Icon kind={s.kind} />
                    </span>
                    <div className="pt-1">
                      <div className={`text-sm ${s.kind === "info" ? "text-[#6b5a2a]" : "font-medium"}`}>{s.text}</div>
                      {s.detail && <div className="mt-0.5 text-xs text-[#5d6d67]">{s.detail}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <section>
              <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
                <Chip active={floor === null} onClick={() => setFloor(null)}>All floors</Chip>
                {FLOORS.map((f) => (
                  <Chip key={f.id} active={floor === f.id} onClick={() => setFloor(floor === f.id ? null : f.id)}>
                    {f.name.replace(" floor", "")}
                  </Chip>
                ))}
              </div>
              <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {(["exhibition", "food", "room", "hub", "outdoor"] as const).map((c) => (
                  <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                    <Swatch category={c} /> {CATEGORIES[c].label}
                  </Chip>
                ))}
              </div>
              <p className="mb-2 text-xs text-[#5d6d67]">{results.length} places · tap the map or pick from the list</p>
              <ul className="divide-y divide-black/5">
                {results.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => choose(p.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-black/[0.02]">
                      <Swatch category={p.category} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {p.code && <span className="mr-1.5 font-bold text-[#0f7b7b]">{p.code}</span>}
                          {p.name}
                        </div>
                        <div className="truncate text-xs text-[#5d6d67]">{p.zone ?? floorById(p.floor).name}</div>
                      </div>
                      <span className="shrink-0 rounded-md bg-[#eef2f0] px-1.5 py-0.5 text-[11px] font-bold text-[#3a4743]">{floorById(p.floor).short}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <footer className="hidden shrink-0 border-t border-black/5 px-5 py-2 text-[10px] text-[#8a9893] md:block">Schematic, not to scale. Source: venue plan V24.1</footer>
      </aside>
    </div>
  );
}

function search(query: string, category: Category | null, floor: FloorId | null): Place[] {
  const q = normalize(query);
  const tokens = q.split(" ").filter(Boolean);
  const scored: [Place, number][] = [];
  for (const p of destinations) {
    if (category && p.category !== category) continue;
    if (floor && p.floor !== floor) continue;
    if (!tokens.length) {
      scored.push([p, 0]);
      continue;
    }
    const code = normalize(p.code ?? "");
    const name = normalize(p.name);
    const hay = `${code} ${name} ${normalize(p.zone ?? "")} ${normalize(CATEGORIES[p.category].label)} ${normalize(floorById(p.floor).name)}`;
    let score = 0;
    if (code && code === q) score = 100;
    else if (code.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (tokens.every((t) => hay.includes(t))) score = 40;
    if (score) scored.push([p, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

function normalize(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function PlaceOptions() {
  const gates = destinations.filter((p) => p.id.startsWith("gate-"));
  const groups = FLOORS.map((f) => ({ f, items: destinations.filter((p) => p.floor === f.id && !p.id.startsWith("gate-")) }));
  return (
    <>
      <optgroup label="Gates">
        {gates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </optgroup>
      {groups.map(({ f, items }) => (
        <optgroup key={f.id} label={f.name}>
          {items.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-[#1f2d29] text-white" : "bg-[#eef2f0] text-[#3a4743] hover:bg-[#e2e8e5]"
      }`}
    >
      {children}
    </button>
  );
}

function Swatch({ category }: { category: Category }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-[4px]" style={{ background: CATEGORIES[category].color }} />;
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white text-sm shadow-md ring-1 ring-black/5">
      <button onClick={() => setOpen((o) => !o)} className="px-3 py-2 font-semibold text-[#3a4743]">
        Legend
      </button>
      {open && (
        <ul className="space-y-1.5 px-3 pb-3 text-xs">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => (
            <li key={c} className="flex items-center gap-2">
              <Swatch category={c} /> {CATEGORIES[c].label}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="inline-block h-1 w-3 rounded bg-[#e8451e]" /> Your route
          </li>
        </ul>
      )}
    </div>
  );
}

function Icon({ kind }: { kind: StepKind | "swap" | "close" }) {
  const paths: Record<string, string> = {
    start: "M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "turn-left": "M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6v1",
    "turn-right": "m15 7 5 5-5 5m5-5H10a6 6 0 0 0-6 6v1",
    straight: "M12 20V4m-5 5 5-5 5 5",
    walk: "M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM9 22l2-7 3 3v4m-3-7 1-5 3 3h3M9 11l3-3",
    lift: "M7 3h10v18H7zM10 9l2-2 2 2m-4 6 2 2 2-2",
    exit: "M14 4h5v16h-5M10 8l-4 4 4 4m-4-4h10",
    arrive: "M5 21V4m0 0h11l-2 4 2 4H5",
    info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    swap: "M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3",
    close: "M6 6l12 12M18 6 6 18",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[kind]} />
    </svg>
  );
}
