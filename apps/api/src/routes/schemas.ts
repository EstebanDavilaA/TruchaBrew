// Fastify JSON-Schema (ajv) validation for the HTTP boundary. Enums are
// validated here, not by SQLite CHECK constraints, per spec §1.2.
import { BATCH_STATUSES, CARBONATION_TYPES, INVENTORY_CATEGORIES, CANONICAL_INVENTORY_UNIT, MISC_INVENTORY_UNITS, LEDGER_KINDS } from '@truchabrew/calculations';

const fermentableTypeEnum = ['Grain', 'Sugar', 'LiquidExtract', 'DryExtract', 'Adjunct'];
const hopUseEnum = ['Boil', 'DryHop', 'FirstWort', 'Aroma', 'Whirlpool'];
const hopTypeEnum = ['Pellet', 'Leaf', 'Cryo'];
const yeastTypeEnum = ['Ale', 'Lager', 'Hybrid', 'Wheat'];
const yeastFormEnum = ['Dry', 'Liquid'];
const miscTypeEnum = ['Spice', 'Fining', 'WaterAgent', 'Herb', 'Flavor', 'Other'];
const miscUseEnum = ['Mash', 'Boil', 'Whirlpool', 'Primary', 'Secondary', 'Bottling'];
const miscUnitEnum = ['g', 'ml', 'tsp', 'tbsp', 'each'];

const fermentableInputSchema = {
  type: 'object',
  required: ['name', 'type', 'amountKg', 'colorSrm', 'potentialSg'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: fermentableTypeEnum },
    amountKg: { type: 'number' },
    colorSrm: { type: 'number' },
    potentialSg: { type: 'number' },
    notes: { type: 'string' },
  },
};

const hopInputSchema = {
  type: 'object',
  required: ['name', 'amountG', 'alphaAcidPct', 'use', 'type'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    amountG: { type: 'number' },
    alphaAcidPct: { type: 'number' },
    use: { type: 'string', enum: hopUseEnum },
    boilMins: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    whirlpoolMins: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    whirlpoolTempC: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    type: { type: 'string', enum: hopTypeEnum },
    // DryHop-only (M4_P1 spec, Resolved Ambiguities) — optional so the
    // Boil/FirstWort/Whirlpool/Aroma line items that never carry a value
    // don't need one. Not in `required`.
    timeMinutes: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    dryHopDayOffset: { anyOf: [{ type: 'null' }, { type: 'integer' }] },
    dryHopDurationDays: { anyOf: [{ type: 'null' }, { type: 'number' }] },
  },
};

const yeastInputSchema = {
  type: 'object',
  required: ['name', 'type', 'form', 'laboratory', 'attenuationPct', 'amountPkg'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: yeastTypeEnum },
    form: { type: 'string', enum: yeastFormEnum },
    laboratory: { type: 'string' },
    attenuationPct: { type: 'number' },
    amountPkg: { type: 'number' },
  },
};

const miscInputSchema = {
  type: 'object',
  required: ['name', 'type', 'use', 'timeMinutes', 'amount', 'unit'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: miscTypeEnum },
    use: { type: 'string', enum: miscUseEnum },
    timeMinutes: { type: 'number' },
    amount: { type: 'number' },
    unit: { type: 'string', enum: miscUnitEnum },
    notes: { type: 'string' },
  },
};

export const recipeWriteBodySchema = {
  type: 'object',
  required: [
    'name',
    'author',
    'styleName',
    'notes',
    'equipmentId',
    'fermentables',
    'hops',
    'yeasts',
    'miscs',
    'mashProfileId',
    'fermentationProfileId',
    'waterSourceId',
    'waterTargetId',
  ],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1 },
    author: { type: 'string' },
    styleName: { type: 'string' },
    notes: { type: 'string' },
    equipmentId: { type: 'string', minLength: 1 },
    fermentables: { type: 'array', items: fermentableInputSchema },
    hops: { type: 'array', items: hopInputSchema },
    yeasts: { type: 'array', items: yeastInputSchema },
    miscs: { type: 'array', items: miscInputSchema },
    // Required keys, nullable values — an omitted key is 400 VALIDATION_FAILED,
    // never a silent null (M3_P2 spec §1.3). Existence of a non-null id is
    // checked by the route/repository before anything is written.
    mashProfileId: { type: ['string', 'null'] },
    fermentationProfileId: { type: ['string', 'null'] },
    // NEW in M6 — same pattern as mashProfileId/fermentationProfileId.
    waterSourceId: { type: ['string', 'null'] },
    waterTargetId: { type: ['string', 'null'] },
  },
};

export const recipePatchNameBodySchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1 },
  },
};

// Boundary operators exactly as specified (M3_P1 spec, Resolved Ambiguities):
// inclusive bounds use minimum/maximum; `> 0` uses exclusiveMinimum, never a
// minimum + epsilon trick. Enforced identically here and by the web form.
// `equipmentCreateBodySchema` and `equipmentUpdateBodySchema` share every
// property definition below except `derivedFromEquipmentId`, which only the
// create schema accepts (server-owned on update — see AC-22).
const equipmentMutableRequired = [
  'name',
  'batchSizeL',
  'boilTimeMin',
  'brewhouseEfficiencyPct',
  'mashEfficiencyPct',
  'boilOffRateLPerHour',
  'trubChillerLossL',
  'hopUtilizationPct',
  'mashWaterRatioLPerKg',
  'grainAbsorptionLPerKg',
  'hopstandUtilizationFactor',
  'hopstandTemperatureC',
  'spargeTemperatureC',
  'mashTunHeatCapacityL',
  'grainTemperatureC',
  'notes',
];

const equipmentMutableProperties = {
  name: { type: 'string', minLength: 1, pattern: '\\S' }, // rejects "" and whitespace-only
  batchSizeL: { type: 'number', exclusiveMinimum: 0 },
  boilTimeMin: { type: 'number', minimum: 0, maximum: 600 },
  brewhouseEfficiencyPct: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
  mashEfficiencyPct: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
  boilOffRateLPerHour: { type: 'number' },
  trubChillerLossL: { type: 'number' },
  hopUtilizationPct: { type: 'number', minimum: 0, maximum: 200 },
  mashWaterRatioLPerKg: { type: 'number', exclusiveMinimum: 0, maximum: 10 },
  grainAbsorptionLPerKg: { type: 'number', minimum: 0, maximum: 5 },
  hopstandUtilizationFactor: { type: 'number', minimum: 0, maximum: 1 },
  hopstandTemperatureC: { type: 'number', minimum: 0, maximum: 100 },
  spargeTemperatureC: { type: 'number', minimum: 0, maximum: 100 },
  mashTunHeatCapacityL: { type: 'number', minimum: 0, maximum: 50 },
  grainTemperatureC: { type: 'number', minimum: -20, maximum: 50 },
  notes: { type: 'string' },
  altitudeMeters: { type: 'number', minimum: -500, maximum: 9000 },
  calcStrikeWithThermalMass: { type: 'boolean' },
  mashTunDeadSpaceL: { type: 'number', minimum: 0, maximum: 500 },
  kettleLossL: { type: 'number', minimum: 0, maximum: 500 },
  mashTunWeightKg: { type: 'number', minimum: 0, maximum: 500 },
  mashTunHeatCapacity: { type: 'number', minimum: 0, maximum: 5 },
};

export const equipmentCreateBodySchema = {
  type: 'object',
  required: [...equipmentMutableRequired, 'derivedFromEquipmentId'],
  additionalProperties: false,
  properties: {
    ...equipmentMutableProperties,
    derivedFromEquipmentId: { type: ['string', 'null'] },
  },
};

// Omits `id` (path parameter) and `derivedFromEquipmentId` (server-owned —
// provenance is not user-editable). Note: `additionalProperties: false` alone does
// NOT reject an unrecognised property here — Fastify's default `removeAdditional:
// true` silently strips it instead, so a `derivedFromEquipmentId` in the body would
// otherwise vanish quietly and the PUT would still succeed. The 400 VALIDATION_FAILED
// required by AC-22 comes from the PUT route's `preValidation` hook (equipment.ts),
// which inspects the raw body before this schema strips anything.
export const equipmentUpdateBodySchema = {
  type: 'object',
  required: equipmentMutableRequired,
  additionalProperties: false,
  properties: equipmentMutableProperties,
};

// ---------------------------------------------------------------------------
// Mash / fermentation schedules (M3_P2). Boundary operators exactly as the
// M3_P2 spec's Resolved Ambiguities bounds table — enforced identically here
// and by the web forms. Nullable-with-bounds fields use `anyOf` so `null` is
// admissible without the bound ever applying to a non-numeric instance.
// ---------------------------------------------------------------------------

const mashStepTypeEnum = ['Infusion', 'Decoction', 'Temperature'];
const fermentationStepTypeEnum = ['Primary', 'Secondary', 'Tertiary', 'ColdCrash', 'Carbonation', 'Conditioning'];

const mashStepInputSchema = {
  type: 'object',
  required: ['name', 'type', 'stepTempC', 'stepTimeMin', 'rampTimeMin', 'infuseAmountL', 'infuseWaterTempC'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    type: { type: 'string', enum: mashStepTypeEnum },
    stepTempC: { type: 'number', minimum: 0, maximum: 110 },
    stepTimeMin: { type: 'number', minimum: 0, maximum: 600 },
    rampTimeMin: { type: 'number', minimum: 0, maximum: 600 },
    infuseAmountL: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0, maximum: 1000 }] },
    infuseWaterTempC: { type: 'number', minimum: 0, maximum: 110 },
  },
};

export const mashProfileWriteBodySchema = {
  type: 'object',
  required: ['name', 'targetPh', 'spargeTempC', 'steps'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    targetPh: { type: 'number', minimum: 3, maximum: 9 },
    spargeTempC: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0, maximum: 100 }] },
    steps: { type: 'array', items: mashStepInputSchema, minItems: 0, maxItems: 20 },
  },
};

const fermentationStepInputSchema = {
  type: 'object',
  required: ['name', 'type', 'stepTempC', 'stepTimeDays', 'rampDays', 'pressurePsi'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    type: { type: 'string', enum: fermentationStepTypeEnum },
    stepTempC: { type: 'number', minimum: -10, maximum: 40 },
    stepTimeDays: { type: 'number', minimum: 0, maximum: 365 },
    rampDays: { type: 'number', minimum: 0, maximum: 60 },
    pressurePsi: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0, maximum: 60 }] },
  },
};

export const fermentationProfileWriteBodySchema = {
  type: 'object',
  required: ['name', 'steps'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    steps: { type: 'array', items: fermentationStepInputSchema, minItems: 0, maxItems: 20 },
  },
};

// ---------------------------------------------------------------------------
// Batches (M4_P1 / M5_P1). Same boundary contract as every other route
// family — a malformed body is 400 VALIDATION_FAILED, never a raw 500, and a
// partial PUT is 400, never a silent merge (M3_P2 spec §1.4's repo-wide
// rule, critic Finding F-4).
// ---------------------------------------------------------------------------

// Derived from BATCH_STATUSES (packages/calculations/src/batchPipeline.ts) —
// the ONE source of truth for batch statuses (M5_P1 spec §2.7 / AC-41).
// Adding a status to BATCH_STATUSES alone is sufficient for this enum (and
// the web <select>, via allowedNextStatuses) to see it; no second
// hand-written list exists anywhere in this file.
const batchStatusEnum = [...BATCH_STATUSES];

// Derived from CARBONATION_TYPES (packages/calculations/src/carbonation.ts),
// never a hand-written literal — the same discipline as batchStatusEnum
// (M5_P2 spec §1.5 / AC-25).
const carbonationTypeEnum = [...CARBONATION_TYPES];

export const batchCreateBodySchema = {
  type: 'object',
  required: ['recipeId'],
  additionalProperties: false,
  properties: {
    recipeId: { type: 'string', minLength: 1 },
  },
};

export const batchWriteBodySchema = {
  type: 'object',
  required: [
    'name',
    // NEW in M19_P1 — three required keys, all nullable except batchNo
    // (Resolved Ambiguities §1.1). Same `type: [...]` array form as
    // measuredFg/measuredBottlingSizeL/etc. above for the two nullable
    // string fields, avoiding the documented ajv coerceTypes null-coercion
    // gap; batchNo is never null, so a plain `integer` type is sufficient
    // (no coercion hazard for a required non-nullable numeric field).
    'batchNo',
    'brewer',
    'brewDate',
    'status',
    'measuredPreBoilGravity',
    'measuredMashPh',
    'measuredBoilSizeL',
    'measuredBoilTimeMin',
    'measuredOg',
    'measuredFg',
    'measuredBottlingSizeL',
    'carbonationType',
    'carbonationVolumesTarget',
    'carbonationTempC',
    'tasteNotes',
    'tasteRating',
  ],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1 },
    // NEW in M19_P1 (spec §1.1/AC-5): integer >= 1, never null.
    batchNo: { type: 'integer', minimum: 1 },
    brewer: { type: ['string', 'null'], maxLength: 200 },
    brewDate: { type: ['string', 'null'] },
    status: { type: 'string', enum: batchStatusEnum },
    measuredPreBoilGravity: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    measuredMashPh: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    measuredBoilSizeL: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    measuredBoilTimeMin: { anyOf: [{ type: 'null' }, { type: 'number' }] },
    // NEW in M5_P1 — required key, nullable value, bounded identically to a
    // reading's `sg` (Resolved Ambiguities).
    measuredOg: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0.9, maximum: 1.2 }] },
    // NEW in M5_P2 — seven required keys, nullable values (`tasteNotes`
    // excepted — it is required and NEVER null, `''` is its unset value).
    // Bounds exactly as the spec's Resolved Ambiguities bounds table.
    //
    // Deliberately `type: [..., 'null']` here, NOT `anyOf: [{type:'null'},
    // {...}]` — verified live against this repo's own ajv install (v8) that
    // the `anyOf`-with-null form, combined with Fastify's repo-wide
    // `coerceTypes: true` default, silently COERCES a legitimate `0`
    // (measuredBottlingSizeL, tasteRating), `''` (carbonationType) or any
    // other value ajv treats as "coercible to null" into an actual `null` —
    // not merely a validation gap but in-place data corruption: a client
    // submitting `carbonationVolumesTarget: 0` ("still beer", AC-24's own
    // documented real setting) would silently have it rewritten to `null`
    // before this route ever sees it, and a `tasteRating: 0` or
    // `measuredBottlingSizeL: 0` (both out of bounds) would incorrectly
    // validate as null-and-accepted rather than 400. The `type: [...]` array
    // form does not exhibit this coercion path (confirmed by direct ajv
    // repro) — bounds/enum apply to the non-null branch as normal, and a
    // literal `0`/`''` is validated against them, not silently rewritten.
    // This is a genuine ajv/Fastify-defaults gap, the same class already
    // documented in this file/route for `coerceTypes` and `removeAdditional`
    // (M3_P1 critic Finding 1, M5_P1 AC-27) — fixed here for the seven new
    // properties only; the five pre-existing `anyOf`-null properties above
    // are untouched (out of this phase's scope; none of them has a
    // documented "0 is a real, distinct setting" requirement the way
    // carbonationVolumesTarget/carbonationTempC do).
    measuredFg: { type: ['number', 'null'], minimum: 0.9, maximum: 1.2 },
    measuredBottlingSizeL: { type: ['number', 'null'], minimum: 0.1, maximum: 1000 },
    carbonationType: { type: ['string', 'null'], enum: [...carbonationTypeEnum, null] },
    carbonationVolumesTarget: { type: ['number', 'null'], minimum: 0, maximum: 5 },
    carbonationTempC: { type: ['number', 'null'], minimum: -20, maximum: 50 },
    tasteNotes: { type: 'string', maxLength: 5000 },
    tasteRating: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
  },
};

// ---------------------------------------------------------------------------
// Batch notes (M5_P2). `note` has minLength: 1 — deliberately unlike
// `tasteNotes`/`comment`, where '' is the unset value of an optional field on
// a larger object: a note is created by an explicit user action, and an
// empty note is a row that records nothing (spec, Resolved Ambiguities).
// `timestamp` and `status` are NOT in this schema at all — both are
// server-minted/recorded, never accepted from a client (enforced by the
// preValidation hook in routes/batches.ts, same mechanism as
// SERVER_OWNED_BATCH_KEYS).
// ---------------------------------------------------------------------------

export const batchNoteWriteBodySchema = {
  type: 'object',
  required: ['note'],
  additionalProperties: false,
  properties: {
    note: { type: 'string', minLength: 1, maxLength: 5000 },
  },
};

// ---------------------------------------------------------------------------
// Batch readings (M5_P1). Boundary operators exactly as the spec's Resolved
// Ambiguities bounds table. `readingTime` is validated for SHAPE here only —
// ajv's built-in ISO instant `format` keyword is deliberately not relied on
// (it needs the ajv-formats plugin, which this repo has never registered);
// the route additionally rejects a pattern-matching-but-unreal instant (e.g.
// 2026-13-45T00:00:00Z) via `Number.isNaN(Date.parse(...))` before anything
// is written (AC-24).
// `comment` has no `minLength` — '' is the unset value and is always
// admissible, never `null` (the column is NOT NULL DEFAULT '').
// ---------------------------------------------------------------------------

const READING_TIME_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$';

export const readingWriteBodySchema = {
  type: 'object',
  required: ['readingTime', 'sg', 'tempC', 'comment', 'ph', 'pressurePsi'],
  additionalProperties: false,
  properties: {
    readingTime: { type: 'string', pattern: READING_TIME_PATTERN },
    sg: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0.9, maximum: 1.2 }] },
    tempC: { anyOf: [{ type: 'null' }, { type: 'number', minimum: -20, maximum: 50 }] },
    comment: { type: 'string', maxLength: 2000 },
    ph: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 3, maximum: 9 }] },
    pressurePsi: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0, maximum: 60 }] },
  },
};

// ---------------------------------------------------------------------------
// Water profiles (M6_P1). Same boundary contract as every other route family.
// ---------------------------------------------------------------------------

const waterProfileTypeEnum = ['source', 'target'];

export const waterProfileWriteBodySchema = {
  type: 'object',
  required: ['name', 'type', 'calcium', 'magnesium', 'sodium', 'chloride', 'sulfate', 'bicarbonate'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    type: { type: 'string', enum: waterProfileTypeEnum },
    calcium: { type: 'number', minimum: 0 },
    magnesium: { type: 'number', minimum: 0 },
    sodium: { type: 'number', minimum: 0 },
    chloride: { type: 'number', minimum: 0 },
    sulfate: { type: 'number', minimum: 0 },
    bicarbonate: { type: 'number', minimum: 0 },
    ph: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0, maximum: 14 }] },
    description: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 2000 }] },
  },
};

// ---------------------------------------------------------------------------
// Inventory (M9_P1). category/unit enums are DERIVED from
// @truchabrew/calculations' INVENTORY_CATEGORIES / CANONICAL_INVENTORY_UNIT /
// MISC_INVENTORY_UNITS — never retyped as a second hand-written literal list
// (the BATCH_STATUSES / CARBONATION_TYPES precedent above). Per-category unit
// validity (e.g. Fermentable must be exactly 'kg') is a cross-field rule the
// route enforces via isValidInventoryUnit — JSON Schema alone cannot express
// "this enum depends on that sibling field" cleanly. `notes: null` is
// rejected by the route's preValidation hook (NULL_REJECTING_STRING_KEYS
// precedent), not here — `coerceTypes: true` would otherwise silently turn it
// into ''. purchaseDate/expiryDate are validated for SHAPE here only; the
// route additionally rejects a pattern-valid-but-unreal calendar date (e.g.
// 2026-02-30) — see routes/inventory.ts's isRealCalendarDate.
// ---------------------------------------------------------------------------

const inventoryCategoryEnum = [...INVENTORY_CATEGORIES];
const inventoryUnitEnum = Array.from(new Set([...Object.values(CANONICAL_INVENTORY_UNIT), ...MISC_INVENTORY_UNITS]));
const CALENDAR_DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

// `customDetails` (M12_P1 Amendment 1) is OPTIONAL — absent entirely for any
// client that predates the amendment, or explicitly null/an object when
// present. Deliberately not deep-validated against the 4 category-specific
// shapes (HopInventoryDetails, etc.) — same looseness as every other
// JSON-mode column in this repo (recipeSnapshot, statsSnapshot,
// closingSnapshot); those interfaces are TypeScript-enforced client-side,
// not HTTP-boundary-enforced.
export const inventoryWriteBodySchema = {
  type: 'object',
  required: ['category', 'name', 'quantity', 'unit', 'costPerUnit', 'purchaseDate', 'expiryDate', 'notes'],
  additionalProperties: false,
  properties: {
    category: { type: 'string', enum: inventoryCategoryEnum },
    name: { type: 'string', minLength: 1, pattern: '\\S' },
    quantity: { type: 'number' },
    unit: { type: 'string', enum: inventoryUnitEnum },
    costPerUnit: { anyOf: [{ type: 'null' }, { type: 'number', minimum: 0 }] },
    purchaseDate: { anyOf: [{ type: 'null' }, { type: 'string', pattern: CALENDAR_DATE_PATTERN }] },
    expiryDate: { anyOf: [{ type: 'null' }, { type: 'string', pattern: CALENDAR_DATE_PATTERN }] },
    notes: { type: 'string' },
    customDetails: { anyOf: [{ type: 'null' }, { type: 'object' }] },
  },
};

// ---------------------------------------------------------------------------
// Checkoff ledger (M9_P2). The ledger-kind enum is DERIVED from LEDGER_KINDS
// (packages/calculations/src/inventoryLedger.ts) by import, never retyped —
// same discipline as batchStatusEnum/carbonationTypeEnum above. Unused by any
// schema below directly (kind is never client-writable), kept for parity
// with the repo's derive-don't-retype convention and available to any future
// caller that needs to validate a kind string.
// ---------------------------------------------------------------------------

export const ledgerKindEnum = [...LEDGER_KINDS];

// `inventoryItemId` is the ONLY client-writable field on either checkoff
// request body (spec Resolved Ambiguity 8). A raw-body preValidation hook —
// not `additionalProperties: false` alone — rejects any other key with 400
// VALIDATION_FAILED naming it (Fastify's repo-wide `removeAdditional: true`
// would otherwise silently strip an extra key instead of rejecting it).
export const checkoffWriteBodySchema = {
  type: 'object',
  required: ['inventoryItemId'],
  additionalProperties: false,
  properties: {
    inventoryItemId: { type: 'string', minLength: 1 },
  },
};

// ---------------------------------------------------------------------------
// In-batch recipe adjustment (M15_P1 spec §3.2). `recipeSnapshot` is a full
// StoredRecipe object — deliberately NOT deep-validated field-by-field here,
// same looseness as `recipeSnapshot`/`statsSnapshot`/`closingSnapshot`
// elsewhere in this repo (those are JSON-mode columns whose shape is
// TypeScript-enforced client-side, never HTTP-boundary-enforced — see the
// `customDetails` precedent in inventoryWriteBodySchema above). `id` is
// required so the optional master-recipe sync knows which recipe to write
// back to.
// ---------------------------------------------------------------------------

export const batchRecipeSnapshotWriteBodySchema = {
  type: 'object',
  required: ['recipeSnapshot'],
  additionalProperties: false,
  properties: {
    recipeSnapshot: {
      type: 'object',
      required: ['id', 'name', 'equipment', 'fermentables', 'hops', 'yeasts', 'miscs'],
      properties: {
        id: { type: 'string', minLength: 1 },
      },
    },
    syncToMasterRecipe: { type: 'boolean' },
  },
};
