'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { HandoutReader } from './HandoutReader'

type Props = {
  id: string
  title: string
  subtitle?: string
  markdown: string
}

export function HandoutAccordion({ id, title, subtitle, markdown }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`learning-handout-accordion${open ? ' learning-handout-accordion--open' : ''}`}>
      <button type="button" className="learning-handout-accordion-trigger" onClick={() => setOpen((v) => !v)}>
        <div className="learning-handout-accordion-head">
          <span className="learning-handout-accordion-title">{title}</span>
          {subtitle && <span className="learning-handout-accordion-sub">{subtitle}</span>}
        </div>
        <ChevronDown size={18} className="learning-handout-accordion-chevron" aria-hidden />
      </button>
      {open && (
        <div className="learning-handout-accordion-body" id={`handout-${id}`}>
          <HandoutReader markdown={markdown} maxHeight={420} />
        </div>
      )}
    </div>
  )
}
