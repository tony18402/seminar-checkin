// app/api/upload-slip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);

    if (!formData) {
      return NextResponse.json(
        { success: false, message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง (formData)' },
        { status: 400 }
      );
    }

    const attendeeId = formData.get('attendeeId');
    const file = formData.get('file');

    if (!attendeeId || typeof attendeeId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ attendeeId ในคำขอ' },
        { status: 400 }
      );
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบไฟล์แนบในคำขอ' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // ✅ ใช้ bucket ชื่อ payments (ตามที่คุณสร้างไว้)
    const fileExt = 'jpg'; // จะปรับตาม type จริงก็ได้
    const fileName = `${attendeeId}-${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payments') // ← ตรงนี้สำคัญ
      .upload(fileName, fileBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error('upload-slip: upload error', uploadError);
      return NextResponse.json(
        {
          success: false,
          message: 'อัปโหลดไฟล์สลิปไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('payments') // ← ให้ตรงกับด้านบน
      .getPublicUrl(uploadData.path);

    const slipUrl = publicUrlData.publicUrl;

    const { data: updated, error: updateError } = await supabase
      .from('attendees')
      .update({ slip_url: slipUrl })
      .eq('id', attendeeId)
      .select('id, slip_url')
      .single();

    if (updateError || !updated) {
      console.error('upload-slip: update attendee error', updateError);
      return NextResponse.json(
        {
          success: false,
          message:
            'บันทึกลิงก์สลิปลงระบบไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'อัปโหลดสลิปเรียบร้อยแล้ว',
        slip_url: updated.slip_url,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('upload-slip: unexpected error', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'เกิดข้อผิดพลาดในระบบระหว่างอัปโหลดสลิป กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
      },
      { status: 500 }
    );
  }
}
