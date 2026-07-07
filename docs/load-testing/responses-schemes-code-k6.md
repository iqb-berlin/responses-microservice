# k6 Load Tests for `POST /schemes/code`

This test harness exercises the responses-microservice `POST /schemes/code`
endpoint with k6.

The harness is intentionally kept outside the npm dependency tree. Install k6
locally or let the wrapper run the official `grafana/k6` Docker image.

## Files

- [scripts/load-tests/responses-schemes-code.js](../../scripts/load-tests/responses-schemes-code.js)
- [scripts/load-tests/run-responses-schemes-code.sh](../../scripts/load-tests/run-responses-schemes-code.sh)
- [scripts/load-tests/payloads/schemes-code-small.json](../../scripts/load-tests/payloads/schemes-code-small.json)
- [scripts/load-tests/payloads/schemes-code-medium.json](../../scripts/load-tests/payloads/schemes-code-medium.json)
- [scripts/load-tests/payloads/schemes-code-complex.json](../../scripts/load-tests/payloads/schemes-code-complex.json)

## Start the Service

Run the service from this repository:

```bash
npm ci
npm run build
RATE_LIMIT_MAX=1000000 npm start
```

Or use Docker:

```bash
docker build -t responses-microservice:local .
docker run --rm -p 3000:3000 -e RATE_LIMIT_MAX=1000000 responses-microservice:local
```

## Payload Classes

| Class | Source | Characteristics | Use |
| --- | --- | --- | --- |
| `small` | Minimal base-variable example | 1 response, 1 variable coding, small JSON body | Smoke and transport checks |
| `medium` | Array/ruleset example | 3 responses, 4 variable codings, several rule sets | Baseline for typical rule load |
| `complex` | Subform/derivation example | 9 responses, 7 variable codings, subforms and `SUM_CODE` derivation | More realistic derivation load |
| `large` | `complex` with `SCALE_FACTOR=5` | 5 synthetic copies with renamed ids and sources | Body-size growth |
| `xlarge` | `complex` with `SCALE_FACTOR=10` | 10 synthetic copies | Large-body saturation runs |

## Profiles

| Profile | Payload | Scale | Load model | Default load | Duration | Goal |
| --- | --- | --- | --- | --- | --- | --- |
| `smoke` | `small` | `1` | `constant-arrival-rate` | `1 req/s` | `30s` | Check URL, headers and JSON parsing |
| `baseline` | `small` | `1` | `ramping-arrival-rate` | `1 -> 2 -> 5 -> 8 req/s` | `5m` | Baseline for small requests |
| `baseline` | `medium` | `1` | `ramping-arrival-rate` | `1 -> 2 -> 5 -> 8 req/s` | `5m` | Baseline for typical ruleset load |
| `spike` | `complex` | `1` | `ramping-arrival-rate` | peak `15 req/s` | `2m` | Short burst behavior |
| `soak` | `medium` | `1` | `constant-arrival-rate` | `4 req/s` | `30m` | Memory and GC stability under sustained load |
| `payload_scaling` | `complex` | `5` | `constant-arrival-rate` | `2 req/s` | `10m` | Larger request bodies without burst load |
| `payload_scaling` | `complex` | `10` | `constant-arrival-rate` | `2 req/s` | `10m` | Large-body CPU and body-size check |

For saturation-specific profiles, see
[responses-schemes-code-saturation-k6.md](./responses-schemes-code-saturation-k6.md).

## Examples

Run directly with k6:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=smoke \
PAYLOAD=small \
k6 run scripts/load-tests/responses-schemes-code.js
```

Run through the wrapper:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=baseline \
PAYLOAD=medium \
./scripts/load-tests/run-responses-schemes-code.sh
```

Run through npm:

```bash
BASE_URL=http://localhost:3000 \
PROFILE=spike \
PAYLOAD=complex \
npm run load-test:schemes-code
```

If k6 is not installed locally, the wrapper uses Docker and rewrites
`localhost` or `127.0.0.1` to `host.docker.internal` so the container can reach
the service on the host.

## Summary Export

The script writes a compact end-of-test summary through `handleSummary()`.

- `SUMMARY_STDOUT=true|false`: print the Markdown summary to stdout
- `SUMMARY_JSON=<path>`: write a machine-readable JSON summary
- `SUMMARY_MD=<path>`: write a Markdown summary
- `SUMMARY_DIR=<directory>` and `SUMMARY_BASENAME=<name>`: convenience form for
  `<directory>/<name>.json` and `<directory>/<name>.md`

Example:

```bash
mkdir -p artifacts/k6

BASE_URL=http://localhost:3000 \
PROFILE=baseline \
PAYLOAD=medium \
SUMMARY_STDOUT=false \
SUMMARY_JSON=artifacts/k6/summary.json \
SUMMARY_MD=artifacts/k6/summary.md \
./scripts/load-tests/run-responses-schemes-code.sh
```

When `SUMMARY_DIR` is used, create the directory first.

## Parameters

- `BASE_URL`: service base URL, for example `http://localhost:3000`
- `PROFILE`: `smoke`, `baseline`, `spike`, `soak`, `payload_scaling`,
  `saturation_medium`, `saturation_complex`, `saturation_complex_x5`,
  `saturation_complex_x10`
- `PAYLOAD`: `small`, `medium`, `complex`
- `SCALE_FACTOR`: synthetic payload multiplier
- `RATE_SCALE`: multiplies configured profile rates
- `RATE`: overrides the fixed rate for `soak` and `payload_scaling`
- `SATURATION_START_RATE`: overrides the start rate for saturation profiles
- `SATURATION_TARGETS`: comma-separated target rates, for example `4,8,12,16`
- `SATURATION_RAMP_DURATION` and `SATURATION_HOLD_DURATION`: ramp and hold
  durations for saturation stages
- `PRE_ALLOCATED_VUS`, `MAX_VUS`, `DURATION`, `P95_MS`, `P99_MS`,
  `MAX_FAILURE_RATE`: runtime tuning
- `PARSE_RESPONSE=false`: skip response JSON parsing when only HTTP latency is
  relevant

## Notes

- Synthetic scaling renames `id`, `alias`, `deriveSources` and `subform` values
  per copy.
- Free-text references inside `solverExpression` are not rewritten. Payloads
  with those dependencies should be maintained as dedicated JSON fixtures.
- The example payloads are derived from realistic `@iqb/responses` test data
  and are meant for `CodingSchemeFactory.code()`.
- The manual GitHub Actions workflow can run against this repository's service
  or a deployed `base_url`.
- Raise `RATE_LIMIT_MAX` for local benchmarking so the service rate limiter does
  not become the bottleneck under test.
- Historical capacity numbers from the former monorepo branch were not migrated
  because they were measured against an older service/library combination.
