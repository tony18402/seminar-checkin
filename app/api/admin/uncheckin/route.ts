// app/api/admin/uncheckin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.attendeeId) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ attendeeId ในคำขอ' },
        { status: 400 }
      );
    }

    const attendeeId = String(body.attendeeId);
    const supabase = createServerClient();

    // ดึงข้อมูลผู้เข้าร่วม
    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .select('id, full_name, checked_in_at')
      .eq('id', attendeeId)
      .single();

    if (attendeeError || !attendee) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบผู้เข้าร่วมในระบบ' },
        { status: 404 }
      );
    }

    // ถ้ายังไม่ได้เช็กอินอยู่แล้ว ก็ไม่ต้องทำอะไร
    if (!attendee.checked_in_at) {
      return NextResponse.json(
        {
          success: true,
          alreadyUnchecked: true,
          message: 'ผู้เข้าร่วมรายนี้ยังไม่ได้เช็กอินอยู่แล้ว',
        },
        { status: 200 }
      );
    }

    // ยกเลิกเช็กอิน: ตั้ง checked_in_at เป็น null
    const { data: updated, error: updateError } = await supabase
      .from('attendees')
      .update({ checked_in_at: null })
      .eq('id', attendee.id)
      .select('id, full_name, checked_in_at')
      .single();

    if (updateError || !updated) {
      console.error('uncheckin update error:', updateError);
      return NextResponse.json(
        {
          success: false,
          message:
            'ยกเลิกเช็กอินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `ยกเลิกเช็กอินให้ผู้เข้าร่วม “${updated.full_name ?? ''}” เรียบร้อย`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('uncheckin error:', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'เกิดข้อผิดพลาดในระบบขณะยกเลิกเช็กอิน กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
      },
      { status: 500 }
    );
  }
}
