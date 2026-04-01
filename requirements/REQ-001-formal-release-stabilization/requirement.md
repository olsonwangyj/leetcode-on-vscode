# REQ-001: Formal Release Stabilization for LeetCode on VSCode

## Metadata

- REQ ID: `REQ-001`
- Status: `Completed`
- Owner: `olsonwangyj`
- Created: `2026-04-01`
- Updated: `2026-04-01`

## Background

This repository is a forked and customized VS Code extension for solving LeetCode problems. The codebase already contains several user-facing improvements, including:

- direct LeetCode test execution shortcuts
- multi-example test execution
- failed-case persistence
- improved submission formatting
- workspace layout customization

During the repository audit, the following release-hardening concerns were identified:

- Marketplace packaging and repository state were not fully synchronized.
- The extension is still marked as a preview release in `package.json`.
- Branding remains partially inconsistent, with metadata saying `LeetCode on VSCode` while some icon asset names still use legacy `AlgoWorkspace` naming.
- The web authorization callback had to be corrected to use the published extension id.
- Problem opening behavior now depends on custom layout logic and must remain stable through formal release.
- Release instructions existed locally but were not yet part of tracked project documentation.

## Problem Statement

The repository currently works as an actively customized fork, but it has not yet been hardened as a clean, repeatable, formally released extension version. The project needs a controlled release-focused pass that verifies repository consistency, stabilizes key user-facing flows, removes preview-only release posture where appropriate, and publishes a formal release with documentation and verification evidence.

## Goals

1. Turn the current customized fork into a stable formal release candidate.
2. Ensure core flows remain functional after stabilization:
   - sign in
   - open problem
   - test solution
   - submit solution
   - view results in submission webview
3. Align extension metadata, release posture, and repository state.
4. Leave the repository in a repeatable state for future packaging and publishing.

## Non-Goals

- Rewriting the extension architecture from source TypeScript.
- Replacing the third-party CLI dependency with a new backend implementation.
- Re-designing all UI surfaces beyond changes required for release stability.
- Adding unrelated new features that are not required for formal release quality.

## Actors

- End User: installs the extension and uses it for LeetCode workflows in VS Code.
- Maintainer: updates code, packages, publishes, and verifies releases.
- LeetCode Web Service: provides auth, problem data, testing, and submission behavior.
- VS Code Marketplace: distributes packaged extension versions.

## User Scenarios

### Scenario 1: User signs in through web authorization

The user selects `Sign In`, chooses web authorization, completes the browser flow, and returns to the installed published extension successfully.

### Scenario 2: User opens a problem from the explorer

The extension opens the problem description on the left, code on the right, closes stale previous problem tabs where safe, and auto-collapses the sidebar while keeping the Activity Bar available.

### Scenario 3: User runs tests on multiple examples

The extension parses example inputs from the problem description, runs them sequentially, formats grouped results, and handles rate limits or partial failures gracefully.

### Scenario 4: Maintainer packages and publishes a release

The maintainer increments the version, packages a VSIX, publishes to Marketplace, and verifies the resulting version and repository state.

## Functional Requirements

### FR-001 Release metadata consistency

The extension metadata must consistently identify the product as `LeetCode on VSCode`, including extension id alignment, publisher alignment, and release documentation alignment.

### FR-002 Formal release posture

The published extension should be suitable for a formal release. Any preview-only flags or preview-only messaging must be explicitly reviewed and either removed or intentionally retained with a documented rationale.

### FR-003 Web authorization correctness

Web authorization must redirect back to the currently published extension id `olsonwangyj.leetcode-on-vscode`, not the original upstream id.

### FR-004 Workspace UX stability

Opening a problem must preserve the intended customized layout:

- description on the left
- code on the right
- previous LeetCode problem code tabs closed when safe
- sidebar auto-collapsed
- Activity Bar left untouched

### FR-005 Test workflow stability

The direct test workflow must keep the current enhanced behavior:

- example extraction from description
- persisted failed-case replay
- structured result grouping
- useful fallback messages when structured parsing fails

### FR-006 Submission workflow stability

Submission results must remain viewable in the custom submission webview and preserve failed testcase capture when the testcase is valid and not truncated.

### FR-007 Release documentation

The repository must contain tracked release instructions sufficient for a future maintainer to package and publish the extension again.

### FR-008 Repository hygiene for release

The repository must reflect the shipped release state, including committed release-critical metadata and documentation changes.

## Non-Functional Requirements

### NFR-001 Stability

Changes for this requirement must not break the current customized user workflows that were previously added.

### NFR-002 Minimal regression scope

Release hardening should focus on the smallest safe set of changes needed to support a formal release.

### NFR-003 Traceability

All changes should map back to a clearly documented release requirement, so future versions can be audited and reproduced.

## Acceptance Criteria

1. The requirement folder and requirement analysis artifacts exist in the repository.
2. The repository contains tracked release guidance for future packaging and publishing.
3. The published extension id and web auth callback path match.
4. The customized open-problem behavior still works as intended.
5. The release version is incremented and published successfully.
6. The repository is pushed to GitHub with the release-critical changes.
7. Verification evidence is captured before archive.

## Initial Impacted Files

- `package.json`
- `package-lock.json`
- `README.md`
- `RELEASE.md`
- `out/src/shared.js`
- `out/src/commands/show.js`
- `out/src/commands/test.js`
- `out/src/commands/submit.js`
- `out/src/webview/leetCodeSubmissionProvider.js`

## Risks

- Marketplace propagation may lag after publish and make verification timing noisy.
- The repository is based on built `out/` artifacts rather than source TypeScript, which increases the need for careful regression checks.
- Credential handling for publishing currently falls back to clear-text local storage when the credential store is unavailable.

## Open Questions

1. Should the extension remain explicitly labeled as unofficial in README and description after the formal release?
2. Should legacy asset filenames using `AlgoWorkspace` be renamed now, or can they remain if the visible branding is already correct?
3. Should preview mode be fully removed for this formal release, or retained temporarily until a broader verification pass is complete?

## Change Log

| Version | Date | Summary | Affected Scope |
| --- | --- | --- | --- |
| v1 | 2026-04-01 | Initial requirement analysis from codebase audit and release request | Docs, Metadata, Authentication, Workspace UX, Testing, Submission, Release |
| v2 | 2026-04-01 | Requirement approved and advanced to technical design | Docs, Release |
| v3 | 2026-04-01 | Coding started for formal stable release, release metadata alignment, helper-module refactor, and release automation scripts | Metadata, Authentication, Workspace UX, Release |
| v4 | 2026-04-01 | Security review started; packaged temporary and local environment files marked for exclusion | Release, Security |
| v5 | 2026-04-01 | Security review completed and cleanup findings prepared for approval | Release, Security, Docs |
| v6 | 2026-04-01 | Cleanup approved and applied; requirement review started | Release, Security, Docs |
| v7 | 2026-04-01 | Requirement review completed; verification scripts and package checks added | Release, Verification, Scripts |
| v8 | 2026-04-01 | Formal release `1.0.0` packaged, locally installed, published, and archived | Release, Verification, Docs |
