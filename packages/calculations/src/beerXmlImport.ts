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

export interface BeerXmlImportOptions {
  defaultEquipmentId: string;
  defaultMashProfileId?: string | null;
  defaultFermentationProfileId?: string | null;
}

function getTagValue(xmlChunk: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(xmlChunk);
  return match ? match[1].trim() : null;
}

function getTagBlocks(xmlChunk: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlChunk)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function mapFermentableType(typeStr?: string | null): FermentableType {
  if (!typeStr) return 'Grain';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('sugar')) return 'Sugar';
  if (s.includes('liquid extract') || s.includes('liquidextract')) return 'LiquidExtract';
  if (s.includes('dry extract') || s.includes('dryextract')) return 'DryExtract';
  if (s.includes('extract')) return 'LiquidExtract';
  if (s.includes('adjunct')) return 'Adjunct';
  return 'Grain';
}

function mapHopUse(useStr?: string | null): HopUse {
  if (!useStr) return 'Boil';
  const s = useStr.trim().toLowerCase();
  if (s.includes('dry')) return 'DryHop';
  if (s.includes('first wort') || s.includes('firstwort')) return 'FirstWort';
  if (s.includes('whirlpool') || s.includes('hopstand') || s.includes('aroma')) return 'Whirlpool';
  return 'Boil';
}

function mapHopType(typeStr?: string | null): HopType {
  if (!typeStr) return 'Pellet';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('leaf') || s.includes('whole') || s.includes('plug')) return 'Leaf';
  if (s.includes('cryo') || s.includes('lupulin')) return 'Cryo';
  return 'Pellet';
}

function mapYeastType(typeStr?: string | null): YeastType {
  if (!typeStr) return 'Ale';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('lager')) return 'Lager';
  if (s.includes('wheat') || s.includes('trigo') || s.includes('weiss')) return 'Wheat';
  return 'Ale';
}

function mapYeastForm(formStr?: string | null): YeastForm {
  if (!formStr) return 'Dry';
  const s = formStr.trim().toLowerCase();
  if (s.includes('liquid')) return 'Liquid';
  return 'Dry';
}

function mapMiscType(typeStr?: string | null): MiscType {
  if (!typeStr) return 'Other';
  const s = typeStr.trim().toLowerCase();
  if (s.includes('water agent') || s.includes('wateragent') || s.includes('water')) return 'WaterAgent';
  if (s.includes('fining') || s.includes('clarificante')) return 'Fining';
  if (s.includes('flavor') || s.includes('sabor')) return 'Flavor';
  if (s.includes('spice') || s.includes('especia') || s.includes('herb')) return 'Spice';
  return 'Other';
}

function mapMiscUse(useStr?: string | null): MiscUse {
  if (!useStr) return 'Boil';
  const s = useStr.trim().toLowerCase();
  if (s.includes('mash') || s.includes('macerado')) return 'Mash';
  if (s.includes('primary') || s.includes('primario')) return 'Primary';
  if (s.includes('secondary') || s.includes('secundario')) return 'Secondary';
  if (s.includes('bottle') || s.includes('bottling') || s.includes('embotellado')) return 'Bottling';
  return 'Boil';
}

/**
 * Pure parser converting a BeerXML document string into RecipeWriteInput[].
 */
export function parseBeerXml(
  xmlContent: string,
  options: BeerXmlImportOptions,
): RecipeWriteInput[] {
  if (!xmlContent || typeof xmlContent !== 'string') return [];

  const recipeBlocks = getTagBlocks(xmlContent, 'RECIPE');
  if (recipeBlocks.length === 0) return [];

  const results: RecipeWriteInput[] = [];

  for (const block of recipeBlocks) {
    const name = getTagValue(block, 'NAME') ?? 'Imported BeerXML Recipe';
    const author = getTagValue(block, 'BREWER') ?? getTagValue(block, 'ASST_BREWER') ?? 'Unknown Brewer';
    
    // Style
    const styleBlock = getTagValue(block, 'STYLE');
    const styleName = styleBlock ? (getTagValue(styleBlock, 'NAME') ?? 'Custom Style') : (getTagValue(block, 'STYLE_NAME') ?? 'Custom Style');
    
    const notes = getTagValue(block, 'NOTES') ?? null;

    // Fermentables
    const fermentableBlocks = getTagBlocks(block, 'FERMENTABLE');
    const fermentables: LineItemInput<FermentableItem>[] = fermentableBlocks.map((fb) => {
      const fName = getTagValue(fb, 'NAME') ?? 'Unnamed Grain';
      const type = mapFermentableType(getTagValue(fb, 'TYPE'));
      const amountKg = parseFloat(getTagValue(fb, 'AMOUNT') ?? '0') || 0;
      const colorSrm = parseFloat(getTagValue(fb, 'COLOR') ?? '3') || 3;

      let potentialSg = 1.036;
      const potentialStr = getTagValue(fb, 'POTENTIAL');
      const yieldStr = getTagValue(fb, 'YIELD');
      if (potentialStr) {
        potentialSg = parseFloat(potentialStr) || 1.036;
      } else if (yieldStr) {
        const yieldPct = parseFloat(yieldStr) || 75;
        potentialSg = parseFloat((1 + (yieldPct * 0.46) / 1000).toFixed(3));
      }

      return {
        name: fName,
        type,
        amountKg,
        colorSrm,
        potentialSg,
      };
    });

    // Hops
    const hopBlocks = getTagBlocks(block, 'HOP');
    const hops: LineItemInput<HopItem>[] = hopBlocks.map((hb) => {
      const hName = getTagValue(hb, 'NAME') ?? 'Unnamed Hop';
      const alphaAcidPct = parseFloat(getTagValue(hb, 'ALPHA') ?? '5.0') || 5.0;
      // In BeerXML, hop amount is in kg (e.g. 0.05 kg = 50g)
      const rawAmountKg = parseFloat(getTagValue(hb, 'AMOUNT') ?? '0') || 0;
      const amountG = rawAmountKg < 1 ? rawAmountKg * 1000 : rawAmountKg;
      const use = mapHopUse(getTagValue(hb, 'USE'));
      const timeVal = parseFloat(getTagValue(hb, 'TIME') ?? '60') || 0;
      const type = mapHopType(getTagValue(hb, 'FORM'));

      const boilMins = use === 'Boil' || use === 'FirstWort' ? timeVal : null;
      const whirlpoolMins = use === 'Whirlpool' ? timeVal : null;
      const whirlpoolTempC = use === 'Whirlpool' ? 85 : null;
      const timeMinutes = use === 'DryHop' ? timeVal : null;

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

    // Yeasts
    const yeastBlocks = getTagBlocks(block, 'YEAST');
    const yeasts: LineItemInput<YeastItem>[] = yeastBlocks.map((yb) => {
      const yName = getTagValue(yb, 'NAME') ?? 'Unnamed Yeast';
      const laboratory = getTagValue(yb, 'LABORATORY') ?? 'Unknown';
      const type = mapYeastType(getTagValue(yb, 'TYPE'));
      const form = mapYeastForm(getTagValue(yb, 'FORM'));
      const attenuationPct = parseFloat(getTagValue(yb, 'ATTENUATION') ?? '75') || 75;

      return {
        name: yName,
        laboratory,
        type,
        form,
        attenuationPct,
        amountPkg: 1,
      };
    });

    // Miscs
    const miscBlocks = getTagBlocks(block, 'MISC');
    const miscs: LineItemInput<MiscItem>[] = miscBlocks.map((mb) => {
      const mName = getTagValue(mb, 'NAME') ?? 'Unnamed Misc';
      const type = mapMiscType(getTagValue(mb, 'TYPE'));
      const use = mapMiscUse(getTagValue(mb, 'USE'));
      const timeMinutes = parseFloat(getTagValue(mb, 'TIME') ?? '0') || 0;
      const rawAmount = parseFloat(getTagValue(mb, 'AMOUNT') ?? '1') || 1;
      const amountIsWeight = (getTagValue(mb, 'AMOUNT_IS_WEIGHT') ?? '').toUpperCase() === 'TRUE';

      let amount = rawAmount;
      let unit: MiscUnit = amountIsWeight ? 'g' : 'each';
      if (amountIsWeight && rawAmount < 1) {
        amount = rawAmount * 1000; // convert kg to g
        unit = 'g';
      }

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
      notes: notes ?? '',
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
