'use client'

/** Shared read-only display of tutor record (API tutor + user + assignments). */

const ID_LABELS: Record<string, string> = {
  NIN: 'NIN',
  VOTERS_CARD: "Voter's card",
  DRIVERS_LICENSE: "Driver's license",
  INTERNATIONAL_PASSPORT: 'International passport',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--white)', fontSize: 14 }}>{children ?? '—'}</div>
    </div>
  )
}

function ImgThumb({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) return <span className="text-muted text-sm">Not uploaded</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} style={{ maxWidth: 280, maxHeight: 200, borderRadius: 8, border: '1px solid var(--border2)', objectFit: 'contain', background: 'var(--muted3)' }} />
  )
}

type ProfileScope = 'platform' | 'school'

export function TutorProfileDetail({
  tutor,
  trackLabel,
  scope = 'platform',
}: {
  tutor: any
  trackLabel?: (code: string) => string
  scope?: ProfileScope
}) {
  const u = tutor?.user
  const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '—'
  const tl =
    trackLabel ||
    ((code: string) => String(code || '').replace('TRACK_', 'Track '))

  const guarantors = Array.isArray(tutor?.guarantors) ? tutor.guarantors : []
  const kyc = tutor?.schoolAdminKycSummary as
    | {
        identificationType?: string | null
        idNumberOnFile?: boolean
        passportPhotoOnFile?: boolean
        idDocumentOnFile?: boolean
        signatureOnFile?: boolean
        guarantorsOnFile?: number
      }
    | undefined

  const yesNo = (v: boolean | undefined) => (v ? 'Yes' : 'No')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Account</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          <Field label="Full name">{name}</Field>
          <Field label="Email">{u?.email}</Field>
          <Field label="Phone">{u?.phone || '—'}</Field>
          <Field label="Onboarding">{tutor?.onboardingStatus === 'COMPLETE' ? 'Complete' : tutor?.onboardingStatus === 'DRAFT' ? 'Draft / in progress' : tutor?.onboardingStatus || '—'}</Field>
          <Field label="Verified">{tutor?.isVerified ? 'Yes' : 'Pending'}</Field>
          <Field label="Rating">★ {tutor?.rating ?? '—'}</Field>
        </div>
      </div>

      <div className="card">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Professional profile</div>
        <Field label="Bio">{tutor?.bio || '—'}</Field>
        <Field label="Specializations">
          {(tutor?.specializations || []).length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(tutor.specializations as string[]).map((s) => (
                <span key={s} className="badge badge-teal" style={{ fontSize: 11 }}>{s}</span>
              ))}
            </div>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Program tracks">
          {(tutor?.tracks || []).length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(tutor.tracks as string[]).map((c: string) => (
                <span key={c} className="badge badge-gold" style={{ fontSize: 11 }}>{tl(c)}</span>
              ))}
            </div>
          ) : (
            '—'
          )}
        </Field>
      </div>

      {scope === 'platform' && (
        <div className="card">
          <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Payment</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            <Field label="Bank name">{tutor?.bankName}</Field>
            <Field label="Account number">{tutor?.bankAccount}</Field>
          </div>
        </div>
      )}

      <div className="card">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Verification (KYC)</div>
        {scope === 'school' && kyc ? (
          <div>
            <p className="text-muted text-sm mb-16" style={{ lineHeight: 1.5 }}>
              For privacy, documents and ID numbers are held by AdharaEdu. Below is what your school can confirm on file.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              <Field label="ID type (category)">
                {kyc.identificationType ? ID_LABELS[String(kyc.identificationType)] || kyc.identificationType : '—'}
              </Field>
              <Field label="ID number on file">{yesNo(kyc.idNumberOnFile)}</Field>
              <Field label="Passport photo on file">{yesNo(kyc.passportPhotoOnFile)}</Field>
              <Field label="ID document image on file">{yesNo(kyc.idDocumentOnFile)}</Field>
              <Field label="Signature on file">{yesNo(kyc.signatureOnFile)}</Field>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <div className="text-xs text-muted mb-8" style={{ textTransform: 'uppercase' }}>Passport photograph</div>
              <ImgThumb url={tutor?.passportPhotoUrl} alt="Passport" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              <Field label="ID type">{tutor?.identificationType ? ID_LABELS[String(tutor.identificationType)] || tutor.identificationType : '—'}</Field>
              <Field label="ID number">{tutor?.identificationNumber}</Field>
            </div>
            <div>
              <div className="text-xs text-muted mb-8" style={{ textTransform: 'uppercase' }}>ID document</div>
              <ImgThumb url={tutor?.identificationDocumentUrl} alt="ID document" />
            </div>
            <div>
              <div className="text-xs text-muted mb-8" style={{ textTransform: 'uppercase' }}>Signature</div>
              <ImgThumb url={tutor?.signatureUrl} alt="Signature" />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>Guarantors</div>
        {scope === 'school' && kyc ? (
          <p className="text-muted text-sm" style={{ lineHeight: 1.5 }}>
            {(kyc.guarantorsOnFile ?? 0) > 0
              ? `${kyc.guarantorsOnFile} guarantor(s) on file with the platform (contact details not shared with schools).`
              : 'None on file with the platform yet.'}
          </p>
        ) : guarantors.length === 0 ? (
          <p className="text-muted text-sm">None on file</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {guarantors.map((g: any, i: number) => (
              <div key={i} style={{ border: '1px solid var(--border2)', borderRadius: 8, padding: 14, background: 'var(--muted3)' }}>
                <div className="fw-600 text-white mb-10" style={{ fontSize: 13 }}>Guarantor {i + 1}</div>
                <Field label="Name">{g?.fullName}</Field>
                <Field label="Phone">{g?.phone}</Field>
                <Field label="Email">{g?.email}</Field>
                <Field label="Address">{g?.address}</Field>
                {g?.relationship ? <Field label="Relationship">{g.relationship}</Field> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="font-display fw-600 text-white mb-16" style={{ fontSize: 16 }}>School assignments</div>
        {!(tutor?.assignments || []).length ? (
          <p className="text-muted text-sm">No assignments</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Class</th>
                  <th>Track</th>
                  <th>Term</th>
                  <th>Sessions/wk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(tutor.assignments as any[]).map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.school?.name || '—'}</td>
                    <td>{a.className}</td>
                    <td>{tl(a.track)}</td>
                    <td style={{ fontSize: 12 }}>{a.termLabel}</td>
                    <td style={{ fontSize: 12 }}>{a.expectedSessionsPerWeek ?? '—'}</td>
                    <td><span className={`badge badge-${a.isActive !== false ? 'success' : 'warning'}`}>{a.isActive !== false ? 'Active' : 'Ended'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
