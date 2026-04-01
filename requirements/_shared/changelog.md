# Change Log Specification

Each requirement document may contain a change log section using the following structure:

| Version | Date | Summary | Affected Scope |
| --- | --- | --- | --- |
| v1 | YYYY-MM-DD | Initial requirement analysis | Docs |

## Affected Scope Values

- `Docs`
- `Metadata`
- `Authentication`
- `Workspace UX`
- `Testing`
- `Submission`
- `Packaging`
- `Release`

## Rules

- Every material scope change must add a new row.
- The latest row takes precedence during requirement review.
- If behavior changes, the affected scope must mention the impacted feature area explicitly.

