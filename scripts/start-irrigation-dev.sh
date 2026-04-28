#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ENV_FILE="${WEB_ENV_FILE:-$ROOT_DIR/web-dev/.env}"
SERVICES_ENV_FILE="${SERVICES_ENV_FILE:-$ROOT_DIR/services/.env}"

load_dotenv_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"
    [[ "$key" == "$line" ]] && continue

    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$env_file"
}

load_dotenv_file "$WEB_ENV_FILE"
load_dotenv_file "$SERVICES_ENV_FILE"

export SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
export MQTT_GATEWAY_BASE_URL="${MQTT_GATEWAY_BASE_URL:-http://127.0.0.1:4320}"
export VITE_EXECUTION_SERVICE_URL="${VITE_EXECUTION_SERVICE_URL:-http://127.0.0.1:4310}"

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL. Add it to services/.env or web-dev/.env." >&2
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to services/.env." >&2
  exit 1
fi

if [[ -z "${WIFI_DEMO_MQTT_ACCOUNT:-}" || -z "${WIFI_DEMO_MQTT_USER_ID:-}" || -z "${WIFI_DEMO_MQTT_PASSWORD:-}" || -z "${WIFI_DEMO_DEVICE_ID:-}" ]]; then
  echo "Missing WiFi demo MQTT env. Check web-dev/.env or services/.env." >&2
  exit 1
fi

PIDS=()

kill_port_if_listening() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Cleaning up existing listener on :$port"
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill "$pid" >/dev/null 2>&1 || true
      sleep 0.2
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    done <<< "$pids"
  fi
}

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

kill_port_if_listening 4310
kill_port_if_listening 4320
kill_port_if_listening 5173

echo "Starting mqtt-gateway-service on :4320"
(cd "$ROOT_DIR/services/mqtt-gateway-service" && npm run start) &
PIDS+=($!)

echo "Starting execution-service on :4310"
(cd "$ROOT_DIR/services/execution-service" && npm run start) &
PIDS+=($!)

echo "Starting web-dev on :5173"
(cd "$ROOT_DIR/web-dev" && npm run dev -- --host 0.0.0.0) &
PIDS+=($!)

echo
echo "Services are starting:"
echo "  web-dev: http://127.0.0.1:5173"
echo "  execution-service: ${VITE_EXECUTION_SERVICE_URL}"
echo "  mqtt-gateway-service: ${MQTT_GATEWAY_BASE_URL}"
echo
echo "Press Ctrl+C to stop all processes."

wait
