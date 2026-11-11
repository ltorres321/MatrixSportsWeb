"use client";

import { useState } from "react";

export default function TikTokAdminPanel() {
  const [publishId, setPublishId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendTestPost() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/tiktok/test-post", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setPublishId(json.publishId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (!publishId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tiktok/status?publishId=${encodeURIComponent(publishId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setStatus(`${json.status}${json.fail_reason ? ` (${json.fail_reason})` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-4">
      <a href="/api/tiktok/connect" className="btn btn-primary">
        Connect TikTok
      </a>

      <button type="button" className="btn btn-ghost" onClick={sendTestPost} disabled={busy}>
        Send test post
      </button>

      {publishId && (
        <div className="text-sm text-[var(--text-dim)]">
          publish_id: {publishId}{" "}
          <button type="button" className="underline" onClick={checkStatus} disabled={busy}>
            check status
          </button>
        </div>
      )}
      {status && <div className="text-sm text-[var(--text)]">Status: {status}</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}
    </div>
  );
}
