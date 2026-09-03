// Thin re-export shim. FermentableSection.tsx and YeastSection.tsx are pure
// (byte-identical) relocations per M1_P1 spec §1.4 and still import from
// '../types/brewing' — this file keeps that path resolving to the real,
// shared definitions in @truchabrew/shared-types without touching their content.
export * from '@truchabrew/shared-types';
