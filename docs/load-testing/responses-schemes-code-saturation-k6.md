# Saturation Matrix for `POST /schemes/code`

The saturation profiles are separate from the regular stability profiles. Their
goal is to identify where `POST /schemes/code` moves from stable behavior into a
warning or failure zone.

Base documentation:

- [k6 load tests for POST /schemes/code](./responses-schemes-code-k6.md)

## Model

Each saturation profile increases arrival rate in steps. Each step consists of:

- a short ramp so the target rate does not jump abruptly
- a hold phase so latency, failure rate and VU demand can settle

Defaults:

- `SATURATION_RAMP_DURATION=30s`
- `SATURATION_HOLD_DURATION=3m30s`

That produces one `4m` block per target rate.

## Profiles

| Profile | Default payload | Default scale | Target rates (req/s) | Duration | Purpose |
| --- | --- | --- | --- | --- | --- |
| `saturation_medium` | `medium` | `1` | `4, 8, 12, 16, 20, 24, 30` | `28m` | Capacity curve for typical ruleset load |
| `saturation_complex` | `complex` | `1` | `4, 8, 12, 16, 20` | `20m` | Turning point for derivations and subforms |
| `saturation_complex_x5` | `complex` | `5` | `2, 4, 6, 8` | `16m` | Larger bodies at moderate rate |
| `saturation_complex_x10` | `complex` | `10` | `2, 3, 4, 5, 6` | `20m` | Large-body worst-case baseline |

Notes:

- The profiles set `PAYLOAD` and `SCALE_FACTOR` only when they are not provided.
- `RATE_SCALE` also applies to saturation profiles and scales all configured
  target rates.
- `DURATION` is not used by saturation profiles. Runtime comes from stage count,
  ramp duration and hold duration.

## Examples

Run directly with k6:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=saturation_medium \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex \
PAYLOAD=complex \
k6 run scripts/load-tests/responses-schemes-code.js

BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex_x5 \
k6 run scripts/load-tests/responses-schemes-code.js
```

Run through the wrapper:

```bash
mkdir -p artifacts/k6-saturation

BASE_URL=http://localhost:3000 \
PROFILE=saturation_medium \
SUMMARY_DIR=artifacts/k6-saturation \
./scripts/load-tests/run-responses-schemes-code.sh
```

Run through npm:

```bash
mkdir -p artifacts/k6-saturation

BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex_x10 \
SUMMARY_DIR=artifacts/k6-saturation \
npm run load-test:schemes-code
```

## Useful Overrides

- `SATURATION_TARGETS`: custom comma-separated target rates, for example
  `SATURATION_TARGETS=6,10,14,18`
- `SATURATION_START_RATE`: custom start rate before the first step
- `SATURATION_RAMP_DURATION`: ramp duration per step, for example `20s`
- `SATURATION_HOLD_DURATION`: hold duration per step, for example `5m`
- `PRE_ALLOCATED_VUS`, `MAX_VUS`: increase when the requested arrival rate
  cannot be held because too few VUs are available
- `P95_MS`, `P99_MS`, `MAX_FAILURE_RATE`: tighten or loosen depending on whether
  the run is exploratory or already used as an operational gate

Example with tighter plateaus:

```bash
mkdir -p artifacts/k6-saturation

BASE_URL=http://localhost:3000 \
PROFILE=saturation_complex \
SATURATION_TARGETS=6,10,14,18,22 \
SATURATION_HOLD_DURATION=5m \
MAX_VUS=150 \
SUMMARY_DIR=artifacts/k6-saturation \
./scripts/load-tests/run-responses-schemes-code.sh
```

## Evaluation

Aggregated averages are not enough for saturation runs. Watch especially:

- `p95` and `p99` request duration
- `http_req_failed`
- `checks`
- `vus` and `vus_max`
- container metrics such as CPU, RAM, GC and event-loop lag when available

Pragmatic warning indicators:

- failure rate rises over the configured limit
- `p95` or `p99` jumps sharply
- the target rate requires rapidly growing VU demand
- the service container approaches CPU or RAM limits

## CI

The manual workflow
[.github/workflows/load-test-responses-schemes-code.yml](../../.github/workflows/load-test-responses-schemes-code.yml)
supports the same profiles and saturation overrides.

Leave `base_url` empty to build and start this repository's service inside the
workflow. Set `base_url` to test a deployed instance that is reachable from the
GitHub Actions runner.
