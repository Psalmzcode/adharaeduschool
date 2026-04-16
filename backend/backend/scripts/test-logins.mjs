/**
 * Smoke-test POST /auth/login for each demo role.
 * Usage: node scripts/test-logins.mjs
 * Env:   API_URL=http://localhost:3001/api/v1
 */
const BASE = (process.env.API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '')

const accounts = [
  { role: 'SUPER_ADMIN', login: 'admin@adharaedu.com', password: 'SuperAdmin@123' },
  { role: 'SCHOOL_ADMIN', login: 'admin@crownheights.edu.ng', password: 'SchoolAdmin@123' },
  { role: 'TUTOR', login: 'tutor@adharaedu.com', password: 'Tutor@123' },
  { role: 'STUDENT', login: 'chr.aisha', password: 'student@021' },
  { role: 'PARENT', login: 'funke.okonkwo@gmail.com', password: 'Parent@123' },
]

async function main() {
  console.log(`Testing ${BASE}/auth/login\n`)
  let ok = 0
  const failures = []

  for (const a of accounts) {
    let res
    try {
      res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: a.login, password: a.password }),
      })
    } catch (e) {
      failures.push({ ...a, err: e.message })
      console.log(`FAIL ${a.role.padEnd(14)} network: ${e.message}`)
      continue
    }

    const text = await res.text()
    let data = {}
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text.slice(0, 200) }
    }
    if (!res.ok) {
      const msg = [data.message, data.error, Array.isArray(data.message) ? data.message.join(', ') : '']
        .filter(Boolean)
        .join(' — ') || text.slice(0, 120)
      failures.push({ ...a, err: msg })
      console.log(`FAIL ${a.role.padEnd(14)} ${res.status} ${msg}`)
      continue
    }

    const gotRole = data.user?.role
    const tokenOk = Boolean(data.token)
    const roleMatch = gotRole === a.role
    if (!tokenOk || !roleMatch) {
      failures.push({ ...a, err: `token=${tokenOk} role=${gotRole} expected=${a.role}` })
      console.log(`FAIL ${a.role.padEnd(14)} unexpected response: token=${tokenOk} role=${gotRole}`)
      continue
    }

    ok++
    console.log(`OK   ${a.role.padEnd(14)} login=${a.login}`)
  }

  console.log(`\n${ok}/${accounts.length} passed`)
  if (failures.length) {
    console.log('\nFailures:', failures.length)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
