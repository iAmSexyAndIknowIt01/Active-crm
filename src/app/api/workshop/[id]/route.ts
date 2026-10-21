import { NextResponse } from 'next/server';
import { isManager } from '@/src/lib/roles';
import { requireAuth } from '@/src/lib/session';
import { diffFields, logAudit } from '@/src/lib/audit';
import { pool } from '@/src/lib/db';
import {
  canEditWork,
  normalizeWorkServices,
  replaceWorkServices,
  sumWorkServices,
  validateWorkInput,
  WORK_SERVICES_SELECT,
} from '@/src/lib/works';

// GET: Тухайн ажлын дэлгэрэнгүй мэдээллийг авах
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session: authSession, error: authError } = await requireAuth();
    if (authError) return authError;
    const session = authSession;
    const companyId = session?.companyId;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна. Дахин нэвтэрнэ үү.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const query = `
      SELECT 
        w.*,
        CASE 
          WHEN w.customer_type = 'individual' THEN CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, ''))
          WHEN w.customer_type = 'company' THEN cc.name
          ELSE 'Тодорхойгүй'
        END AS customer_name,
        ${WORK_SERVICES_SELECT},
        CONCAT(COALESCE(u.last_name, ''), ' ', COALESCE(u.first_name, '')) AS employee_name,
        to_char(rv.reservation_date, 'YYYY-MM-DD') AS reservation_date,
        to_char(rv.start_time, 'HH24:MI') AS reservation_start
      FROM mt_works w
      LEFT JOIN mt_customer c ON w.customer_id = c.customer_id
      LEFT JOIN mt_customercompany cc ON w.company_customer_id = cc.company_customer_id
      LEFT JOIN mt_user u ON w.assigned_employee::text = u.user_id::text
      LEFT JOIN mt_reservation rv ON rv.reservation_id = w.reservation_id
      WHERE w.work_id = $1 AND w.company_id = $2
    `;

    const { rows } = await pool.query(query, [id, companyId]);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ажил олдсонгүй' },
        { status: 404 }
      );
    }

    const work = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        ...work,
        // Админ бүх ажлыг, ажилтан зөвхөн өөрийн хариуцсан ажлыг засна. Хариуцагчийг зөвхөн админ солино.
        can_edit: canEditWork(session!, work.assigned_employee),
        can_reassign: isManager(session!.role),
      },
    });
  } catch (error) {
    console.error('Fetch Work Detail Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ажлын мэдээллийг авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// PUT: Тухайн ажлын мэдээллийг (хариуцсан ажилтан, төлөв гэх мэт) засах
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session: authSession, error: authError } = await requireAuth();
    if (authError) return authError;
    const session = authSession;
    const companyId = session?.companyId;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна. Дахин нэвтэрнэ үү.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Ажилтан зөвхөн өөрийн хариуцсан ажлыг засна
    const { rows: existingRows } = await pool.query(
      'SELECT assigned_employee FROM mt_works WHERE work_id = $1 AND company_id = $2',
      [id, companyId]
    );
    if (existingRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Засварлах ажил олдсонгүй' }, { status: 404 });
    }
    const currentAssignee = existingRows[0].assigned_employee;
    if (!canEditWork(session!, currentAssignee)) {
      return NextResponse.json(
        { success: false, error: 'Та зөвхөн өөрийн хариуцсан ажлыг засах эрхтэй.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Хариуцсан ажилтныг зөвхөн админ солино; ажилтны хувьд одоогийн утгыг хадгална
    if (!isManager(session!.role)) body.assigned_employee = currentAssignee ? String(currentAssignee) : '';
    // Хуучин өгөгдөлд "COMPANY" гэх мэт том үсгээр хадгалагдсан утга байдаг тул жижиг үсэг болгоно
    if (typeof body.customer_type === 'string') body.customer_type = body.customer_type.toLowerCase();
    const { 
      title, 
      customer_type, 
      customer_id, 
      assigned_employee, 
      price, 
      status, 
      priority, 
      due_date, 
      description 
    } = body;

    const inputError = await validateWorkInput(companyId, body);
    if (inputError) {
      return NextResponse.json({ success: false, error: inputError }, { status: 400 });
    }

    const serviceResult = await normalizeWorkServices(companyId, body);
    if (serviceResult.error !== undefined) {
      return NextResponse.json({ success: false, error: serviceResult.error }, { status: 400 });
    }
    const lines = serviceResult.lines;
    if (lines.length === 0) {
      return NextResponse.json({ success: false, error: 'Дор хаяж нэг үйлчилгээ сонгоно уу.' }, { status: 400 });
    }
    // Үйлчилгээ сонгосон бол нийт үнэ = мөрүүдийн нийлбэр, үгүй бол гараар оруулсан үнэ
    const totalPrice = lines.length > 0 ? sumWorkServices(lines) : Math.round((Number(price) || 0) * 100) / 100;
    if (totalPrice < 0) {
      return NextResponse.json({ success: false, error: 'Үнэ буруу байна.' }, { status: 400 });
    }

    let indCustomerId = null;
    let compCustomerId = null;

    if (customer_type === 'individual') {
      indCustomerId = customer_id || null;
    } else if (customer_type === 'company') {
      compCustomerId = customer_id || null;
    }

    const updateQuery = `
      UPDATE mt_works 
      SET 
        customer_type = $1, 
        customer_id = $2, 
        company_customer_id = $3, 
        service_id = $4, 
        assigned_employee = $5, 
        title = $6, 
        description = $7, 
        price = $8, 
        status = $9, 
        priority = $10, 
        due_date = $11, 
        update_date = CURRENT_TIMESTAMP
      WHERE work_id = $12 AND company_id = $13
        AND ($14::text IS NULL OR assigned_employee::text = $14)
      RETURNING *
    `;

    const values = [
      customer_type,
      indCustomerId,
      compCustomerId,
      lines[0]?.service_id ?? null, // хуучин query-нүүдэд зориулсан үндсэн үйлчилгээ
      assigned_employee || null,
      title,
      description || null,
      totalPrice,
      status || 'pending',
      priority || 'medium',
      due_date || null,
      id,
      companyId,
      // Ажилтан: шалгасны дараа хариуцагч солигдсон бол шинэчлэхгүй
      isManager(session!.role) ? null : session!.userId
    ];

    const client = await pool.connect();
    let work;
    try {
      await client.query('BEGIN');
      const before = await client.query(
        'SELECT title, price, status, assigned_employee, due_date FROM mt_works WHERE work_id = $1 AND company_id = $2 FOR UPDATE',
        [id, companyId]
      );
      const { rows } = await client.query(updateQuery, values);
      work = rows[0];
      if (work) await replaceWorkServices(client, work.work_id, lines);
      if (work && before.rows[0]) {
        // Үнэ, төлөв, хариуцагч зэрэг өөрчлөлтийг түүхэнд бичнэ
        const changes = diffFields(before.rows[0], work, ['title', 'price', 'status', 'assigned_employee', 'due_date']);
        if (Object.keys(changes).length > 0) {
          await logAudit({ session: session!, action: 'work.update', entityType: 'work', entityId: work.work_id, summary: work.title, details: changes }, client);
        }
      }
      // Захиалгаас үүссэн ажил: дуусвал захиалга "Үйлчлүүлсэн", бусад үед "Ажилд шилжсэн".
      // Ажил цуцлагдсан ч захиалга өөрийн өгөгдөл, холбоосоороо үлдэнэ.
      if (work?.reservation_id) {
        await client.query(
          `UPDATE mt_reservation
           SET status = CASE WHEN $1 = 'completed' THEN 'completed' ELSE 'in_service' END,
               update_date = CURRENT_TIMESTAMP
           WHERE reservation_id = $2 AND company_id = $3`,
          [work.status, work.reservation_id, companyId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (!work) {
      return NextResponse.json(
        { success: false, error: 'Засварлах ажил олдсонгүй' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: work,
      message: 'Ажил амжилттай шинэчлэгдлээ' 
    });
  } catch (error) {
    console.error('Update Work Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ажил шинэчлэхэд алдаа гарлаа' },
      { status: 500 }
    );
  }
}