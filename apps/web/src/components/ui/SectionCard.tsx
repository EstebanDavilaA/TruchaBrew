import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { CARD_CLASS, SECTION_HEADING_CLASS } from '../designSystem';

export type SectionCardHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface SectionCardProps {
  /** Stable anchor id — written verbatim as the root <section> DOM id. Must be
   *  unique within the page and, for jump-nav targeting, exactly equal to a
   *  StickyJumpNavItem.id. Required. */
  id: string;
  /** Heading content. Required. */
  title: ReactNode;
  /** Rendered heading level (h1..h6). Default 2. */
  headingLevel?: SectionCardHeadingLevel;
  /** Optional decorative icon; wrapped aria-hidden. Optional. */
  icon?: ReactNode;
  /** Optional non-interactive slot rendered at the far right of the header.
   *  Renders inside the disclosure <button> when collapsible. Optional. */
  badge?: ReactNode;
  /** When true the header becomes a disclosure toggle and the body may be
   *  collapsed. Default false. */
  collapsible?: boolean;
  /** Uncontrolled initial open state. Only consulted when `open` is undefined.
   *  Default true. */
  defaultOpen?: boolean;
  /** Controlled open state. When `open !== undefined`, component is fully
   *  controlled and `defaultOpen` is ignored. Optional. */
  open?: boolean;
  /** Called with the next open state on header click (both modes). Optional. */
  onToggle?: (open: boolean) => void;
  /** Rendered unchanged as the card body. */
  children?: ReactNode;
  /** Passthrough onto the root <section>. */
  className?: string;
}

// Module-local structural constants (design-token governance: a string is only
// promoted into designSystem.ts once it recurs at >=2 real call sites; each of
// these has a single P1 usage, mirroring Button.tsx's local layoutClass).
type HeadingTagName = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const DISCLOSURE_TRIGGER_CLASS =
  'w-full flex items-center gap-2 text-left bg-transparent border-0 p-0 cursor-pointer';
const TITLE_SPAN_CLASS = 'flex-1';
const CHEVRON_CLASS = 'w-4 h-4 text-slate-400 flex-shrink-0';
const CHEVRON_OPEN_CLASS = 'rotate-180';

export function SectionCard({
  id,
  title,
  headingLevel = 2,
  icon,
  badge,
  collapsible = false,
  defaultOpen = true,
  open,
  onToggle,
  children,
  className,
}: SectionCardProps) {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const resolvedOpen = isControlled ? open : uncontrolledOpen;

  const handleToggle = () => {
    if (isControlled) {
      // Controlled: `open` is the sole source of truth. Notify the caller of
      // the requested next state; never mutate internal state.
      onToggle?.(!open);
    } else {
      // Uncontrolled: flip internal state, then observe.
      const next = !uncontrolledOpen;
      setUncontrolledOpen(next);
      onToggle?.(next);
    }
  };

  const HeadingTag = `h${headingLevel}` as HeadingTagName;
  const rootClass = [CARD_CLASS, className].filter(Boolean).join(' ');

  return (
    <section id={id} data-testid={`${id}-section`} className={rootClass}>
      {collapsible ? (
        <HeadingTag className={SECTION_HEADING_CLASS}>
          <button
            type="button"
            data-testid={`${id}-toggle`}
            aria-expanded={resolvedOpen}
            aria-controls={`${id}-panel`}
            onClick={handleToggle}
            className={DISCLOSURE_TRIGGER_CLASS}
          >
            {icon && <span aria-hidden="true">{icon}</span>}
            <span className={TITLE_SPAN_CLASS}>{title}</span>
            {badge && <span>{badge}</span>}
            <ChevronDown
              aria-hidden="true"
              className={
                resolvedOpen ? `${CHEVRON_CLASS} ${CHEVRON_OPEN_CLASS}` : CHEVRON_CLASS
              }
            />
          </button>
        </HeadingTag>
      ) : (
        <HeadingTag className={SECTION_HEADING_CLASS} data-testid={`${id}-title`}>
          {icon && <span aria-hidden="true">{icon}</span>}
          <span className={TITLE_SPAN_CLASS}>{title}</span>
          {badge && <span>{badge}</span>}
        </HeadingTag>
      )}

      {collapsible ? (
        resolvedOpen && (
          <div id={`${id}-panel`} data-testid={`${id}-panel`}>
            {children}
          </div>
        )
      ) : (
        <div data-testid={`${id}-panel`}>{children}</div>
      )}
    </section>
  );
}
