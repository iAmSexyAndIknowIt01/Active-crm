import 'server-only';
import nodemailer from 'nodemailer';

// Имэйлийг Gmail SMTP-ээр (nodemailer) илгээнэ.
// Тохиргоо: GMAIL_USER, GMAIL_APP_PASSWORD (Google бүртгэлийн App Password)
// Тохируулаагүй бол dev орчинд console-д хэвлэж, production-д алдаа бүртгэнэ.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}`);
      return true;
    }
    console.error('Имэйл илгээх тохиргоо (GMAIL_USER, GMAIL_APP_PASSWORD) хийгдээгүй байна.');
    return false;
  }

  try {
    await transporter.sendMail({ from: `"Active CRM" <${user}>`, to, subject, text });
    return true;
  } catch (err) {
    console.error('Имэйл илгээхэд алдаа гарлаа:', err);
    return false;
  }
}
