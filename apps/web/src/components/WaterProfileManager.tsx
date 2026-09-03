import React, { useState } from 'react';
import type { WaterProfile } from '@truchabrew/shared-types';
import { deleteWaterProfile, ApiClientError } from '../api/client';
import { WaterProfileForm } from './WaterProfileForm';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ListRow, LIST_CONTAINER_CLASS } from './ListRow';
import { BODY_TEXT_CLASS } from './designSystem';
import { Button, Badge } from './ui';
import { Plus, AlertTriangle, RotateCw, Droplets } from 'lucide-react';

interface WaterProfileManagerProps {
  profiles: WaterProfile[];
  loadError: string | null;
  onReload: () => void;
  activeRecipeSourceId: string | null;
  activeRecipeTargetId: string | null;
  onCreated: (profile: WaterProfile) => void;
  onUpdated: (profile: WaterProfile) => void;
  onDeleted: (id: string) => void;
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

type FormTarget = { mode: 'create' } | { mode: 'edit'; profile: WaterProfile } | null;

export const WaterProfileManager: React.FC<WaterProfileManagerProps> = ({
  profiles,
  loadError,
  onReload,
  activeRecipeSourceId,
  activeRecipeTargetId,
  onCreated,
  onUpdated,
  onDeleted,
  onOpenMobileNav,
}) => {
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const handleDelete = async (profile: WaterProfile) => {
    setDeletingId(profile.id);
    setDeleteError(null);
    try {
      await deleteWaterProfile(profile.id);
      onDeleted(profile.id);
      setFormTarget(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to delete water profile.';
      setDeleteError({ id: profile.id, message });
    } finally {
      setDeletingId(null);
    }
  };

  if (formTarget?.mode === 'create') {
    return (
      <WaterProfileForm
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
    const isUsedByActiveRecipe =
      formTarget.profile.id === activeRecipeSourceId || formTarget.profile.id === activeRecipeTargetId;
    const blockedReason = isUsedByActiveRecipe
      ? 'In use by the recipe currently open in the editor'
      : null;

    return (
      <WaterProfileForm
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
      <TopBar title="Water Profiles" onOpenMobileNav={onOpenMobileNav}>
        <Button
          variant="primary"
          size="sm"
          type="button"
          onClick={() => setFormTarget({ mode: 'create' })}
          data-testid="water-new-profile"
        >
          <Plus className="w-4 h-4" /> New Profile
        </Button>
      </TopBar>
      <PageContainer>
        {loadError && (
          <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-4 flex items-start gap-3 text-sm text-rose-200 mb-6">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-rose-300">Couldn't load your water profiles</div>
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
            <Droplets className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            No water profiles yet. Create one to define your source water or style target profiles.
          </div>
        )}

        {!loadError && profiles.length > 0 && (
          <div className={LIST_CONTAINER_CLASS}>
            {profiles.map((profile) => (
              <ListRow
                key={profile.id}
                testId={`water-row-${profile.id}`}
                label={`Open "${profile.name}"`}
                onOpen={() => setFormTarget({ mode: 'edit', profile })}
                primary={profile.name}
                meta={
                  <>
                    <Badge variant="neutral" size="sm" className="capitalize">
                      {profile.type}
                    </Badge>
                    <span>•</span>
                    <span>Ca: {profile.calcium} | Mg: {profile.magnesium} | Na: {profile.sodium}</span>
                    <span>•</span>
                    <span>Cl: {profile.chloride} | SO₄: {profile.sulfate} | HCO₃: {profile.bicarbonate}</span>
                    {profile.ph !== null && (
                      <>
                        <span>•</span>
                        <span>pH {profile.ph}</span>
                      </>
                    )}
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
