# REQ-001 Technical Design: Formal Release Stabilization for LeetCode on VSCode

## Metadata

- REQ ID: `REQ-001`
- Status: `Completed`
- Owner: `olsonwangyj`
- Created: `2026-04-01`
- Updated: `2026-04-01`

## Design Objective

Stabilize the existing customized fork as a formal release without rewriting its architecture. The design must preserve the current working enhancements while reducing release ambiguity, aligning published metadata, and making the repository ready for repeatable future releases.

## Current Baseline

The current repository is built around compiled JavaScript in `out/` plus packaged dependencies in `node_modules`. The extension is already published under:

- Extension id: `olsonwangyj.leetcode-on-vscode`
- Publisher: `olsonwangyj`

Key audited modules:

- `package.json`: extension identity, Marketplace metadata, command contributions, preview posture
- `out/src/shared.js`: endpoint and web auth callback configuration
- `out/src/leetCodeManager.js`: sign-in flow orchestration and cookie handling
- `out/src/commands/show.js`: open-problem workflow and workspace UX customization
- `out/src/commands/test.js`: direct multi-example test pipeline
- `out/src/commands/submit.js`: submission + failed testcase persistence
- `out/src/webview/leetCodeSubmissionProvider.js`: grouped result rendering
- `RELEASE.md`: manual release runbook

## Proposed Technical Decisions

### TD-001 Keep the runtime architecture, stabilize the release surface

The extension will continue to ship from the existing built `out/` artifact model. This requirement will not introduce a TypeScript source migration.

Reason:

- It minimizes regression risk.
- It respects the current maintained state of the repository.
- It is sufficient for a release-hardening pass.

### TD-002 Promote the release from preview to formal release

The `preview` release posture in `package.json` should be removed or set to a formal non-preview state.

Reason:

- The requirement is specifically for a formal release.
- The Marketplace listing should match the intended maturity level.

### TD-003 Preserve the “Unofficial” disclosure

README and store-facing description should continue to state that this is an unofficial fork.

Reason:

- It reduces brand confusion.
- It preserves the current explicit attribution and risk posture.

### TD-004 Keep legacy asset renaming out of this requirement unless strictly necessary

Visible branding should be aligned where required, but mass renaming legacy `AlgoWorkspace*` asset filenames is not required for this release unless a specific runtime or Marketplace issue is found.

Reason:

- Filename cleanup is structurally nice but not essential to formal release stability.
- It introduces avoidable churn across package metadata and assets.

### TD-005 Preserve customized workspace and test flows

The following custom behaviors are release-critical and must be retained:

- description left / code right layout
- auto-close old LeetCode code tabs where safe
- auto-collapse sidebar without hiding Activity Bar
- web auth callback using the published extension id
- multi-example testing
- failed-case persistence
- structured grouped submission rendering

## Scope of Code Changes

### 1. Release Metadata Layer

Files:

- `package.json`
- `README.md`
- `CHANGELOG.md` if release notes must be updated
- `RELEASE.md`

Changes:

- finalize formal release version
- remove or disable preview release posture
- ensure description and release docs match the actual released behavior

### 2. Authentication Layer

Files:

- `out/src/shared.js`
- `out/src/leetCodeManager.js`

Changes:

- preserve published extension id in web authorization callback
- verify no remaining upstream callback path references exist
- keep cookie login fallback unchanged

### 3. Workspace UX Layer

Files:

- `out/src/commands/show.js`

Changes:

- preserve 40/60 layout behavior
- preserve description-left/code-right behavior
- preserve safe tab cleanup
- preserve sidebar auto-collapse after problem open

### 4. Test and Submission Layer

Files:

- `out/src/commands/test.js`
- `out/src/commands/submit.js`
- `out/src/utils/customTestcaseStore.js`
- `out/src/utils/cpUtils.js`
- `out/src/webview/leetCodeSubmissionProvider.js`

Changes:

- verify current custom flows remain intact
- avoid introducing feature churn unless needed to fix release regressions

### 5. Repository and Release Evidence Layer

Files:

- `RELEASE.md`
- `requirements/REQ-001-formal-release-stabilization/*`

Changes:

- keep release process documented in-repo
- ensure release-critical notes are committed to GitHub

## Module Reuse Strategy

This requirement emphasizes reuse over refactor-heavy redesign.

### LeetCodeExecutor

Role:

- central CLI interaction layer

Decision:

- no redesign
- use as the single command execution boundary

### LeetCodeManager

Role:

- sign-in orchestration
- URI callback handling
- user status state management

Decision:

- preserve existing responsibility split
- only harden callback correctness and release readiness

### show.js workflow

Role:

- open-problem orchestration
- layout and editor management

Decision:

- keep all workspace UX decisions here
- do not spread these behaviors into unrelated modules

### Test / Submit / Webview trio

Role:

- execution flow
- persistence of failed cases
- rendering results

Decision:

- keep the current separation
- adjust only if release verification uncovers regressions

## Architecture Overview

The formal release continues to use a layered flow:

1. Marketplace metadata layer
2. VS Code command registration layer
3. Manager / executor orchestration layer
4. CLI + LeetCode service integration layer
5. Webview presentation layer

This requirement changes mainly the metadata layer and the release-critical edges of layers 3 to 5.

## Sequence Design

### Sign In via Web Authorization

1. User triggers `leetcode.signin`
2. `LeetCodeManager.signIn()` opens the web auth URL from `shared.js`
3. LeetCode returns to the VS Code URI handler using the published extension id
4. `handleUriSignIn()` parses the cookie
5. user data is fetched and persisted
6. CLI session is updated
7. explorer and status bar refresh

### Open Problem

1. User triggers `leetcode.showProblem`
2. `showProblemInternal()` resolves workspace path and file path
3. `LeetCodeExecutor.showProblem()` fetches or materializes the code file
4. description webview opens on the left
5. code opens on the right
6. previous safe LeetCode code tabs close
7. sidebar collapses

### Release Publish

1. Maintainer updates package version
2. Maintainer packages VSIX
3. Maintainer publishes via `vsce publish`
4. Marketplace processes the release
5. Maintainer verifies Marketplace version and GitHub sync

## Class / Module Interaction Design

The following runtime relationships are central to this requirement:

- `extension.js` registers commands and wires handlers
- `LeetCodeManager` handles auth state and callback processing
- `LeetCodeExecutor` handles CLI execution and remote interactions
- `show.js` coordinates file opening and workspace UX
- `test.js` coordinates enhanced direct test flows
- `submit.js` coordinates submission and testcase persistence
- `LeetCodeSubmissionProvider` renders grouped or fallback result views

## Data and State Considerations

### Persistent User State

Managed through:

- extension global state
- CLI session state

Risk:

- auth can appear valid in one layer and expired in another

Design response:

- keep sign-in fallback paths
- ensure callback correctness

### Persistent Failed Testcases

Managed through:

- `.leetcode-extra-testcases.json`

Design response:

- preserve reusable testcase filtering
- keep truncated testcase protection

## Security and Operational Considerations

### Security

- keep unofficial branding to avoid deceptive presentation
- do not broaden credential handling scope in this requirement
- do not introduce new remote telemetry behavior

### Operational

- Marketplace propagation lag is expected; verification must tolerate a delay
- release validation should rely first on `vsce publish` success and `vsce show`, then on Marketplace page propagation

## Verification Strategy

The later verification stage should cover:

1. package metadata verification
2. local VSIX packaging success
3. sign-in flow sanity check
4. open-problem UX check
5. test flow check
6. submit flow check
7. GitHub sync check
8. Marketplace version visibility check

## Out of Scope for This Requirement

- TypeScript source recovery or rebuild
- deep UI redesign
- unrelated feature expansion
- broad icon filename cleanup

## Implementation Order

1. finalize release metadata changes
2. verify auth callback correctness
3. preserve and confirm workspace UX logic
4. verify test and submission modules
5. update release docs
6. package and publish
7. verify Marketplace and GitHub state

## Expected Deliverables

- stabilized release metadata
- release-ready repository state
- published formal release version
- committed release documentation
- verification evidence

## Design Approval Notes

This technical design assumes:

1. the release should no longer remain a Marketplace preview release
2. unofficial attribution must remain
3. legacy asset filename cleanup is deferred unless required by runtime behavior

If any of those assumptions should change, the coding scope for REQ-001 must be adjusted before Stage 3 starts.

## Change Log

| Version | Date | Summary | Affected Scope |
| --- | --- | --- | --- |
| v1 | 2026-04-01 | Initial technical design for formal release stabilization | Docs, Metadata, Authentication, Workspace UX, Testing, Submission, Release |
| v2 | 2026-04-01 | Technical design approved and coding started | Docs, Release |
| v3 | 2026-04-01 | Security review identified package-level exclusions for temporary and local environment files | Release, Security |
| v4 | 2026-04-01 | Security review completed and cleanup review opened | Release, Security, Docs |
| v5 | 2026-04-01 | Cleanup applied and requirement review started | Release, Security, Docs |
