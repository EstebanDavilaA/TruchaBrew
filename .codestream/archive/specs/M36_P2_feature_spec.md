# FEATURE SPECIFICATION: M36_P2 — Database JSON Restore, Validation & Conflict Resolution

> **Milestone 36:** "Full JSON Database Backup, Restore & Data Portability" (`.gsd/ROADMAP.md`)
> **Phase 2 of 2 (Milestone Closure).** Delivers full-database JSON restore capabilities, providing pre-flight schema validation, transactional database restoration (`POST /api/backup/restore`) with both `replace` and `merge` conflict resolution strategies, drag-and-drop file upload in `SettingsManager.tsx`, an accessible `BackupRestoreModal.tsx` confirmation dialog with entity count previews and mode selection, client API integration, and closing milestone quality gates.

---

## Phase Summary

Milestone 36 Phase 1 implemented full-database JSON export. Phase 2 now completes the database portability system with comprehensive restoration:

1. **Restore Schema & Validation Contracts (`packages/shared-types/src/backup.ts` & `index.ts`):**
   - Exports `RestoreMode = 'replace' | 'merge'`.
   - Exports `RestoreRequest` interface (`{ backup: DatabaseBackup; mode: RestoreMode }`).
   - Exports `RestoreSummary` interface (`{ restoredAt: string; mode: RestoreMode; counts: EntityCounts }`).
   - Implements payload structure and version compatibility verification.
2. **Fastify Transactional Restore Route (`apps/api/src/routes/backup.ts`):**
   - Implements `POST /api/backup/restore`.
   - Executes inside a SQLite transaction (`db.transaction()`) to guarantee strict atomicity (if any insertion fails, the entire database rolls back cleanly without partial corruption).
   - **Mode `replace`:** Wipes active user rows in correct foreign-key dependency order (readings $\to$ notes $\to$ deductions $\to$ batches $\to$ line items $\to$ recipes $\to$ steps $\to$ mash/fermentation profiles $\to$ equipment $\to$ water $\to$ inventory) and inserts all incoming entities.
   - **Mode `merge`:** Inserts incoming entities, generating fresh IDs when collisions occur or skipping duplicates, preserving foreign-key references.
   - Updates user configuration if present in backup.
   - Returns 200 with the `RestoreSummary`.
3. **Client API Integration (`apps/web/src/api/client.ts`):**
   - Adds `restoreDatabaseBackup(req: RestoreRequest): Promise<RestoreSummary>`.
4. **Accessible Restore UI & Modal (`apps/web/src/components/BackupRestoreModal.tsx` & `SettingsManager.tsx`):**
   - Adds a drag-and-drop JSON file upload dropzone in `SettingsManager.tsx` alongside the Export button.
   - Dropping or selecting a `.json` file parses and validates the payload and opens `BackupRestoreModal.tsx`.
   - `BackupRestoreModal.tsx`:
     - Displays backup metadata: Exported timestamp, App version, Schema version.
     - Previews entity count grid (e.g. "12 Recipes, 5 Batches, 3 Equipment Profiles, 24 Inventory Items").
     - Provides mode selection:
       - **Replace Database (Destructive):** Replaces current database with backup contents (includes explicit warning badge).
       - **Merge into Database (Additive):** Merges items alongside existing data.
     - Features `<Button variant="primary" size="sm">` trigger with loading state and error handling.
5. **Quality Gates & Invariants:**
   - Transactional integration test `apps/api/test/backup.restore.test.ts` verifying replace, merge, rollback on error, and foreign-key integrity.
   - UI tests in `apps/web/test/BackupRestoreModal.test.tsx` and `apps/web/test/SettingsManager.test.tsx`.

---

## Acceptance Criteria Matrix (24 ACs)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Type Contracts | `packages/shared-types` exports `RestoreMode`, `RestoreRequest`, `RestoreSummary`, and `EntityCounts` types. | `shared-types/src/index.ts` & Typecheck |
| **AC-2** | API Route Registration | Fastify registers `POST /api/backup/restore` route. | `apps/api/src/server.ts` & Route Inspection |
| **AC-3** | Replace Mode Restore | `POST /api/backup/restore` with `mode: 'replace'` wipes existing user data and inserts all entities from backup. | `apps/api/test/backup.restore.test.ts` |
| **AC-4** | Merge Mode Restore | `POST /api/backup/restore` with `mode: 'merge'` retains existing records and appends incoming entities with collision resolution. | `apps/api/test/backup.restore.test.ts` |
| **AC-5** | Atomic Transaction | If any entity fails schema validation or DB constraint, the transaction rolls back 100% leaving existing data untouched. | `apps/api/test/backup.restore.test.ts` |
| **AC-6** | Recipe & Line Items Restore | Restored recipes include complete fermentables, hops, yeasts, and miscs with intact FK references. | `apps/api/test/backup.restore.test.ts` |
| **AC-7** | Batch & Readings Restore | Restored batches retain complete readings, notes, and recipe/equipment snapshot references. | `apps/api/test/backup.restore.test.ts` |
| **AC-8** | Profiles & Steps Restore | Restored mash and fermentation profiles retain ordered steps with intact positions. | `apps/api/test/backup.restore.test.ts` |
| **AC-9** | Inventory & Water Restore | Restored inventory items and water profiles retain on-hand quantities and ion concentrations. | `apps/api/test/backup.restore.test.ts` |
| **AC-10** | User Config Restore | User configuration (unit system, gravity/temperature display, formulas) is updated to match backup. | `apps/api/test/backup.restore.test.ts` |
| **AC-11** | Invalid Schema Rejection | Malformed JSON or payloads with invalid `schemaVersion` return 400 Bad Request with descriptive error details. | `apps/api/test/backup.restore.test.ts` |
| **AC-12** | Client Restore Helper | `apps/web/src/api/client.ts` exports `restoreDatabaseBackup()`. | `apps/web/src/api/client.ts` & Unit test |
| **AC-13** | Settings Dropzone UI | `SettingsManager.tsx` renders a drag-and-drop upload zone for `.json` backup files with `data-testid="settings-restore-dropzone"`. | `apps/web/test/SettingsManager.test.tsx` |
| **AC-14** | Restore Modal Launch | Selecting or dropping a valid backup file opens `BackupRestoreModal.tsx` (`data-testid="backup-restore-modal"`). | `apps/web/test/BackupRestoreModal.test.tsx` |
| **AC-15** | Entity Count Previews | Modal renders preview badges/tiles with entity counts for recipes, batches, profiles, and inventory. | `apps/web/test/BackupRestoreModal.test.tsx` |
| **AC-16** | Mode Selection | Modal provides selectable options for Replace vs Merge modes with clear warning text for Replace. | `apps/web/test/BackupRestoreModal.test.tsx` |
| **AC-17** | Confirmation & Execution | Clicking Confirm Restore executes the restore, displays progress spinner, and closes modal on success. | `apps/web/test/BackupRestoreModal.test.tsx` |
| **AC-18** | UI Error Banner | If restore API fails, modal displays an accessible error message without dismissing or corrupting state. | `apps/web/test/BackupRestoreModal.test.tsx` |
| **AC-19** | Primitive Adherence | `BackupRestoreModal.tsx` and Settings dropzone exclusively use `components/ui/` primitives (0 raw buttons/inputs). | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-20** | Scope Guardrail | Pre/post SHA-256 manifest verifies only authorized files modified, 0 created in app (except `BackupRestoreModal.tsx`, `backup.restore.test.ts`, `BackupRestoreModal.test.tsx`), 0 deleted. | Manifest comparison |
| **AC-21** | Layer 1 Gate: Tests | Full test suite passes without reduction (>= 2,317 tests passing across 123 files). | `npm test` (exit 0) |
| **AC-22** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck with 0 errors. | `npm run typecheck` (exit 0) |
| **AC-23** | Layer 1 Gate: Build | Production client bundle builds cleanly in <1.2s. | `npm run build` (exit 0) |
| **AC-24** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |

---

## Resolved Ambiguities (Binding)

**RA-1 — Transaction Safety & Foreign Keys.**
Restore operations in SQLite must clear child tables in strict reverse-dependency order:
1. `batch_readings`, `batch_notes`, `inventory_deductions`
2. `batches`
3. `recipe_fermentables`, `recipe_hops`, `recipe_yeasts`, `recipe_miscs`
4. `recipes`
5. `mash_steps`, `mash_profiles`
6. `fermentation_steps`, `fermentation_profiles`
7. `equipment_profiles`
8. `water_profiles`
9. `inventory_items`
10. `user_config`

**RA-2 — Replace Mode vs Merge Mode.**
- In **Replace Mode**: Table contents are fully cleared before inserting the backup entities verbatim with original IDs.
- In **Merge Mode**: Existing database records are preserved. Incoming entities with existing matching IDs receive a newly generated UUIDv4 to avoid primary key conflicts.

**RA-3 — Reload / Re-sync After Restore.**
Upon successful restore, the web application invalidates client caches and triggers a route reload / re-fetch so all open views immediately reflect the restored state.

---

## Authorized Files to Modify

- `packages/shared-types/src/backup.ts`
- `packages/shared-types/src/index.ts`
- `apps/api/src/routes/backup.ts`
- `apps/api/test/backup.restore.test.ts` (NEW)
- `apps/web/src/api/client.ts`
- `apps/web/src/components/BackupRestoreModal.tsx` (NEW)
- `apps/web/src/components/SettingsManager.tsx`
- `apps/web/test/BackupRestoreModal.test.tsx` (NEW)
- `apps/web/test/SettingsManager.test.tsx`
- `apps/web/test/uiPrimitives.test.tsx`
- `.gsd/STATE.json`

---

## Halt Gate (State 2)

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
