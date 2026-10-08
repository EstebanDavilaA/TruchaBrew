# M12_P1 Amendment 1 — Scope Guard Manifests

`pre_amend1_manifest.txt` / `post_amend1_manifest.txt` are the SHA-256 file
manifests for **Amendment 1** ("Category-Specific Inventory Item Details &
Custom Vitals Editing", spec §7, AC-15..AC-21) — captured before and after
that amendment's implementation.

These are distinct from `pre_exec_manifest.json` / `post_exec_manifest.json`
in this same directory, which cover the **base M12_P1 slice** (AC-1..AC-14,
expanded catalog + 4-category InventoryManager + PresetPickerModal +
InventoryForm preset pre-fill) and were captured before Amendment 1 existed.
Do not overwrite either pair.

## Diff summary (pre -> post, excluding the manifest files themselves)

New:
- `apps/api/drizzle/0014_inventory_custom_details.sql`

Modified:
- `apps/api/drizzle/meta/_journal.json`
- `apps/api/src/db/schema.ts`
- `apps/api/src/repositories/inventoryRepository.ts`
- `apps/api/src/routes/schemas.ts`
- `apps/api/test/inventory.migration.test.ts`
- `apps/api/test/inventory.test.ts`
- `apps/api/test/inventoryLedger.migration.test.ts` (collateral: a
  pre-existing pinned `inventory_items` column count, `12`, was stale after
  the additive 0014 migration; updated to `13`)
- `apps/web/src/components/InventoryForm.tsx`
- `apps/web/src/components/InventoryManager.tsx`
- `apps/web/src/components/PresetPickerModal.tsx`
- `apps/web/test/InventoryForm.test.tsx`
- `apps/web/test/InventoryManager.test.tsx`
- `apps/web/test/PresetPickerModal.test.tsx`
- `packages/shared-types/src/inventory.ts`

Every changed file serves Amendment 1's scope (§7.2/§7.3) or is direct
collateral of the additive migration. No file under `packages/calculations/`
or `apps/api/src/routes/{batches,recipes,equipment,schedules}.ts` was
touched, per spec §5.
