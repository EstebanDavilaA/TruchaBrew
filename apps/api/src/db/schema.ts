import { sqliteTable, text, real, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Equipment profiles
// ---------------------------------------------------------------------------

export const equipmentProfiles = sqliteTable('equipment_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  batchSizeL: real('batch_size_l').notNull(),
  boilTimeMin: real('boil_time_min').notNull(),
  brewhouseEfficiencyPct: real('brewhouse_efficiency_pct').notNull(),
  mashEfficiencyPct: real('mash_efficiency_pct').notNull(),
  boilOffRateLPerHour: real('boil_off_rate_l_per_hour').notNull(),
  trubChillerLossL: real('trub_chiller_loss_l').notNull(),
  hopUtilizationPct: real('hop_utilization_pct').notNull(),
  derivedFromEquipmentId: text('derived_from_equipment_id').references((): any => equipmentProfiles.id, {
    onDelete: 'set null',
  }),
  isSeed: integer('is_seed').notNull().default(0),
  // NEW in M3 — every new column is an additive ALTER TABLE ADD COLUMN with a
  // constant default equal to the retired brewhouse constant it replaces (or,
  // for the four brand-new fields, the documented brewhouse default). See
  // M3_P1 spec §1.2.
  mashWaterRatioLPerKg: real('mash_water_ratio_l_per_kg').notNull().default(3.0),
  grainAbsorptionLPerKg: real('grain_absorption_l_per_kg').notNull().default(0.96),
  hopstandUtilizationFactor: real('hopstand_utilization_factor').notNull().default(0.26),
  hopstandTemperatureC: real('hopstand_temperature_c').notNull().default(79.0),
  spargeTemperatureC: real('sparge_temperature_c').notNull().default(76.0),
  mashTunHeatCapacityL: real('mash_tun_heat_capacity_l').notNull().default(0.0),
  grainTemperatureC: real('grain_temperature_c').notNull().default(20.0),
  notes: text('notes').notNull().default(''),
  // NEW in M11_P1 — Physics & loss modeling
  altitudeMeters: real('altitude_meters').notNull().default(0.0),
  calcStrikeWithThermalMass: integer('calc_strike_with_thermal_mass').notNull().default(0),
  mashTunDeadSpaceL: real('mash_tun_dead_space_l').notNull().default(0.0),
  kettleLossL: real('kettle_loss_l').notNull().default(0.0),
  mashTunWeightKg: real('mash_tun_weight_kg').notNull().default(0.0),
  mashTunHeatCapacity: real('mash_tun_heat_capacity').notNull().default(0.12),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// Mash profiles
// ---------------------------------------------------------------------------

export const mashProfiles = sqliteTable('mash_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetPh: real('target_ph').notNull().default(5.4),
  spargeTempC: real('sparge_temp_c'), // NULL means inherit equipment.spargeTemperatureC
  isSeed: integer('is_seed').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mashSteps = sqliteTable(
  'mash_steps',
  {
    id: text('id').primaryKey(),
    mashProfileId: text('mash_profile_id')
      .notNull()
      .references(() => mashProfiles.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'Infusion' | 'Decoction' | 'Temperature'
    stepTempC: real('step_temp_c').notNull(),
    stepTimeMin: real('step_time_min').notNull(),
    rampTimeMin: real('ramp_time_min').notNull(),
    infuseAmountL: real('infuse_amount_l'), // NULL means compute
    infuseWaterTempC: real('infuse_water_temp_c').notNull().default(100.0),
  },
  (table) => ({
    profileIdIdx: index('mash_steps_profile_id_idx').on(table.mashProfileId),
    profilePositionUq: uniqueIndex('mash_steps_profile_position_uq').on(table.mashProfileId, table.position),
  }),
);

// ---------------------------------------------------------------------------
// Fermentation profiles
// ---------------------------------------------------------------------------

export const fermentationProfiles = sqliteTable('fermentation_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isSeed: integer('is_seed').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const fermentationSteps = sqliteTable(
  'fermentation_steps',
  {
    id: text('id').primaryKey(),
    fermentationProfileId: text('fermentation_profile_id')
      .notNull()
      .references(() => fermentationProfiles.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'Primary' | 'Secondary' | 'Tertiary' | 'ColdCrash' | 'Carbonation' | 'Conditioning'
    stepTempC: real('step_temp_c').notNull(),
    stepTimeDays: real('step_time_days').notNull(),
    rampDays: real('ramp_days').notNull(),
    pressurePsi: real('pressure_psi'), // NULL allowed
  },
  (table) => ({
    profileIdIdx: index('fermentation_steps_profile_id_idx').on(table.fermentationProfileId),
    profilePositionUq: uniqueIndex('fermentation_steps_profile_position_uq').on(table.fermentationProfileId, table.position),
  }),
);

// ---------------------------------------------------------------------------
// Water profiles (M6)
// ---------------------------------------------------------------------------

export const waterProfiles = sqliteTable('water_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'source' | 'target'
  calcium: real('calcium').notNull().default(0),
  magnesium: real('magnesium').notNull().default(0),
  sodium: real('sodium').notNull().default(0),
  chloride: real('chloride').notNull().default(0),
  sulfate: real('sulfate').notNull().default(0),
  bicarbonate: real('bicarbonate').notNull().default(0),
  ph: real('ph'),
  description: text('description'),
  isSeed: integer('is_seed').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    author: text('author').notNull().default(''),
    styleName: text('style_name').notNull().default(''),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipmentProfiles.id, { onDelete: 'restrict' }),
    notes: text('notes').notNull().default(''),
    // NEW in M3_P2 — both nullable, no default, ON DELETE SET NULL is a
    // schema-level backstop the API never reaches (DELETE checks references
    // first and returns 409 PROFILE_IN_USE instead). See M3_P2 spec §1.2.
    mashProfileId: text('mash_profile_id').references(() => mashProfiles.id, { onDelete: 'set null' }),
    fermentationProfileId: text('fermentation_profile_id').references(() => fermentationProfiles.id, { onDelete: 'set null' }),
    // NEW in M6 — both nullable, no default. ON DELETE SET NULL is the same
    // schema-level backstop (the API checks references and returns 409
    // WATER_PROFILE_IN_USE before this edge is reached).
    waterSourceId: text('water_source_id').references(() => waterProfiles.id, { onDelete: 'set null' }),
    waterTargetId: text('water_target_id').references(() => waterProfiles.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({ nameIdx: index('recipes_name_idx').on(table.name) }),
);

// ---------------------------------------------------------------------------
// Line-item tables
// ---------------------------------------------------------------------------

export const recipeFermentables = sqliteTable(
  'recipe_fermentables',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    amountKg: real('amount_kg').notNull(),
    colorSrm: real('color_srm').notNull(),
    potentialSg: real('potential_sg').notNull(),
    notes: text('notes'),
  },
  (table) => ({
    recipeIdIdx: index('recipe_fermentables_recipe_id_idx').on(table.recipeId),
    recipePositionUq: uniqueIndex('recipe_fermentables_recipe_position_uq').on(table.recipeId, table.position),
  }),
);

export const recipeHops = sqliteTable(
  'recipe_hops',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    amountG: real('amount_g').notNull(),
    alphaAcidPct: real('alpha_acid_pct').notNull(),
    use: text('use').notNull(),
    boilMins: real('boil_mins'),
    whirlpoolMins: real('whirlpool_mins'),
    whirlpoolTempC: real('whirlpool_temp_c'),
    type: text('type').notNull(),
    // Restored by migration 0005, nullable. DryHop-only per the M4_P1 spec
    // amendment (option b): meaningful iff use === 'DryHop', null for every
    // other use. See @truchabrew/shared-types HopItem.timeMinutes.
    timeMinutes: real('time_minutes'),
    // NEW in M11_P1 — Domain-specific hop timing
    dryHopDayOffset: integer('dry_hop_day_offset'),
    dryHopDurationDays: real('dry_hop_duration_days'),
  },
  (table) => ({
    recipeIdIdx: index('recipe_hops_recipe_id_idx').on(table.recipeId),
    recipePositionUq: uniqueIndex('recipe_hops_recipe_position_uq').on(table.recipeId, table.position),
  }),
);

export const recipeYeasts = sqliteTable(
  'recipe_yeasts',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    form: text('form').notNull(),
    laboratory: text('laboratory').notNull(),
    attenuationPct: real('attenuation_pct').notNull(),
    amountPkg: real('amount_pkg').notNull(),
  },
  (table) => ({
    recipeIdIdx: index('recipe_yeasts_recipe_id_idx').on(table.recipeId),
    recipePositionUq: uniqueIndex('recipe_yeasts_recipe_position_uq').on(table.recipeId, table.position),
  }),
);

export const recipeMiscs = sqliteTable(
  'recipe_miscs',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    use: text('use').notNull(),
    timeMinutes: real('time_minutes').notNull(),
    amount: real('amount').notNull(),
    unit: text('unit').notNull(),
    notes: text('notes'),
  },
  (table) => ({
    recipeIdIdx: index('recipe_miscs_recipe_id_idx').on(table.recipeId),
    recipePositionUq: uniqueIndex('recipe_miscs_recipe_position_uq').on(table.recipeId, table.position),
  }),
);

// ---------------------------------------------------------------------------
// Catalog tables
// ---------------------------------------------------------------------------

export const catalogFermentables = sqliteTable('catalog_fermentables', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  colorSrm: real('color_srm').notNull(),
  potentialSg: real('potential_sg').notNull(),
});

export const catalogHops = sqliteTable('catalog_hops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  alphaAcidPct: real('alpha_acid_pct').notNull(),
  type: text('type').notNull(),
});

export const catalogYeasts = sqliteTable('catalog_yeasts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  laboratory: text('laboratory').notNull(),
  type: text('type').notNull(),
  form: text('form').notNull(),
  attenuationPct: real('attenuation_pct').notNull(),
});

export const catalogMiscs = sqliteTable('catalog_miscs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  defaultUse: text('default_use').notNull(),
  defaultUnit: text('default_unit').notNull(),
});

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export const batches = sqliteTable(
  'batches',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    batchNo: integer('batch_no').notNull(),
    // NEW in migration 0015 (M19_P1 spec §1.1/§2.2), nullable, client-writable
    // through BatchWriteInput.
    brewer: text('brewer'),
    brewDate: text('brew_date'),
    status: text('status').notNull(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'restrict' }),
    recipeSnapshot: text('recipe_snapshot', { mode: 'json' }).notNull(),
    // NEW in migration 0006, nullable. Computed once at batch creation from
    // the same frozen `recipeSnapshot` and never touched again (see
    // batchRepository.update()). NULL only for batch rows created before
    // 0006 shipped; the API/UI fall back to a labelled live recompute for
    // those. See M4_P1 spec AC-12.
    statsSnapshot: text('stats_snapshot', { mode: 'json' }),
    measuredPreBoilGravity: real('measured_pre_boil_gravity'),
    measuredMashPh: real('measured_mash_ph'),
    measuredBoilSizeL: real('measured_boil_size_l'),
    measuredBoilTimeMin: real('measured_boil_time_min'),
    // NEW in migration 0007, nullable, client-writable through
    // BatchWriteInput. OG measured at pitch (M5_P1 spec §1.2/§4 deviation 3).
    measuredOg: real('measured_og'),
    // NEW in migration 0007, nullable, SERVER-OWNED and write-once — set by
    // the route to the transition's own `now` iff the request transitions a
    // batch whose stored value is null into status 'Fermenting'. Never
    // accepted from the client (see the preValidation hook in
    // routes/batches.ts). See M5_P1 spec Resolved Ambiguities.
    fermentationStartDate: text('fermentation_start_date'),
    // NEW in migration 0008 (M5_P2 spec §1.2) — nine columns, additive only.
    measuredFg: real('measured_fg'),
    measuredBottlingSizeL: real('measured_bottling_size_l'),
    carbonationType: text('carbonation_type'),
    carbonationVolumesTarget: real('carbonation_volumes_target'),
    carbonationTempC: real('carbonation_temp_c'),
    tasteNotes: text('taste_notes').notNull().default(''),
    tasteRating: integer('taste_rating'),
    // SERVER-OWNED, write-once at first 'Conditioning' — mirrors
    // fermentationStartDate exactly.
    bottlingDate: text('bottling_date'),
    // SERVER-OWNED, frozen at 'Completed'. JSON-mode column carrying a
    // ClosingSnapshot; see packages/calculations/src/batchClosing.ts.
    closingSnapshot: text('closing_snapshot', { mode: 'json' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    recipeIdIdx: index('batches_recipe_id_idx').on(table.recipeId),
  }),
);

// ---------------------------------------------------------------------------
// Batch readings (M5_P1)
// ---------------------------------------------------------------------------

// A reading is an immutable-in-shape, append-oriented log entry, not a
// positional child row — deliberately NO `position` column: order is derived
// from `reading_time` (see packages/calculations/src/fermentation.ts's
// sortReadings), and a dense 0-based position would be meaningless for a log
// whose entries arrive at arbitrary real times and can be back-dated. No
// UNIQUE index either — unlike mash_steps, two readings on one batch may
// legitimately share a reading_time (M5_P1 spec §1.2, Resolved Ambiguities).
export const batchReadings = sqliteTable(
  'batch_readings',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    readingTime: text('reading_time').notNull(),
    sg: real('sg'),
    tempC: real('temp_c'),
    comment: text('comment').notNull().default(''),
    ph: real('ph'),
    pressurePsi: real('pressure_psi'),
  },
  (table) => ({
    batchIdIdx: index('batch_readings_batch_id_idx').on(table.batchId),
    batchTimeIdx: index('batch_readings_batch_time_idx').on(table.batchId, table.readingTime),
  }),
);

// ---------------------------------------------------------------------------
// User config (M7_P1) — single-row table, primary key fixed to 'default'.
// Storage stays canonical metric/SG (see M7_P1 spec Key Behavior 1); this
// table only records DISPLAY/FORMULA preferences, never a converted value.
// ---------------------------------------------------------------------------

export const userConfig = sqliteTable('user_config', {
  id: text('id').primaryKey().default('default'),
  unitSystem: text('unit_system').notNull().default('metric'),
  gravityUnit: text('gravity_unit').notNull().default('sg'),
  temperatureUnit: text('temperature_unit').notNull().default('celsius'),
  ibuFormula: text('ibu_formula').notNull().default('tinseth'),
  abvFormula: text('abv_formula').notNull().default('simple'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// Batch notes (M5_P2)
// ---------------------------------------------------------------------------

// timestamp and status are both server-minted at creation and never rewritten
// (M5_P2 spec §1.2). No `position` column and no UNIQUE index — same
// reasoning as batch_readings.
export const batchNotes = sqliteTable(
  'batch_notes',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    timestamp: text('timestamp').notNull(),
    status: text('status').notNull(),
    note: text('note').notNull(),
  },
  (table) => ({
    batchIdIdx: index('batch_notes_batch_id_idx').on(table.batchId),
    batchTimeIdx: index('batch_notes_batch_time_idx').on(table.batchId, table.timestamp),
  }),
);

// ---------------------------------------------------------------------------
// Inventory (M9_P1). category/unit enums are enforced at the HTTP boundary,
// not by SQLite CHECK (repo-wide convention). `quantity` has NO lower bound —
// negative stock is legal, flagged by isOutOfStock/isNegativeStock at the
// calculation layer, never rejected or clamped here. (category, name_key) is
// UNIQUE — at most one row per normalized name within a category, which is
// what makes the M9_P1 stock-check matcher a lookup rather than a heuristic.
// ---------------------------------------------------------------------------

export const inventoryItems = sqliteTable(
  'inventory_items',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    costPerUnit: real('cost_per_unit'),
    purchaseDate: text('purchase_date'),
    expiryDate: text('expiry_date'),
    notes: text('notes').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    // NEW in migration 0014 (M12_P1 Amendment 1) — nullable, JSON-mode.
    // Category-specific vitals (alpha acid %, potential SG, attenuation %,
    // lot number, etc.) that vary per lot/purchase rather than per catalog
    // preset. Absent (null) for every row created before 0014. See
    // @truchabrew/shared-types InventoryCustomDetails.
    customDetails: text('custom_details', { mode: 'json' }),
  },
  (table) => ({
    categoryNameKeyUq: uniqueIndex('inventory_items_category_name_key_uq').on(table.category, table.nameKey),
    categoryIdx: index('inventory_items_category_idx').on(table.category),
  }),
);

// ---------------------------------------------------------------------------
// Inventory transactions (M9_P2) — the append-only deduction ledger. No
// UPDATE and no DELETE against this table anywhere in the codebase (AC-31).
// No foreign keys, deliberately — the denormalized category/display_name/
// name_key columns are what keep a closed batch's cost breakdown readable
// after its inventory row is deleted (Key Behavior 6). `reverses_transaction_id`
// carries a UNIQUE index so a double-reversal is structurally impossible
// (SQLite permits unlimited NULLs in a unique index, so deduction rows,
// which are always NULL there, are unconstrained by it).
// ---------------------------------------------------------------------------

export const inventoryTransactions = sqliteTable(
  'inventory_transactions',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id').notNull(),
    inventoryItemId: text('inventory_item_id').notNull(),
    kind: text('kind').notNull(), // 'deduction' | 'reversal' — enforced at the HTTP boundary
    reversesTransactionId: text('reverses_transaction_id'), // non-null IFF kind = 'reversal'
    category: text('category').notNull(),
    displayName: text('display_name').notNull(),
    nameKey: text('name_key').notNull(),
    amount: real('amount').notNull(), // positive magnitude
    unit: text('unit').notNull(),
    costPerUnit: real('cost_per_unit'), // nullable; frozen at deduction
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    batchIdx: index('inventory_transactions_batch_idx').on(table.batchId),
    itemIdx: index('inventory_transactions_item_idx').on(table.inventoryItemId),
    reversesUq: uniqueIndex('inventory_transactions_reverses_uq').on(table.reversesTransactionId),
  }),
);

