import type {
  RecipeWriteInput,
  FermentableType,
  HopUse,
  HopType,
  YeastType,
  YeastForm,
  MiscType,
  MiscUse,
  MiscUnit,
  LineItemInput,
  FermentableItem,
  HopItem,
  YeastItem,
  MiscItem,
} from '@truchabrew/shared-types';

export interface BrewfatherImportOptions {
  defaultEquipmentId: string;
  defaultMashProfileId?: string | null;
  defaultFermentationProfileId?: string | null;
}

function parseMinutes(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/\b(?:day|days|d)\b/i.test(trimmed)) return null;
    const match = /^(\d+(?:\.\d+)?)\s*(?:min|m|mins)?$/i.exec(trimmed);
    if (match) return parseFloat(match[1]);
    const generalMatch = /^(\d+(?:\.\d+)?)\s*(?:min|m|mins)/i.exec(trimmed);
    if (generalMatch) return parseFloat(generalMatch[1]);
    const numOnly = /^(\d+(?:\.\d+)?)$/.exec(trimmed);
    if (numOnly) return parseFloat(numOnly[1]);
  }
  return null;
}

function parseDaysToMinutes(val: unknown): number | null {
  if (typeof val === 'string') {
    const match = /^(\d+(?:\.\d+)?)\s*(?:day|days|d)/i.exec(val.trim());
    if (match) return Math.round(parseFloat(match[1]) * 1440);
  }
  return null;
}

function parseTempC(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const match = /(?:@|\bat\b)?\s*(\d+(?:\.\d+)?)\s*(?:°?C|\bC\b)/i.exec(val);
    if (match) return parseFloat(match[1]);
    const numMatch = /^(\d+(?:\.\d+)?)/.exec(val.trim());
    if (numMatch) return parseFloat(numMatch[1]);
  }
  return null;
}

function parseAmountAndUnit(rawAmount: unknown, rawUnit?: unknown): { amount: number; unit: MiscUnit } {
  if (typeof rawAmount === 'number') {
    let amount = rawAmount;
    let unit: MiscUnit = 'g';
    if (typeof rawUnit === 'string') {
      const normalized = normalizeMiscUnit(rawAmount, rawUnit);
      amount = normalized.amount;
      unit = normalized.unit;
    }
    return { amount, unit };
  }

  if (typeof rawAmount === 'string') {
    const trimmed = rawAmount.trim();
    const match = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(trimmed);
    if (match) {
      const parsedAmount = parseFloat(match[1]);
      const unitStr = match[2] || (typeof rawUnit === 'string' ? rawUnit : '');
      return normalizeMiscUnit(parsedAmount, unitStr);
    }
  }

  return { amount: 1, unit: 'each' };
}

function normalizeMiscUnit(amount: number, str: string): { amount: number; unit: MiscUnit } {
  const s = str.trim().toLowerCase();
  if (s.startsWith('kg')) return { amount: amount * 1000, unit: 'g' };
  if (s.startsWith('g')) return { amount, unit: 'g' };
  if (s.startsWith('oz')) return { amount: Math.round(amount * 28.3495 * 100) / 100, unit: 'g' };
  if (s.startsWith('lb')) return { amount: Math.round(amount * 453.592 * 100) / 100, unit: 'g' };
  if (s.startsWith('ml')) return { amount, unit: 'ml' };
  if (s.startsWith('l')) return { amount: amount * 1000, unit: 'ml' };
  if (s.startsWith('tsp')) return { amount, unit: 'tsp' };
  if (s.startsWith('tbsp')) return { amount, unit: 'tbsp' };
  return { amount, unit: 'each' };
}

function mapFermentableType(typeStr?: string): FermentableType {
  if (!typeStr) return 'Grain';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('sugar')) return 'Sugar';
  if (s.includes('liquid extract') || s.includes('liquidextract')) return 'LiquidExtract';
  if (s.includes('dry extract') || s.includes('dryextract')) return 'DryExtract';
  if (s.includes('extract')) return 'LiquidExtract';
  if (s.includes('adjunct')) return 'Adjunct';
  return 'Grain';
}

function mapHopUse(useStr?: string): HopUse {
  if (!useStr) return 'Boil';
  const s = useStr.trim().toLowerCase();
  if (s.includes('dry')) return 'DryHop';
  if (s.includes('first wort') || s.includes('firstwort')) return 'FirstWort';
  if (s.includes('whirlpool') || s.includes('hopstand') || s.includes('aroma')) return 'Whirlpool';
  if (s.includes('boil')) return 'Boil';
  return 'Boil';
}

function mapHopType(typeStr?: string): HopType {
  if (!typeStr) return 'Pellet';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('leaf') || s.includes('whole') || s.includes('plug')) return 'Leaf';
  if (s.includes('cryo') || s.includes('lupulin')) return 'Cryo';
  return 'Pellet';
}

function mapYeastType(typeStr?: string, nameStr?: string): YeastType {
  const combined = `${typeStr || ''} ${nameStr || ''}`.toLowerCase();
  if (combined.includes('lager')) return 'Lager';
  if (combined.includes('wheat') || combined.includes('weiss') || combined.includes('weizen')) return 'Wheat';
  if (combined.includes('hybrid') || combined.includes('kolsch') || combined.includes('kölsch') || combined.includes('alt')) return 'Hybrid';
  return 'Ale';
}

function mapMiscType(typeStr?: string): MiscType {
  if (!typeStr) return 'Other';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('water')) return 'WaterAgent';
  if (s.includes('fining')) return 'Fining';
  if (s.includes('flavor') || s.includes('flavour') || s.includes('spice') || s.includes('herb')) return 'Flavor';
  return 'Other';
}

function mapMiscUse(useStr?: string): MiscUse {
  if (!useStr) return 'Boil';
  const s = useStr.trim().toLowerCase();
  if (s.includes('mash') || s.includes('sparge')) return 'Mash';
  if (s.includes('whirlpool') || s.includes('hopstand') || s.includes('aroma')) return 'Whirlpool';
  if (s.includes('primary') || s.includes('ferment')) return 'Primary';
  if (s.includes('secondary')) return 'Secondary';
  if (s.includes('bottl') || s.includes('packag')) return 'Bottling';
  return 'Boil';
}


function parseMiscTime(useStr?: string): number {
  if (typeof useStr === 'string') {
    const match = /(\d+(?:\.\d+)?)\s*(?:min|m|mins)\b/i.exec(useStr);
    if (match) return parseFloat(match[1]);
  }
  return 0;
}

interface RawBrewfatherFermentable {
  name?: string;
  brand?: string | null;
  amountKg?: number;
  amount?: number | string;
  color?: number | string;
  colorEBC?: number;
  colorSrm?: number;
  ebc?: number;
  type?: string;
  potential?: number | string;
  potentialSg?: number;
  notes?: string;
}

interface RawBrewfatherHop {
  name?: string;
  alphaAcidPct?: number;
  alpha?: number | string;
  amountG?: number;
  amount?: number | string;
  time?: string | number;
  timeMinutes?: number;
  use?: string;
  type?: string;
  temp?: number | string;
  whirlpoolTempC?: number | string;
}

interface RawBrewfatherYeast {
  name?: string;
  laboratory?: string;
  brand?: string | null;
  attenuationPct?: number;
  attenuation?: number | string;
  amount?: number | string;
  amountPkg?: number;
  form?: string;
  type?: string;
}

interface RawBrewfatherMisc {
  name?: string;
  type?: string;
  amount?: number | string;
  unit?: string;
  use?: string;
}

interface RawBrewfatherRecipe {
  name?: string;
  author?: string;
  style?: { name?: string; code?: string };
  styleName?: string;
  notes?: string;
  boilTime?: number;
  // NEW in M38_P1 (AC-18) — Brewfather's own recipe folder/tag fields. Both
  // optional; absent (or non-string/non-array) input falls through to
  // null/[] (RA-5), exactly like a manually-created recipe that never set
  // either.
  folder?: string | null;
  tags?: string[];
  fermentables?: RawBrewfatherFermentable[];
  hops?: RawBrewfatherHop[];
  yeast?: RawBrewfatherYeast[];
  yeasts?: RawBrewfatherYeast[];
  misc?: RawBrewfatherMisc[];
  miscs?: RawBrewfatherMisc[];
}

export function parseBrewfatherJson(raw: unknown, options: BrewfatherImportOptions): RecipeWriteInput[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON payload: string could not be parsed');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON payload: expected object or array');
  }

  let recipeList: RawBrewfatherRecipe[] = [];

  if (Array.isArray(parsed)) {
    recipeList = parsed as RawBrewfatherRecipe[];
  } else {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.recipes)) {
      recipeList = record.recipes as RawBrewfatherRecipe[];
    } else if (
      typeof record.name === 'string' &&
      (record.fermentables ||
        record.hops ||
        record.type ||
        record.style ||
        record.yeast ||
        record.yeasts ||
        record.misc ||
        record.miscs ||
        record.mashProfile ||
        record.fermentationProfile ||
        record.notes !== undefined)
    ) {
      recipeList = [record as RawBrewfatherRecipe];
    }
  }

  if (recipeList.length === 0) {
    throw new Error('No valid recipes found in payload');
  }

  const results: RecipeWriteInput[] = [];

  for (const r of recipeList) {
    const name = (typeof r.name === 'string' && r.name.trim()) ? r.name.trim() : 'Unnamed Imported Recipe';
    const author = typeof r.author === 'string' ? r.author.trim() : '';
    const styleName = r.style?.name ?? (typeof r.styleName === 'string' ? r.styleName : '');
    const notes = typeof r.notes === 'string' ? r.notes : '';
    // AC-18: maps Brewfather's folder/tags (if present) to the recipe's
    // folder/tags — final trim/dedup normalization happens server-side
    // (recipeRepository.ts's normalizeFolder/normalizeTags) when this
    // RecipeWriteInput is actually persisted, same as any other write path.
    const folder = typeof r.folder === 'string' && r.folder.trim() !== '' ? r.folder.trim() : null;
    const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [];

    // 1. Fermentables
    const rawFermentables = Array.isArray(r.fermentables) ? r.fermentables : [];
    const fermentables: LineItemInput<FermentableItem>[] = rawFermentables.map((f) => {
      const fName = (typeof f.name === 'string' && f.name.trim()) ? f.name.trim() : 'Unnamed Fermentable';
      const fType = mapFermentableType(f.type);
      
      let amountKg = 0;
      if (typeof f.amountKg === 'number') {
        amountKg = f.amountKg;
      } else if (typeof f.amount === 'number') {
        amountKg = f.amount;
      } else if (typeof f.amount === 'string' || typeof f.amountKg === 'string') {
        amountKg = parseFloat(String(f.amount || f.amountKg)) || 0;
      }

      let colorSrm = 0;
      if (typeof f.colorSrm === 'number') {
        colorSrm = f.colorSrm;
      } else if (typeof f.color === 'number') {
        colorSrm = f.color;
      } else if (typeof f.colorEBC === 'number') {
        colorSrm = f.colorEBC / 1.97;
      } else if (typeof f.ebc === 'number') {
        colorSrm = f.ebc / 1.97;
      } else if (typeof f.color === 'string') {
        colorSrm = parseFloat(f.color) || 0;
      }

      let potentialSg = 1.036;
      if (typeof f.potentialSg === 'number') {
        potentialSg = f.potentialSg;
      } else if (typeof f.potential === 'number') {
        if (f.potential > 1000) {
          potentialSg = 1 + (f.potential - 1000) / 1000;
        } else if (f.potential > 10) {
          potentialSg = 1 + f.potential / 1000;
        } else if (f.potential > 1.0) {
          potentialSg = f.potential;
        }
      } else if (typeof f.potential === 'string') {
        const parsedP = parseFloat(f.potential);
        if (!isNaN(parsedP)) {
          if (parsedP > 1000) potentialSg = 1 + (parsedP - 1000) / 1000;
          else if (parsedP > 10) potentialSg = 1 + parsedP / 1000;
          else if (parsedP > 1.0) potentialSg = parsedP;
        }
      }

      return {
        name: fName,
        type: fType,
        amountKg,
        colorSrm: Math.round(colorSrm * 100) / 100,
        potentialSg,
        notes: f.brand ? String(f.brand) : undefined,
      };
    });

    // 2. Hops
    const rawHops = Array.isArray(r.hops) ? r.hops : [];
    const hops: LineItemInput<HopItem>[] = rawHops.map((h) => {
      const hName = (typeof h.name === 'string' && h.name.trim()) ? h.name.trim() : 'Unnamed Hop';
      const use = mapHopUse(h.use);
      const type = mapHopType(h.type);

      let amountG = 0;
      if (typeof h.amountG === 'number') {
        amountG = h.amountG;
      } else if (typeof h.amount === 'number') {
        amountG = h.amount < 1 ? h.amount * 1000 : h.amount;
      } else if (typeof h.amount === 'string' || typeof h.amountG === 'string') {
        const parsedA = parseFloat(String(h.amount || h.amountG)) || 0;
        amountG = parsedA < 1 && String(h.amount || h.amountG).includes('kg') ? parsedA * 1000 : parsedA;
      }

      let alphaAcidPct = 0;
      if (typeof h.alphaAcidPct === 'number') {
        alphaAcidPct = h.alphaAcidPct;
      } else if (typeof h.alpha === 'number') {
        alphaAcidPct = h.alpha;
      } else if (typeof h.alphaAcidPct === 'string' || typeof h.alpha === 'string') {
        alphaAcidPct = parseFloat(String(h.alphaAcidPct || h.alpha)) || 0;
      }

      let boilMins: number | null = null;
      let whirlpoolMins: number | null = null;
      let whirlpoolTempC: number | null = null;
      let timeMinutes: number | null = null;

      if (use === 'Boil') {
        boilMins = parseMinutes(h.time) ?? parseMinutes(h.timeMinutes) ?? 60;
      } else if (use === 'FirstWort') {
        boilMins = parseMinutes(h.time) ?? parseMinutes(h.timeMinutes) ?? (r.boilTime ?? 60);
      } else if (use === 'Whirlpool') {
        whirlpoolMins = parseMinutes(h.time) ?? parseMinutes(h.timeMinutes) ?? 20;
        whirlpoolTempC = parseTempC(h.use) ?? parseTempC(h.temp) ?? parseTempC(h.whirlpoolTempC) ?? 90;
      } else if (use === 'DryHop') {
        timeMinutes = parseDaysToMinutes(h.time) ?? parseMinutes(h.time) ?? parseMinutes(h.timeMinutes) ?? 4320;
      }

      return {
        name: hName,
        amountG,
        alphaAcidPct,
        use,
        type,
        boilMins,
        whirlpoolMins,
        whirlpoolTempC,
        timeMinutes,
      };
    });

    // 3. Yeasts
    const rawYeasts = Array.isArray(r.yeast) ? r.yeast : (Array.isArray(r.yeasts) ? r.yeasts : []);
    const yeasts: LineItemInput<YeastItem>[] = rawYeasts.map((y) => {
      const yName = (typeof y.name === 'string' && y.name.trim()) ? y.name.trim() : 'Unnamed Yeast';
      const laboratory = (typeof y.laboratory === 'string' && y.laboratory.trim())
        ? y.laboratory.trim()
        : ((typeof y.brand === 'string' && y.brand.trim()) ? y.brand.trim() : 'Unknown');

      let attenuationPct = 75;
      if (typeof y.attenuationPct === 'number') {
        attenuationPct = y.attenuationPct;
      } else if (typeof y.attenuation === 'number') {
        attenuationPct = y.attenuation;
      } else if (typeof y.attenuation === 'string' || typeof y.attenuationPct === 'string') {
        const parsedAtt = parseFloat(String(y.attenuation || y.attenuationPct));
        if (!isNaN(parsedAtt)) attenuationPct = parsedAtt;
      }

      let amountPkg = 1;
      if (typeof y.amountPkg === 'number') {
        amountPkg = y.amountPkg;
      } else if (typeof y.amount === 'number') {
        amountPkg = y.amount;
      } else if (typeof y.amount === 'string') {
        const match = /^(\d+(?:\.\d+)?)/.exec(y.amount.trim());
        if (match) amountPkg = parseFloat(match[1]);
      }

      const form: YeastForm = (y.form && /liquid/i.test(y.form)) ? 'Liquid' : 'Dry';
      const yeastType = mapYeastType(y.type, yName);

      return {
        name: yName,
        type: yeastType,
        form,
        laboratory,
        attenuationPct,
        amountPkg,
      };
    });

    // 4. Miscs
    const rawMiscs = Array.isArray(r.misc) ? r.misc : (Array.isArray(r.miscs) ? r.miscs : []);
    const miscs: LineItemInput<MiscItem>[] = rawMiscs.map((m) => {
      const mName = (typeof m.name === 'string' && m.name.trim()) ? m.name.trim() : 'Unnamed Misc';
      const type = mapMiscType(m.type);
      const use = mapMiscUse(m.use);
      const { amount, unit } = parseAmountAndUnit(m.amount, m.unit);
      const timeMinutes = parseMiscTime(m.use);

      return {
        name: mName,
        type,
        use,
        timeMinutes,
        amount,
        unit,
      };
    });

    results.push({
      name,
      author,
      styleName,
      folder,
      tags,
      notes,
      equipmentId: options.defaultEquipmentId,
      mashProfileId: options.defaultMashProfileId ?? null,
      fermentationProfileId: options.defaultFermentationProfileId ?? null,
      waterSourceId: null,
      waterTargetId: null,
      fermentables,
      hops,
      yeasts,
      miscs,
    });
  }

  return results;
}

export const parseBrewfatherRecipe = parseBrewfatherJson;
