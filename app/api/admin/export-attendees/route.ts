// app/api/admin/export-attendees/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';

export const runtime = 'nodejs';

// ---- Types จากฐานข้อมูล ----
type DbAttendee = {
  event_id: string | null;
  full_name: string | null;
  organization: string | null;
  province: string | null;
  region: number | null;
  job_position: string | null;
  phone: string | null;
  food_type: string | null;
  hotel_name: string | null;
  checked_in_at: string | null;
  slip_url: string | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  created_at: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
};

// เดานามสกุลรูปจาก URL
function getImageExtension(url: string): 'png' | 'jpeg' | null {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpeg';
  return null;
}

// ดึงรูปจาก URL เป็น Buffer
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error('fetchImageBuffer error', e);
    return null;
  }
}

// แปลง code ประเภทอาหารเป็นภาษาไทย
function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'อาหารทั่วไป';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'halal':
      return 'ฮาลาล';
    default:
      return 'ไม่ระบุ';
  }
}

// ตั้งคอลัมน์และ header ให้ชีตแต่ละภาค
function setupSheetColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns = [
    { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 30 },
    { header: 'เบอร์โทร', key: 'phone', width: 16 },
    { header: 'หน่วยงาน', key: 'organization', width: 28 },
    { header: 'ตำแหน่ง', key: 'job_position', width: 24 },
    { header: 'จังหวัด', key: 'province', width: 18 },
    { header: 'ภาค', key: 'region', width: 12 },
    { header: 'ประเภทอาหาร', key: 'food_type', width: 18 },
    { header: 'ชื่อผู้ประสานงาน', key: 'coordinator_name', width: 26 },
    {
      header: 'เบอร์โทรผู้ประสานงาน',
      key: 'coordinator_phone',
      width: 20,
    },
    { header: 'โรงแรม', key: 'hotel_name', width: 24 },
    { header: 'สถานะเช็กอิน', key: 'checkin_status', width: 16 },
    { header: 'สลิป (รูป)', key: 'slip', width: 20 },
    { header: 'รหัสบัตร', key: 'ticket_token', width: 26 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // ให้หัวตารางค้างไว้ เวลาเลื่อนลง
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    // ✅ รองรับ region = 0 (ศาลกลาง) + 1–9
    const regionParam = req.nextUrl.searchParams.get('region');
    const regionNumberRaw =
      regionParam !== null ? Number(regionParam) : Number.NaN;

    const hasRegionFilter =
      Number.isFinite(regionNumberRaw) &&
      regionNumberRaw >= 0 &&
      regionNumberRaw <= 9;

    const regionFilter: number | null = hasRegionFilter
      ? regionNumberRaw
      : null;

    let query = supabase
      .from('attendees')
      .select(
        `
        event_id,
        full_name,
        organization,
        province,
        region,
        job_position,
        phone,
        food_type,
        hotel_name,
        checked_in_at,
        slip_url,
        qr_image_url,
        ticket_token,
        created_at,
        coordinator_name,
        coordinator_phone
      `,
      )
      .order('region', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true });

    if (regionFilter !== null) {
      query = query.eq('region', regionFilter);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error('export-attendees supabase error:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'โหลดข้อมูลไม่สำเร็จจากฐานข้อมูล',
          error,
        },
        { status: 500 },
      );
    }

    const attendees = data as DbAttendee[];

    const workbook = new ExcelJS.Workbook();

    // -------------------- โหมด 1: export เฉพาะภาคเดียว (มี ?region=) --------------------
    if (regionFilter !== null) {
      const sheetName =
        regionFilter === 0 ? 'ศาลกลาง' : `ภาค ${regionFilter}`; // 👈 ใช้ชื่อสั้น ๆ
      const sheet = workbook.addWorksheet(sheetName);
      setupSheetColumns(sheet);

      for (const a of attendees) {
        const row = sheet.addRow({
          full_name: a.full_name ?? '',
          phone: a.phone ?? '',
          organization: a.organization ?? '',
          job_position: a.job_position ?? '',
          province: a.province ?? '',
          region: a.region ?? '',
          food_type: formatFoodType(a.food_type ?? null),
          coordinator_name: a.coordinator_name ?? '',
          coordinator_phone: a.coordinator_phone ?? '',
          hotel_name: a.hotel_name ?? '',
          checkin_status: a.checked_in_at ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน',
          slip: '',
          ticket_token: a.ticket_token ?? '',
        });

        const excelRow = row.number;

        // ฝังรูปสลิป (ถ้ามี) — ถ้า error ให้ข้าม
        try {
          if (a.slip_url) {
            const ext = getImageExtension(a.slip_url);
            if (ext) {
              const imgBuffer = await fetchImageBuffer(a.slip_url);
              if (imgBuffer) {
                const imageId = workbook.addImage({
                  buffer: imgBuffer as any,
                  extension: ext,
                });

                // ตอนนี้ "สลิป (รูป)" คือคอลัมน์ลำดับที่ 12 → index 11
                sheet.addImage(imageId, {
                  tl: { col: 11.1, row: excelRow - 0.9 },
                  ext: { width: 90, height: 90 },
                });

                sheet.getRow(excelRow).height = 80;
              }
            }
          }
        } catch (imgErr) {
          console.error('embed slip image error (single sheet)', imgErr);
        }
      }

      const fileArrayBuffer = await workbook.xlsx.writeBuffer();
      const filename =
        regionFilter === 0
          ? 'attendees-central-court.xlsx'
          : `attendees-region-${regionFilter}.xlsx`;

      return new NextResponse(fileArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // -------------------- โหมด 2: export ทุกภาค แยกชีต --------------------
    const centralSheet = workbook.addWorksheet('ศาลกลาง');
    setupSheetColumns(centralSheet);

    const regionSheets: Record<string, ExcelJS.Worksheet> = {};
    for (let r = 1; r <= 9; r += 1) {
      const sheet = workbook.addWorksheet(`ภาค ${r}`); // 👈 ชื่อสั้น ๆ ทั้ง 1–9
      setupSheetColumns(sheet);
      regionSheets[String(r)] = sheet;
    }

    let otherSheet: ExcelJS.Worksheet | null = null;
    const getOtherSheet = () => {
      if (!otherSheet) {
        otherSheet = workbook.addWorksheet('ไม่ระบุภาค');
        setupSheetColumns(otherSheet);
      }
      return otherSheet;
    };

    for (const a of attendees) {
      const regionValue = a.region ?? -1;

      let targetSheet: ExcelJS.Worksheet;

      if (regionValue === 0) {
        targetSheet = centralSheet;
      } else if (regionValue >= 1 && regionValue <= 9) {
        targetSheet = regionSheets[String(regionValue)];
      } else {
        targetSheet = getOtherSheet();
      }

      const row = targetSheet.addRow({
        full_name: a.full_name ?? '',
        phone: a.phone ?? '',
        organization: a.organization ?? '',
        job_position: a.job_position ?? '',
        province: a.province ?? '',
        region: a.region ?? '',
        food_type: formatFoodType(a.food_type ?? null),
        coordinator_name: a.coordinator_name ?? '',
        coordinator_phone: a.coordinator_phone ?? '',
        hotel_name: a.hotel_name ?? '',
        checkin_status: a.checked_in_at ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน',
        slip: '',
        ticket_token: a.ticket_token ?? '',
      });

      const excelRow = row.number;

      try {
        if (a.slip_url) {
          const ext = getImageExtension(a.slip_url);
          if (ext) {
            const imgBuffer = await fetchImageBuffer(a.slip_url);
            if (imgBuffer) {
              const imageId = workbook.addImage({
                buffer: imgBuffer as any,
                extension: ext,
              });

              targetSheet.addImage(imageId, {
                tl: { col: 11.1, row: excelRow - 0.9 },
                ext: { width: 90, height: 90 },
              });

              targetSheet.getRow(excelRow).height = 80;
            }
          }
        }
      } catch (imgErr) {
        console.error('embed slip image error (multi sheet)', imgErr);
      }
    }

    const fileArrayBuffer = await workbook.xlsx.writeBuffer();
    const filename = 'attendees-by-region.xlsx';

    return new NextResponse(fileArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('export-attendees unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `เกิดข้อผิดพลาดภายใน: ${msg}` },
      { status: 500 },
    );
  }
}
