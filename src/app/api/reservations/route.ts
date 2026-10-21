import { NextResponse } from 'next/server';
import { MANAGER_ROLES } from '@/src/lib/roles';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import {
  RESERVATION_FROM,
  RESERVATION_SELECT,
  findEmployeeConflict,
  getCustomerSnapshot,
  replaceReservationServices,
  validateReservationInput,
  withTransaction,
} from '@/src/lib/reservations';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET: Захиалгын жагсаалт (?from=YYYY-MM-DD&to=YYYY-MM-DD) эсвэл ?action=options сонголтын дата
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth({ roles: MANAGER_ROLES });
    if (error) return error;
    const { companyId } = session;

    const { searchParams } = new URL(request.url);

    if (searchParams.get('action') === 'options') {
      const [individualsRes, companiesRes, servicesRes, employeesRes] = await Promise.all([
        pool.query(
          `SELECT customer_id AS id, first_name, last_name, phone FROM mt_customer WHERE company_id = $1 ORDER BY last_name, first_name`,
          [companyId]
        ),
        pool.query(
          `SELECT company_customer_id AS id, name, tax_number, phone FROM mt_customercompany WHERE company_id = $1 ORDER BY name`,
          [companyId]
        ),
        pool.query(
          `SELECT service_id, name, price, duration FROM mt_services WHERE company_id = $1 ORDER BY name`,
          [companyId]
        ),
        pool.query(
          `SELECT user_id, first_name, last_name, position FROM mt_user
           WHERE company_id = $1 AND is_active IS NOT FALSE ORDER BY last_name, first_name`,
          [companyId]
        ),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          individuals: individualsRes.rows,
          companies: companiesRes.rows,
          services: servicesRes.rows,
          employees: employeesRes.rows,
        },
      });
    }

    const conditions = ['r.company_id = $1'];
    const values: unknown[] = [companyId];
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && DATE_RE.test(from)) {
      values.push(from);
      conditions.push(`r.reservation_date >= $${values.length}::date`);
    }
    if (to && DATE_RE.test(to)) {
      values.push(to);
      conditions.push(`r.reservation_date <= $${values.length}::date`);
    }

    const { rows } = await pool.query(
      `SELECT ${RESERVATION_SELECT} ${RESERVATION_FROM}
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.reservation_date, r.start_time`,
      values
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch Reservations Error:', error);
    return NextResponse.json(
      { success: false, error: 'Захиалгын мэдээлэл авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// POST: Шинэ захиалга бүртгэх. Харилцагчийн мэдээллийг mt_customer / mt_customercompany-оос хуулна.
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth({ roles: MANAGER_ROLES });
    if (error) return error;
    const { companyId, userId } = session;

    const body = await request.json();
    const validated = await validateReservationInput(companyId, body, { requireCustomer: true, isNew: true });
    if (validated.error !== undefined) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }
    const input = validated.data;

    const snapshot = await getCustomerSnapshot(companyId, input.customer_type, input.customer_id!);
    if (snapshot.error !== undefined) {
      return NextResponse.json({ success: false, error: snapshot.error }, { status: 400 });
    }
    const customer = snapshot.data;

    const conflict = await findEmployeeConflict(companyId, input);
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }

    // Захиалга болон үйлчилгээнүүдийг хамт хадгална
    const reservation = await withTransaction(async (client) => {
      const { rows } = await client.query(
      `
        INSERT INTO mt_reservation (
          company_id, customer_type, customer_id, company_customer_id,
          customer_name, customer_phone, customer_email, customer_address, customer_register,
          service_id, assigned_employee, reservation_date, start_time, end_time,
          status, note, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING reservation_id
      `,
      [
        companyId,
        input.customer_type,
        customer.customer_id,
        customer.company_customer_id,
        customer.customer_name,
        customer.customer_phone,
        customer.customer_email,
        customer.customer_address,
        customer.customer_register,
        input.services[0]?.service_id ?? null, // хуучин query-нүүдэд зориулсан үндсэн үйлчилгээ
        input.assigned_employee,
        input.reservation_date,
        input.start_time,
        input.end_time,
        input.status,
        input.note,
        userId,
      ]
      );
      await replaceReservationServices(client, rows[0].reservation_id, input.services);
      return rows[0];
    });

    return NextResponse.json({
      success: true,
      data: reservation,
      message: 'Захиалга амжилттай бүртгэгдлээ',
    });
  } catch (error) {
    console.error('Create Reservation Error:', error);
    return NextResponse.json(
      { success: false, error: 'Захиалга хадгалахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}
