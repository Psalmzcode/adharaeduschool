export type QuizDraftQuestion = {
  id: string
  questionText: string
  options: string[]
  correctIndex: number
}

export function newQuestionId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function emptyQuestion(): QuizDraftQuestion {
  return {
    id: newQuestionId(),
    questionText: '',
    options: ['', '', '', ''],
    correctIndex: 0,
  }
}

export function defaultQuestionSet(count = 3): QuizDraftQuestion[] {
  return Array.from({ length: count }, () => emptyQuestion())
}

/** Parse saved quiz or curriculum quickCheck into editable drafts. */
export function draftsFromSource(
  savedQuestions: unknown,
  curriculumQuickCheck?: unknown,
): QuizDraftQuestion[] {
  const fromSaved = parseMcqList(savedQuestions)
  if (fromSaved.length) return fromSaved

  const fromCurriculum = parseCurriculumQuickCheck(curriculumQuickCheck)
  if (fromCurriculum.length) return fromCurriculum

  return defaultQuestionSet(3)
}

function parseMcqList(raw: unknown): QuizDraftQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((q: any) => {
      const options = Array.isArray(q?.options)
        ? q.options.map((o: any) => String(o || '').trim()).filter(Boolean)
        : []
      const correctIndex = Number(q?.correctIndex)
      const questionText = String(q?.questionText || '').trim()
      if (!questionText || options.length < 2) return null
      return {
        id: newQuestionId(),
        questionText,
        options: options.length >= 4 ? options.slice(0, 4) : [...options, ...Array(4 - options.length).fill('')].slice(0, 4),
        correctIndex:
          Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < options.length ? correctIndex : 0,
      }
    })
    .filter(Boolean) as QuizDraftQuestion[]
}

/** Curriculum seed often stores string prompts — turn into drafts tutors can finish. */
function parseCurriculumQuickCheck(raw: unknown): QuizDraftQuestion[] {
  if (!Array.isArray(raw) || !raw.length) return []

  const mcq = parseMcqList(raw)
  if (mcq.length) return mcq

  return raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((prompt) => ({
      id: newQuestionId(),
      questionText: prompt,
      options: ['Correct', 'Partially correct', 'Incorrect', 'Not sure'],
      correctIndex: 0,
    }))
}

export function validateDrafts(questions: QuizDraftQuestion[]): string | null {
  if (!questions.length) return 'Add at least one question'
  if (questions.length > 10) return 'Maximum 10 questions per quick check'
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.questionText.trim()) return `Question ${i + 1} needs text`
    const opts = q.options.map((o) => o.trim()).filter(Boolean)
    if (opts.length < 2) return `Question ${i + 1} needs at least 2 answer options`
    if (q.correctIndex < 0 || q.correctIndex >= opts.length) {
      return `Question ${i + 1}: select which option is correct`
    }
  }
  return null
}

export function draftsToPayload(questions: QuizDraftQuestion[]) {
  return questions.map((q) => {
    const options = q.options.map((o) => o.trim()).filter(Boolean)
    let correctIndex = q.correctIndex
    if (correctIndex >= options.length) correctIndex = 0
    return {
      questionText: q.questionText.trim(),
      options,
      correctIndex,
    }
  })
}
