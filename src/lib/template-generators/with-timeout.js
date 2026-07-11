// Wraps a promise so it can never hang forever — a stuck fal.subscribe poll
// (queue update never observed, dropped connection, etc.) now surfaces as a
// clear timeout error instead of leaving the frontend spinning forever with
// nothing to look at in the Network tab or server logs.
export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
