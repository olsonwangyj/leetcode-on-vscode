# Requirement Status Specification

All statuses in `requirements/index.md` must be written in English.

## Allowed Status Values

- `AnalysisInProgress`
- `AnalysisPendingApproval`
- `TechnicalDesignInProgress`
- `TechnicalDesignPendingApproval`
- `CodingInProgress`
- `SecurityReviewInProgress`
- `CleanupPendingApproval`
- `RequirementReviewInProgress`
- `VerificationInProgress`
- `Completed`
- `Blocked`

## Stage Mapping

| Status | Stage |
| --- | --- |
| AnalysisInProgress | Stage 1: Requirement Analysis |
| AnalysisPendingApproval | Stage 1: Requirement Analysis |
| TechnicalDesignInProgress | Stage 2: Technical Design |
| TechnicalDesignPendingApproval | Stage 2: Technical Design |
| CodingInProgress | Stage 3: Coding |
| SecurityReviewInProgress | Stage 4: Security Review |
| CleanupPendingApproval | Stage 5: Code Cleanup |
| RequirementReviewInProgress | Stage 6: Requirement Review |
| VerificationInProgress | Stage 7: Verification |
| Completed | Stage 8: Archive |
| Blocked | Resume from the last incomplete stage |

## Index Update Rules

- `index.md` must remain in English.
- Each REQ row must include: `REQ ID`, `Title`, `Status`, `Owner`, `Created`, `Updated`, and `Notes`.
- `Updated` must be refreshed every time the requirement status changes.
- When a requirement is resumed, keep the same `REQ ID` and update only status and notes.

