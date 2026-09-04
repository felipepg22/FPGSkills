// Deterministic per-VU allocation: unused capacity is never borrowed by another VU.
export function createBudget(env, vuId, now) {
  if (env.MAX_REQUESTS === undefined) return () => {}; // Legacy read-only plans.
  const number = (key, minimum) => {
    const value = Number(env[key]);
    if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`${key} requires an integer bound`);
    return value;
  };
  const requests = number("MAX_REQUESTS", 1);
  const records = number("MAX_RECORDS", 0);
  const perRequest = number("MAX_RECORDS_PER_REQUEST", 0);
  const concurrency = number("MAX_CONCURRENCY", 1);
  const duration = number("MAX_DURATION_SECONDS", 1) * 1000;
  const allowance = Math.floor(Math.min(requests, perRequest ? Math.floor(records / perRequest) : requests) / concurrency);
  const started = now();
  let used = 0;
  return () => {
    if (vuId() < 1 || vuId() > concurrency) throw new Error("Execution concurrency exceeds plan");
    if (now() - started >= duration || used >= allowance) throw new Error("Execution budget exhausted");
    used++;
  };
}

export function verifyRemoteHost(host, approvedHost) {
  if (!approvedHost || host.toLowerCase() !== approvedHost.toLowerCase()) throw new Error("Remote host differs from plan");
}
