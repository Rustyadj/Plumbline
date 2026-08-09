/**
 * PLUMBLINE Offline Mode
 * - Caches tasks + validation steps in localStorage (per job/task)
 * - Queues TaskEntry POSTs when offline, replays them when back online
 * - Handles localStorage quota (drops photos as last resort to preserve the entry)
 */

const K = {
  tasks: (jobId) => `plumbline:cache:tasks:${jobId}`,
  steps: (taskId) => `plumbline:cache:steps:${taskId}`,
  queue: "plumbline:queue:entries",
};

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // Quota exceeded — try to trim photos out of queued entries and retry once
    console.warn("localStorage quota — trimming photos from queue");
    try {
      const raw = localStorage.getItem(K.queue);
      if (raw) {
        const q = JSON.parse(raw);
        for (const it of q) {
          for (const v of it.payload.validations || []) v.photo_b64 = null;
        }
        localStorage.setItem(K.queue, JSON.stringify(q));
      }
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ── Public helpers ──────────────────────────────────────────────
export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function cacheTasks(jobId, tasks) {
  safeSet(K.tasks(jobId), { at: Date.now(), tasks });
}
export function getCachedTasks(jobId) {
  return safeGet(K.tasks(jobId), null);
}

export function cacheSteps(taskId, steps) {
  safeSet(K.steps(taskId), { at: Date.now(), steps });
}
export function getCachedSteps(taskId) {
  return safeGet(K.steps(taskId), null);
}

export function enqueueEntry(taskId, payload) {
  const q = safeGet(K.queue, []);
  const item = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    task_id: taskId,
    payload,
    queued_at: new Date().toISOString(),
  };
  q.push(item);
  safeSet(K.queue, q);
  return item;
}

export function getQueue() {
  return safeGet(K.queue, []);
}

export function clearQueueItem(id) {
  const q = safeGet(K.queue, []).filter((x) => x.id !== id);
  safeSet(K.queue, q);
}

export async function syncQueue(apiClient, onItemDone) {
  const q = getQueue();
  const results = { attempted: q.length, succeeded: 0, failed: 0, errors: [] };
  for (const item of q) {
    try {
      await apiClient.post(`/tasks/${item.task_id}/entries`, item.payload);
      clearQueueItem(item.id);
      results.succeeded++;
      onItemDone?.(item, "ok");
    } catch (e) {
      results.failed++;
      results.errors.push({ id: item.id, error: e.message || String(e) });
      onItemDone?.(item, "fail");
    }
  }
  return results;
}

// Attach network listeners once
let listenersAttached = false;
export function attachAutoSync(apiClient, onSyncDone) {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  const trigger = async () => {
    if (!isOnline()) return;
    if (getQueue().length === 0) return;
    const res = await syncQueue(apiClient);
    onSyncDone?.(res);
  };
  window.addEventListener("online", trigger);
  // Try immediately on load if we're online with a queue
  setTimeout(trigger, 800);
}
