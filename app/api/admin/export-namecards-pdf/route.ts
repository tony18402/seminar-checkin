// app/api/admin/export-namecards-pdf/route.ts

import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createServerClient } from '@/lib/supabaseServer';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AttendeeRow = {
  full_name: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  qr_image_url: string | null; // ✅ เพิ่มฟิลด์ QR
};

export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('attendees')
      .select(
        'full_name, organization, job_position, province, region, qr_image_url'
      ) // ✅ ดึง qr_image_url มาด้วย
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[export-namecards-pdf] Supabase error:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'ไม่สามารถดึงข้อมูลผู้เข้าร่วมได้',
          detail: error.message,
        },
        { status: 500 }
      );
    }

    const attendees = (data ?? []) as AttendeeRow[];

    // ✅ โหลดฟอนต์ตามที่มีใน public/fonts
    const regularFontPath = path.join(
      process.cwd(),
      'public',
      'fonts',
      'Sarabun-Regular.ttf'
    );
    const boldFontPath = path.join(
      process.cwd(),
      'public',
      'fonts',
      'Sarabun-Bold.ttf'
    );

    const [regularFontBytes, boldFontBytes] = await Promise.all([
      fs.readFile(regularFontPath),
      fs.readFile(boldFontPath),
    ]);

    const pdfDoc = await PDFDocument.create();

    // ⭐ register fontkit ก่อนใช้ embedFont กับไฟล์ .ttf
    pdfDoc.registerFontkit(fontkit);

    const thaiFont = await pdfDoc.embedFont(regularFontBytes);
    const thaiFontBold = await pdfDoc.embedFont(boldFontBytes);

    const pageWidth = 595.28; // A4 width (pt)
    const pageHeight = 841.89; // A4 height (pt)

    const cardsPerRow = 2;
    const cardsPerColumn = 4;
    const cardsPerPage = cardsPerRow * cardsPerColumn;

    const cardWidth = pageWidth / cardsPerRow;
    const cardHeight = pageHeight / cardsPerColumn;

    const marginX = 18;
    const marginY = 18;

    const fontSizeName = 18;
    const fontSizeJob = 12;
    const fontSizeOrg = 11;
    const fontSizeRegionProvince = 11;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cardIndex = 0;

    for (let i = 0; i < attendees.length; i++) {
      if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
      }

      const slotOnPage = cardIndex % cardsPerPage;
      const row = Math.floor(slotOnPage / cardsPerRow);
      const col = slotOnPage % cardsPerRow;

      const x = col * cardWidth;
      const y = pageHeight - (row + 1) * cardHeight;

      // 🔲 กรอบการ์ด
      page.drawRectangle({
        x: x + 6,
        y: y + 6,
        width: cardWidth - 12,
        height: cardHeight - 12,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
      });

      const textAreaX = x + marginX;
      const textAreaYTop = y + cardHeight - marginY;

      const attendee = attendees[i];
      const fullName = attendee.full_name ?? '';
      const org = attendee.organization ?? '';
      const job = attendee.job_position ?? '';
      const province = attendee.province ?? '';
      const region = attendee.region ?? null;
      const qrUrl = attendee.qr_image_url ?? '';

      // 🧾 พยายามโหลด QR image ถ้ามี url
      let qrImage = null;
      if (qrUrl) {
        try {
          const res = await fetch(qrUrl);
          if (res.ok) {
            const qrArrayBuffer = await res.arrayBuffer();
            // ส่วนใหญ่ QR เป็น PNG ถ้าคุณใช้ Supabase storage build PNG
            qrImage = await pdfDoc.embedPng(qrArrayBuffer);
          } else {
            console.warn(
              '[export-namecards-pdf] QR fetch failed:',
              qrUrl,
              res.status
            );
          }
        } catch (e) {
          console.warn(
            '[export-namecards-pdf] QR fetch error:',
            qrUrl,
            (e as Error).message
          );
        }
      }

      // 🧍‍♂️ ชื่อ (bold)
      if (fullName) {
        page.drawText(fullName, {
          x: textAreaX,
          y: textAreaYTop - fontSizeName - 4,
          size: fontSizeName,
          font: thaiFontBold,
          color: rgb(0, 0, 0),
        });
      }

      // 💼 ตำแหน่ง
      if (job) {
        page.drawText(job, {
          x: textAreaX,
          y: textAreaYTop - fontSizeName - fontSizeJob - 10,
          size: fontSizeJob,
          font: thaiFont,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      // 🏢 หน่วยงาน
      if (org) {
        page.drawText(org, {
          x: textAreaX,
          y: textAreaYTop - fontSizeName - fontSizeJob - fontSizeOrg - 16,
          size: fontSizeOrg,
          font: thaiFont,
          color: rgb(0.2, 0.2, 0.2),
        });
      }

      // 🌍 ภาค + จังหวัด
      if (region || province) {
        const regionLabel = region ? `ภาค ${region}` : '';
        const provinceLabel = province ? `จังหวัด${province}` : '';
        const sep = regionLabel && provinceLabel ? ' – ' : '';
        const line = `${regionLabel}${sep}${provinceLabel}`;

        page.drawText(line, {
          x: textAreaX,
          y: y + marginY,
          size: fontSizeRegionProvince,
          font: thaiFont,
          color: rgb(0.25, 0.25, 0.25),
        });
      }

      // 🧩 วาด QR ด้านล่างของการ์ด (ถ้ามีรูป)
      if (qrImage) {
        const qrSize = 72; // ปรับขนาด QR ได้ตามใจ
        page.drawImage(qrImage, {
          x: x + cardWidth / 2 - qrSize / 2,
          y: y + marginY + 8,
          width: qrSize,
          height: qrSize,
        });
      }

      cardIndex++;
    }

    const pdfBytes = await pdfDoc.save();

    const pdfArrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="namecards-attendees.pdf"',
      },
    });
  } catch (err: any) {
    console.error('[export-namecards-pdf] Unexpected error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF',
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
