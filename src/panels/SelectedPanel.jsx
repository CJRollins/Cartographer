import React, { useRef } from 'react';
import {
  ATMOS,
  CONN_TYPES,
  TEMPORAL_CADENCES,
  TEMPORAL_ERAS,
  TEMPORAL_PHASES,
  DEFAULT_TEMPORAL,
  FONT_SERIF,
  FONT_MONO,
  BORDER,
  INPUT_STYLE,
} from '../constants.js';
import { directionBetween, spatialDistance } from '../topology.js';

export default function SelectedPanel({
  node, edges, nodes, selected,
  renaming, setRenaming, renameBuf, setRenameBuf, onRename,
  onUpdateAtmo, onUpdateNotes, onUpdateTemporal, onUpdateSpatial, onEditConnType, onRemoveConnection,
  onUpdateConnectionTravel,
  onSelectNode, onStartConnect, onConfirmDelete, sceneRef,
}) {
  const renameRef = useRef(null);
  if (!node) return null;

  const isOrphan = !edges.length;
  const temporal = { ...DEFAULT_TEMPORAL, ...(node.temporal || {}) };
  const elevation = Number.isFinite(node.y) ? node.y : 0;

  const btn = (label, action, opts = {}) => (
    <button onClick={action} disabled={opts.disabled} style={{
      padding: "4px 10px",
      background: opts.danger ? "rgba(140,31,24,0.1)" : "rgba(181,152,80,0.06)",
      border: opts.danger ? "1px solid rgba(140,31,24,0.15)" : BORDER,
      color: opts.disabled ? "#3a3530" : opts.danger ? "#8c1f18" : "#b59850",
      fontFamily: FONT_MONO, fontSize: 10, cursor: opts.disabled ? "default" : "pointer", borderRadius: 3,
    }}>{label}</button>
  );
  const temporalField = (label, value, options, key) => (
    <label style={{ display: "block", flex: 1, minWidth: 78 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", marginBottom: 3 }}>{label}</div>
      <select value={value} onChange={e => onUpdateTemporal(selected, { [key]: e.target.value })}
        style={{ ...INPUT_STYLE, fontSize: 9, padding: "3px 5px", textTransform: "uppercase" }}>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );

  return (
    <div style={{ padding: "10px 16px", borderBottom: BORDER }}>
      {/* Name */}
      {renaming ? (
        <input ref={renameRef} value={renameBuf} onChange={e => setRenameBuf(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onRename(selected, renameBuf); if (e.key === "Escape") setRenaming(false); }}
          onBlur={() => { if (renameBuf.trim()) onRename(selected, renameBuf); }}
          autoFocus style={INPUT_STYLE} />
      ) : (
        <div onDoubleClick={() => { setRenaming(true); setRenameBuf(node.name); }}
          style={{ fontFamily: FONT_SERIF, fontSize: 15, color: "#D4B66E", cursor: "text", marginBottom: 4 }}>
          {node.name} <span style={{ fontSize: 9, color: "#5a4e38", fontFamily: FONT_MONO }}>dbl-click to rename</span>
        </div>
      )}

      {/* Atmosphere */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "6px 0" }}>
        {ATMOS.map(a => (
          <button key={a.id} onClick={() => onUpdateAtmo(selected, a.id)} title={`${a.desc} [${a.key}]`}
            style={{
              padding: "2px 7px", fontSize: 9, fontFamily: FONT_MONO, cursor: "pointer", borderRadius: 2,
              background: node.atmosphere === a.id ? "rgba(181,152,80,0.15)" : "transparent",
              border: node.atmosphere === a.id ? `1px solid ${a.color}` : BORDER,
              color: a.color,
            }}>{a.label}</button>
        ))}
      </div>

      {/* Notes */}
      <textarea value={node.notes || ""} onChange={e => onUpdateNotes(selected, e.target.value)}
        placeholder="Notes..." rows={2}
        style={{ ...INPUT_STYLE, fontSize: 10, resize: "vertical", minHeight: 36 }} />

      {/* Temporal state */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", marginBottom: 4 }}>
          TEMPORAL STATE
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {temporalField("ERA", temporal.era, TEMPORAL_ERAS, "era")}
          {temporalField("PHASE", temporal.phase, TEMPORAL_PHASES, "phase")}
          {temporalField("CADENCE", temporal.cadence, TEMPORAL_CADENCES, "cadence")}
        </div>
      </div>

      {/* Spatial placement */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", marginBottom: 4 }}>
          LAYER 1 · SPATIAL PLACEMENT
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
          {[
            ["X", node.x || 0, "x"],
            ["Y", elevation, "y"],
            ["Z", node.z || 0, "z"],
          ].map(([label, value, key]) => (
            <label key={key}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", marginBottom: 3 }}>{label}</div>
              <input type="number" step="0.5" value={Number(value).toFixed(1)}
                onChange={e => onUpdateSpatial(selected, { [key]: Number(e.target.value) })}
                style={{ ...INPUT_STYLE, fontSize: 9, padding: "3px 5px" }} />
            </label>
          ))}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: elevation > 0 ? "#5DCAA5" : elevation < 0 ? "#F0997B" : "#5a4e38", marginTop: 4 }}>
          {elevation > 0 ? `height +${elevation.toFixed(1)}` : elevation < 0 ? `depth ${elevation.toFixed(1)}` : "surface level"}
        </div>
      </div>

      {/* Connections */}
      {edges.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", marginBottom: 4 }}>
            CONNECTIONS ({edges.length})
          </div>
          {edges.map((e, i) => {
            const oid = e.from === selected ? e.to : e.from;
            const other = nodes.find(n => n.id === oid);
            const direction = directionBetween(node, other);
            const derivedLength = spatialDistance(node, other);
            const travelLength = Number(e.travelLength) > 0 ? Number(e.travelLength) : derivedLength;
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 72px 48px 14px", gap: 4, alignItems: "center", marginBottom: 5 }}>
                <span onClick={() => { onSelectNode(oid); sceneRef.current.focusId = oid; }}
                  style={{ cursor: "pointer", fontFamily: FONT_MONO, fontSize: 10, color: "#b59850", flex: 1 }}>
                  → {other?.name}
                  <span style={{ display: "block", fontSize: 8, color: "#5a4e38" }}>{direction} · {derivedLength.toFixed(1)}u</span>
                </span>
                <select value={e.type} onChange={ev => onEditConnType(e.from, e.to, ev.target.value)}
                  style={{ background: "#0a0806", border: BORDER, color: "#b59850", fontFamily: FONT_MONO, fontSize: 8, padding: "1px 3px" }}>
                  {CONN_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
                <input type="number" min="0" step="0.5" title="Authored travel length"
                  value={travelLength.toFixed(1)}
                  onChange={ev => onUpdateConnectionTravel(e.from, e.to, ev.target.value)}
                  style={{ width: 48, background: "#0a0806", border: BORDER, color: "#D4B66E", fontFamily: FONT_MONO, fontSize: 8, padding: "2px 3px", boxSizing: "border-box" }} />
                <span onClick={() => onRemoveConnection(e.from, e.to)}
                  style={{ cursor: "pointer", color: "#8c1f18", fontSize: 11, padding: "0 2px" }} title="Remove connection">✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Orphan warning */}
      {isOrphan && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#8c1f18", marginTop: 6, opacity: 0.8 }}>
          ⚠ Orphan — no connections
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
        {btn("Connect to...", onStartConnect)}
        {btn("Remove", () => onConfirmDelete(selected), { danger: true })}
      </div>
    </div>
  );
}
