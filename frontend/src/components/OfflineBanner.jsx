import React from "react";
import { WifiOff, CloudUpload, Check, RefreshCw } from "lucide-react";
import { apiClient } from "@/App";
import { isOnline, getQueue, syncQueue, attachAutoSync } from "@/lib/offline";

export default function OfflineBanner() {
  const [online, setOnline] = React.useState(isOnline());
  const [queueCount, setQueueCount] = React.useState(getQueue().length);
  const [syncing, setSyncing] = React.useState(false);
  const [flash, setFlash] = React.useState(null);

  const refresh = React.useCallback(() => {
    setOnline(isOnline());
    setQueueCount(getQueue().length);
  }, []);

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("plumbline:queue-updated", refresh);
    const t = setInterval(refresh, 4000);
    attachAutoSync(apiClient, (res) => {
      refresh();
      if (res.succeeded > 0) {
        setFlash({ type: "ok", msg: `Synced ${res.succeeded} entr${res.succeeded === 1 ? "y" : "ies"}` });
        setTimeout(() => setFlash(null), 4000);
      }
    });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("plumbline:queue-updated", refresh);
      clearInterval(t);
    };
  }, [refresh]);

  const doSync = async () => {
    if (!online) return;
    setSyncing(true);
    const res = await syncQueue(apiClient);
    refresh();
    setSyncing(false);
    setFlash({
      type: res.failed > 0 ? "warn" : "ok",
      msg: res.failed > 0 ? `Synced ${res.succeeded}, ${res.failed} failed` : `Synced ${res.succeeded} entries`,
    });
    setTimeout(() => setFlash(null), 4000);
  };

  if (online && queueCount === 0 && !flash) return null;

  const tone = !online
    ? "bg-red-50 text-red-700 border-red-200"
    : queueCount > 0
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <div
      data-testid="offline-banner"
      className={`${tone} border-b px-4 md:px-6 py-2 flex items-center justify-between gap-3 text-sm font-semibold`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!online ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline Mode</span>
            {queueCount > 0 && <span className="font-mono font-normal">· {queueCount} pending</span>}
          </>
        ) : queueCount > 0 ? (
          <>
            <CloudUpload className="w-4 h-4 shrink-0" />
            <span>Back Online</span>
            <span className="font-mono font-normal">· {queueCount} pending sync</span>
          </>
        ) : flash ? (
          <>
            <Check className="w-4 h-4 shrink-0" />
            <span>{flash.msg}</span>
          </>
        ) : null}
      </div>
      {online && queueCount > 0 && (
        <button data-testid="sync-btn" onClick={doSync} disabled={syncing} className="k-btn k-btn-primary !py-1.5 !px-3 text-xs">
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      )}
    </div>
  );
}
