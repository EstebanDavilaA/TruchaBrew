import { asc } from 'drizzle-orm';
import type { CatalogResponse, FermentableType, HopType, YeastType, YeastForm, MiscType, MiscUse, MiscUnit } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import { catalogFermentables, catalogHops, catalogYeasts, catalogMiscs } from '../db/schema';

export function getCatalog(db: Db): CatalogResponse {
  const fermentables = db.select().from(catalogFermentables).orderBy(asc(catalogFermentables.name)).all();
  const hops = db.select().from(catalogHops).orderBy(asc(catalogHops.name)).all();
  const yeasts = db.select().from(catalogYeasts).orderBy(asc(catalogYeasts.name)).all();
  const miscs = db.select().from(catalogMiscs).orderBy(asc(catalogMiscs.name)).all();

  return {
    fermentables: fermentables.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type as FermentableType,
      colorSrm: f.colorSrm,
      potentialSg: f.potentialSg,
    })),
    hops: hops.map((h) => ({
      id: h.id,
      name: h.name,
      alphaAcidPct: h.alphaAcidPct,
      type: h.type as HopType,
    })),
    yeasts: yeasts.map((y) => ({
      id: y.id,
      name: y.name,
      laboratory: y.laboratory,
      type: y.type as YeastType,
      form: y.form as YeastForm,
      attenuationPct: y.attenuationPct,
    })),
    miscs: miscs.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type as MiscType,
      defaultUse: m.defaultUse as MiscUse,
      defaultUnit: m.defaultUnit as MiscUnit,
    })),
  };
}
