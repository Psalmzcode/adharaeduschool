'use client'

import { PreviewFrame, PreviewPanel } from './PreviewPanel'

type ScratchData = {
  spriteCount: number
  blockCount: number
  hasSound: boolean
  hasMotion: boolean
  hasLoops: boolean
  hasConditionals: boolean
  hasVariables?: boolean
  scriptSummary?: string[]
}

const FLAG = (on: boolean) => (on ? 'Yes' : 'No')

export function ScratchProjectPreview({
  scratchData,
  fileUrl,
}: {
  scratchData: ScratchData
  fileUrl?: string | null
}) {
  const stats = [
    { label: 'Sprites', value: String(scratchData.spriteCount) },
    { label: 'Blocks', value: String(scratchData.blockCount) },
    { label: 'Motion', value: FLAG(scratchData.hasMotion) },
    { label: 'Loops', value: FLAG(scratchData.hasLoops) },
    { label: 'Conditionals', value: FLAG(scratchData.hasConditionals) },
    { label: 'Sound', value: FLAG(scratchData.hasSound) },
  ]

  return (
    <PreviewPanel
      title="Preview Scratch project"
      footer={
        fileUrl
          ? 'Download the .sb3 file and open it in the Scratch editor (scratch.mit.edu) to watch the project run.'
          : 'Analysis parsed from the .sb3 project file.'
      }
    >
      <PreviewFrame background="rgba(15,23,42,0.35)">
        <div style={{ padding: 14, maxHeight: 380, overflow: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border2)',
                }}
              >
                <div className="text-xs text-muted">{s.label}</div>
                <div style={{ fontWeight: 600, color: 'var(--white)', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
          {scratchData.scriptSummary?.length ? (
            <div>
              <div className="text-xs text-muted" style={{ marginBottom: 6 }}>
                Top-level scripts
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--white)', fontSize: 13, lineHeight: 1.55 }}>
                {scratchData.scriptSummary.slice(0, 12).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {fileUrl ? (
            <div style={{ marginTop: 12 }}>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs"
                style={{ color: 'var(--teal2)' }}
              >
                Download .sb3 for Scratch editor →
              </a>
            </div>
          ) : null}
        </div>
      </PreviewFrame>
    </PreviewPanel>
  )
}
