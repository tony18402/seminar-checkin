// app/api/admin/delete-attendee/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

type DeleteBody = {
  attendeeId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeleteBody;
    const attendeeId = body.attendeeId;

    if (!attendeeId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'กรุณาระบุ attendeeId',
        },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from('attendees')
      .delete()
      .eq('id', attendeeId);

    if (error) {
      console.error('Delete attendee error:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'ลบข้อมูลผู้เข้าร่วมเรียบร้อยแล้ว',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Delete attendee unexpected error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดไม่คาดคิดระหว่างลบข้อมูล',
      },
      { status: 500 }
    );
  }
}
