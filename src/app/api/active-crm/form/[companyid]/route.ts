import { NextResponse } from 'next/server';
import { pool } from '../../../../../lib/db'; // Замын дагуу тохируулна уу
import { checkRateLimits, getClientIp } from '../../../../../lib/rate-limit';
import { checkFormToken, issueFormToken } from '../../../../../lib/form-token';
import { MULTI_ANSWER_SEPARATOR, splitMultiAnswer } from '../../../../../lib/form-templates';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ANSWER_LENGTH = 1000;
const MAX_LONG_ANSWER_LENGTH = 2000; // "Урт хариулт" (textarea)

interface TemplateQuestion {
  id: string | number;
  type?: string;
  label: string;
  required?: boolean;
  options?: string[];
}

// 1. Тухайн компанийн ID-аар идэвхтэй анкетын загварыг авах
export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyid: string }> }
) {
  try {
    const resolvedParams = await params;
    const companyid = resolvedParams.companyid;

    // ?t=<анкетын id> — тухайн анкет. Байхгүй бол (хуучин холбоос, QR) компанийн үндсэн анкет,
    // үндсэн анкет идэвхгүй бол хамгийн сүүлд үүссэн идэвхтэй анкет.
    const requested = new URL(request.url).searchParams.get('t');
    if (!UUID_RE.test(companyid) || (requested !== null && !UUID_RE.test(requested))) {
      return NextResponse.json({ success: false, error: 'Анкет олдсонгүй.' }, { status: 404 });
    }

    const query = `
      SELECT id, company_id, title, description, questions
      FROM mt_templates
      WHERE company_id = $1 AND is_active = true AND deleted_at IS NULL
        AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [companyid, requested]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Анкет олдсонгүй эсвэл одоогоор хариулт хүлээн авахгүй байна.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      // Илгээхэд шаардлагатай роботын эсрэг токен (lib/form-token.ts)
      data: { ...result.rows[0], form_token: issueFormToken(result.rows[0].id) },
    });
  } catch (error) {
    console.error('Public Template Fetch Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}

// Хариултыг анкетын загварын асуулттай тулгаж шалгана.
// Асуултын нэр, төрөл, заавал бөглөх эсэхийг клиентээс биш DB-д хадгалсан загвараас авна.
function validateAnswers(questions: TemplateQuestion[], answers: unknown) {
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
    return { error: 'Хариултын формат буруу байна.' };
  }
  const input = answers as Record<string, unknown>;
  const cleaned: { question: TemplateQuestion; value: string }[] = [];

  for (const question of questions) {
    const raw = input[String(question.id)];

    // Олон сонголт: массив (эсвэл "; "-ээр нийлүүлсэн текст) — сонголт бүр загварт байх ёстой
    if (question.type === 'multiselect') {
      const picked = Array.isArray(raw)
        ? raw.map((v) => String(v).trim()).filter(Boolean)
        : typeof raw === 'string'
          ? splitMultiAnswer(raw)
          : [];
      const unique = [...new Set(picked)];
      if (question.required && unique.length === 0) {
        return { error: `"${question.label}" асуултад дор хаяж нэгийг сонгоно уу.` };
      }
      const options = Array.isArray(question.options) ? question.options : [];
      if (unique.some((v) => !options.includes(v))) {
        return { error: `"${question.label}" талбарын сонголт буруу байна.` };
      }
      cleaned.push({ question, value: unique.join(MULTI_ANSWER_SEPARATOR) });
      continue;
    }

    const value = raw === undefined || raw === null || Array.isArray(raw) ? '' : String(raw).trim();
    const maxLength = question.type === 'textarea' ? MAX_LONG_ANSWER_LENGTH : MAX_ANSWER_LENGTH;

    if (question.required && !value) {
      return { error: `"${question.label}" талбарыг заавал бөглөнө үү.` };
    }
    if (value.length > maxLength) {
      return { error: `"${question.label}" хариулт хэт урт байна (${maxLength} тэмдэгтээс ихгүй).` };
    }
    if (value && question.type === 'number' && !/^[+-]?\d+([.,]\d+)?$/.test(value.replace(/\s/g, ''))) {
      return { error: `"${question.label}" талбарт зөвхөн тоо оруулна уу.` };
    }
    if (value && (question.type === 'select' || question.type === 'rating') && Array.isArray(question.options) && !question.options.includes(value)) {
      return { error: `"${question.label}" талбарын сонголт буруу байна.` };
    }
    cleaned.push({ question, value });
  }
  return { cleaned };
}

// 2. Үйлчлүүлэгчийн оруулсан хариуг form_submissions болон form_submission_answers рүү хадгална.
//    Анкет зөвхөн асуулт хариулт: харилцагчийн бүртгэл (mt_customer) үүсгэхгүй, холбохгүй.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyid: string }> }
) {
  try {
    const { companyid } = await params;
    const body = await request.json();
    const { answers, templateId, website } = body;

    if (!UUID_RE.test(companyid) || typeof templateId !== 'string' || !UUID_RE.test(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Анкетын загварын ID олдсонгүй.' },
        { status: 400 }
      );
    }

    // Нэвтрэлтгүй нийтийн endpoint тул spam-аас хамгаална: IP-ээр 10 минутад 10, компаниар цагт 300
    const limited = await checkRateLimits([
      { key: `form:ip:${getClientIp(request)}`, limit: 10, windowSeconds: 10 * 60 },
      { key: `form:company:${companyid}`, limit: 300, windowSeconds: 60 * 60 },
    ]);
    if (limited) return limited;

    // Хүнд харагдахгүй "website" талбарыг зөвхөн робот бөглөнө: амжилттай мэт хариулж, хадгалахгүй
    if (typeof website === 'string' && website.trim() !== '') {
      return NextResponse.json({ success: true, message: 'Анкет амжилттай илгээгдлээ.' });
    }
    const tokenCheck = checkFormToken(body.formToken, templateId);
    if (tokenCheck !== 'ok') {
      const error =
        tokenCheck === 'too_fast'
          ? 'Анкетыг хэт хурдан илгээлээ. Хэдэн секунд хүлээгээд дахин оролдоно уу.'
          : 'Анкетын хуудасны хугацаа дууссан байна. Хуудсыг дахин ачаалаад бөглөнө үү.';
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    // Загвар нь энэ компанийх бөгөөд идэвхтэй байх ёстой
    const templateResult = await pool.query(
      `SELECT questions FROM mt_templates WHERE id = $1 AND company_id = $2 AND is_active = true AND deleted_at IS NULL`,
      [templateId, companyid]
    );
    if (templateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Анкет олдсонгүй эсвэл идэвхгүй болсон байна.' },
        { status: 404 }
      );
    }
    const questions: TemplateQuestion[] = Array.isArray(templateResult.rows[0].questions)
      ? templateResult.rows[0].questions
      : [];

    const { cleaned, error } = validateAnswers(questions, answers);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    // Transaction ашиглах тул client-ийг pool-оос дуудна
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const submissionResult = await client.query(
        `INSERT INTO form_submissions (form_template_id, company_id) VALUES ($1, $2) RETURNING id`,
        [templateId, companyid]
      );
      const submissionId = submissionResult.rows[0].id;

      for (const { question, value } of cleaned!) {
        if (!value) continue;
        await client.query(
          `INSERT INTO form_submission_answers (submission_id, question_id, question_label, answer_value)
           VALUES ($1, $2, $3, $4)`,
          [submissionId, String(question.id), question.label, value]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      message: 'Анкет амжилттай илгээгдлээ.',
    });
  } catch (error) {
    console.error('Client Answer Save Error:', error);
    return NextResponse.json(
      { success: false, error: 'Хадгалахад алдаа гарлаа.' },
      { status: 500 }
    );
  }
}
