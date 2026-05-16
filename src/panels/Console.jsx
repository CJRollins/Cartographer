import React from 'react';
import { ATMOS, TEMPORAL_PHASES, FONT_MONO, BORDER } from '../constants.js';
import { boundaryVertices, spatialDistance } from '../topology.js';

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
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const placedNodes = nodes.filter(n => Number.isFinite(n.x) && Number.isFinite(n.z));
  const verticalNodes = nodes.filter(n => Number.isFinite(n.y) && Math.abs(n.y) > 0.01);
  const authoredTravelEdges = edges.filter(edge => Number(edge.travelLength) > 0);
  const boundedNodes = nodes.filter(n => n.boundary?.shape && n.boundary.shape !== "none");
  const walledNodes = boundedNodes.filter(n => n.boundary?.walled);
  const gateCount = boundedNodes.reduce((sum, n) => sum + (Number(n.boundary?.gates) || 0), 0);
  const zoneEdgeCount = boundedNodes.reduce((sum, n) => sum + boundaryVertices(n).length, 0);
  const measuredEdges = edges.map(edge => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return null;
    return Number(edge.travelLength) > 0 ? Number(edge.travelLength) : spatialDistance(from, to);
  }).filter(Boolean);
  const avgTravel = measuredEdges.length
    ? measuredEdges.reduce((sum, length) => sum + length, 0) / measuredEdges.length
    : 0;
  const longestTravel = measuredEdges.length ? Math.max(...measuredEdges) : 0;
  const cardinalSpread = nodes.length > 1
    ? {
      eastWest: Math.max(...nodes.map(n => n.x)) - Math.min(...nodes.map(n => n.x)),
      northSouth: Math.max(...nodes.map(n => n.z)) - Math.min(...nodes.map(n => n.z)),
    }
    : { eastWest: 0, northSouth: 0 };
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
  const layer1Missing = [
    placedNodes.length < nodes.length ? `${nodes.length - placedNodes.length} unplaced node${nodes.length - placedNodes.length === 1 ? "" : "s"}` : null,
    verticalNodes.length === 0 ? "height/depth not authored" : null,
    edges.length && authoredTravelEdges.length < edges.length ? `${edges.length - authoredTravelEdges.length} derived travel length${edges.length - authoredTravelEdges.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const layer2Missing = [
    boundedNodes.length < nodes.length ? `${nodes.length - boundedNodes.length} unbounded location${nodes.length - boundedNodes.length === 1 ? "" : "s"}` : null,
    boundedNodes.length && !zoneEdgeCount ? "zone edges unavailable" : null,
    walledNodes.length && !gateCount ? "walled zones have no gates" : null,
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
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: BORDER }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", letterSpacing: ".08em", marginBottom: 5 }}>
            LAYER 1 · SPATIAL PLACEMENT
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 6 }}>
            {[
              ["placed", `${placedNodes.length}/${nodes.length}`],
              ["height", verticalNodes.length],
              ["authored", `${authoredTravelEdges.length}/${edges.length}`],
            ].map(([label, value]) => (
              <div key={label} style={{ border: BORDER, padding: "4px 5px", borderRadius: 3 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38" }}>{label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#D4B66E" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", lineHeight: 1.8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>east/west spread</span><span>{cardinalSpread.eastWest.toFixed(1)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>north/south spread</span><span>{cardinalSpread.northSouth.toFixed(1)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>avg travel</span><span>{avgTravel.toFixed(1)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>longest travel</span><span>{longestTravel.toFixed(1)}</span>
            </div>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: layer1Missing.length ? "#8c1f18" : "#5a6848", marginTop: 6 }}>
            {layer1Missing.length ? layer1Missing.join(" · ") : "Layer 1 spatial requirements satisfied"}
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: BORDER }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", letterSpacing: ".08em", marginBottom: 5 }}>
            LAYER 2 · BOUNDARIES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 6 }}>
            {[
              ["shapes", `${boundedNodes.length}/${nodes.length}`],
              ["edges", zoneEdgeCount],
              ["walls", walledNodes.length],
              ["gates", gateCount],
            ].map(([label, value]) => (
              <div key={label} style={{ border: BORDER, padding: "4px 5px", borderRadius: 3 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38" }}>{label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#D4B66E" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: layer2Missing.length ? "#8c1f18" : "#5a6848", marginTop: 6 }}>
            {layer2Missing.length ? layer2Missing.join(" · ") : "Layer 2 boundary requirements satisfied"}
          </div>
        </div>
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
