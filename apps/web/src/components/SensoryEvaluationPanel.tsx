import { useState, useMemo } from 'react';
import type { SensoryScoreInput } from '@truchabrew/calculations';
import { calculateBJCPScore } from '@truchabrew/calculations';
import { CARD_CLASS, SECTION_HEADING_CLASS, INPUT_CLASS } from './designSystem';
import { Button } from './ui';
import { Award, Star, CheckCircle2, FileText } from 'lucide-react';

export interface SensoryEvaluationPanelProps {
  initialRating?: number | null;
  initialNotes?: string | null;
  onSaveEvaluation?: (data: {
    totalScore: number;
    tier: string;
    starRating: number;
    notes: string;
    scoreBreakdown: SensoryScoreInput;
  }) => Promise<void>;
}

export function SensoryEvaluationPanel({
  initialRating,
  initialNotes,
  onSaveEvaluation,
}: SensoryEvaluationPanelProps) {
  const [scores, setScores] = useState<SensoryScoreInput>({
    aroma: 10,
    appearance: 3,
    flavor: 16,
    mouthfeel: 4,
    overall: 8,
  });

  const [tastingNotes, setTastingNotes] = useState<string>(initialNotes ?? '');
  const [busy, setBusy] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const scoreResult = useMemo(() => {
    return calculateBJCPScore(scores);
  }, [scores]);

  const updateScore = (key: keyof SensoryScoreInput, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!onSaveEvaluation) return;
    setBusy(true);
    try {
      await onSaveEvaluation({
        totalScore: scoreResult.totalScore,
        tier: scoreResult.tier,
        starRating: scoreResult.suggestedStarRating,
        notes: tastingNotes,
        scoreBreakdown: scores,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD_CLASS} data-testid="sensory-evaluation-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className={SECTION_HEADING_CLASS}>BJCP Sensory Evaluation &amp; Rating</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Structured 50-point BJCP score evaluation with automatic quality tiering and star rating.
          </p>
        </div>

        {/* Score & Tier Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  data-testid={`star-icon-${star}`}
                  className={`w-4 h-4 ${
                    star <= (initialRating ?? scoreResult.suggestedStarRating)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-600'
                  }`}
                />
              ))}
            </div>
            <span
              data-testid="bjcp-tier-badge"
              className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/80 inline-block mt-1"
            >
              {scoreResult.tier} ({scoreResult.totalScore}/50)
            </span>
          </div>
        </div>
      </div>

      {/* 5 Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Aroma */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="sensory-aroma" className="text-xs font-semibold text-slate-300">
              Aroma
            </label>
            <span className="text-xs font-bold text-amber-400">{scores.aroma}/12</span>
          </div>
          <input
            id="sensory-aroma"
            type="range"
            min="0"
            max="12"
            value={scores.aroma}
            onChange={(e) => updateScore('aroma', parseInt(e.target.value, 10))}
            className="w-full accent-amber-400 cursor-pointer"
            aria-label="Aroma score out of 12"
          />
          <p className="text-[10px] text-slate-400">Malt, hops, esters &amp; aromatics</p>
        </div>

        {/* Appearance */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="sensory-appearance" className="text-xs font-semibold text-slate-300">
              Appearance
            </label>
            <span className="text-xs font-bold text-amber-400">{scores.appearance}/3</span>
          </div>
          <input
            id="sensory-appearance"
            type="range"
            min="0"
            max="3"
            value={scores.appearance}
            onChange={(e) => updateScore('appearance', parseInt(e.target.value, 10))}
            className="w-full accent-amber-400 cursor-pointer"
            aria-label="Appearance score out of 3"
          />
          <p className="text-[10px] text-slate-400">Color, clarity &amp; head retention</p>
        </div>

        {/* Flavor */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="sensory-flavor" className="text-xs font-semibold text-slate-300">
              Flavor
            </label>
            <span className="text-xs font-bold text-amber-400">{scores.flavor}/20</span>
          </div>
          <input
            id="sensory-flavor"
            type="range"
            min="0"
            max="20"
            value={scores.flavor}
            onChange={(e) => updateScore('flavor', parseInt(e.target.value, 10))}
            className="w-full accent-amber-400 cursor-pointer"
            aria-label="Flavor score out of 20"
          />
          <p className="text-[10px] text-slate-400">Malt/hop balance, bitterness &amp; finish</p>
        </div>

        {/* Mouthfeel */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="sensory-mouthfeel" className="text-xs font-semibold text-slate-300">
              Mouthfeel
            </label>
            <span className="text-xs font-bold text-amber-400">{scores.mouthfeel}/5</span>
          </div>
          <input
            id="sensory-mouthfeel"
            type="range"
            min="0"
            max="5"
            value={scores.mouthfeel}
            onChange={(e) => updateScore('mouthfeel', parseInt(e.target.value, 10))}
            className="w-full accent-amber-400 cursor-pointer"
            aria-label="Mouthfeel score out of 5"
          />
          <p className="text-[10px] text-slate-400">Body, carbonation &amp; warmth</p>
        </div>

        {/* Overall */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="sensory-overall" className="text-xs font-semibold text-slate-300">
              Overall
            </label>
            <span className="text-xs font-bold text-amber-400">{scores.overall}/10</span>
          </div>
          <input
            id="sensory-overall"
            type="range"
            min="0"
            max="10"
            value={scores.overall}
            onChange={(e) => updateScore('overall', parseInt(e.target.value, 10))}
            className="w-full accent-amber-400 cursor-pointer"
            aria-label="Overall score out of 10"
          />
          <p className="text-[10px] text-slate-400">Overall impression &amp; drinkability</p>
        </div>
      </div>

      {/* Tasting Notes Input & Action */}
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="sensory-tasting-notes" className="block text-xs font-semibold text-slate-300 mb-1">
            Tasting Notes &amp; Sensory Feedback
          </label>
          <textarea
            id="sensory-tasting-notes"
            rows={3}
            value={tastingNotes}
            onChange={(e) => setTastingNotes(e.target.value)}
            placeholder="e.g. Crisp citrus aroma with pleasant grapefruit bitterness, light malt backbone, dry clean finish."
            className={`w-full ${INPUT_CLASS} text-xs`}
            aria-label="Tasting notes description"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400">
            Computed Score: <strong className="text-slate-100">{scoreResult.totalScore}/50</strong> ({scoreResult.tier})
          </span>
          <Button
            variant="primary"
            size="sm"
            type="button"
            data-testid="save-sensory-evaluation-btn"
            disabled={busy}
            onClick={handleSave}
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Evaluation Saved!
              </>
            ) : busy ? (
              'Saving…'
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Save Sensory Evaluation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
