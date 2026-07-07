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

`/version` returns both the service version and the bundled `@iqb/responses`
version:

```json
{
  "service": "0.1.0",
  "responses": "5.2.0"
}
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

Images are also tagged with the bundled library version, for example:

```text
ghcr.io/iqb-berlin/responses-microservice:responses-5.2.0
```

The bundled `@iqb/responses` version is exposed via `/version` and the OCI label `de.iqb.responses.version`.

### Docker Compose

Use [docker-compose.example.yml](./docker-compose.example.yml) as a starting
point:

```bash
docker compose -f docker-compose.example.yml up
```

## API

OpenAPI documentation is available in [openapi.yml](./openapi.yml).

### Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health check for runtime and container probes |
| `GET /version` | Service and bundled `@iqb/responses` versions |
| `POST /codings/code` | Code one response with one variable coding |
| `POST /schemes/code` | Code unit responses with a coding scheme |
| `POST /schemes/validate` | Validate a coding scheme against base variables |
| `POST /schemes/derive-value` | Derive one variable value from source responses |
| `POST /text/code` | Render one code rule as text |
| `POST /text/source` | Render a variable source definition as text |
| `POST /text/processing` | Render processing instructions as text |
| `POST /text/var-info` | Render variable metadata as text |

### Examples

Code one response:

```bash
curl -X POST http://localhost:3000/codings/code \
  -H "Content-Type: application/json" \
  -d '{
    "response": { "id": "v1", "value": "hello", "status": "VALUE_CHANGED" },
    "coding": {
      "id": "v1",
      "sourceType": "BASE",
      "codes": [
        {
          "id": 1,
          "type": "FULL_CREDIT",
          "score": 1,
          "ruleSets": [
            { "rules": [{ "method": "MATCH", "parameters": ["hello"] }] }
          ]
        }
      ]
    }
  }'
```

Code responses with a coding scheme:

```bash
curl -X POST http://localhost:3000/schemes/code \
  -H "Content-Type: application/json" \
  -d '{
    "unitResponses": [
      { "id": "v1", "value": "hello", "status": "VALUE_CHANGED" }
    ],
    "variableCodings": [
      {
        "id": "v1",
        "sourceType": "BASE",
        "codes": [
          {
            "id": 1,
            "type": "FULL_CREDIT",
            "score": 1,
            "ruleSets": [
              { "rules": [{ "method": "MATCH", "parameters": ["hello"] }] }
            ]
          }
        ]
      }
    ]
  }'
```

Validate a coding scheme:

```bash
curl -X POST http://localhost:3000/schemes/validate \
  -H "Content-Type: application/json" \
  -d '{
    "baseVariables": [
      {
        "id": "v1",
        "type": "string",
        "format": "",
        "multiple": false,
        "nullable": false,
        "values": [],
        "valuePositionLabels": []
      }
    ],
    "variableCodings": [
      { "id": "v1", "sourceType": "BASE", "codes": [] }
    ]
  }'
```

Derive a value:

```bash
curl -X POST http://localhost:3000/schemes/derive-value \
  -H "Content-Type: application/json" \
  -d '{
    "variableCodings": [
      { "id": "v1", "sourceType": "BASE", "codes": [] },
      { "id": "copy", "sourceType": "COPY_VALUE", "deriveSources": ["v1"], "codes": [] }
    ],
    "coding": { "id": "copy", "sourceType": "COPY_VALUE", "deriveSources": ["v1"], "codes": [] },
    "sourceResponses": [{ "id": "v1", "value": "hello", "status": "VALUE_CHANGED" }]
  }'
```

Render text:

```bash
curl -X POST http://localhost:3000/text/source \
  -H "Content-Type: application/json" \
  -d '{ "variableId": "copy", "sourceType": "COPY_VALUE", "sources": ["v1"] }'
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `BODY_LIMIT` | `10mb` | JSON request body limit |
| `RATE_LIMIT_MAX` | `300` | Requests per 15 minutes per client |
| `CORS_ORIGIN` | unset | Comma-separated allowed origins, or `*` |

## Versions and Updates

The service uses a locked npm dependency tree for reproducible builds. New
`@iqb/responses` versions are picked up through dependency update pull requests,
validated by CI, and released as new service/container versions.

See [VERSIONING.md](./VERSIONING.md) for the release and dependency update
policy.

## Development Checks

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

`npm run check` runs all of the above.

CI also builds the Docker image and smoke-tests `/health` and `/version`.

## Support

Please use GitHub issues for questions and bug reports. Include the service
version, the `@iqb/responses` version from `/version`, the endpoint, a minimal
request body, and the observed response.
