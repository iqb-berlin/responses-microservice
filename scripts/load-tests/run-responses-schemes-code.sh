#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
K6_SCRIPT="${SCRIPT_DIR}/responses-schemes-code.js"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"

K6_ENV_VARS=(
  BASE_URL
  PROFILE
  PAYLOAD
  SCALE_FACTOR
  RATE_SCALE
  RATE
  SATURATION_START_RATE
  SATURATION_TARGETS
  SATURATION_RAMP_DURATION
  SATURATION_HOLD_DURATION
  RESPONSE_TIMEOUT
  PARSE_RESPONSE
  MAX_FAILURE_RATE
  P95_MS
  P99_MS
  SUMMARY_DIR
  SUMMARY_BASENAME
  SUMMARY_JSON
  SUMMARY_MD
  SUMMARY_STDOUT
  VUS
  PRE_ALLOCATED_VUS
  MAX_VUS
  DURATION
)

if command -v k6 >/dev/null 2>&1; then
  cd "${REPO_DIR}"
  exec k6 run "$@" "${K6_SCRIPT}"
fi

if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but the Docker daemon is not reachable." >&2
    echo "Start Docker or install 'k6' locally to run this load test." >&2
    exit 125
  fi

  docker_env_args=()
  docker_base_url="${BASE_URL:-}"

  if [[ -z "${docker_base_url}" ]]; then
    docker_base_url="http://host.docker.internal:3000"
  elif [[ "${docker_base_url}" =~ ^https?://localhost([:/]|$) ]]; then
    docker_base_url="${docker_base_url/localhost/host.docker.internal}"
  elif [[ "${docker_base_url}" =~ ^https?://127\.0\.0\.1([:/]|$) ]]; then
    docker_base_url="${docker_base_url/127.0.0.1/host.docker.internal}"
  fi

  docker_env_args+=(-e "BASE_URL=${docker_base_url}")

  for var_name in "${K6_ENV_VARS[@]}"; do
    if [[ "${var_name}" == "BASE_URL" ]]; then
      continue
    fi

    if [[ -n "${!var_name:-}" ]]; then
      docker_env_args+=(-e "${var_name}=${!var_name}")
    fi
  done

  cd "${REPO_DIR}"
  exec docker run --rm -i \
    --add-host=host.docker.internal:host-gateway \
    -v "${REPO_DIR}:/work" \
    -w /work \
    "${docker_env_args[@]}" \
    "${K6_IMAGE}" run "$@" scripts/load-tests/responses-schemes-code.js
fi

echo "Neither 'k6' nor a reachable Docker daemon is available." >&2
exit 127
