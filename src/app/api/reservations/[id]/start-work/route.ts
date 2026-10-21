import { NextResponse } from 'next/server';
import { MANAGER_ROLES } from '@/src/lib/roles';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { sendEmail } from '@/src/lib/email';
import { replaceWorkServices, sumWorkServices, type WorkServiceLine } from '@/src/lib/works';
import { RESERVATION_FROM, RESERVATION_SELECT, withTransaction } from '@/src/lib/reservations';

type Params = { params: Promise<{ id: string }> };

// Ажилд шилжүүлж болох захиалгын төлөвүүд
const STARTABLE = ['pending', 'confirmed'];

// POST: Харилцагч ирэхэд захиалгын мэдээллээр ажил (mt_works) үүсгэж, захиалгыг "Ажилд шилжсэн" болгоно.
// Дараа нь хариуцсан ажилтанд имэйлээр мэдэгдэнэ. Имэйл амжилтгүй болсон ч ажил үүссэн хэвээр үлдэнэ.
export async function POST(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAuth({ roles: MANAGER_ROLES });
    if (error) return error;
    const { companyId, userId } = session;
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT ${RESERVATION_SELECT} ${RESERVATION_FROM}
       WHERE r.reservation_id::text = $1 AND r.company_id = $2`,
      [id, companyId]
    );
    const r = rows[0];
    if (!r) return NextResponse.json({ success: false, error: 'Захиалга олдсонгүй' }, { status: 404 });

    if (r.work_id) {
      return NextResponse.json(
        { success: false, error: 'Энэ захиалгаас ажил аль хэдийн үүссэн байна.', data: { work_id: r.work_id } },
        { status: 409 }
      );
    }
    if (!STARTABLE.includes(r.status)) {
      return NextResponse.json(
        { success: false, error: 'Зөвхөн хүлээгдэж буй эсвэл баталгаажсан захиалгаас ажил эхлүүлэх боломжтой.' },
        { status: 400 }
      );
    }
    if (!r.customer_id && !r.company_customer_id) {
      return NextResponse.json(
        { success: false, error: 'Захиалгын харилцагч бүртгэлээс устсан байна. Захиалгаа засаж харилцагчаа дахин сонгоно уу.' },
        { status: 400 }
      );
    }
    if (!r.assigned_employee) {
      return NextResponse.json(
        { success: false, error: 'Хариуцах ажилтан сонгоогүй байна. Захиалгаа засаж ажилтнаа сонгоно уу.' },
        { status: 400 }
      );
    }
    const services: { service_id: number | null; service_name: string; price: number | string }[] = r.services ?? [];
    if (services.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Захиалгад үйлчилгээ сонгоогүй байна. Захиалгаа засаж дор хаяж нэг үйлчилгээ нэмнэ үү.' },
        { status: 400 }
      );
    }

    const { rows: employees } = await pool.query(
      `SELECT email, first_name, last_name FROM mt_user
       WHERE user_id = $1 AND company_id = $2 AND is_active IS NOT FALSE`,
      [r.assigned_employee, companyId]
    );
    const employee = employees[0];
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Хариуцах ажилтан идэвхгүй эсвэл олдсонгүй. Захиалгаа засаж өөр ажилтан сонгоно уу.' },
        { status: 400 }
      );
    }

    // Захиалгын үйлчилгээнүүд → ажлын мөрүүд (тоо ширхэг 1, захиалах үеийн үнээр)
    const lines: WorkServiceLine[] = services.map((s) => ({
      service_id: s.service_id,
      service_name: s.service_name,
      price: Number(s.price) || 0,
      quantity: 1,
    }));
    const names = lines.map((l) => l.service_name);
    const title = (names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')).slice(0, 255);
    const timeRange = r.end_time ? `${r.start_time}–${r.end_time}` : r.start_time;
    const description = [`Захиалгаас үүссэн (${r.reservation_date} ${timeRange}).`, r.note].filter(Boolean).join('\n');

    const work = await withTransaction(async (client) => {
      // Нэг захиалгаас зэрэг хоёр ажил үүсэхээс сэргийлж мөрийг түгжинэ
      const { rows: locked } = await client.query(
        `SELECT status FROM mt_reservation WHERE reservation_id = $1 FOR UPDATE`,
        [r.reservation_id]
      );
      if (!STARTABLE.includes(locked[0]?.status)) return null;

      const { rows: inserted } = await client.query(
        `
          INSERT INTO mt_works (
            company_id, customer_type, customer_id, company_customer_id,
            service_id, assigned_employee, title, description, price, status, priority, due_date, reservation_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'in_progress', 'medium', $10::date, $11)
          RETURNING work_id, title
        `,
        [
          companyId,
          r.customer_type,
          r.customer_type === 'individual' ? r.customer_id : null,
          r.customer_type === 'company' ? r.company_customer_id : null,
          lines[0].service_id,
          r.assigned_employee,
          title,
          description,
          sumWorkServices(lines),
          r.reservation_date,
          r.reservation_id,
        ]
      );
      await replaceWorkServices(client, inserted[0].work_id, lines);
      await client.query(
        `UPDATE mt_reservation SET status = 'in_service', update_date = CURRENT_TIMESTAMP WHERE reservation_id = $1`,
        [r.reservation_id]
      );
      return inserted[0];
    });

    if (!work) {
      return NextResponse.json(
        { success: false, error: 'Захиалгын төлөв өөрчлөгдсөн байна. Хуудсаа шинэчлээд дахин оролдоно уу.' },
        { status: 409 }
      );
    }

    // Хариуцсан ажилтанд мэдэгдэл
    const { rows: starters } = await pool.query(`SELECT first_name, last_name FROM mt_user WHERE user_id = $1`, [userId]);
    const starter = starters[0] ? `${starters[0].last_name ?? ''} ${starters[0].first_name ?? ''}`.trim() : '';
    const workUrl = `${new URL(request.url).origin}/dashboard/workshop/${work.work_id}`;
    const text = [
      `Сайн байна уу, ${employee.first_name ?? ''}.`,
      '',
      `Захиалгатай харилцагч ирсэн тул танд шинэ ажил хуваарилагдлаа.`,
      '',
      `Харилцагч: ${r.customer_name}${r.customer_phone ? ` (${r.customer_phone})` : ''}`,
      `Цаг: ${r.reservation_date} ${timeRange}`,
      `Үйлчилгээ: ${names.join(', ')}`,
      r.note ? `Тэмдэглэл: ${r.note}` : null,
      starter ? `Бүртгэсэн: ${starter}` : null,
      '',
      `Ажлыг нээх: ${workUrl}`,
    ]
      .filter((line) => line !== null)
      .join('\n');

    let emailSent = false;
    try {
      emailSent = await sendEmail({ to: employee.email, subject: `Шинэ ажил: ${title}`, text });
    } catch (err) {
      console.error('Start Work Email Error:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        work_id: work.work_id,
        employee_name: `${employee.last_name ?? ''} ${employee.first_name ?? ''}`.trim(),
        employee_email: employee.email,
        email_sent: emailSent,
      },
      message: 'Ажил амжилттай үүслээ',
    });
  } catch (error) {
    console.error('Start Work From Reservation Error:', error);
    return NextResponse.json({ success: false, error: 'Ажил үүсгэхэд алдаа гарлаа' }, { status: 500 });
  }
}
