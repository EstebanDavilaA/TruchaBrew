import React, { useState } from 'react';
import type { EquipmentProfile } from '@truchabrew/shared-types';
import { deleteEquipmentProfile, ApiClientError } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { formatVolume } from '@truchabrew/calculations';
import { EquipmentForm } from './EquipmentForm';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ListRow, LIST_CONTAINER_CLASS } from './ListRow';
import { BODY_TEXT_CLASS } from './designSystem';
import { Button } from './ui';
import { Plus, AlertTriangle, RotateCw, Beaker } from 'lucide-react';

interface EquipmentManagerProps {
  profiles: EquipmentProfile[];
  loadError: string | null;
  onReload: () => void;
  /** editor.recipe?.equipment.id ?? null — that profile's Delete is disabled (AC-45). */
  activeRecipeEquipmentId: string | null;
  onCreated: (profile: EquipmentProfile) => void;
  onUpdated: (profile: EquipmentProfile) => void;
  onDeleted: (id: string) => void;
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

type FormTarget = { mode: 'create' } | { mode: 'edit'; profile: EquipmentProfile } | null;

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({
  profiles,
  loadError,
  onReload,
  activeRecipeEquipmentId,
  onCreated,
  onUpdated,
  onDeleted,
  onOpenMobileNav,
}) => {
  const { config } = useConfig();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const handleDelete = async (profile: EquipmentProfile) => {
    setDeletingId(profile.id);
    setDeleteError(null);
    try {
      await deleteEquipmentProfile(profile.id);
      onDeleted(profile.id);
      setFormTarget(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to delete equipment profile.';
      setDeleteError({ id: profile.id, message });
    } finally {
      setDeletingId(null);
    }
  };

  if (formTarget?.mode === 'create') {
    return (
      <EquipmentForm
        key="create"
        mode="create"
        onSaved={(created) => {
          onCreated(created);
          setFormTarget(null);
        }}
        onCancel={() => setFormTarget(null)}
        onOpenMobileNav={onOpenMobileNav}
      />
    );
  }
  if (formTarget?.mode === 'edit') {
    const blockedReason = formTarget.profile.id === activeRecipeEquipmentId ? 'In use by the recipe currently open in the editor' : null;
    return (
      <EquipmentForm
        key={`edit-${formTarget.profile.id}`}
        mode="edit"
        initialProfile={formTarget.profile}
        onSaved={(updated) => {
          onUpdated(updated);
          setFormTarget(null);
        }}
        onCancel={() => setFormTarget(null)}
        deleteAction={{
          onConfirm: () => handleDelete(formTarget.profile),
          blockedReason,
          busy: deletingId === formTarget.profile.id,
          error: deleteError?.id === formTarget.profile.id ? deleteError.message : null,
        }}
        onOpenMobileNav={onOpenMobileNav}
      />
    );
  }

  return (
    <>
      <TopBar title="Equipment Profiles" onOpenMobileNav={onOpenMobileNav}>
        <Button
          variant="primary"
          size="sm"
          type="button"
          onClick={() => setFormTarget({ mode: 'create' })}
          data-testid="equipment-new-profile"
        >
          <Plus className="w-4 h-4" /> New Profile
        </Button>
      </TopBar>
      <PageContainer>
      {loadError && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-4 flex items-start gap-3 text-sm text-rose-200 mb-6">
          <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-rose-300">Couldn't load your equipment profiles</div>
            <div className="text-rose-200/90">{loadError}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={onReload}
          >
            <RotateCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {!loadError && profiles.length === 0 && (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-10 text-center ${BODY_TEXT_CLASS}`}>
          <Beaker className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          No equipment profiles yet. Create one to start brewing.
        </div>
      )}

      {!loadError && profiles.length > 0 && (
        <div className={LIST_CONTAINER_CLASS}>
          {profiles.map((profile) => (
            <ListRow
              key={profile.id}
              testId={`equipment-row-${profile.id}`}
              label={`Open "${profile.name}"`}
              onOpen={() => setFormTarget({ mode: 'edit', profile })}
              primary={profile.name}
              meta={
                <>
                  <span>{formatVolume(profile.batchSizeL, config.unitSystem)} batch</span>
                  <span>•</span>
                  <span>{profile.boilTimeMin} min boil</span>
                  <span>•</span>
                  <span>{profile.brewhouseEfficiencyPct}% brewhouse eff.</span>
                  <span>•</span>
                  <span>{profile.hopUtilizationPct}% hop util.</span>
                  <span>•</span>
                  <span>{profile.mashWaterRatioLPerKg} L/kg mash water</span>
                  <span>•</span>
                  <span>{profile.grainAbsorptionLPerKg} L/kg absorption</span>
                </>
              }
            />
          ))}
        </div>
      )}
      </PageContainer>
    </>
  );
};
