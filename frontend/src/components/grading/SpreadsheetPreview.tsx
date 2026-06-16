'use client'

import { PreviewFrame, PreviewPanel } from './PreviewPanel'

type Sheet = {
  sheetName: string
  headers?: string[]
  rows?: unknown[][]
  formulas?: { cell: string; formula: string }[]
}

export function SpreadsheetPreview({ tables }: { tables: Sheet[] }) {
  if (!tables?.length) return null

  return (
    <PreviewPanel
      title={`Preview spreadsheet (${tables.length} sheet${tables.length === 1 ? '' : 's'})`}
      footer="Table rebuilt from the Excel file. Download the .xlsx for formulas and formatting in Excel."
    >
      <PreviewFrame background="rgba(255,255,255,0.97)">
        <div style={{ maxHeight: 380, overflow: 'auto', padding: 12 }}>
          {tables.map((sheet) => (
            <div key={sheet.sheetName} style={{ marginBottom: tables.length > 1 ? 20 : 0 }}>
              {tables.length > 1 && (
                <div className="text-xs" style={{ fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  {sheet.sheetName}
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#1e293b' }}>
                {sheet.headers?.length ? (
                  <thead>
                    <tr>
                      {sheet.headers.map((h, i) => (
                        <th
                          key={i}
                          style={{
                            border: '1px solid #cbd5e1',
                            padding: '8px 10px',
                            background: '#f1f5f9',
                            textAlign: 'left',
                            fontWeight: 600,
                          }}
                        >
                          {String(h ?? '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {(sheet.rows || []).slice(0, 40).map((row, ri) => (
                    <tr key={ri}>
                      {(row || []).map((cell, ci) => (
                        <td
                          key={ci}
                          style={{ border: '1px solid #e2e8f0', padding: '7px 10px', verticalAlign: 'top' }}
                        >
                          {String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sheet.formulas?.length ? (
                <div className="text-xs text-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  Formulas: {sheet.formulas.slice(0, 6).map((f) => `${f.cell}=${f.formula}`).join(' · ')}
                  {sheet.formulas.length > 6 ? ' …' : ''}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </PreviewFrame>
    </PreviewPanel>
  )
}
