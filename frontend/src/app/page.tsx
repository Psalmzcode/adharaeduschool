'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HomeServicesCarousel } from '@/components/HomeServicesCarousel'
import { MarketingNav } from '@/components/MarketingNav'

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&q=80',
  '/hero/slide-1.png',
  '/hero/slide-2.png',
  '/hero/slide-3.png',
]

export default function HomePage() {
  const [heroImageIndex, setHeroImageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroImageIndex((i) => (i + 1) % HERO_IMAGES.length)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div id="page-home" className="page active" style={{display:'block'}}>

      <MarketingNav />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-grid"></div>
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="dot"></span>
            Nigeria&apos;s #1 School Tech Skills Platform
          </div>
          <h1>
            Equipping Students<br/>
            for the <span className="accent">Digital Economy</span>
          </h1>
          <p>
            AdharaEdu partners with secondary schools to deliver structured tech education — from computer basics to professional web development — in your existing computer lab.
          </p>
          <div className="hero-actions">
            <Link href="/auth/register" className="btn btn-primary btn-lg">Start Your School Partnership →</Link>
            <Link href="/auth/login" className="btn btn-outline btn-lg">View Demo Dashboard</Link>
          </div>
          <div className="hero-stats">
            <div>
              <div className="hero-stat-num">50<span>+</span></div>
              <div className="hero-stat-label">Schools Partnered</div>
            </div>
            <div>
              <div className="hero-stat-num">12<span>k</span></div>
              <div className="hero-stat-label">Students Enrolled</div>
            </div>
            <div>
              <div className="hero-stat-num">98<span>%</span></div>
              <div className="hero-stat-label">Completion Rate</div>
            </div>
            <div>
              <div className="hero-stat-num">3</div>
              <div className="hero-stat-label">Learning Tracks</div>
            </div>
          </div>
        </div>

        {/* Hero Visual — spinning rings */}
        <div className="hero-visual" style={{zIndex:1}}>
          <div className="hero-ring">
            <div className="orbit-dot orbit-dot-1"></div>
          </div>
          <div className="hero-ring hero-ring-2">
            <div className="orbit-dot orbit-dot-2" style={{top:'10px'}}></div>
          </div>
          <div className="hero-ring hero-ring-3"></div>
          <div className="hero-center">🎓</div>
        </div>

        {/* Hero Image — circular with conic shimmer */}
        <div className="hero-image-wrap">
          <div className="hero-image-shine"></div>
          <div className="hero-image-frame">
            <img
              src={HERO_IMAGES[heroImageIndex]}
              alt="Students learning tech skills"
              style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}
            />
            <div className="hero-image-overlay"></div>
          </div>
        </div>

        {/* Floating cards */}
        <div className="float-card float-card-1">
          <div className="float-card-label">🏆 Top Student</div>
          <div className="float-card-value">Aisha M.</div>
          <div className="float-card-sub">Track 3 — 94% Score</div>
        </div>
        <div className="float-card float-card-2">
          <div className="float-card-label">📊 This Week</div>
          <div className="float-card-value">248</div>
          <div className="float-card-sub">Sessions Completed</div>
        </div>
        <div className="float-card float-card-3">
          <div className="float-card-label">✅ New Cert</div>
          <div className="float-card-value">Track 1 Done</div>
          <div className="float-card-sub">32 Students Passed</div>
        </div>
      </section>

      {/* ── TRACKS SECTION ── */}
      <section style={{background:'var(--navy2)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
        <div className="section-eyebrow" style={{textAlign:'center'}}>Learning Tracks</div>
        <h2 className="section-title" style={{textAlign:'center',maxWidth:600,margin:'0 auto 12px'}}>
          Three Tracks, Every Student Level
        </h2>
        <p className="section-desc" style={{textAlign:'center',margin:'0 auto 0',maxWidth:500}}>
          We meet students where they are. No student is left behind because they don&apos;t know how to use a computer yet.
        </p>
        <div className="tracks-grid">
          {/* Track 1 */}
          <div className="track-card">
            <div className="track-glow"></div>
            <div className="track-icon track-icon-1">💻</div>
            <div className="track-level">Track 01 // JSS1 — SS1</div>
            <h3>Computer Appreciation</h3>
            <p>For students who are new to computers entirely. We build confidence before we build code.</p>
            <ul className="track-modules">
              <li>Computer parts &amp; OS basics</li>
              <li>Microsoft Word &amp; Excel</li>
              <li>Internet &amp; email safety</li>
              <li>Typing speed drills</li>
            </ul>
            <Link href="/services" className="btn btn-ghost btn-sm" style={{marginTop:20,width:'100%',justifyContent:'center'}}>Learn More →</Link>
          </div>
          {/* Track 2 — Featured */}
          <div className="track-card featured">
            <div className="track-glow"></div>
            <div className="badge badge-gold" style={{marginBottom:16}}>Most Popular</div>
            <div className="track-icon track-icon-2">🌐</div>
            <div className="track-level">Track 02 // SS1 — SS2</div>
            <h3>Intro to Programming</h3>
            <p>Scratch, HTML, CSS and JavaScript. Students build their first real webpage by the end of the term.</p>
            <ul className="track-modules">
              <li>Scratch visual programming</li>
              <li>HTML &amp; CSS fundamentals</li>
              <li>JavaScript basics</li>
              <li>Personal portfolio project</li>
            </ul>
            <Link href="/auth/register" className="btn btn-primary btn-sm" style={{marginTop:20,width:'100%',justifyContent:'center'}}>Enroll Now →</Link>
          </div>
          {/* Track 3 */}
          <div className="track-card">
            <div className="track-glow"></div>
            <div className="track-icon track-icon-3">🚀</div>
            <div className="track-level">Track 03 // SS3</div>
            <h3>Advanced Tech Skills</h3>
            <p>Pre-university track with real frontend development, Python, backend basics, and how to earn from tech.</p>
            <ul className="track-modules">
              <li>Frontend dev (HTML+CSS+JS)</li>
              <li>Python programming</li>
              <li>Backend &amp; databases intro</li>
              <li>Freelancing &amp; Fiverr</li>
              <li>Capstone project</li>
            </ul>
            <Link href="/services" className="btn btn-ghost btn-sm" style={{marginTop:20,width:'100%',justifyContent:'center'}}>Learn More →</Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works">
        <div className="how-grid">
          <div>
            <div className="section-eyebrow">How It Works</div>
            <h2 className="section-title">From Sign-Up to<br/>First Class in 4 Weeks</h2>
            <p className="section-desc" style={{marginBottom:48}}>We handle everything. Your school provides the computer lab, we provide the rest.</p>
            <div className="steps">
              {[
                {n:'1',title:'Sign the Partnership Agreement',desc:'A simple one-term pilot agreement. No long-term lock-in for first-time partners.'},
                {n:'2',title:'Free Student Assessment',desc:'We assess a sample class to confirm which track is right for which students. No guessing.'},
                {n:'3',title:'Tutor Deployed to Your School',desc:'A vetted, trained AdharaEdu tutor begins classes on a schedule that works for your timetable.'},
                {n:'4',title:'Dashboard Goes Live',desc:'Your admin, tutors, students and parents all get portal access. You see everything in real time.'},
              ].map((s,i,arr) => (
                <div key={s.n} className="step" style={{paddingBottom: i<arr.length-1?40:0}}>
                  {i<arr.length-1 && <div style={{position:'absolute',left:23,top:48,width:2,height:'calc(100% - 48px)',background:'linear-gradient(to bottom, var(--gold), transparent)'}}></div>}
                  <div className="step-num">{s.n}</div>
                  <div className="step-content">
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Dashboard Mockup */}
          <div className="dashboard-mockup">
            <div className="mockup-topbar">
              <div className="mockup-dot" style={{background:'#EF4444'}}></div>
              <div className="mockup-dot" style={{background:'#F59E0B'}}></div>
              <div className="mockup-dot" style={{background:'#22C55E'}}></div>
              <span style={{marginLeft:8,fontSize:11,color:'var(--muted)'}}>School Dashboard · Crown Heights SS</span>
            </div>
            <div className="mockup-body">
              <div className="mockup-stat-row">
                {[['347','Students'],['94%','Attendance'],['89%','Avg Score']].map(([v,l]) => (
                  <div key={l} className="mockup-stat">
                    <div className="mockup-stat-val">{v}</div>
                    <div className="mockup-stat-lbl">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mockup-bar-row">
                {[['Track 1 · SS1A',92],['Track 2 · SS2B',78],['Track 3 · SS3A',95]].map(([l,p]) => (
                  <div key={l} className="mockup-bar-item">
                    <div className="mockup-bar-label"><span>{l}</span><span>{p}%</span></div>
                    <div className="mockup-bar"><div className="mockup-bar-fill" style={{width:`${p}%`}}></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{background:'var(--navy2)',borderTop:'1px solid var(--border)'}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div className="section-eyebrow">Testimonials</div>
          <h2 className="section-title">What Schools Are Saying</h2>
        </div>
        <div className="testi-grid">
          {[
            {q:"The improvement in our students' computer literacy has been remarkable. AdharaEdu's structured approach and dedicated tutors made all the difference this term.",name:'Mrs. Adunola Fashola',role:'Principal, Sunlight Academy Lagos',init:'AF',bg:'rgba(212,168,83,0.2)',color:'var(--gold)'},
            {q:"Our SS3 students are now freelancing on Fiverr after completing Track 3. One student earned ₦45,000 in her first month. This is life-changing.",name:'Mr. Chukwuemeka Obi',role:'ICT Coordinator, Greenfield College',init:'CO',bg:'rgba(26,127,212,0.2)',color:'var(--teal2)'},
            {q:"The parent portal is a game-changer. Parents call us asking how their children are performing — not to complain, but because they can see the progress.",name:'Mrs. Grace Adeyemi',role:'VP Academics, Crown Heights SS',init:'GA',bg:'rgba(139,92,246,0.2)',color:'#A78BFA'},
          ].map(({q,name,role,init,bg,color}) => (
            <div key={name} className="testi-card">
              <div className="stars">★★★★★</div>
              <p className="testi-quote">&ldquo;{q}&rdquo;</p>
              <div className="testi-author">
                <div className="testi-avatar" style={{background:bg,color}}>{init}</div>
                <div>
                  <div className="testi-name">{name}</div>
                  <div className="testi-role">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES PREVIEW (responsive carousel) ── */}
      <section id="services-preview" aria-label="Our services">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="section-eyebrow">Our Services</div>
          <h2 className="section-title">Everything a School Needs</h2>
          <p className="section-desc" style={{ margin: '0 auto', maxWidth: 500 }}>
            Nine services built around the real challenges Nigerian schools face every day.
          </p>
        </div>
        <HomeServicesCarousel />
      </section>

      {/* ── CTA ── */}
      <section style={{background:'var(--navy2)',borderTop:'1px solid var(--border)',textAlign:'center'}}>
        <div style={{maxWidth:700,margin:'0 auto'}}>
          <div className="section-eyebrow" style={{justifyContent:'center',display:'flex'}}>Ready to Start?</div>
          <h2 className="section-title">
            Bring Tech Skills to<br/><span style={{background:'linear-gradient(135deg,var(--gold),var(--teal2))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Your School Today</span>
          </h2>
          <p className="section-desc" style={{margin:'0 auto 40px',maxWidth:500}}>Join 50+ schools already transforming their students into tech-ready graduates. We&apos;ll tailor partnership to your school&apos;s needs.</p>
          <div style={{display:'flex',gap:16,justifyContent:'center',flexWrap:'wrap'}}>
            <Link href="/auth/register" className="btn btn-primary btn-lg">Register Your School →</Link>
            <Link href="/auth/login" className="btn btn-outline btn-lg">View Demo Dashboard</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="nav-logo" style={{marginBottom:8}}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 50" height="36" width="180">
                <rect x="1" y="4" width="38" height="40" rx="12" ry="14" fill="#1E7FD4"/>
                <polygon points="20,10 23.5,18.5 33,18.5 25.5,24 28.5,33 20,27.5 11.5,33 14.5,24 7,18.5 16.5,18.5" fill="#F5C518"/>
                <text x="46" y="33" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="26" fill="var(--white)">Adhara</text>
                <text x="153" y="14" fontFamily="Arial,sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1E7FD4">Edu</text>
              </svg>
            </div>
            <p>Providing Nigerian secondary schools with expert tech tutors, structured curriculum, and a full learning management platform.</p>
          </div>
          {[
            {title:'Services',links:['Tech Skills','Staff Training','Student Coaching','School Websites','Competitions','Grants & Funding']},
            {title:'Platform',links:['School Admin','Student Portal','Tutor Dashboard','Parent Portal','CBT Exams','Super Admin']},
            {title:'Company',links:[
              { label: 'About Us', href: '/about' },
              { label: 'Our Mission', href: '/about#mission' },
              { label: 'Contact Us', href: '/contact' },
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms of Service', href: '#' },
              { label: 'Blog', href: '#' },
            ]},
          ].map(({title,links}) => (
            <div key={title} className="footer-col">
              <h5>{title}</h5>
              <ul>
                {links.map((l) => {
                  if (typeof l === 'string') {
                    return (
                      <li key={l}>
                        <a href="#">{l}</a>
                      </li>
                    )
                  }
                  return (
                    <li key={l.label}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <p>© 2026 AdharaEdu. All rights reserved.</p>
          <p>Built for Nigerian Schools 🇳🇬 &nbsp;·&nbsp; <a href="#" style={{color:'var(--gold)',textDecoration:'none'}}>info@adharaedu.com</a></p>
        </div>
      </footer>
    </div>
  )
}
