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
  const attempts = env.MAX_ATTEMPTS === undefined ? 1 : number("MAX_ATTEMPTS", 1);
  const duration = number("MAX_DURATION_SECONDS", 1) * 1000;
  const allowance = Math.floor(Math.min(requests, perRequest ? Math.floor(records / perRequest) : requests) / concurrency / attempts);
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

// k6 does not supply the browser/Node URL global. Accept only unambiguous HTTP authorities.
export function httpTargetHost(value) {
  const match = typeof value === "string" && value.match(/^https?:\/\/(\[[0-9a-fA-F:]+\]|[A-Za-z0-9_.-]+)(?::([0-9]+))?(?:[/?#][^\s\\]*)?$/);
  if (!match || (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) throw new Error("Target must be HTTP(S) with an explicit unambiguous host and no URL credentials");
  return match[1].replace(/^\[|\]$/g, "").toLowerCase();
}
