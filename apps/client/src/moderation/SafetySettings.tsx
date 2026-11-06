import type { BlockInfo } from "@fq/server/client";
import { useEffect, useState } from "react";
import { useModeration } from "./context.js";
import { say } from "./text.js";

/** The Settings section: blocked players, the data download and account deletion. */
export function SafetySettings() {
  const mod = useModeration();
  const [blocks, setBlocks] = useState<BlockInfo[] | "loading" | "failed">("loading");
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const api = mod?.api;
  useEffect(() => {
    if (!api) return;
    let alive = true;
    api.blocks().then(
      (list) => alive && setBlocks(list),
      () => alive && setBlocks("failed"),
    );
    return () => {
      alive = false;
    };
  }, [api]);
  if (!mod || !api) return null;

  const unblock = async (b: BlockInfo) => {
    try {
      await api.unblock(b.id);
      setBlocks((list) => (Array.isArray(list) ? list.filter((x) => x.id !== b.id) : list));
    } catch {
      setBlocks("failed");
    }
  };

  const download = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "funeral-quest-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section aria-labelledby="fq-mod-blocked">
      <h3 className="fq-set-heading" id="fq-mod-blocked">
        {say("settings.blocked")}
      </h3>
      {blocks === "loading" && <p className="fq-set-note">{say("settings.blocked.loading")}</p>}
      {blocks === "failed" && (
        <p className="fq-set-note" role="alert">
          {say("settings.blocked.failed")}
        </p>
      )}
      {Array.isArray(blocks) && blocks.length === 0 && (
        <p className="fq-set-note">{say("settings.blocked.none")}</p>
      )}
      {Array.isArray(blocks) && blocks.length > 0 && (
        <ul className="fq-mod-blocks">
          {blocks.map((b) => (
            <li key={b.id}>
              <span>
                {b.name}
                {b.parlor && <span className="fq-mod-parlor"> {b.parlor}</span>}
              </span>
              <button
                type="button"
                className="fq-dbtn"
                aria-label={say("settings.unblockNamed", { name: b.name })}
                onClick={() => void unblock(b)}
              >
                {say("settings.unblock")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="fq-set-note">{say("settings.blocked.explain")}</p>
      <h3 className="fq-set-heading">{say("settings.data")}</h3>
      <p className="fq-mod-row">
        <button
          type="button"
          className="fq-dbtn"
          aria-disabled={exporting || undefined}
          onClick={() => void download()}
        >
          {exporting ? say("settings.exporting") : say("settings.export")}
        </button>
        <button type="button" className="fq-dbtn fq-mod-danger" onClick={() => mod.openDelete()}>
          {say("settings.delete")}
        </button>
      </p>
      {exportFailed && (
        <p className="fq-mod-error" role="alert">
          {say("settings.exportFailed")}
        </p>
      )}
    </section>
  );
}
