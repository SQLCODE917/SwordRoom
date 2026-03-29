import type { ReactNode } from 'react';

export interface TableLiteColumn<Row> {
  id: string;
  header: string;
  render: (row: Row) => ReactNode;
}

interface TableLiteProps<Row> {
  ariaLabel: string;
  columns: Array<TableLiteColumn<Row>>;
  rows: Row[];
  placeholder: string;
}

export function TableLite<Row>({ ariaLabel, columns, rows, placeholder }: TableLiteProps<Row>) {
  return (
    <div className="c-table" role="table" aria-label={ariaLabel}>
      <div className="c-table__head c-table__row" role="row">
        {columns.map((column) => (
          <div className="c-table__cell t-small" role="columnheader" key={column.id}>
            {column.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="c-table__row" role="row">
          {columns.map((column, index) => (
            <div className="c-table__cell t-small" role="cell" key={column.id}>
              {index === 0 ? placeholder : ' '}
            </div>
          ))}
        </div>
      ) : (
        rows.map((row, rowIndex) => (
          <div className="c-table__row" role="row" key={`row-${rowIndex}`}>
            {columns.map((column) => (
              <div className="c-table__cell t-small" role="cell" key={column.id}>
                {column.render(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
