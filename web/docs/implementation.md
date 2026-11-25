# 另有解 implementation plan

**Goal** · Run the responsive text community against PostgreSQL, and make private preview readiness verifiable.

**Design reference** · The V2 prototype in the parent directory.

- [x] Apply versioned authentication and community migrations. Verify ownership, anonymous projections and restricted runtime access in PostgreSQL.
- [x] Connect Better Auth to PostgreSQL. Add signup, verification, sign-in, sign-out and recovery with invited registration.
- [x] Build the public, account and moderator pages using the original responsive layout.
- [x] Complete desktop and mobile browser acceptance against the production build.
- [ ] Confirm preview provider access and protection before deployment. See the README for configuration.
