import type { TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, ReactNode } from 'react';
import { TABLE_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS } from '../designSystem';
import { TABLE_CELL_TEXT_CLASS, TABLE_CELL_SM_CLASS, TABLE_CELL_SM_TEXT_CLASS } from '../designSystem';

export type TableCellSize = 'sm' | 'md';
export type TableCellVariant = 'numeric' | 'text';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children?: ReactNode;
}

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  size?: TableCellSize;
  variant?: TableCellVariant;
}

export function Table({ className, children, ...props }: TableProps) {
  const mergedClass = [TABLE_CLASS, className].filter(Boolean).join(' ');

  return (
    <div className="overflow-x-auto">
      <table className={mergedClass} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeaderCell({ scope = 'col', className, children, ...props }: TableHeaderCellProps) {
  const mergedClass = [TABLE_HEADER_CELL_CLASS, className].filter(Boolean).join(' ');

  return (
    <th scope={scope} className={mergedClass} {...props}>
      {children}
    </th>
  );
}

// Exhaustive token-selection table over TableCellSize x TableCellVariant — no
// default branch, no fallback, no catch. An out-of-union size/variant value
// is a typecheck failure, which is the point (M35_P2 spec §1.2).
const TABLE_CELL_TOKENS: Record<TableCellSize, Record<TableCellVariant, string>> = {
  md: { numeric: TABLE_CELL_CLASS, text: TABLE_CELL_TEXT_CLASS },
  sm: { numeric: TABLE_CELL_SM_CLASS, text: TABLE_CELL_SM_TEXT_CLASS },
};

export function TableCell({ size = 'md', variant = 'numeric', className, children, ...props }: TableCellProps) {
  const mergedClass = [TABLE_CELL_TOKENS[size][variant], className].filter(Boolean).join(' ');

  return (
    <td className={mergedClass} {...props}>
      {children}
    </td>
  );
}
