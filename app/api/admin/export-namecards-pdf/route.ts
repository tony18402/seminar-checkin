import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createServerClient } from '@/lib/supabaseServer';

type AttendeeCardRow = {
  id: string;
  event_id: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  food_type: string | null;
  hotel_name: string | null;
};

// แปลง code ประเภทอาหารเป็น label ภาษาไทย
function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'ทั่วไป';
    case 'no_pork':
      return 'ไม่ทานหมู';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'vegan':
      return 'เจ / วีแกน';
    case 'halal':
      return 'ฮาลาล';
    case 'seafood_allergy':
      return 'แพ้อาหารทะเล';
    case 'other':
      return 'อื่น ๆ';
    default:
      return 'ไม่ระบุ';
  }
}

// ถ้าใน DB ยังไม่มี qr_image_url ให้ fallback เป็นลิงก์ QR จาก ticket_token
function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

export async function GET(req: NextRequest) {
  // ดึง query parameter สำหรับการค้นหา
  const { searchParams } = new URL(req.url);
  const keyword = (searchParams.get('q') ?? '').trim().toLowerCase();

  // ดึงข้อมูลจาก Supabase
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('attendees')
    .select(
      `
      id,
      event_id,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      qr_image_url,
      ticket_token,
      food_type,
      hotel_name
    `
    )
    .order('full_name', { ascending: true });

  if (error || !data) {
    return NextResponse.json(
      { error: 'ไม่สามารถโหลดข้อมูลผู้เข้าร่วมได้' },
      { status: 500 }
    );
  }

  const attendees: AttendeeCardRow[] = data as AttendeeCardRow[];

  // filter ตาม keyword (ชื่อ / หน่วยงาน / ตำแหน่ง / จังหวัด / token)
  const filtered = keyword
    ? attendees.filter((a) => {
        const name = (a.full_name ?? '').toLowerCase();
        const org = (a.organization ?? '').toLowerCase();
        const job = (a.job_position ?? '').toLowerCase();
        const prov = (a.province ?? '').toLowerCase();
        const token = (a.ticket_token ?? '').toLowerCase();
        return (
          name.includes(keyword) ||
          org.includes(keyword) ||
          job.includes(keyword) ||
          prov.includes(keyword) ||
          token.includes(keyword)
        );
      })
    : attendees;

  if (filtered.length === 0) {
    return NextResponse.json(
      { error: 'ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา' },
      { status: 404 }
    );
  }

  // สร้าง PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // สำหรับแต่ละนามบัตร
  for (let i = 0; i < filtered.length; i++) {
    const a = filtered[i];
    const qrUrl = buildQrUrl(a.ticket_token, a.qr_image_url);

    // เพิ่มหน้าใหม่สำหรับแต่ละคน (ยกเว้นหน้าแรก)
    if (i > 0) {
      doc.addPage();
    }

    // หัวข้อ
    doc.setFontSize(20);
    doc.text('นามบัตรผู้เข้าร่วมงาน', 105, 20, { align: 'center' });

    // ข้อมูลส่วนบุคคล
    doc.setFontSize(16);
    doc.text(`ชื่อ: ${a.full_name || 'ไม่ระบุชื่อ'}`, 20, 40);

    doc.setFontSize(12);
    doc.text(`หน่วยงาน: ${a.organization || 'ไม่ระบุหน่วยงาน'}`, 20, 50);
    doc.text(`ตำแหน่ง: ${a.job_position || 'ไม่ระบุตำแหน่ง'}`, 20, 60);
    doc.text(`จังหวัด: ${a.province || 'ไม่ระบุจังหวัด'}`, 20, 70);
    doc.text(`โทรศัพท์: ${a.phone || 'ไม่ระบุ'}`, 20, 80);

    // QR Code (ถ้ามี)
    if (qrUrl) {
      try {
        // ดาวน์โหลด QR image และใส่ใน PDF
        const qrResponse = await fetch(qrUrl);
        const qrBlob = await qrResponse.blob();
        const qrBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(qrBlob);
        });

        doc.addImage(qrBase64, 'PNG', 70, 100, 70, 70);
        doc.setFontSize(10);
        doc.text('QR Code สำหรับเช็คอิน', 105, 180, { align: 'center' });
      } catch (err) {
        // ถ้าดาวน์โหลด QR ไม่ได้ ให้แสดง text แทน
        doc.setFontSize(10);
        doc.text('ไม่สามารถโหลด QR Code ได้', 105, 140, { align: 'center' });
      }
    } else {
      doc.setFontSize(10);
      doc.text('ไม่มี QR Code', 105, 140, { align: 'center' });
    }
  }

  // ส่ง PDF กลับเป็น response
  const pdfData = doc.output('arraybuffer');
  return new NextResponse(Buffer.from(pdfData), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="namecards.pdf"',
    },
  });
}
