import { NextResponse } from 'next/server';
import { getSession } from '@/src/lib/session';
import { isPlatformAdmin } from '@/src/lib/platform';
import { pool } from '@/src/lib/db'; // Төслийн файлын бүтцээс хамаарч замыг шалгана уу

export async function GET() {
  try {
    const session = await getSession();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Хэрэглэгчийн ID cookie олдсонгүй.' },
        { status: 401 }
      );
    }

    const query = `
      SELECT email, first_name, last_name 
      FROM mt_user 
      WHERE user_id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Хэрэглэгчийн мэдээлэл олдсонгүй.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      // role нь зөвхөн цэс харуулах/нуухад; эрхийн жинхэнэ шалгалт API бүр дээр хийгдэнэ
      // subscription нь багцын анхааруулга, is_platform_admin нь "Платформ" цэсийг харуулахад
      data: {
        ...result.rows[0],
        role: session!.role,
        subscription: session!.subscription,
        is_platform_admin: isPlatformAdmin(session!.email),
      },
    });
  } catch (error) {
    console.error('User Fetch Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}