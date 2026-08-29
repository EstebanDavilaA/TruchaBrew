import { describe, it, expect } from 'vitest';
import { parseBeerXml } from '../src/beerXmlImport';

const SAMPLE_BEERXML = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Citra Pale Ale</NAME>
    <BREWER>Craft Master</BREWER>
    <STYLE>
      <NAME>American Pale Ale</NAME>
      <CATEGORY_NUMBER>18</CATEGORY_NUMBER>
      <STYLE_LETTER>B</STYLE_LETTER>
    </STYLE>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <BOIL_SIZE>25.0</BOIL_SIZE>
    <BOIL_TIME>60</BOIL_TIME>
    <NOTES>Crisp and fruity pale ale.</NOTES>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale Ale Malt</NAME>
        <AMOUNT>4.5</AMOUNT>
        <TYPE>Grain</TYPE>
        <YIELD>80.0</YIELD>
        <COLOR>5.0</COLOR>
        <POTENTIAL>1.038</POTENTIAL>
      </FERMENTABLE>
      <FERMENTABLE>
        <NAME>Caramunich II</NAME>
        <AMOUNT>0.5</AMOUNT>
        <TYPE>Grain</TYPE>
        <YIELD>75.0</YIELD>
        <COLOR>120.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>Citra</NAME>
        <ALPHA>12.5</ALPHA>
        <AMOUNT>0.030</AMOUNT>
        <USE>Boil</USE>
        <TIME>60.0</TIME>
        <FORM>Pellet</FORM>
      </HOP>
      <HOP>
        <NAME>Citra</NAME>
        <ALPHA>12.5</ALPHA>
        <AMOUNT>0.050</AMOUNT>
        <USE>Dry Hop</USE>
        <TIME>4320.0</TIME>
        <FORM>Pellet</FORM>
      </HOP>
    </HOPS>
    <YEASTS>
      <YEAST>
        <NAME>SafAle US-05</NAME>
        <LABORATORY>Fermentis</LABORATORY>
        <PRODUCT_ID>US-05</PRODUCT_ID>
        <TYPE>Ale</TYPE>
        <FORM>Dry</FORM>
        <ATTENUATION>81.0</ATTENUATION>
      </YEAST>
    </YEASTS>
    <MISCS>
      <MISC>
        <NAME>Irish Moss</NAME>
        <TYPE>Fining</TYPE>
        <USE>Boil</USE>
        <TIME>15.0</TIME>
        <AMOUNT>0.005</AMOUNT>
        <AMOUNT_IS_WEIGHT>TRUE</AMOUNT_IS_WEIGHT>
      </MISC>
    </MISCS>
  </RECIPE>
  <RECIPE>
    <NAME>Dry Irish Stout</NAME>
    <BREWER>Dublin Brewer</BREWER>
    <STYLE>
      <NAME>Irish Stout</NAME>
    </STYLE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Maris Otter</NAME>
        <AMOUNT>4.0</AMOUNT>
        <TYPE>Grain</TYPE>
        <COLOR>6.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>East Kent Goldings</NAME>
        <ALPHA>5.0</ALPHA>
        <AMOUNT>0.040</AMOUNT>
        <USE>Boil</USE>
        <TIME>60.0</TIME>
      </HOP>
    </HOPS>
    <YEASTS>
      <YEAST>
        <NAME>Irish Ale Yeast</NAME>
        <TYPE>Ale</TYPE>
        <ATTENUATION>75.0</ATTENUATION>
      </YEAST>
    </YEASTS>
    <MISCS />
  </RECIPE>
</RECIPES>`;

describe('BeerXML Parser (M22_P1 AC-3)', () => {
  it('parses multiple recipes accurately from BeerXML document', () => {
    const recipes = parseBeerXml(SAMPLE_BEERXML, {
      defaultEquipmentId: 'eq-default',
    });

    expect(recipes).toHaveLength(2);

    // Recipe 1: Citra Pale Ale
    const r1 = recipes[0];
    expect(r1.name).toBe('Citra Pale Ale');
    expect(r1.author).toBe('Craft Master');
    expect(r1.styleName).toBe('American Pale Ale');
    expect(r1.notes).toBe('Crisp and fruity pale ale.');
    expect(r1.equipmentId).toBe('eq-default');

    // Fermentables
    expect(r1.fermentables).toHaveLength(2);
    expect(r1.fermentables[0].name).toBe('Pale Ale Malt');
    expect(r1.fermentables[0].amountKg).toBe(4.5);
    expect(r1.fermentables[0].colorSrm).toBe(5.0);
    expect(r1.fermentables[0].potentialSg).toBe(1.038);

    expect(r1.fermentables[1].name).toBe('Caramunich II');
    expect(r1.fermentables[1].amountKg).toBe(0.5);
    expect(r1.fermentables[1].colorSrm).toBe(120.0);

    // Hops
    expect(r1.hops).toHaveLength(2);
    expect(r1.hops[0].name).toBe('Citra');
    expect(r1.hops[0].amountG).toBe(30);
    expect(r1.hops[0].alphaAcidPct).toBe(12.5);
    expect(r1.hops[0].use).toBe('Boil');

    expect(r1.hops[1].use).toBe('DryHop');
    expect(r1.hops[1].amountG).toBe(50);

    // Yeasts
    expect(r1.yeasts).toHaveLength(1);
    expect(r1.yeasts[0].name).toBe('SafAle US-05');
    expect(r1.yeasts[0].laboratory).toBe('Fermentis');
    expect(r1.yeasts[0].attenuationPct).toBe(81.0);

    // Miscs
    expect(r1.miscs).toHaveLength(1);
    expect(r1.miscs[0].name).toBe('Irish Moss');
    expect(r1.miscs[0].type).toBe('Fining');
    expect(r1.miscs[0].amount).toBe(5); // converted 0.005 kg to 5g
    expect(r1.miscs[0].unit).toBe('g');

    // Recipe 2: Dry Irish Stout
    const r2 = recipes[1];
    expect(r2.name).toBe('Dry Irish Stout');
    expect(r2.author).toBe('Dublin Brewer');
    expect(r2.styleName).toBe('Irish Stout');
    expect(r2.fermentables).toHaveLength(1);
    expect(r2.hops).toHaveLength(1);
    expect(r2.yeasts).toHaveLength(1);
    expect(r2.miscs).toHaveLength(0);
  });

  it('handles empty or malformed XML gracefully', () => {
    expect(parseBeerXml('', { defaultEquipmentId: 'eq-1' })).toEqual([]);
    expect(parseBeerXml('<INVALID>stuff</INVALID>', { defaultEquipmentId: 'eq-1' })).toEqual([]);
  });
});
