// ─────────────────────────────────────────────────────────────
// AdharaEdu API Client — fully wired to NestJS backend
// ─────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('adhara_token') : null
}

// Generic request — throws with server error message on failure
async function req(method: string, path: string, body?: any): Promise<any> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(err.message || `${method} ${path} failed (${res.status})`)
  }

  return res.json().catch(() => ({}))
}

// Upload — multipart/form-data
async function upload(path: string, file: File, extra?: Record<string, string>): Promise<any> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  if (extra) Object.entries(extra).forEach(([k, v]) => form.append(k, v))

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'Upload failed') }
  return res.json()
}

// ─── AUTH ───────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    req('POST', '/auth/login', { email, password }),
  register: (data: any) => req('POST', '/auth/register', data),
  me: () => req('GET', '/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    req('PATCH', '/auth/change-password', { oldPassword, newPassword }),
}

// ─── SCHOOLS ────────────────────────────────────────────────
export const schoolsApi = {
  // School Admin
  mine: () => req('GET', '/schools/my-school'),
  myStats: () => req('GET', '/schools/my-school/stats'),
  topStudents: () => req('GET', '/schools/my-school/top-students'),
  myAttendanceOverview: () => req('GET', '/schools/my-school/attendance'),
  // Super Admin
  all: (params?: any) =>
    req('GET', '/schools?' + new URLSearchParams(params || {}).toString()),
  one: (id: string) => req('GET', `/schools/${id}`),
  update: (id: string, data: any) => req('PATCH', `/schools/${id}`, data),
  /** Post-approval onboarding — sets profileCompletedAt */
  completeProfile: (data: Record<string, unknown>) =>
    req('POST', '/schools/my-school/complete-profile', data),
  updateStatus: (id: string, status: string, notes?: string) =>
    req('PATCH', `/schools/${id}/status`, { status, notes }),
}

// ─── SCHOOL CLASSES ──────────────────────────────────────────
export const schoolClassesApi = {
  all: (schoolId: string) => req('GET', `/school-classes?schoolId=${encodeURIComponent(schoolId)}`),
  create: (data: { schoolId: string; className: string; track: string }) =>
    req('POST', '/school-classes', data),
}

// ─── TRACKS (dynamic program tracks) ─────────────────────────
export const tracksApi = {
  all: () => req('GET', '/tracks'),
  create: (data: { code: string; name: string; description?: string; isActive?: boolean }) =>
    req('POST', '/tracks', data),
  update: (id: string, data: any) => req('PATCH', `/tracks/${id}`, data),
}

// ─── STUDENTS ───────────────────────────────────────────────
export const studentsApi = {
  // Student role
  me: () => req('GET', '/students/me'),
  myStats: () => req('GET', '/students/me/stats'),
  /** Same class — search by name for peer messaging */
  meClassmates: (q?: string) =>
    req('GET', '/students/me/classmates' + (q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '')),
  // Admin / Tutor
  all: (params?: any) =>
    req('GET', '/students?' + new URLSearchParams(params || {}).toString()),
  one: (id: string) => req('GET', `/students/${id}`),
  create: (data: any) => req('POST', '/students', data),
  bulkCreate: (schoolId: string, students: any[]) =>
    req('POST', '/students/bulk', { schoolId, students }),
  update: (id: string, data: any) => req('PATCH', `/students/${id}`, data),
  leaderboard: (params?: any) =>
    req('GET', '/students/leaderboard?' + new URLSearchParams(params || {}).toString()),
}

// ─── TUTORS ─────────────────────────────────────────────────
export const tutorsApi = {
  // Tutor role
  me: () => req('GET', '/tutors/me'),
  patchMyProfile: (data: any) => req('PATCH', '/tutors/me', data),
  completeOnboarding: () => req('POST', '/tutors/me/complete-onboarding'),
  myStats: () => req('GET', '/tutors/me/stats'),
  myClasses: () => req('GET', '/tutors/me/classes'),
  updateMe: (data: any) => req('PATCH', '/users/me', data),
  // Super Admin
  all: (params?: any) =>
    req('GET', '/tutors?' + new URLSearchParams(params || {}).toString()),
  one: (id: string) => req('GET', `/tutors/${id}`),
  create: (data: any) => req('POST', '/tutors', data),
  update: (id: string, data: any) => req('PATCH', `/tutors/${id}`, data),
  assign: (tutorId: string, data: any) =>
    req('POST', `/tutors/${tutorId}/assign`, data),
  removeAssignment: (assignmentId: string) =>
    req('PATCH', `/tutors/assignments/${assignmentId}/remove`),
  updateAssignmentExpectation: (assignmentId: string, expectedSessionsPerWeek: number) =>
    req('PATCH', `/tutors/assignments/${assignmentId}/expectation`, { expectedSessionsPerWeek }),
}

// ─── CLASS PERFORMANCE (Phase D roll-up) ────────────────────
export const classPerformanceApi = {
  rollup: (params: { schoolId: string; className: string; days?: number; track?: string }) => {
    const p = new URLSearchParams()
    p.set('schoolId', params.schoolId)
    p.set('className', params.className)
    if (params.days != null) p.set('days', String(params.days))
    if (params.track) p.set('track', params.track)
    return req('GET', `/class-performance?${p}`)
  },
}

// ─── MODULES / CURRICULUM ───────────────────────────────────
export const modulesApi = {
  all: (track?: string) =>
    req('GET', '/modules' + (track ? `?track=${track}` : '')),
  create: (data: {
    track: string
    number: number
    title: string
    description: string
    objectives?: string[]
    durationWeeks?: number
    isActive?: boolean
  }) => req('POST', '/modules', data),
  update: (id: string, data: any) => req('PATCH', `/modules/${id}`, data),
  studentProgress: (studentId: string) =>
    req('GET', `/modules/progress/${studentId}`),
  myProgress: () =>
    req('GET', '/students/me').then((s: any) =>
      req('GET', `/modules/progress/${s.id}`)
    ),
  updateProgress: (studentId: string, moduleId: string, data: any) =>
    req('PATCH', `/modules/progress/${studentId}/${moduleId}`, data),
  classProgress: (schoolId: string, className: string) =>
    req('GET', `/modules/class-progress?schoolId=${schoolId}&className=${encodeURIComponent(className)}`),
  updateClassScores: (data: { schoolId: string; className: string; moduleId: string; scores: { studentId: string; score: number }[] }) =>
    req('PATCH', '/modules/class-progress/scores', data),
  advanceClass: (data: { schoolId: string; className: string; moduleId: string; passMark?: number }) =>
    req('PATCH', '/modules/class-progress/advance', data),
}

// ─── ATTENDANCE ─────────────────────────────────────────────
export const attendanceApi = {
  mark: (records: { studentId: string; status: string; notes?: string }[], date: string) =>
    req('POST', '/attendance/mark', { records, date }),
  classView: (schoolId: string, className: string, date: string) =>
    req('GET', `/attendance/class?schoolId=${schoolId}&className=${className}&date=${date}`),
  myAttendance: (studentId: string, from?: string, to?: string) => {
    const p = new URLSearchParams({ studentId })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    return req('GET', `/attendance/student?${p}`)
  },
  weeklyBreakdown: (studentId: string, weeks = 5) =>
    req('GET', `/attendance/student/weekly?studentId=${studentId}&weeks=${weeks}`),
  schoolStats: (schoolId: string, days = 7) =>
    req('GET', `/attendance/school/stats?schoolId=${schoolId}&days=${days}`),
  schoolWeekly: (schoolId: string, weeks = 12, className?: string) => {
    const p = new URLSearchParams({ schoolId, weeks: String(weeks) })
    if (className) p.set('className', className)
    return req('GET', `/attendance/school/weekly?${p}`)
  },
}

// ─── CBT ────────────────────────────────────────────────────
export const cbtApi = {
  // Public — student login to exam
  login: (regNumber: string, token: string, examId: string) =>
    req('POST', '/cbt/login', { regNumber, token, examId }),
  // Tutor
  myExams: () => req('GET', '/cbt'),
  create: (data: any) => req('POST', '/cbt', data),
  update: (id: string, data: any) => req('PATCH', `/cbt/${id}`, data),
  publish: (id: string) => req('PATCH', `/cbt/${id}/publish`),
  // Super Admin
  all: (params?: any) =>
    req('GET', '/cbt?' + new URLSearchParams(params || {}).toString()),
  vet: (id: string, vetted: boolean) =>
    req('PATCH', `/cbt/${id}/vet`, { vetted }),
  attempts: (examId: string) => req('GET', `/cbt/${examId}/attempts`),
  // Student exam
  start: (examId: string, studentId: string) =>
    req('POST', '/cbt/attempts/start', { examId, studentId }),
  saveAnswer: (attemptId: string, questionNumber: number, selectedIndex: number) =>
    req('PATCH', `/cbt/attempts/${attemptId}/answer`, { questionNumber, selectedIndex }),
  submit: (attemptId: string, answers?: Record<string, number>) =>
    req('POST', `/cbt/attempts/${attemptId}/submit`, { answers }),
  result: (attemptId: string) => req('GET', `/cbt/attempts/${attemptId}/result`),
}

// ─── REPORTS ────────────────────────────────────────────────
export const reportsApi = {
  // Tutor
  mine: () => req('GET', '/reports/my-reports'),
  create: (data: any) => req('POST', '/reports', data),
  submit: (id: string) => req('PATCH', `/reports/${id}/submit`),
  update: (id: string, data: any) => req('PATCH', `/reports/${id}`, data),
  // Super Admin / School Admin
  all: (params?: any) =>
    req('GET', '/reports?' + new URLSearchParams(params || {}).toString()),
  one: (id: string) => req('GET', `/reports/${id}`),
  review: (id: string, notes: string) =>
    req('PATCH', `/reports/${id}/review`, { notes }),
}

// ─── NOTICES ────────────────────────────────────────────────
export const noticesApi = {
  all: (schoolId: string) => req('GET', `/notices?schoolId=${schoolId}`),
  create: (data: any) => req('POST', '/notices', data),
  update: (id: string, data: any) => req('PATCH', `/notices/${id}`, data),
  delete: (id: string) => {
    const token = getToken()
    return fetch(`${BASE}/notices/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).then(r => r.json().catch(() => ({})))
  },
}

// ─── EXAMS (scheduled) ──────────────────────────────────────
export const examsApi = {
  upcoming: (schoolId: string) =>
    req('GET', `/exams/upcoming?schoolId=${schoolId}`),
  all: (params?: any) =>
    req('GET', '/exams?' + new URLSearchParams(params || {}).toString()),
  create: (data: any) => req('POST', '/exams', data),
  update: (id: string, data: any) => req('PATCH', `/exams/${id}`, data),
}

// ─── PAYMENTS ───────────────────────────────────────────────
export const paymentsApi = {
  all: (params?: any) =>
    req('GET', '/payments?' + new URLSearchParams(params || {}).toString()),
  summary: () => req('GET', '/payments/summary'),
  create: (data: any) => req('POST', '/payments', data),
  markPaid: (id: string, receiptUrl?: string) =>
    req('PATCH', `/payments/${id}/paid`, { receiptUrl }),
}

// ─── NOTIFICATIONS ──────────────────────────────────────────
export const notifApi = {
  all: () => req('GET', '/notifications'),
  unreadCount: () => req('GET', '/notifications/unread-count'),
  markRead: (id: string) => req('PATCH', `/notifications/${id}/read`),
  markAllRead: () => req('PATCH', '/notifications/mark-all-read'),
}

// ─── MESSAGES ───────────────────────────────────────────────
export const messagesApi = {
  conversations: () => req('GET', '/messages/conversations'),
  unreadCount: () => req('GET', '/messages/unread-count'),
  start: (targetId: string, schoolId?: string) =>
    req('POST', '/messages/conversations/start', { targetId, schoolId }),
  getMessages: (conversationId: string, page = 1) =>
    req('GET', `/messages/conversations/${conversationId}?page=${page}`),
  send: (conversationId: string, body: string) =>
    req('POST', `/messages/conversations/${conversationId}/send`, { body }),
  /** Student ↔ student (same class) */
  peerConversations: () => req('GET', '/messages/peer/conversations'),
  peerStart: (targetUserId: string) =>
    req('POST', '/messages/peer/conversations/start', { targetUserId }),
  peerMessages: (conversationId: string, page = 1) =>
    req('GET', `/messages/peer/conversations/${conversationId}?page=${page}`),
  peerSend: (conversationId: string, body: string) =>
    req('POST', `/messages/peer/conversations/${conversationId}/send`, { body }),
}

// ─── LESSON PLANS ───────────────────────────────────────────
export const lessonsApi = {
  mine: () => req('GET', '/lessons'),
  bySchool: (schoolId: string) => req('GET', `/lessons/school?schoolId=${schoolId}`),
  forStudentClass: () => req('GET', '/lessons/my-class'),
  create: (data: any) => req('POST', '/lessons', data),
  update: (id: string, data: any) => req('PATCH', `/lessons/${id}`, data),
  delete: (id: string) => {
    const token = getToken()
    return fetch(`${BASE}/lessons/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).then(r => r.json().catch(() => ({})))
  },
}

// ─── UPLOADS ────────────────────────────────────────────────
export const uploadsApi = {
  avatar: (file: File) => upload('/uploads?entityType=avatar', file),
  assignment: (file: File, entityId: string) =>
    upload(`/uploads?entityType=assignment&entityId=${entityId}`, file),
  report: (file: File, entityId: string) =>
    upload(`/uploads?entityType=report&entityId=${entityId}`, file),
  lessonPlan: (file: File, entityId: string) =>
    upload(`/uploads?entityType=lesson-plan&entityId=${entityId}`, file),
  practical: (file: File, entityId: string) =>
    upload(`/uploads?entityType=practical&entityId=${entityId}`, file),
  /** Tutor KYC — entityType e.g. tutor-kyc-passport, tutor-kyc-id, tutor-kyc-signature */
  tutorKyc: (file: File, entityType: string) =>
    upload(`/uploads?entityType=${encodeURIComponent(entityType)}`, file),
  schoolLogo: (file: File, schoolId: string) =>
    upload(`/uploads?entityType=school-logo&entityId=${encodeURIComponent(schoolId)}`, file),
  byEntity: (entityType: string, entityId: string) =>
    req('GET', `/uploads?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`),
}

// ─── USERS ──────────────────────────────────────────────────
export const usersApi = {
  updateProfile: (data: any) => req('PATCH', '/users/me', data),
}

// ─── SESSIONS (lesson logging) ───────────────────────────────
export const sessionsApi = {
  start: (data: any) => req('POST', '/sessions/start', data),
  end: (id: string, notes?: string) => req('PATCH', `/sessions/${id}/end`, { notes }),
  active: () => req('GET', '/sessions/active'),
  myHistory: () => req('GET', '/sessions/my-sessions'),
  bySchool: (schoolId: string, opts?: { from?: string; to?: string; limit?: number }) => {
    const p = new URLSearchParams()
    if (opts?.from) p.set('from', opts.from)
    if (opts?.to) p.set('to', opts.to)
    if (opts?.limit != null) p.set('limit', String(opts.limit))
    const q = p.toString()
    return req('GET', `/sessions/school/${schoolId}${q ? `?${q}` : ''}`)
  },
  schoolCoverage: (schoolId: string, weekStart?: string) => {
    const p = new URLSearchParams()
    if (weekStart) p.set('weekStart', weekStart)
    const q = p.toString()
    return req('GET', `/sessions/school/${schoolId}/coverage${q ? `?${q}` : ''}`)
  },
  schoolSummary: (schoolId: string) => req('GET', `/sessions/school/${schoolId}/summary`),
}

// ─── PAYROLL ─────────────────────────────────────────────────
export const payrollApi = {
  all: (schoolId?: string, tutorId?: string) => {
    const p = new URLSearchParams()
    if (schoolId) p.set('schoolId', schoolId)
    if (tutorId) p.set('tutorId', tutorId)
    return req('GET', `/payroll?${p}`)
  },
  mine: () => req('GET', '/payroll/mine'),
  summary: () => req('GET', '/payroll/summary'),
  calculate: (
    dataOrTutorId:
      | { tutorId: string; schoolId: string; month: number; year: number; ratePerSession?: number }
      | string,
    schoolId?: string,
    month?: number,
    year?: number
  ) => {
    const payload =
      typeof dataOrTutorId === 'string'
        ? { tutorId: dataOrTutorId, schoolId, month, year, ratePerSession: 2500 }
        : dataOrTutorId
    return req('POST', '/payroll/calculate', payload)
  },
  markPaid: (id: string) => req('PATCH', `/payroll/${id}/pay`),
}

// ─── ASSIGNMENTS ─────────────────────────────────────────────
export const assignmentsApi = {
  create: (data: any) => req('POST', '/assignments', data),
  forClass: (schoolId: string, className: string) => req('GET', `/assignments/class?schoolId=${schoolId}&className=${className}`),
  mine: () => req('GET', '/assignments/mine'),
  submit: (assignmentId: string, data: { fileUrl?: string; textBody?: string }) =>
    req('POST', `/assignments/${assignmentId}/submit`, data),
  submissions: (assignmentId: string) => req('GET', `/assignments/${assignmentId}/submissions`),
  grade: (submissionId: string, grade: number, feedback: string) =>
    req('PATCH', `/assignments/submissions/${submissionId}/grade`, { grade, feedback }),
  update: (id: string, data: any) => req('PATCH', `/assignments/${id}`, data),
  delete: (id: string) => {
    const token = getToken()
    return fetch(`${BASE}/assignments/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }).then(r => r.json())
  },
}

// ─── PRACTICAL ASSESSMENTS ────────────────────────────────────
export const practicalsApi = {
  myTasks: () => req('GET', '/practicals/my-tasks'),
  listTasks: (params?: { tutorId?: string; schoolId?: string; className?: string; moduleId?: string }) =>
    req('GET', '/practicals/tasks?' + new URLSearchParams(params || {}).toString()),
  createTask: (data: any) => req('POST', '/practicals/tasks', data),
  submit: (taskId: string, data: { evidenceUrl?: string; evidenceText?: string }) =>
    req('POST', `/practicals/tasks/${taskId}/submit`, data),
  submissions: (taskId: string) => req('GET', `/practicals/tasks/${taskId}/submissions`),
  grade: (submissionId: string, data: { totalScore: number; feedback?: string; scoreBreakdown?: any }) =>
    req('PATCH', `/practicals/submissions/${submissionId}/grade`, data),
  bulkGrade: (taskId: string, data: { submissionIds?: string[]; totalScore: number; feedback?: string; scoreBreakdown?: any }) =>
    req('PATCH', `/practicals/tasks/${taskId}/bulk-grade`, data),
}

// ─── PAYSTACK ────────────────────────────────────────────────
export const paystackApi = {
  initialize: (paymentId: string) => req('POST', `/paystack/initialize/${paymentId}`),
  verify: (reference: string) => req('GET', `/paystack/verify?reference=${reference}`),
}

// ─── BULK STUDENT UPLOAD ─────────────────────────────────────
export const bulkUploadApi = {
  csv: (csv: string, schoolId: string, defaults: { className: string; track: string; termLabel: string }) =>
    req('POST', '/students/bulk-csv', { csv, schoolId, defaults }),
}

// ─── CERTIFICATES ────────────────────────────────────────────
export const certificatesApi = {
  mine: () => req('GET', '/certificates/my-certificates'),
  all: () => req('GET', '/certificates'),
  bySchool: async (schoolId: string) => {
    const students = await req('GET', `/students?schoolId=${schoolId}`)
    const list = Array.isArray(students) ? students : []
    const certArrays = await Promise.all(
      list.map((s: any) => req('GET', `/certificates/student/${s.id}`).catch(() => []))
    )
    return certArrays.flat()
  },
  check: (studentId: string) => req('GET', `/certificates/check-eligibility/${studentId}`),
  issue: (studentId: string, track: string) => req('POST', `/certificates/issue/${studentId}/${track}`),
  verify: (serial: string) => req('GET', `/certificates/verify/${serial}`),
  byStudent: (studentId: string) => req('GET', `/certificates/student/${studentId}`),
  revoke: (id: string) => req('PATCH', `/certificates/${id}/revoke`),
}

// ─── EXAM SCHEDULER ──────────────────────────────────────────
export const examSchedulesApi = {
  create: (data: any) => req('POST', '/exam-schedules', data),
  schedule: (data: any) => req('POST', '/exam-schedules', data),
  /** Student/parent — backend: GET /exam-schedules/mine (not GET /exam-schedules, which is tutor/admin list). */
  mine: () => req('GET', '/exam-schedules/mine'),
  all: (schoolId?: string, className?: string) => {
    const p = new URLSearchParams()
    if (schoolId) p.set('schoolId', schoolId)
    if (className) p.set('className', className)
    return req('GET', `/exam-schedules?${p}`)
  },
  upcoming: (schoolId: string, className?: string) => {
    const p = new URLSearchParams({ schoolId })
    if (className) p.set('className', className)
    return req('GET', `/exam-schedules/upcoming?${p}`)
  },
  cancel: (id: string) => req('PATCH', `/exam-schedules/${id}/cancel`),
}

// ─── PAYROLL ─────────────────────────────────────────────────