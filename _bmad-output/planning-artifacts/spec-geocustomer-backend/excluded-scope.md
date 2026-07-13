# Explicitly Excluded Scope

Do not add:

- frontend
- authentication
- authorization
- CRUD endpoints (beyond the two specified `GET` endpoints)
- message queues
- event sourcing
- CQRS
- Kubernetes
- cloud deployment
- PostGIS
- external geocoding services
- runtime AI integration

The implementation should remain intentionally small and focused on the project specification — no additional packages, layers, abstractions, or infrastructure beyond what the two source documents require.
