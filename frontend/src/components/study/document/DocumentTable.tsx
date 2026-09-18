/**
 * DocumentTable — Renders risks, timeline, participants, or other tables.
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
}

export function DocumentTable({ columns, rows }: DocumentTableProps) {
  if (rows.length === 0) return null;
  return (
    <table className={styles.docTable}>
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
              <td key={col.key} style={{ textAlign: col.align || 'left', width: col.width }}>
                {row[col.key] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
