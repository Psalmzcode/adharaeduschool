'use client'

import { useState } from 'react'
import { MarketingNav } from '@/components/MarketingNav'

const SUBJECTS = ['School Partnership', 'Student Enquiry', 'Tutor Application', 'Technical Support', 'Other'] as const

export default function ContactPage() {
  const [subject, setSubject] = useState<string>(SUBJECTS[0])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !email.trim() || !message.trim()) {
      return
    }
    setSending(true)
    window.setTimeout(() => {
      setSending(false)
      setSuccess(true)
    }, 1200)
  }

  function resetForm() {
    setSuccess(false)
    setFirstName('')
    setLastName('')
    setEmail('')
    setOrg('')
    setPhone('')
    setMessage('')
    setSubject(SUBJECTS[0])
  }

  return (
    <div className="contact-page marketing-subpage">
      <MarketingNav />

      <div className="contact-wrapper">
        <div className="contact-left">
          <div className="section-eyebrow">// contact us</div>
          <h1>Contact Us</h1>
          <p>
            Whether you&apos;re a school administrator ready to partner, a parent with questions, or someone who wants to join our mission — we&apos;re here.
          </p>

          <div className="contact-methods">
            <a className="contact-method" href="mailto:info@adharaedu.com">
              <div className="method-icon">✉️</div>
              <div className="method-info">
                <div className="method-label">Email us</div>
                <div className="method-value">info@adharaedu.com</div>
              </div>
            </a>
            <a className="contact-method" href="tel:+2348160486223">
              <div className="method-icon">📞</div>
              <div className="method-info">
                <div className="method-label">Contact us</div>
                <div className="method-value">0816 048 6223</div>
              </div>
            </a>
            <div className="contact-method">
              <div className="method-icon">📍</div>
              <div className="method-info">
                <div className="method-label">Address</div>
                <div className="method-value">Enugu, Nigeria</div>
              </div>
            </div>
            <a className="contact-method" href="https://wa.me/2348160486223" target="_blank" rel="noopener noreferrer">
              <div className="method-icon">💬</div>
              <div className="method-info">
                <div className="method-label">WhatsApp</div>
                <div className="method-value">Chat with us now</div>
              </div>
            </a>
          </div>
        </div>

        <div className="contact-form-wrap">
          <h3>Send us a Message</h3>
          <p>We typically respond within 24 hours on business days.</p>

          {!success ? (
            <form id="contact-form-body" onSubmit={submit}>
              <div style={{ marginBottom: 20 }}>
                <label className="contact-chip-label">What&apos;s this about?</label>
                <div className="subject-chips">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip${subject === s ? ' active' : ''}`}
                      onClick={() => setSubject(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cf-firstname">First Name</label>
                  <input
                    id="cf-firstname"
                    className="form-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Amaka"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cf-lastname">Last Name</label>
                  <input
                    id="cf-lastname"
                    className="form-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Okonkwo"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="cf-email">Email Address</label>
                <input
                  id="cf-email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amaka@greenacademy.edu.ng"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cf-org">
                  School / Organisation <span style={{ opacity: 0.5, fontSize: 11 }}>(optional)</span>
                </label>
                <input
                  id="cf-org"
                  className="form-input"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder="Green Academy Secondary School"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cf-phone">
                  Phone Number <span style={{ opacity: 0.5, fontSize: 11 }}>(optional)</span>
                </label>
                <input
                  id="cf-phone"
                  className="form-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 801 234 5678"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cf-message">Message</label>
                <textarea
                  id="cf-message"
                  className="form-input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us a bit about your school and what you're looking for..."
                  required
                />
              </div>

              <input type="hidden" name="subject" value={subject} readOnly />

              <div className="form-submit-row">
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? 'Sending...' : 'Send Message →'}
                </button>
                <span className="submit-note">We&apos;ll reply to your email</span>
              </div>
            </form>
          ) : (
            <div className="form-success show">
              <div className="success-icon">✅</div>
              <h3>Message Sent!</h3>
              <p>Thank you. We&apos;ve received your message and will get back to you within 24 hours.</p>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={resetForm}>
                Send another →
              </button>
            </div>
          )}
        </div>
      </div>

      <footer className="marketing-footer">
        <p>© 2026 AdharaEdu. All rights reserved.</p>
        <p>
          Built for Nigerian Schools 🇳🇬 &nbsp;·&nbsp;{' '}
          <a href="mailto:info@adharaedu.com">info@adharaedu.com</a>
        </p>
      </footer>
    </div>
  )
}
