import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.attendeeId || !body.action) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ attendeeId หรือ action ในคำขอ' },
        { status: 400 }
      );
    }

    const attendeeId = String(body.attendeeId);
    const action = body.action;

    const supabase = createServerClient();

    // ดึงข้อมูลผู้เข้าร่วม
    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .select('id, full_name, checked_in_at, slip_url')
      .eq('id', attendeeId)
      .single();

    if (attendeeError || !attendee) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบผู้เข้าร่วมในระบบ' },
        { status: 404 }
      );
    }

    if (action === 'uncheckin') {
      // เช็กอินอยู่แล้วและต้องการยกเลิก
      if (!attendee.checked_in_at) {
        return NextResponse.json(
          { success: false, message: 'ผู้เข้าร่วมรายนี้ยังไม่ได้เช็กอิน' },
          { status: 400 }
        );
      }

      // ยกเลิกการเช็กอิน (ตั้งค่า checked_in_at เป็น null)
      const { data: updated, error: updateError } = await supabase
        .from('attendees')
        .update({ checked_in_at: null })
        .eq('id', attendee.id)
        .select('id, full_name, checked_in_at')
        .single();

      if (updateError || !updated) {
        console.error('force uncheckin update error:', updateError);
        return NextResponse.json(
          {
            success: false,
            message: 'ยกเลิกเช็กอินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: `ยกเลิกเช็กอินผู้เข้าร่วม “${updated.full_name ?? ''}” เรียบร้อย`,
          checked_in_at: updated.checked_in_at,
        },
        { status: 200 }
      );
    }

    // ฟังก์ชันสำหรับการเช็กอิน (กรณีเช็กอิน)
    if (action === 'checkin') {
      if (attendee.checked_in_at) {
        return NextResponse.json(
          {
            success: true,
            message: 'ผู้เข้าร่วมรายนี้เช็กอินไว้แล้ว',
            checked_in_at: attendee.checked_in_at,
            alreadyCheckedIn: true,
          },
          { status: 200 }
        );
      }

      const nowIso = new Date().toISOString();

      // ทำการบังคับเช็กอิน
      const { data: updated, error: updateError } = await supabase
        .from('attendees')
        .update({ checked_in_at: nowIso })
        .eq('id', attendee.id)
        .select('id, full_name, checked_in_at')
        .single();

      if (updateError || !updated) {
        console.error('force checkin update error:', updateError);
        return NextResponse.json(
          {
            success: false,
            message: 'เช็กอินแทนไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: `เช็กอินแทนผู้เข้าร่วม “${updated.full_name ?? ''}” เรียบร้อย`,
          checked_in_at: updated.checked_in_at,
          alreadyCheckedIn: false,
        },
        { status: 200 }
      );
    }

    // กรณี action ที่ไม่ได้ระบุ
    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('force checkin error:', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'เกิดข้อผิดพลาดในระบบขณะเช็กอินแทน กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
      },
      { status: 500 }
    );
  }
}
