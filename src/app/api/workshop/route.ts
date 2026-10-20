import { NextResponse } from 'next/server';
import { getSession } from '@/src/lib/session';
import { logAudit } from '@/src/lib/audit';
import { pool } from '@/src/lib/db';
import {
  canEditWork,
  normalizeWorkServices,
  replaceWorkServices,
  sumWorkServices,
  validateWorkInput,
  WORK_SERVICES_SELECT,
} from '@/src/lib/works';

// GET: Тухайн компанийн ажлуудын жагсаалт болон холбогдох сонголтын датаг татах
export async function GET(request: Request) {
  try {
    const session = await getSession();
    const companyId = session?.companyId;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна. Дахин нэвтэрнэ үү.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Сонголтын датанууд (Хувь хүн, Компани, Үйлчилгээ, Ажилчид)
    if (action === 'options') {
      const individualsRes = await pool.query(
        `SELECT customer_id as id, first_name, last_name, phone FROM mt_customer WHERE company_id = $1 ORDER BY create_date DESC`,
        [companyId]
      );
      const companiesRes = await pool.query(
        `SELECT company_customer_id as id, name, tax_number, phone FROM mt_customerCompany WHERE company_id = $1 ORDER BY create_date DESC`,
        [companyId]
      );
      const servicesRes = await pool.query(
        `SELECT service_id, name, price, duration FROM mt_services WHERE company_id = $1 ORDER BY created_at DESC`,
        [companyId]
      );
      // mt_user хүснэгтээс ажилчдын мэдээллийг татах
      const employeesRes = await pool.query(
        `SELECT user_id, first_name, last_name, email FROM mt_user WHERE company_id = $1 ORDER BY create_date DESC`,
        [companyId]
      );

      return NextResponse.json({
        success: true,
        data: {
          individuals: individualsRes.rows,
          companies: companiesRes.rows,
          services: servicesRes.rows,
          employees: employeesRes.rows,
        }
      });
    }

    // Үндсэн ажлын жагсаалт татах query (mt_user-ийг assigned_employee-р холбох)
    const worksQuery = `
      SELECT 
        w.*,
        CASE 
          WHEN w.customer_type = 'individual' THEN CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, ''))
          WHEN w.customer_type = 'company' THEN cc.name
          ELSE 'Тодорхойгүй'
        END AS customer_name,
        ${WORK_SERVICES_SELECT},
        CONCAT(COALESCE(u.last_name, ''), ' ', COALESCE(u.first_name, '')) AS employee_name
      FROM mt_works w
      LEFT JOIN mt_customer c ON w.customer_id = c.customer_id
      LEFT JOIN mt_customercompany cc ON w.company_customer_id = cc.company_customer_id
      LEFT JOIN mt_user u ON w.assigned_employee::text = u.user_id::text
      WHERE w.company_id = $1
      ORDER BY w.create_date DESC
    `;

    const { rows } = await pool.query(worksQuery, [companyId]);

    return NextResponse.json({
      success: true,
      data: rows.map((w) => ({ ...w, can_edit: canEditWork(session!, w.assigned_employee) })),
    });
  } catch (error) {
    console.error('Fetch Works Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ажлын мэдээлэл авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// POST: Шинэ ажил бүртгэх
export async function POST(request: Request) {
  try {
    const session = await getSession();
    const companyId = session?.companyId;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна. Дахин нэвтэрнэ үү.' },
        { status: 401 }
      );
    }

    const body = await request.json();
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

    if (!title || !customer_type) {
      return NextResponse.json(
        { success: false, error: 'Ажлын гарчиг болон харилцагчийн төрлийг оруулна уу.' },
        { status: 400 }
      );
    }

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

    const insertQuery = `
      INSERT INTO mt_works (
        company_id, customer_type, customer_id, company_customer_id, 
        service_id, assigned_employee, title, description, price, status, priority, due_date
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *
    `;

    const values = [
      companyId,
      customer_type,
      indCustomerId,
      compCustomerId,
      lines[0]?.service_id ?? null, // хуучин query-нүүдэд зориулсан үндсэн үйлчилгээ
      assigned_employee || null, // mt_user.user_id (UUID)
      title,
      description || null,
      totalPrice,
      status || 'pending',
      priority || 'medium', // Зэрэглэл утга
      due_date || null
    ];

    // Ажил болон үйлчилгээнүүдийг хамт хадгална (аль нэг нь алдаа гарвал аль аль нь буцна)
    const client = await pool.connect();
    let work;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(insertQuery, values);
      work = rows[0];
      await replaceWorkServices(client, work.work_id, lines);
      await logAudit(
        { session: session!, action: 'work.create', entityType: 'work', entityId: work.work_id, summary: work.title, details: { price: work.price, status: work.status } },
        client
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      success: true, 
      data: work,
      message: 'Ажил амжилттай бүртгэгдлээ' 
    });
  } catch (error) {
    console.error('Create Work Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ажил хадгалахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}