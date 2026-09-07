import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { CARD_CLASS, SECTION_HEADING_CLASS, BODY_TEXT_CLASS } from './designSystem';

/**
 * Static, non-interactive Settings card stating the honest security posture
 * (M42_P3 RA-1/RA-18). Takes no props, holds no state, performs no I/O — its
 * only job is to say, in-app, what README.md's Security section says.
 *
 * Constraints (RA-18, each satisfies an existing governance sweep): zero
 * local class-string constants of its own; only CARD_CLASS,
 * SECTION_HEADING_CLASS and BODY_TEXT_CLASS from designSystem; zero
 * interactive elements; zero explicit h-N height classes (the icon is sized
 * via lucide-react's `size` prop, not a Tailwind height utility).
 */
export function ServerSecurityNotice(): React.JSX.Element {
  return (
    <div className={CARD_CLASS} data-testid="settings-security-notice">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert aria-hidden="true" size={20} className="text-amber-500" />
        <h2 className={SECTION_HEADING_CLASS}>Security — Please Read</h2>
      </div>
      <p className={BODY_TEXT_CLASS}>
        This server has no login, no password, and no encryption of any kind.
      </p>
      <p className={`${BODY_TEXT_CLASS} mt-2`}>
        Anyone connected to the same wifi network can open this app and see or change your data.
      </p>
      <p className={`${BODY_TEXT_CLASS} mt-2`}>
        Never expose this server to the internet or forward a port to it — it is built only for a
        trusted home network.
      </p>
      <p className={`${BODY_TEXT_CLASS} mt-2`}>
        Your recipes and batches live in a single file on this machine, not in the cloud.
      </p>
    </div>
  );
}
