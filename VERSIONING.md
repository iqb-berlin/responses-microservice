# Versioning and updates

This service wraps a concrete installed version of `@iqb/responses`. The
service version and the bundled library version are tracked separately.

## Runtime visibility

- `GET /version` returns the service version and the installed
  `@iqb/responses` version.
- Published container images include the OCI label
  `de.iqb.responses.version`.
- Published images are tagged with the service version and an additional
  `responses-<version>` tag for the bundled `@iqb/responses` version.

## Service releases

Use semantic versioning for the service package:

- Patch: dependency updates or internal fixes that do not change the HTTP API.
- Minor: backward-compatible endpoint or response additions.
- Major: breaking HTTP API, behavior, or deployment contract changes.

Every published container image should come from a versioned service release.
Create a `v*` tag after updating `package.json`, `package-lock.json`, and the
OpenAPI version when the HTTP API version changes.

## `@iqb/responses` updates

Dependency update pull requests are created by Dependabot. Updates to
`@iqb/responses` are intentionally not grouped with other npm dependencies so
they can be reviewed on their own.

Review checklist:

1. Read the `@iqb/responses` release notes or changelog.
2. Run `npm run check`.
3. Confirm fixture tests still cover representative coding, derivation,
   validation, and text-rendering behavior.
4. Build the Docker image and verify `/health` and `/version`.
5. Merge the update only after CI is green.
6. Release a new service version and publish a new image when consumers should
   receive the updated library.

Major `@iqb/responses` versions require manual API and fixture review before
release.
