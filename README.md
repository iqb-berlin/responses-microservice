# responses-microservice

REST API wrapper for the [`@iqb/responses`](https://www.npmjs.com/package/@iqb/responses) library.

The service exposes coding, coding-scheme validation, derivation, and text-rendering helpers over HTTP. It is intended for non-TypeScript consumers or deployment environments that prefer a containerized API over direct npm package usage.

## Quick Start

```bash
npm ci
npm run build
npm start
```

The service listens on port `3000` by default:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/version
```

## Docker

```bash
docker build \
  --build-arg SERVICE_VERSION=0.1.0 \
  --build-arg RESPONSES_VERSION=5.2.0 \
  -t responses-microservice:0.1.0 .

docker run --rm -p 3000:3000 responses-microservice:0.1.0
```

Published images use the service version as the primary tag:

```text
ghcr.io/iqb-berlin/responses-microservice:0.1.0
```

The bundled `@iqb/responses` version is exposed via `/version` and the OCI label `de.iqb.responses.version`.

## API

OpenAPI documentation is available in [openapi.yml](./openapi.yml).

### Code One Response

```bash
curl -X POST http://localhost:3000/codings/code \
  -H "Content-Type: application/json" \
  -d '{
    "response": { "id": "v1", "value": "hello", "status": "VALUE_CHANGED" },
    "coding": { "id": "v1", "sourceType": "BASE", "codes": [] }
  }'
```

### Endpoints

- `GET /health`
- `GET /version`
- `POST /codings/code`
- `POST /schemes/code`
- `POST /schemes/validate`
- `POST /schemes/derive-value`
- `POST /text/code`
- `POST /text/source`
- `POST /text/processing`
- `POST /text/var-info`

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `BODY_LIMIT` | `10mb` | JSON request body limit |
| `RATE_LIMIT_MAX` | `300` | Requests per 15 minutes per client |
| `CORS_ORIGIN` | unset | Comma-separated allowed origins, or `*` |

## Development Checks

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

`npm run check` runs all of the above.
