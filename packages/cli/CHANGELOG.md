# Changelog

All notable changes to the `blockend-cli` package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2026-09-10

### Added

- Added verified CLI release workflow with GitHub Actions.
- Added automated CLI testing before publishing.
- Added npm provenance support for trusted package releases.

### Changed

- Improved release process to publish CLI packages through GitHub Actions instead of local publishing.

### Fixed

- Fixed release verification and package publishing workflow.

## [2.0.1] - 2026-09-02

### Chores

- Bump version to 2.0.1

## [2.0.0] - 2026-08-22

### Chores

- Replace ESLint with oxlint
- Update CLI documentation and enhance package metadata

## [1.5.1] - 2026-07-21

### Fixes

- Fix CDN base URL for registry manifest fetching

## [1.5.0] - 2026-07-21

### Features

- Add `diff` command for previewing generated files without writing to disk
- Add `doctor` command for diagnosing configuration and project issues
- Add `update` command for comparing installed blocks with newer versions

### Refactor

- Implement import rewriting strategy for module resolution
- Resolve block dependencies with framework-agnostic block support

## [1.4.6] - 2026-07-14

### Features

- Resolve block dependencies and add support for framework-agnostic blocks

## [1.4.5] - 2026-07-14

### Fixes

- Patch release

## [1.4.4] - 2026-07-10

### Features

- Enable framework-agnostic blocks for every framework

## [1.4.3] - 2026-07-03

### Fixes

- Patch release

## [1.4.2] - 2026-07-02

### Fixes

- Patch release

## [1.4.1] - 2026-07-02

### Fixes

- Fix import resolution

## [1.4.0] - 2026-07-01

### Features

- Add MCP server support (`mcp` command with `init` subcommand)
- Add `list` command for browsing available blocks
- Merge detector package into CLI

### Refactor

- Update CLI for MCP server integration
- Decouple logger engine with adaptive framework resolution
- Polish CLI UI and theme system

## [1.3.1] - 2026-06-29

### Fixes

- Resolve TypeScript build issues

## [1.3.0] - 2026-06-28

### Features

- Enforce TypeScript-only projects
- Filter blocks by framework

### Refactor

- Unify manifest schema around variant files array
- Decouple logger engine with adaptive framework resolution

## [1.2.0] - 2026-06-27

### Features

- Upgrade registry schema
- Modularize block addition

## [1.1.0] - 2026-06-27

### Features

- Implement `add` command for injecting blocks into codebases
- Enhance init workflow with project detection
- Add Express rate limiter block

## [1.0.2] - 2026-06-27

### Features

- Integrate project detector into init command
- Refactor CLI UX with theme system

## [1.0.0] - 2026-06-26

### Features

- Initial release of `blockend-cli`
- `init` command for project configuration
- `add` command for block injection
- `detect` command for project scanning

## Releasing

### How maintainers create a release

1. Ensure the CLI version in `packages/cli/package.json` has been bumped to the desired version.
2. Commit the version bump with a message like `chore(cli): bump version to x.y.z`.
3. Push to `master`.
4. On GitHub, go to **Releases** → **Draft new release**.
5. Set the release tag (e.g., `v2.1.0`) and target the `master` branch.
6. Fill in release notes summarizing the changes.
7. Click **Publish release**.

The `release.yml` workflow triggers on the published release event and handles the rest automatically.

### Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (`1.0.x`): Bug fixes, non-breaking changes.
- **Minor** (`1.x.0`): New features, backward-compatible.
- **Major** (`2.0.0`): Breaking changes.

### Publishing

- Publishing happens exclusively through GitHub Actions (`release.yml`).
- No manual `npm publish` is required or recommended.
- The package is published with **npm provenance** enabled via GitHub Actions OIDC trusted publishing.
- No long-lived npm tokens are stored. Authentication is handled through GitHub's OIDC integration.
- Each published artifact includes provenance metadata linking it to:
  - The GitHub repository (`github.com/codewithnuh/blockend`)
  - The specific workflow run
  - The commit SHA

### Verification

Before every publish, the release workflow:

1. Runs the full CLI test suite (72 unit tests).
2. Builds the CLI package.
3. Runs smoke tests against all CLI subcommands.
4. Validates package contents with `npm pack --dry-run`.
5. Only then publishes to npm with `--provenance`.

If any step fails, the release is blocked and no package is published.
