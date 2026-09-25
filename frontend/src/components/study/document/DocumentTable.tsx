/**
 * DocumentTable — Renders risks, timeline, participants, or other tables.
 *
 * VC-2B: tableScroll wrapper, stackedTable class, data-label for narrow stacking.
 */

import styles from './document.module.css';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;  // e.g., '80px', '30%'
}

interface DocumentTableProps {
  columns: Column[];
  rows: Record<string, string | number | null>[];
  /** If false, table stays horizontal on narrow viewports. Default: true */
  stackOnNarrow?: boolean;
}

export function DocumentTable({ columns, rows, stackOnNarrow = true }: DocumentTableProps) {
  if (rows.length === 0) return null;

  const tableClass = stackOnNarrow
    ? `${styles.docTable} ${styles.stackedTable}`
    : styles.docTable;

  return (
    <div className={styles.tableScroll}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align || 'left', width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  data-label={col.label}
                  className={col.align === 'center' ? styles.cellCenter : undefined}
                  style={{ textAlign: col.align || 'left', width: col.width }}
                >
                  {row[col.key] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
