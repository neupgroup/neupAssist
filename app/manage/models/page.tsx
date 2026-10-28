"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../../ui-icon";

type ModelEntry = {
  id: number;
  provider: { id: number; name: string; code: string };
  model_name: string;
  cost_input: string;
  cost_output: string;
  status: string;
  order_index: number;
  added_on: string;
};

export default function ManageModelsPage() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState("");

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/manage/models", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load models.");
      setModels(result);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load models.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadModels(); }, [loadModels]);

  async function reorderModels(fromId: number, toId: number) {
    if (fromId === toId || savingOrder) return;
    const previous = models;
    const reordered = [...models];
    const from = reordered.findIndex((model) => model.id === fromId);
    const to = reordered.findIndex((model) => model.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setModels(reordered);
    setSavingOrder(true);
    setMessage("");
    try {
      const response = await fetch("/api/manage/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((model) => model.id) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save model order.");
      setMessage("Model priority saved.");
    } catch (error) {
      setModels(previous);
      setMessage(error instanceof Error ? error.message : "Could not save model order.");
    } finally {
      setSavingOrder(false);
      setDragging(null);
    }
  }

  async function deleteModel(id: number) {
    setMessage("");
    try {
      const response = await fetch(`/api/manage/models?id=${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete model.");
      setModels((current) => current.filter((entry) => entry.id !== id));
      setMessage("Model removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete model.");
    }
  }

  return (
    <section className="keys-page">
      <header className="topbar"><div className="breadcrumb"><span>Manage</span><span className="crumb-slash">/</span><strong>Models</strong></div><span className="settings-save-status"><Icon name="code" size={14} /> Model catalog</span></header>
      <div className="keys-content">
        <div className="page-intro"><div className="page-icon"><Icon name="code" size={19} /></div><p className="page-eyebrow">AI MODEL CATALOG</p><h1>Manage models</h1><p className="page-description">Drag models to set request priority. Models at the top are selected first when their provider key is available.</p></div>
        <section className="api-card saved-keys-card" aria-labelledby="saved-models-title">
          <div className="card-title-row"><div><span className="card-eyebrow">AVAILABLE MODELS</span><h2 id="saved-models-title">Model priority</h2></div><div className="model-list-actions"><span className="key-count">{models.length}</span><Link href="/manage/models/add" className="model-add-link"><Icon name="plus" size={15} /> Add model</Link></div></div>
          <p className="saved-keys-description">Cost values are shown per 1M tokens. {savingOrder ? "Saving order…" : "Drag a row to change priority."}</p>
          {message && <p className={`keys-message${message.includes("saved") || message.includes("removed") ? " success" : ""}`} role="status">{message}</p>}
          {loading ? <div className="keys-empty"><span className="key-placeholder-dot" />Loading models…</div> : models.length ? <div className="saved-key-list">{models.map((entry, index) => <article className={`saved-key-row model-order-row${dragging === entry.id ? " is-dragging" : ""}`} key={entry.id} draggable={!savingOrder} onDragStart={(event) => { setDragging(entry.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(entry.id)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = Number(event.dataTransfer.getData("text/plain")); if (draggedId) void reorderModels(draggedId, entry.id); }} onDragEnd={() => setDragging(null)}>
            <span className="model-order-index">{index + 1}</span><span className="model-drag-handle" aria-label="Drag to reorder">⠿</span><span className="saved-key-icon"><Icon name="code" size={16} /></span><div className="saved-key-details"><strong>{entry.model_name}<span> · {entry.provider.name}</span></strong><code>Input {entry.cost_input} · Output {entry.cost_output} / 1M tokens</code><small>Added {new Date(entry.added_on).toLocaleDateString()}</small></div><span className={`model-state${entry.status.toLowerCase() === "active" ? " active" : ""}`}>{entry.status}</span><Button type="button" variant="plain" size="icon" aria-label={`Remove ${entry.model_name}`} className="remove-key-button" onClick={() => void deleteModel(entry.id)}><span aria-hidden="true">×</span></Button>
          </article>)}</div> : <div className="keys-empty"><span className="key-placeholder-dot" />No models in the catalog yet.</div>}
        </section>
      </div>
    </section>
  );
}
