import React from 'react';
import { ATMOS, CONN_TYPES, FONT_MONO, BORDER, INPUT_STYLE } from '../constants.js';

export default function CreatePanel({
  selected, selectedNode, nodes,
  newName, setNewName, newAtmo, setNewAtmo, connType, setConnType,
  onCreate, onDeselect, nameInputRef,
}) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && newName.trim()) {
      onCreate(newName.trim(), newAtmo, selected);
    }
  };

  const label = selected
    ? `NEW FROM ${selectedNode?.name?.toUpperCase()}`
    : nodes.length ? "NEW STANDALONE" : "FIRST LOCATION";

  return (
    <div style={{ padding: "10px 16px", borderBottom: BORDER }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a4e38", marginBottom: 4 }}>{label}</div>

      <input ref={nameInputRef} value={newName} onChange={e => setNewName(e.target.value)}
        onKeyDown={handleKeyDown} placeholder="Location name... [N]" style={INPUT_STYLE} />

      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "6px 0" }}>
        {ATMOS.map(a => (
          <button key={a.id} onClick={() => setNewAtmo(a.id)} style={{
            padding: "2px 7px", fontSize: 9, fontFamily: FONT_MONO, cursor: "pointer", borderRadius: 2,
            background: newAtmo === a.id ? "rgba(181,152,80,0.15)" : "transparent",
            border: newAtmo === a.id ? `1px solid ${a.color}` : BORDER,
            color: a.color,
          }}>{a.label}</button>
        ))}
      </div>

      {selected && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", marginBottom: 3 }}>VIA</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {CONN_TYPES.map(ct => (
              <button key={ct} onClick={() => setConnType(ct)} style={{
                padding: "2px 5px", fontSize: 8, fontFamily: FONT_MONO, cursor: "pointer", borderRadius: 2,
                background: connType === ct ? "rgba(181,152,80,0.12)" : "transparent",
                border: connType === ct ? BORDER : "1px solid transparent",
                color: connType === ct ? "#D4B66E" : "#5a4e38",
              }}>{ct}</button>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => { if (newName.trim()) onCreate(newName.trim(), newAtmo, selected); }}
        disabled={!newName.trim()} style={{
          padding: "5px 12px", background: "rgba(212,166,110,0.12)", border: BORDER,
          color: newName.trim() ? "#D4B66E" : "#3a3530", fontFamily: FONT_MONO, fontSize: 10,
          cursor: newName.trim() ? "pointer" : "default", borderRadius: 3, opacity: newName.trim() ? 1 : 0.5,
        }}>
        {selected ? "Create & connect" : "Create"}
      </button>

      {selected && (
        <button onClick={onDeselect} style={{
          marginLeft: 8, padding: "4px 10px", background: "rgba(181,152,80,0.06)",
          border: BORDER, color: "#b59850", fontFamily: FONT_MONO, fontSize: 9,
          cursor: "pointer", borderRadius: 3,
        }}>Deselect</button>
      )}
    </div>
  );
}
