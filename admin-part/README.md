# Admin part

Administration is a protected, cross-cutting product area, not a separately
deployed application.

- Admin routes and UI belong in `frontend-part/src/app/admin` and
  `frontend-part/src/features/admin`.
- Admin controllers, services, authorization, moderation, and audit logic belong
  in `backend-part/src/modules/admin` and the relevant domain modules.
- Every admin action must be authorized in the backend and sensitive mutations
  must create durable audit records.

Keeping these boundaries inside the two application parts preserves the approved
modular-monolith architecture and avoids a third service with duplicated auth or
business rules.
