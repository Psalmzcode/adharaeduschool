'use client'
import Link from 'next/link'
import { MarketingNav } from '@/components/MarketingNav'

export default function ServicesPage() {
  return (
    <div id="page-services" className="page active" style={{display:'block'}}>
      <MarketingNav />

      {/* Hero */}
      <div style={{padding:'160px 60px 80px',background:'var(--navy2)',borderBottom:'1px solid var(--border)',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 60% at 50% 100%,rgba(212,168,83,0.07),transparent)',pointerEvents:'none'}}/>
        <div style={{position:'relative',textAlign:'center',maxWidth:700,margin:'0 auto'}}>
          <div className="hero-eyebrow" style={{justifyContent:'center'}}><span className="dot"></span> Complete Service Catalogue</div>
          <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'clamp(40px,5vw,68px)',marginBottom:20,lineHeight:1.05}}>
            Everything AdharaEdu<br/><span style={{background:'linear-gradient(135deg,var(--gold),var(--teal2))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Does for Schools</span>
          </h1>
          <p style={{fontSize:17,color:'rgba(248,245,239,0.6)',lineHeight:1.8,marginBottom:36}}>Nine services designed to address every challenge Nigerian schools face — from classroom quality to digital presence, student performance to international funding.</p>
          <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
            <span className="badge badge-gold">For Schools</span>
            <span className="badge badge-teal">For Students</span>
            <span className="badge badge-info">Online</span>
            <span className="badge badge-success">Events</span>
            <span className="badge badge-warning">Funding</span>
          </div>
        </div>
      </div>

      <div style={{padding:'80px 60px',maxWidth:1200,margin:'0 auto'}}>
        {/* Service 1 */}
        <div style={{marginBottom:80}} id="svc-tech">
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:32}}>
            <div style={{width:56,height:56,background:'rgba(212,168,83,0.15)',border:'1px solid rgba(212,168,83,0.3)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>💻</div>
            <div>
              <div style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--gold)',letterSpacing:'0.1em',marginBottom:4}}>SERVICE 01 · FLAGSHIP</div>
              <h2 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'clamp(24px,3vw,36px)'}}>Tech Skills Education Program</h2>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
            {[
              {color:'rgba(26,127,212,0.2)',border:'rgba(26,127,212,0.2)',label:'TRACK 01 · JSS1–SS1',labelColor:'var(--teal2)',title:'Computer Appreciation',items:['Computer parts, mouse, keyboard basics','Windows OS, files & folders','Microsoft Word & Excel','Internet safety & email etiquette','Typing speed (target: 25 wpm)']},
              {color:'rgba(212,168,83,0.3)',border:'rgba(212,168,83,0.3)',label:'TRACK 02 · SS1–SS2',labelColor:'var(--gold)',title:'Intro to Programming',items:['Scratch: events, loops, conditionals, mini-games','HTML — building real webpages','CSS — colors, fonts, layouts','JavaScript basics & interactivity','Final project: personal portfolio page']},
              {color:'rgba(59,130,246,0.2)',border:'rgba(59,130,246,0.2)',label:'TRACK 03 · SS3',labelColor:'#93C5FD',title:'Advanced Tech Skills',items:['Frontend dev: HTML + CSS + JS combined','Responsive design for mobile','Python: variables, loops, functions','Backend basics & databases','Freelancing, Fiverr & capstone project']},
            ].map(s=>(
              <div key={s.title} style={{background:'var(--glass)',border:`1px solid ${s.border}`,borderRadius:'var(--radius-lg)',padding:28,backdropFilter:'blur(16px)'}}>
                <div style={{fontSize:11,fontFamily:'var(--font-mono)',color:s.labelColor,letterSpacing:'0.1em',marginBottom:12}}>{s.label}</div>
                <h4 style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,marginBottom:12,color:'var(--white)'}}>{s.title}</h4>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {s.items.map(item=><div key={item} style={{fontSize:13,color:'rgba(248,245,239,0.75)',display:'flex',gap:8}}><span style={{color:s.labelColor}}>→</span>{item}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{height:1,background:'var(--border2)',marginBottom:80}}/>

        {/* Services 2-9 Grid */}
        {[
          {icon:'👩‍🏫',num:'02',label:'FOR SCHOOLS',title:'Staff Training & Professional Development',desc:'Transform teaching quality through hands-on, practical workshops — from foundational pedagogy to technology integration and school leadership.'},
          {icon:'🎯',num:'03',label:'FOR STUDENTS',title:'Student 1-on-1 Coaching',desc:'Personalised academic coaching, JAMB preparation, university application support, and career direction for SS students.'},
          {icon:'🌐',num:'04',label:'DIGITAL PRESENCE',title:'School Website & Digital Identity',desc:'Professional website, custom email, social media setup, and Google Business profile — complete digital presence for your school.'},
          {icon:'🏆',num:'05',label:'COMPETITIONS',title:'Inter-School Tech Competitions',desc:'Annual coding, typing, and digital skills competitions with prizes, trophies, and Adhara certificates for top students and schools.'},
          {icon:'💰',num:'06',label:'FUNDING',title:'Grants, Funding & Partnerships',desc:'We identify, apply, and manage grants from government, NGOs, and international bodies on behalf of partner schools.'},
          {icon:'📊',num:'07',label:'MANAGEMENT',title:'School Management Consulting',desc:'Academic performance reviews, administrative systems, parent engagement strategies, and school improvement planning.'},
          {icon:'💻',num:'08',label:'ONLINE',title:'Online Bootcamps for Students',desc:'Holiday and weekend intensive programmes — web development, Python, digital marketing, and graphic design for secondary students.'},
          {icon:'🎓',num:'09',label:'CERTIFICATION',title:'Adhara Digital Skills Certification',desc:'Nationally-recognised certificates for students who complete AdharaEdu tracks. Issued digitally and physically, verifiable online.'},
        ].map(s=>(
          <div key={s.num} style={{display:'flex',gap:20,padding:'24px 28px',background:'var(--glass)',border:'1px solid var(--border2)',borderRadius:'var(--radius)',backdropFilter:'blur(16px)',marginBottom:16}}>
            <div style={{width:52,height:52,background:'rgba(26,127,212,0.12)',border:'1px solid rgba(26,127,212,0.25)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{s.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--teal2)',letterSpacing:'0.1em',marginBottom:6}}>SERVICE {s.num} · {s.label}</div>
              <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:18,color:'var(--white)',marginBottom:8}}>{s.title}</h3>
              <p style={{fontSize:14,color:'var(--muted)',lineHeight:1.7}}>{s.desc}</p>
            </div>
            <Link href="/auth/register" className="btn btn-outline btn-sm" style={{flexShrink:0,alignSelf:'center'}}>Enquire →</Link>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{padding:'80px 60px',background:'var(--navy2)',borderTop:'1px solid var(--border)',textAlign:'center'}}>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'clamp(28px,4vw,48px)',fontWeight:800,marginBottom:16}}>Ready to Partner with AdharaEdu?</h2>
        <p style={{fontSize:17,color:'var(--muted)',marginBottom:36,maxWidth:500,margin:'0 auto 36px'}}>Contact us today to discuss how we can bring these services to your school.</p>
        <div style={{display:'flex',gap:16,justifyContent:'center',flexWrap:'wrap'}}>
          <Link href="/auth/register" className="btn btn-primary btn-lg">Register Your School →</Link>
          <Link href="/auth/login" className="btn btn-outline btn-lg">View Demo Dashboard</Link>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <div className="footer-bottom">
          <p>© 2026 AdharaEdu. All rights reserved.</p>
          <Link href="/" style={{color:'var(--gold)',textDecoration:'none',fontSize:13}}>← Back to Home</Link>
        </div>
      </footer>
    </div>
  )
}
