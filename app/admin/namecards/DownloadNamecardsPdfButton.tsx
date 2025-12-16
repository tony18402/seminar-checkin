// app/admin/namecards/DownloadNamecardsPdfButton.tsx
'use client';

import { useMemo, useRef, useState } from 'react';

type RegionOption = { value: number; label: string };

export default function DownloadNamecardsPdfButton() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [region, setRegion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const regions = useMemo<RegionOption[]>(
    () => [
      { value: 0, label: 'ภาค 0 — ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)' },
      { value: 1, label: 'ภาค 1' },
      { value: 2, label: 'ภาค 2' },
      { value: 3, label: 'ภาค 3' },
      { value: 4, label: 'ภาค 4' },
      { value: 5, label: 'ภาค 5' },
      { value: 6, label: 'ภาค 6' },
      { value: 7, label: 'ภาค 7' },
      { value: 8, label: 'ภาค 8' },
      { value: 9, label: 'ภาค 9' },
    ],
    []
  );

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const onConfirm = async () => {
    setIsLoading(true);
    try {
      const url = `/api/admin/export-namecards-pdf?region=${encodeURIComponent(region)}`;
      // ✅ ดาวน์โหลดเลย (ไม่เปิดแท็บใหม่)
      window.location.assign(url);
      close();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="admin-export-btn" onClick={open} disabled={isLoading}>
        ⬇️ ดาวน์โหลดนามบัตร (PDF)
      </button>

      <dialog ref={dialogRef}>
        <div style={{ minWidth: 360 }}>
          <h3 style={{ margin: 0 }}>เลือกภาคที่ต้องการ Export</h3>

          <div style={{ marginTop: 12 }}>
            <label>
              ภาค
              <select
                value={region}
                onChange={(e) => setRegion(Number(e.target.value))}
                style={{ display: 'block', marginTop: 6, width: '100%' }}
              >
                {regions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={onConfirm} disabled={isLoading}>
              {isLoading ? 'กำลังเริ่มดาวน์โหลด…' : 'Export PDF'}
            </button>
            <button type="button" onClick={close} disabled={isLoading}>
              ยกเลิก
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
