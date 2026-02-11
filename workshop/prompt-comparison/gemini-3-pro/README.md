# Scheduled Reports Feature - Planning Documents

This directory contains the planning and architecture documents for the "Scheduled Reports" feature.

## Contents

-   **[PLAN.md](./PLAN.md)**: High-level overview, requirements, and phased implementation plan.
-   **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed system design, database schema, and technical considerations.

## Next Steps

1.  **Review the Plan**: Discuss the proposed architecture with the team.
2.  **Database Migration**: Implement the schema changes outlined in `ARCHITECTURE.md`.
3.  **Backend Setup**: Initialize the scheduler and worker processes.
4.  **Frontend Development**: Build the UI for managing report schedules.

## Open Questions

-   Confirm the initial list of supported report types.
-   Decide on the email service provider (if not already selected).
-   Determine if generated reports should be stored (S3) or ephemeral (email attachments only).

## Contact

For questions regarding this plan, please contact the engineering lead or the author of this document.
