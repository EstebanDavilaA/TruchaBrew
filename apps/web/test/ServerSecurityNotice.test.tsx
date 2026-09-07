import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { ServerSecurityNotice } from '../src/components/ServerSecurityNotice';

const COMPONENT_PATH = path.resolve(__dirname, '../src/components/ServerSecurityNotice.tsx');
const SOURCE = fs.readFileSync(COMPONENT_PATH, 'utf-8');

describe('AC-28: ServerSecurityNotice renders the required security copy', () => {
  it('renders data-testid="settings-security-notice" stating no login/password, network-wide visibility, no internet exposure, and local data storage', () => {
    render(<ServerSecurityNotice />);
    const card = screen.getByTestId('settings-security-notice');
    expect(card).toBeInTheDocument();

    const text = card.textContent ?? '';
    expect(text).toMatch(/no login/i);
    expect(text).toMatch(/no password/i);
    expect(text).toMatch(/same wifi network/i);
    expect(text).toMatch(/internet/i);
    expect(text).toMatch(/file on this machine/i);
  });
});

describe('AC-29: ServerSecurityNotice is token-clean and non-interactive (RA-18)', () => {
  it('declares zero local class-string constants', () => {
    expect(SOURCE).not.toMatch(/^\s*(export\s+)?const\s+[A-Z_]+_CLASS\s*=/m);
  });

  it('imports only CARD_CLASS, SECTION_HEADING_CLASS and BODY_TEXT_CLASS from designSystem', () => {
    const importMatch = SOURCE.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(importMatch).not.toBeNull();
    const names = (importMatch?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    expect(names).toEqual(['BODY_TEXT_CLASS', 'CARD_CLASS', 'SECTION_HEADING_CLASS']);
  });

  it('contains zero interactive elements (no button/input/select/textarea/anchor)', () => {
    expect(SOURCE).not.toMatch(/<button\b/);
    expect(SOURCE).not.toMatch(/<input\b/);
    expect(SOURCE).not.toMatch(/<select\b/);
    expect(SOURCE).not.toMatch(/<textarea\b/);
    expect(SOURCE).not.toMatch(/<a\s+href/);
  });

  it('contains zero explicit h-N height classes', () => {
    expect(SOURCE).not.toMatch(/[\s"'`]h-\d/);
  });

  it('contains zero text-slate-500/text-slate-600 literals', () => {
    expect(SOURCE).not.toContain('text-slate-500');
    expect(SOURCE).not.toContain('text-slate-600');
  });
});
