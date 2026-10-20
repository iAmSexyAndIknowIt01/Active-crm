import 'server-only';

// SMS илгээх: SMS gateway-ийн HTTP API руу JSON POST хийнэ.
// Тохиргоо:
//   SMS_API_URL   — gateway-ийн endpoint (жнь: https://sms.example.mn/api/send)
//   SMS_API_TOKEN — (заавал биш) "Authorization: Bearer <token>" толгойгоор илгээгдэнэ
//   SMS_SENDER    — (заавал биш) илгээгчийн нэр / дугаар
// Илгээх бие: { "to": "99112233", "text": "...", "from": SMS_SENDER }
// Gateway өөр формат шаарддаг бол зөвхөн энэ файлыг өөрчилнө.

export function isSmsConfigured() {
  return Boolean(process.env.SMS_API_URL);
}

export async function sendSms(to: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.SMS_API_URL;
  if (!url) return { ok: false, error: 'SMS тохиргоо (SMS_API_URL) хийгдээгүй.' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMS_API_TOKEN ? { Authorization: `Bearer ${process.env.SMS_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ to, text, ...(process.env.SMS_SENDER ? { from: process.env.SMS_SENDER } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `SMS gateway ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'SMS илгээхэд алдаа гарлаа.' };
  }
}
