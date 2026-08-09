import React from "react";
import { WifiOff, CloudUpload, Check, RefreshCw } from "lucide-react";
import { apiClient } from "@/App";
import { isOnline, getQueue, syncQueue, attachAutoSync } from "@/lib/offline";

export default function OfflineBanner() {
  const [online, setOnline] = React.useState(isOnline());
  const [queueCount, setQueueCount] = React.useState(getQueue().length);
  const [syncing, setSyncing] = React.useState(false);
  const [flash, setFlash] = React.useState(null); // {type, msg}

  const refresh = React.useCallback(() => {
    setOnline(isOnline());
    setQueueCount(getQueue().length);
  }, []);

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    // Listen for a custom event fired by anywhere in the app when queue changes
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

  const bg = !online ? "bg-[#FF5F15]" : queueCount > 0 ? "bg-[#F59E0B]" : "bg-[#CCFF00]";
  const fg = "text-[#09090B]";

  return (
    <div
      data-testid="offline-banner"
      className={`${bg} ${fg} px-4 py-2 flex items-center justify-between gap-3 text-sm font-semibold sticky top-0 z-40`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!online ? (
          <>
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span className="uppercase tracking-widest text-xs">Offline Mode</span>
            {queueCount > 0 && <span className="font-mono">· {queueCount} pending</span>}
          </>
        ) : queueCount > 0 ? (
          <>
            <CloudUpload className="w-4 h-4 flex-shrink-0" />
            <span className="uppercase tracking-widest text-xs">Back Online</span>
            <span className="font-mono">· {queueCount} pending sync</span>
          </>
        ) : flash ? (
          <>
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="uppercase tracking-widest text-xs">{flash.msg}</span>
          </>
        ) : null}
      </div>
      {online && queueCount > 0 && (
        <button
          data-testid="sync-btn"
          onClick={doSync}
          disabled={syncing}
          className="k-btn !py-1 !px-3 text-xs !bg-[#09090B] !text-[#FAFAFA] !border-[#09090B]"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      )}
    </div>
  );
}
