'use client'

import { Info } from 'lucide-react'

export function LearningMaterialsHint() {
  return (
    <div className="card mb-20 learning-materials-hint">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info size={22} strokeWidth={1.75} style={{ color: 'var(--teal2)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="font-display fw-600 text-white mb-8" style={{ fontSize: 15 }}>
            No lesson materials yet for this module
          </div>
          <p className="text-muted text-sm" style={{ margin: '0 0 12px', lineHeight: 1.55 }}>
            Materials show up here when your school sets up the learning path. Ask your tutor if you expected files today.
          </p>
          <ul className="text-muted text-sm" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
            <li><strong style={{ color: 'var(--white)' }}>Curriculum lessons</strong> — added by Curriculum Lead (published lessons + uploads)</li>
            <li><strong style={{ color: 'var(--white)' }}>Tutor handouts</strong> — tutor saves a lesson plan, generates AI material, then clicks <em>Publish handout to class</em></li>
            <li><strong style={{ color: 'var(--white)' }}>Lesson files</strong> — tutor attaches PDF/slides under <em>Module Material</em> on a lesson plan</li>
            <li><strong style={{ color: 'var(--white)' }}>In class</strong> — after each session, &quot;Last delivered&quot; and class files update automatically</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
