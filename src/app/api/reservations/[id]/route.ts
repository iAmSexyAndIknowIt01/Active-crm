import { NextResponse } from 'next/server';
import { MANAGER_ROLES } from '@/src/lib/roles';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import {
  RESERVATION_FROM,
  RESERVATION_SELECT,
  LINKED_TO_WORK_ERROR,
  MANUAL_RESERVATION_STATUSES,
  findEmployeeConflict,
  getCustomerSnapshot,
  replaceReservationServices,
  validateReservationInput,
  withTransaction,
} from '@/src/lib/reservations';

type Params = { params: Promise<{ id: string }> };

async function findReservation(id: string, companyId: string) {
  const { rows } = await pool.query(
    `SELECT ${RESERVATION_SELECT} ${RESERVATION_FROM}
     WHERE r.reservation_id::text = $1 AND r.company_id = $2`,
    [id, companyId]
  );
  return rows[0] ?? null;
}

const notFound = () =>
  NextResponse.json({ success: false, error: 'Захиалга олдсонгүй' }, { status: 404 });

// GET: Захиалгын дэлгэрэнгүй
export async function GET(_request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAuth({ roles: MANAGER_ROLES });
    if (error) return error;

    const { id } = await params;
    const reservation = await findReservation(id, session.companyId);
    if (!reservation) return notFound();

    return NextResponse.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Fetch Reservation Error:', error);
    return NextResponse.json(
      { success: false, error: 'Захиалгын мэдээлэл авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// PUT: Захиалгыг бүхэлд нь засах. Харилцагч сонгосон бол мэдээллийг нь дахин хуулна,
// сонгоогүй бол (жишээ нь харилцагч устсан) өмнөх хуулбарыг хэвээр үлдээнэ.
export async function PUT(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAuth({ roles: MANAGER_ROLES });
    if (error) return error;
    const { companyId } = session;

    const { id } = await params;
    const existing = await findReservation(id, companyId);
    if (!existing) return notFound();
    if (existing.work_id) {
      return NextResponse.json({ success: false, error: LINKED_TO_WORK_ERROR }, { status: 409 });
    }

    const body = await request.json();
    const validated = await validateReservationInput(companyId, body, { requireCustomer: false });
    if (validated.error !== undefined) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }
    const input = validated.data;

    let customer = {
      customer_id: existing.customer_id,
      company_customer_id: existing.company_customer_id,
      customer_name: existing.customer_name,
      customer_phone: existing.customer_phone,
      customer_email: existing.customer_email,
      customer_address: existing.customer_address,
      customer_register: existing.customer_register,
    };
    if (input.customer_id) {
      const snapshot = await getCustomerSnapshot(companyId, input.customer_type, input.customer_id);
      if (snapshot.error !== undefined) {
        return NextResponse.json({ success: false, error: snapshot.error }, { status: 400 });
      }
      customer = snapshot.data;
    } else if (input.customer_type !== existing.customer_type) {
      return NextResponse.json(
        { success: false, error: 'Харилцагчийн төрлийг солих бол харилцагчаа сонгоно уу.' },
        { status: 400 }
      );
    }

    const conflict = await findEmployeeConflict(companyId, input, existing.reservation_id);
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }

    await withTransaction(async (client) => {
      await client.query(
      `
        UPDATE mt_reservation SET
          customer_type = $1,
          customer_id = $2,
          company_customer_id = $3,
          customer_name = $4,
          customer_phone = $5,
          customer_email = $6,
          customer_address = $7,
          customer_register = $8,
          service_id = $9,
          assigned_employee = $10,
          reservation_date = $11,
          start_time = $12,
          end_time = $13,
          status = $14,
          note = $15,
          update_date = CURRENT_TIMESTAMP
        WHERE reservation_id = $16 AND company_id = $17
      `,
      [
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
        existing.reservation_id,
        companyId,
      ]
      );
      await replaceReservationServices(client, existing.reservation_id, input.services);
    });

    return NextResponse.json({
      success: true,
      data: await findReservation(id, companyId),
      message: 'Захиалга амжилттай шинэчлэгдлээ',
    });
  } catch (error) {
    console.error('Update Reservation Error:', error);
    return NextResponse.json(
      { success: false, error: 'Захиалга шинэчлэхэд алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// PATCH: Зөвхөн төлөв солих (баталгаажуулах, цуцлах гэх мэт)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAuth({ roles: MANAGER_ROLES });
    if (error) return error;
    const { companyId } = session;

    const { id } = await params;
    const { status } = await request.json();
    if (!MANUAL_RESERVATION_STATUSES.includes(String(status))) {
      return NextResponse.json({ success: false, error: 'Захиалгын төлөв буруу байна.' }, { status: 400 });
    }

    const existing = await findReservation(id, companyId);
    if (!existing) return notFound();
    if (existing.work_id) {
      return NextResponse.json({ success: false, error: LINKED_TO_WORK_ERROR }, { status: 409 });
    }

    // Цуцлагдсан захиалгыг сэргээхэд тухайн цаг өөр захиалгад орсон байж болно
    const conflict = await findEmployeeConflict(
      companyId,
      { ...existing, status },
      existing.reservation_id
    );
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }

    await pool.query(
      `UPDATE mt_reservation SET status = $1, update_date = CURRENT_TIMESTAMP
       WHERE reservation_id = $2 AND company_id = $3`,
      [status, existing.reservation_id, companyId]
    );

    return NextResponse.json({ success: true, message: 'Төлөв шинэчлэгдлээ' });
  } catch (error) {
    console.error('Update Reservation Status Error:', error);
    return NextResponse.json(
      { success: false, error: 'Төлөв шинэчлэхэд алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// DELETE: Захиалгыг устгах (зөвхөн админ). Ердийн тохиолдолд "Цуцлагдсан" төлөв ашиглана.
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAuth({ admin: true });
    if (error) return error;

    const { id } = await params;
    const { rowCount } = await pool.query(
      `DELETE FROM mt_reservation WHERE reservation_id::text = $1 AND company_id = $2`,
      [id, session.companyId]
    );
    if (!rowCount) return notFound();

    return NextResponse.json({ success: true, message: 'Захиалга устгагдлаа' });
  } catch (error) {
    console.error('Delete Reservation Error:', error);
    return NextResponse.json(
      { success: false, error: 'Захиалга устгахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}
