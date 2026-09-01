# FEATURE SPECIFICATION: M36_P1 — Full-Database JSON Export & Download

> **Milestone 36:** "Full JSON Database Backup, Restore & Data Portability" (`.gsd/ROADMAP.md`)
> **Phase 1 of 2.** Delivers full-database JSON export capabilities, providing a versioned payload format that bundles all application entities (recipes with line items, batches with readings and notes, equipment profiles, mash profiles with steps, fermentation profiles with steps, water profiles, inventory items with stock levels, and user configuration), a dedicated Fastify endpoint `GET /api/backup/export`, client API integration in `apps/web/src/api/client.ts`, and a dedicated "Database Backup & Export" card in `apps/web/src/components/SettingsManager.tsx` with a single-click download trigger.

---

## Phase Summary

Milestone 36 Phase 1 implements the first half of the backup/restore system by creating a complete, structured JSON export of all database tables:

1. **Universal Database Backup Schema (`packages/shared-types/src/backup.ts` & `index.ts`):**
   - Defines `DatabaseBackup` interface containing:
     - `schemaVersion: 1` (constant for format evolution and backward compatibility).
     - `exportedAt: string` (ISO 8601 UTC timestamp).
     - `appVersion: string` (TruchaBrew semantic version).
     - Entity collections:
       - `recipes: StoredRecipe[]` (with line items: fermentables, hops, yeasts, miscs).
       - `batches: BatchWithReadings[]` (with readings and notes).
       - `equipmentProfiles: EquipmentProfile[]`.
       - `mashProfiles: MashProfileWithSteps[]`.
       - `fermentationProfiles: FermentationProfileWithSteps[]`.
       - `waterProfiles: WaterProfile[]`.
       - `inventoryItems: InventoryItem[]`.
       - `config: UserConfig`.
2. **Fastify Export Route (`apps/api/src/routes/backup.ts` & `server.ts`):**
   - Implements `GET /api/backup/export`.
   - Uses Drizzle ORM repositories to fetch all active entities across all 8 entity families in a read-only transaction or parallel query execution.
   - Sets headers: `Content-Type: application/json`, `Content-Disposition: attachment; filename="truchabrew_backup_YYYY-MM-DD.json"`.
   - Returns 200 with the complete `DatabaseBackup` payload.
3. **Client API Integration (`apps/web/src/api/client.ts`):**
   - Adds `exportDatabaseBackup(): Promise<DatabaseBackup>` and `downloadDatabaseBackup(): Promise<void>` helpers to trigger browser file downloads.
4. **Settings UI Integration (`apps/web/src/components/SettingsManager.tsx`):**
   - Adds a dedicated "Database Backup & Export" card in `SettingsManager.tsx` within the full-width settings grid.
   - Displays database entity summary counters (e.g. "Recipes, Batches, Equipment, Mash & Fermentation Profiles, Inventory, Settings").
   - Includes a single-click `<Button variant="primary" size="sm" data-testid="settings-export-backup-btn">` with download icon and loading state during generation.
5. **Quality Gates & Invariants:**
   - Dedicated integration test `apps/api/test/backup.export.test.ts` asserting 100% entity serialization and schema compliance.
   - Component test in `apps/web/test/SettingsManager.test.tsx` verifying export trigger and error states.

---

## Acceptance Criteria Matrix (22 ACs)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Type Contracts | `packages/shared-types` exports `DatabaseBackup` interface with `schemaVersion: 1`, `exportedAt`, and typed arrays for all 8 entity families. | `shared-types/src/index.ts` & Typecheck |
| **AC-2** | API Route Registration | Fastify registers `GET /api/backup/export` route under `/api/backup`. | `apps/api/src/server.ts` & Route Inspection |
| **AC-3** | Export Recipe Integrity | `GET /api/backup/export` includes all recipes with full line items (fermentables, hops, yeasts, miscs). | `apps/api/test/backup.export.test.ts` |
| **AC-4** | Export Batch Integrity | `GET /api/backup/export` includes all batches with readings, notes, and snapshots. | `apps/api/test/backup.export.test.ts` |
| **AC-5** | Export Equipment Integrity | `GET /api/backup/export` includes all equipment profiles with physical loss and physics fields. | `apps/api/test/backup.export.test.ts` |
| **AC-6** | Export Mash Integrity | `GET /api/backup/export` includes all mash profiles with ordered steps. | `apps/api/test/backup.export.test.ts` |
| **AC-7** | Export Fermentation Integrity | `GET /api/backup/export` includes all fermentation profiles with ordered steps. | `apps/api/test/backup.export.test.ts` |
| **AC-8** | Export Water Profile Integrity | `GET /api/backup/export` includes all water profiles with cation/anion ion concentrations. | `apps/api/test/backup.export.test.ts` |
| **AC-9** | Export Inventory Integrity | `GET /api/backup/export` includes all inventory items with on-hand quantities, units, and categories. | `apps/api/test/backup.export.test.ts` |
| **AC-10** | Export Config Integrity | `GET /api/backup/export` includes user configuration (unit system, gravity/temperature display, formulas). | `apps/api/test/backup.export.test.ts` |
| **AC-11** | Empty Database Export | `GET /api/backup/export` on an empty/cleared database returns empty arrays (`[]`) for collections and default config, not null or 500. | `apps/api/test/backup.export.test.ts` |
| **AC-12** | Client Helper | `apps/web/src/api/client.ts` exports `exportDatabaseBackup()` and `downloadDatabaseBackup()`. | `apps/web/src/api/client.ts` & Unit test |
| **AC-13** | Settings UI Card | `SettingsManager.tsx` renders a "Database Backup & Export" section card with informative description copy using `BODY_TEXT_CLASS`. | `apps/web/test/SettingsManager.test.tsx` |
| **AC-14** | Export Button Primitive | Export trigger renders via `<Button variant="primary" size="sm">` with `data-testid="settings-export-backup-btn"`. | `apps/web/test/SettingsManager.test.tsx` |
| **AC-15** | Download Filename | Download helper sets default filename formatted as `truchabrew_backup_YYYY-MM-DD.json`. | `apps/web/test/SettingsManager.test.tsx` |
| **AC-16** | Error Handling | If export API fails, `SettingsManager.tsx` displays a recoverable error banner without crashing the page. | `apps/web/test/SettingsManager.test.tsx` |
| **AC-17** | UI Guardrail Invariant | Zero raw buttons or inputs added; all controls in new backup card use `components/ui/` primitives. | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-18** | Scope Guardrail | Pre/post SHA-256 manifest verifies only authorized files modified, 0 created in app (except `backup.ts`, `backup.export.test.ts`, and `backup.ts` in shared-types), 0 deleted. | Manifest comparison |
| **AC-19** | Layer 1 Gate: Tests | Full test suite passes without reduction (>= 2,293 tests passing across 122 files). | `npm test` (exit 0) |
| **AC-20** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck with 0 errors. | `npm run typecheck` (exit 0) |
| **AC-21** | Layer 1 Gate: Build | Production client bundle builds cleanly in <1.2s. | `npm run build` (exit 0) |
| **AC-22** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |

---

## Resolved Ambiguities (Binding)

**RA-1 — `DatabaseBackup` Payload Envelope.**
The backup JSON envelope is strictly structured as:
```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-30T17:00:00.000Z",
  "appVersion": "1.0.0",
  "data": {
    "recipes": [],
    "batches": [],
    "equipmentProfiles": [],
    "mashProfiles": [],
    "fermentationProfiles": [],
    "waterProfiles": [],
    "inventoryItems": [],
    "config": {}
  }
}
```

**RA-2 — Read-Only Export Safety.**
`GET /api/backup/export` is strictly non-mutating; it performs read queries and does not alter database state, timestamps, or active dirty flags.

**RA-3 — Browser Download Mechanism.**
The browser initiates the download by creating an ephemeral object URL via `URL.createObjectURL(blob)` and clicking a hidden anchor tag with `download` attribute, revoking the URL immediately after trigger.

---

## Authorized Files to Modify

- `packages/shared-types/src/backup.ts` (NEW)
- `packages/shared-types/src/index.ts`
- `apps/api/src/routes/backup.ts` (NEW)
- `apps/api/src/server.ts`
- `apps/api/test/backup.export.test.ts` (NEW)
- `apps/web/src/api/client.ts`
- `apps/web/src/components/SettingsManager.tsx`
- `apps/web/test/SettingsManager.test.tsx`
- `apps/web/test/uiPrimitives.test.tsx`
- `.gsd/STATE.json`
- `.gsd/ROADMAP.md`

---

## Halt Gate (State 2)

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
