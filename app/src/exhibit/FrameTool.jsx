// Frame tool (?frames): lets the studio frame each desk item by hand. Select an item, move the camera until it
// looks right, press "Save this view". Saved views apply straight away in this browser (so you can check them)
// and "Copy all" puts them on the clipboard as text, ready to paste to the developer to build into the site
// (site.js -> PAGES.home.exhibit.framed). Off unless the page was opened with ?frames (remembered for the visit).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FRAMED_KEY } from "./Scene.jsx";

const load = () => { try { return JSON.parse(localStorage.getItem(FRAMED_KEY) || "{}"); } catch { return {}; } };

export default function FrameTool({ selectedId, labels, api }) {
  const [views, setViews] = useState(load);
  const [note, setNote] = useState("");
  useEffect(() => { setNote(""); }, [selectedId]);
  const save = () => {
    const v = api.current?.captureView?.();
    if (!v || !selectedId) return;
    const next = { ...load(), [selectedId]: v };
    try { localStorage.setItem(FRAMED_KEY, JSON.stringify(next)); } catch { /* blocked */ }
    setViews(next); setNote("Saved. Close the panel and pick it again to see it.");
  };
  const remove = (id) => { const next = { ...load() }; delete next[id]; try { localStorage.setItem(FRAMED_KEY, JSON.stringify(next)); } catch { /* */ } setViews(next); };
  const text = JSON.stringify(views, null, 1);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setNote("Copied - paste it in the chat."); }
    catch { setNote("Copy didn't work here: select the text below and copy it."); }
  };
  const ids = Object.keys(views);
  // shown in the page's left column (Home has a #frame-tool-slot under the desk's options), off the 3D view
  const [slot, setSlot] = useState(null);
  useEffect(() => { setSlot(document.getElementById("frame-tool-slot")); }, []);
  const body = (
    <div className="frame-tool" role="region" aria-label="Frame tool">
      <p className="frame-tool-h">Frame tool</p>
      <p className="frame-tool-help">Pick an item, move the camera until it looks right, then save. {selectedId ? "" : "No item selected."}</p>
      <button type="button" className="tool" disabled={!selectedId} onClick={save}>
        {selectedId ? `Save this view · ${labels[selectedId] || selectedId}` : "Save this view"}
      </button>
      {ids.length > 0 && (
        <>
          <ul className="frame-tool-list">
            {ids.map((id) => <li key={id}><span>{labels[id] || id}</span><button type="button" className="linkbtn" onClick={() => remove(id)} aria-label={`Remove ${labels[id] || id}`}>remove</button></li>)}
          </ul>
          <div className="frame-tool-row">
            <button type="button" className="tool" onClick={copy}>Copy all ({ids.length})</button>
          </div>
          <textarea readOnly value={text} rows={3} aria-label="Saved views as text" onFocus={(e) => e.target.select()} />
        </>
      )}
      {note && <p className="frame-tool-note" role="status">{note}</p>}
    </div>
  );
  return slot ? createPortal(body, slot) : body;
}
