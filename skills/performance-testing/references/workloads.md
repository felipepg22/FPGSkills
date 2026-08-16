# Workload and statistical design

Separate workload scenarios from the statistics used to observe them.

## Select scenarios deliberately

- **Baseline:** one or very few virtual users establish functional timing and local noise.
- **Load:** expected steady traffic validates normal capacity.
- **Stress:** increasing load finds degradation and saturation behavior.
- **Spike:** a rapid arrival increase measures shock and recovery.
- **Soak:** sustained expected load exposes leaks, queues, and degradation over time.
- **Scalability:** repeated load steps relate throughput to resource growth.

Choose only scenarios justified by the request and repository evidence. Default an ordinary endpoint request to baseline plus load. Never start a long soak or aggressive stress run as a hidden default.

Map the approved intent to an explicit k6 executor: use iterations/shared iterations for baseline, constant VUs or constant arrival rate for steady load and soak, and ramping VUs or ramping arrival rate for stress, spike, and scalability stages. A template that lacks the selected executor must be adapted and structurally validated before approval; never substitute a different scenario silently.

## Choose the workload model

Ask whether the user knows concurrent users or request/RPC rate. Use a closed, VU-based model for correlated journeys and an open, arrival-rate model for endpoint traffic unless the user approves another model. Do not translate concurrency into arrival rate without an explicit service-time assumption.

Run isolated cases sequentially. For whole-application scope, add a composite scenario only when the user approved the traffic weights. Do not infer production traffic ratios.

Offer:

- **Quick:** one measured run after a short warm-up.
- **Standard:** warm-up plus three measured repetitions, executed under comparable conditions.

Propose conservative local values when the user lacks numbers, show them in the plan, and obtain fingerprinted approval. Include ramp-up, steady state, ramp-down, hard maximum duration, and stream termination.

## Define safety stops

Safety stops prevent harm; they are not performance SLOs. Represent each stop with a stable identifier, observable, concrete threshold, abort action, and implementation path. Cover application unavailability, runaway error rates, memory pressure, shared setup failure, and maximum duration where the selected instrumentation can observe them. Wire k6-observable stops to `abortOnFail` thresholds and external resource or wall-clock stops to the executor supervisor. If a required observable cannot be enforced, block execution rather than describing an inert stop. Retain partial evidence after an abort.

## Report adequate statistics

For every operation and scenario, request mean, `p50 (median)`, p95, p99, min, max, standard deviation, sample count, throughput, and error rate. Also record scenario duration and full campaign wall-clock time.

Label p99 exploratory when fewer than 1,000 successful samples exist for that metric. If a supplied p99 SLO lacks adequate samples, report insufficient evidence instead of pass or fail.

Use only SLOs explicitly supplied in the conversation. Preserve their scope, statistic, threshold, and unit. Checks establish functional correctness; they become performance verdicts only when paired with supplied thresholds.

## Compare compatible runs

Offer a historical comparison only when target, case definition, workload, k6 version, application revision, configuration profile, and material machine/container limits are compatible. Describe incompatible historical data without calculating a regression claim.
