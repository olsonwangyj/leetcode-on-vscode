# Breakpoint Recovery Guide

When resuming a requirement:

1. Read `requirements/index.md`.
2. Identify the current status.
3. Map the status to a workflow stage using `_shared/status.md`.
4. Verify artifacts for that stage already exist.
5. Resume from the first incomplete artifact or approval gate.

## Artifact Expectations by Stage

### Stage 1

- Requirement folder exists.
- `requirement.md` exists.
- At least one diagram file exists when the requirement involves flows, actors, or system interactions.

### Stage 2

- `technical.md` exists.
- Architecture or sequence diagrams exist if the change affects runtime flows.

### Stage 3

- Code changes are applied.
- Release or helper scripts exist when repeated operational steps are required.

### Stage 4+

- Review notes or verification artifacts exist before advancing.

