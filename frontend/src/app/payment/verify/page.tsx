'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { paystackApi } from '@/lib/api'

function PaymentVerifyInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'verifying'|'success'|'failed'>('verifying')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const reference = params.get('reference')
    if (!reference) { setStatus('failed'); return }
    paystackApi.verify(reference)
      .then(d => { setData(d); setStatus(d.verified ? 'success' : 'failed') })
      .catch(() => setStatus('failed'))
  }, [])

  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--navy)',padding:20 }}>
      <div style={{ background:'rgba(10,22,40,0.9)',border:'1px solid var(--border)',borderRadius:20,padding:48,maxWidth:440,width:'100%',textAlign:'center',backdropFilter:'blur(16px)' }}>
        {status === 'verifying' && <>
          <div style={{ fontSize:56,marginBottom:20 }}>⏳</div>
          <h2 style={{ fontFamily:'var(--font-display)',color:'var(--white)',fontSize:22,marginBottom:8 }}>Verifying payment…</h2>
          <p style={{ color:'var(--muted)',fontSize:14 }}>Please wait while we confirm your payment.</p>
        </>}
        {status === 'success' && <>
          <div style={{ fontSize:56,marginBottom:20 }}>✅</div>
          <h2 style={{ fontFamily:'var(--font-display)',color:'var(--white)',fontSize:22,marginBottom:8 }}>Payment Confirmed!</h2>
          <p style={{ color:'var(--muted)',fontSize:14,marginBottom:24 }}>Your payment of <strong style={{ color:'var(--success)' }}>₦{(data?.payment?.amount||0).toLocaleString()}</strong> has been received. A receipt has been emailed to you.</p>
          <button onClick={() => router.push('/dashboard/admin')} className="btn btn-primary" style={{ width:'100%',justifyContent:'center' }}>Back to Dashboard →</button>
        </>}
        {status === 'failed' && <>
          <div style={{ fontSize:56,marginBottom:20 }}>❌</div>
          <h2 style={{ fontFamily:'var(--font-display)',color:'var(--white)',fontSize:22,marginBottom:8 }}>Payment Not Confirmed</h2>
          <p style={{ color:'var(--muted)',fontSize:14,marginBottom:24 }}>We could not verify this payment. Please try again or contact support at adharaEdu0@gmail.com</p>
          <button onClick={() => router.push('/dashboard/admin?section=payments')} className="btn btn-ghost" style={{ width:'100%',justifyContent:'center' }}>Back to Payments</button>
        </>}
      </div>
    </div>
  )
}

export default function PaymentVerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--navy)',padding:20 }}>
        <div style={{ background:'rgba(10,22,40,0.9)',border:'1px solid var(--border)',borderRadius:20,padding:48,maxWidth:440,width:'100%',textAlign:'center',backdropFilter:'blur(16px)' }}>
          <div style={{ fontSize:56,marginBottom:20 }}>⏳</div>
          <h2 style={{ fontFamily:'var(--font-display)',color:'var(--white)',fontSize:22,marginBottom:8 }}>Loading payment page…</h2>
          <p style={{ color:'var(--muted)',fontSize:14 }}>Please wait a moment.</p>
        </div>
      </div>
    }>
      <PaymentVerifyInner />
    </Suspense>
  )
}
