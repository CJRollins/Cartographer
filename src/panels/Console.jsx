import React from 'react';
import { ATMOS, TEMPORAL_PHASES, FONT_MONO, BORDER } from '../constants.js';

const SHORTCUTS = [
  "WASD — move map cursor",
  "Arrow keys — rotate view",
  "Enter — select cursor location",
  "N — focus name input",
  "R — rename selected",
  "C — connect from selected",
  "1-4 — set atmosphere",
  "Tab — cycle nodes",
  "Delete — remove",
  "F — focus camera",
  "Ctrl+Z — undo",
  "Ctrl+Shift+Z — redo",
  "Ctrl+S — export",
  "Esc — cancel / deselect",
];

export function ShortcutsPanel() {
  return (
    <details style={{ padding: "6px 16px", borderBottom: BORDER }}>
      <summary style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a4e38", cursor: "pointer" }}>
        Shortcuts
      </summary>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", lineHeight: 2, marginTop: 4 }}>
        {SHORTCUTS.map(s => <div key={s}>{s}</div>)}
      </div>
    </details>
  );
}

export function Layer0AuditPanel({ nodes, edges }) {
  const orphans = nodes.filter(n => !edges.some(e => e.from === n.id || e.to === n.id));
  const maxDeg = nodes.reduce((m, n) => Math.max(m, edges.filter(e => e.from === n.id || e.to === n.id).length), 0);
  const hubs = nodes.filter(n => edges.filter(e => e.from === n.id || e.to === n.id).length >= Math.max(4, maxDeg));
  const atmosphereCounts = ATMOS.map(a => ({
    ...a,
    count: nodes.filter(n => n.atmosphere === a.id).length,
  }));
  const phaseCounts = TEMPORAL_PHASES.map(phase => ({
    phase,
    count: nodes.filter(n => n.temporal?.phase === phase).length,
  })).filter(p => p.count > 0);
  const unstable = nodes.filter(n => ["declining", "broken", "hidden"].includes(n.temporal?.phase));
  const warnings = [
    orphans.length ? `${orphans.length} orphan${orphans.length === 1 ? "" : "s"}` : null,
    hubs.length ? `${hubs.length} high-pressure hub${hubs.length === 1 ? "" : "s"}` : null,
    unstable.length ? `${unstable.length} unstable temporal state${unstable.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <details open style={{ padding: "8px 16px", borderBottom: BORDER }}>
      <summary style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a4e38", cursor: "pointer" }}>
        Layer 0 Audit
      </summary>
      <div style={{ marginTop: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 6 }}>
          {[
            ["nodes", nodes.length],
            ["edges", edges.length],
            ["hub", maxDeg],
          ].map(([label, value]) => (
            <div key={label} style={{ border: BORDER, padding: "4px 5px", borderRadius: 3 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38" }}>{label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#D4B66E" }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: warnings.length ? "#8c1f18" : "#5a6848", marginBottom: 6 }}>
          {warnings.length ? warnings.join(" · ") : "no structural warnings"}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", lineHeight: 1.8 }}>
          {atmosphereCounts.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", color: a.count ? a.color : "#3a3530" }}>
              <span>{a.label}</span><span>{a.count}</span>
            </div>
          ))}
        </div>
        {phaseCounts.length > 0 && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", lineHeight: 1.8, marginTop: 6 }}>
            {phaseCounts.map(p => (
              <div key={p.phase} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{p.phase}</span><span>{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export function ConsolePanel({ log }) {
  return (
    <div style={{ flex: 1, padding: "8px 16px", overflowY: "auto" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", letterSpacing: ".1em", marginBottom: 4 }}>
        CONSOLE
      </div>
      {log.map((l, i) => (
        <div key={i} style={{
          fontFamily: FONT_MONO, fontSize: 9, color: "#5a6848",
          opacity: 1 - i * 0.04, marginBottom: 2,
        }}>{l}</div>
      ))}
    </div>
  );
}
