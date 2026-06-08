'use client'

import type { CertificatePreviewData } from './certificate-artwork'

function SidebarCertificate({ data }: { data: CertificatePreviewData }) {
  const navy = data.navy || '#0B2048'
  const accent = data.accent || '#1E7FD4'
  const gold = data.gold || '#C9963A'
  const year = data.year || String(new Date().getFullYear())
  const trackShort = data.trackLabel.split('—')[0].trim()

  return (
    <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'row', position: 'relative', overflow: 'hidden', boxShadow: '0 16px 48px rgba(11,32,72,0.14)', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ width: '28%', minWidth: 200, flexShrink: 0, background: navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '36px 22px', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: accent, borderRadius: 12, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${gold}55` }}>
            <span style={{ fontSize: 22 }}>★</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase' }}>AdharaEdu<br />Schools</div>
          <div style={{ width: 32, height: 1.5, background: gold, opacity: 0.5, margin: '12px auto' }} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>Structured tech education for secondary schools · Nigeria</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', border: `1.5px solid ${gold}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', border: `0.75px solid ${accent}55`, background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gold, fontSize: 18 }}>★</div>
          </div>
          <div style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>Official Seal</div>
        </div>
        <div style={{ width: '100%', textAlign: 'center' }}>
          {[
            ['Date Issued', data.issueDateLabel],
            ['Programme', `${trackShort} · ${year}`],
            ['Credential ID', data.serialNumber],
          ].map(([label, value]) => (
            <div key={label} style={{ paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.07)', marginTop: 8 }}>
              <div style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 4, background: `linear-gradient(180deg, ${gold}, ${gold}40)` }} />
      <div style={{ flex: 1, background: '#fff', padding: '36px 40px 32px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} />
        <div style={{ fontSize: 9, color: accent, fontWeight: 600, letterSpacing: '0.35em', textTransform: 'uppercase', marginTop: 8 }}>Official Credential · AdharaEdu</div>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 'clamp(28px, 4vw, 42px)', color: navy, lineHeight: 1, margin: '8px 0 12px' }}>Certificate of Completion</div>
        <div style={{ width: 44, height: 3, background: gold, borderRadius: 2, marginBottom: 20 }} />
        <div style={{ fontSize: 13, color: '#8FA3B8', marginBottom: 6 }}>This is to certify that</div>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 'clamp(28px, 5vw, 44px)', color: navy, lineHeight: 1, marginBottom: 4 }}>{data.studentName}</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.15em', color: '#8FA3B8', textTransform: 'uppercase', marginBottom: 20 }}>Reg. {data.regNumber}</div>
        <div style={{ background: '#F7F9FC', borderLeft: `3px solid ${accent}`, padding: '12px 16px', borderRadius: '0 6px 6px 0', marginBottom: 18 }}>
          <div style={{ fontSize: 8, letterSpacing: '0.22em', color: '#8FA3B8', textTransform: 'uppercase', marginBottom: 4 }}>Programme Completed</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: navy, marginBottom: 4 }}>{data.trackLabel}</div>
          <div style={{ fontSize: 13, color: '#4A6070' }}>{data.schoolName}</div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            ['Grade', data.grade, gold],
            ['Average Score', `${data.averageScore}%`, navy],
            ['Year', year, navy],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ background: '#EEF2F7', border: '0.75px solid #DDE4EE', padding: '10px 16px', borderRadius: 5 }}>
              <div style={{ fontSize: 8, letterSpacing: '0.2em', color: '#8FA3B8', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: color as string }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '0.75px solid #DDE4EE', paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 24, color: navy }}>A. S. Chidera</div>
            <div style={{ width: 110, height: 1, background: `${accent}40`, margin: '6px 0' }} />
            <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#4A6070', textTransform: 'uppercase', fontWeight: 600 }}>Ali Samuel Chidera</div>
            <div style={{ fontSize: 11, color: '#8FA3B8', fontStyle: 'italic' }}>Founder & Chief Learning Officer, AdharaEdu</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.2em', color: '#8FA3B8', textTransform: 'uppercase' }}>Serial Number</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A6070' }}>{data.serialNumber}</div>
            <div style={{ fontSize: 8, letterSpacing: '0.2em', color: '#8FA3B8', textTransform: 'uppercase', marginTop: 8 }}>Verify at</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: accent, maxWidth: 220, wordBreak: 'break-all' }}>{data.verifyUrl}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassicCertificate({ data }: { data: CertificatePreviewData }) {
  const navy = data.navy || '#0B1F3A'
  const accent = data.accent || '#1E7FD4'
  const gold = data.gold || '#C9963A'

  return (
    <div style={{ width: '100%', maxWidth: 960, background: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.10)', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ height: 6, background: navy, position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${navy}, ${gold} 30%, ${gold} 70%, ${navy})` }} />
      </div>
      <div style={{ position: 'absolute', inset: 14, border: `0.75px solid ${gold}38`, pointerEvents: 'none' }} />
      <div style={{ padding: '40px 56px 36px', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, background: navy, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5C518', fontSize: 20 }}>★</div>
          <div style={{ width: 1, height: 36, background: '#E2E8F0' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: navy }}>AdharaEdu Schools</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>Structured tech education for secondary schools · Nigeria</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
          <div style={{ width: 6, height: 6, background: gold, transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 9, letterSpacing: '0.42em', color: accent, textTransform: 'uppercase', fontWeight: 600 }}>Official Credential</div>
        <div style={{ fontSize: 10, letterSpacing: '0.35em', color: gold, textTransform: 'uppercase', margin: '4px 0' }}>Certificate of</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(24px, 4vw, 36px)', color: navy, letterSpacing: '0.06em', marginBottom: 18 }}>Completion</div>
        <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontStyle: 'italic', fontSize: 15, color: '#546070', marginBottom: 6 }}>This is to certify that</div>
        <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontWeight: 700, fontSize: 'clamp(30px, 6vw, 48px)', color: navy, lineHeight: 1.05, marginBottom: 6 }}>{data.studentName}</div>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 14 }}>Reg. {data.regNumber}</div>
        <div style={{ fontSize: 14, color: '#546070', marginBottom: 4 }}>has successfully completed the</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: navy, marginBottom: 4 }}>{data.trackLabel}</div>
        <div style={{ fontSize: 14, color: '#546070', marginBottom: 16 }}>programme at <strong style={{ color: navy }}>{data.schoolName}</strong></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
          {[
            ['Grade', data.grade, gold],
            ['Average Score', `${data.averageScore}%`, navy],
            ['Issued', data.issueDateLabel, navy],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ background: '#F2F4F7', border: '0.75px solid #E2E8F0', padding: '10px 18px', borderRadius: 4 }}>
              <div style={{ fontSize: 8, letterSpacing: '0.22em', color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: color as string }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', borderTop: `0.75px solid ${gold}30`, paddingTop: 18 }}>
          <div style={{ width: 80, height: 80, border: `1px dashed ${accent}50`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: `${accent}88`, textAlign: 'center', lineHeight: 1.4 }}>QR encodes<br />verify URL<br />(PDF only)</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', color: gold, fontSize: 22 }}>★</div>
            <div style={{ fontSize: 8, letterSpacing: '0.16em', color: `${accent}88`, textTransform: 'uppercase' }}>Official Seal</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontStyle: 'italic', fontSize: 22, color: navy }}>A. S. Chidera</div>
            <div style={{ width: 100, height: 1, background: `${accent}40`, margin: '6px auto' }} />
            <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#546070', textTransform: 'uppercase' }}>Ali Samuel Chidera</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Founder & Chief Learning Officer</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `0.75px solid ${gold}30`, gap: 8, flexWrap: 'wrap', fontSize: 8, color: '#9AAABA', textTransform: 'uppercase' }}>
          <div style={{ textAlign: 'left' }}>Date Issued<strong style={{ display: 'block', color: '#546070', textTransform: 'none', fontSize: 10, marginTop: 3 }}>{data.issueDateLabel}</strong></div>
          <div style={{ textAlign: 'center' }}>Serial No.<strong style={{ display: 'block', color: '#546070', textTransform: 'none', fontSize: 10, marginTop: 3 }}>{data.serialNumber}</strong></div>
          <div style={{ textAlign: 'right' }}>Verify Online<strong style={{ display: 'block', color: '#546070', textTransform: 'none', fontSize: 10, marginTop: 3, wordBreak: 'break-all' }}>{data.verifyUrl}</strong></div>
        </div>
      </div>
      <div style={{ height: 6, background: navy, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${navy}, ${gold} 30%, ${gold} 70%, ${navy})` }} />
      </div>
    </div>
  )
}

export function CertificateArtworkPreview({ data, scale = 1 }: { data: CertificatePreviewData; scale?: number }) {
  const inner = data.template === 'SIDEBAR'
    ? <SidebarCertificate data={data} />
    : <ClassicCertificate data={data} />

  return (
    <div style={{ background: '#E2E8F0', padding: scale < 1 ? 12 : 24, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
      <div style={{ transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top center', width: scale < 1 ? `${100 / scale}%` : '100%' }}>
        {inner}
      </div>
    </div>
  )
}
