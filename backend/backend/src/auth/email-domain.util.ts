import * as dns from 'dns/promises';

const DNS_TIMEOUT_MS = 5000;

/** Extract domain from `user@domain`. */
export function emailDomainFromAddress(email: string): string | null {
  const m = String(email || '')
    .trim()
    .toLowerCase()
    .match(/^[^@\s]+@([^@\s]+)$/);
  return m ? m[1] : null;
}

/**
 * Check that the domain can plausibly receive mail: MX records, or host A/AAAA (implicit MX per SMTP).
 * Does not prove the mailbox exists — use OTP or provider APIs for that.
 */
export async function verifyEmailDomainResolvable(domain: string): Promise<{ ok: boolean; reason?: string }> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.') || d.includes('..')) {
    return { ok: false, reason: 'Invalid email domain.' };
  }
  if (d === 'localhost' || d.endsWith('.localhost') || d === 'invalid' || d.endsWith('.invalid')) {
    return { ok: false, reason: 'This email domain cannot receive mail.' };
  }

  const run = async (): Promise<{ ok: boolean; reason?: string }> => {
    try {
      const mx = await dns.resolveMx(d);
      if (mx?.length) return { ok: true };
    } catch {
      /* no MX */
    }
    try {
      const a = await dns.resolve4(d);
      if (a?.length) return { ok: true };
    } catch {
      /* no A */
    }
    try {
      const aaaa = await dns.resolve6(d);
      if (aaaa?.length) return { ok: true };
    } catch {
      /* no AAAA */
    }
    return {
      ok: false,
      reason:
        'We could not find a mail server for this address. Check spelling (e.g. .com vs .co), or use another email.',
    };
  };

  try {
    return await Promise.race([
      run(),
      new Promise<{ ok: boolean; reason?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('dns_timeout')), DNS_TIMEOUT_MS),
      ),
    ]);
  } catch {
    return {
      ok: false,
      reason: 'Could not verify this email domain. Check your connection and try again.',
    };
  }
}
