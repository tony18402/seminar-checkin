'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ForceCheckinButtonProps = {
  attendeeId: string;
  hasSlip: boolean;
  action: 'checkin' | 'uncheckin';
  label: string;
  isCheckedIn: boolean;
};

export default function ForceCheckinButton({
  attendeeId,
  hasSlip,
  action,
  label,
  isCheckedIn,
}: ForceCheckinButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCalling, setIsCalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const isLoading = isCalling || isPending;

  const handleForceCheckin = async () => {
    setMessage(null);
    setMessageType('success');

    // เช็คว่าเป็นการยกเลิกเช็กอินแล้วแต่ผู้เข้าร่วมยังไม่ได้เช็กอิน
    if (action === 'uncheckin' && !isCheckedIn) {
      setMessage('ผู้เข้าร่วมยังไม่ได้เช็กอิน ดังนั้นไม่สามารถยกเลิกเช็กอินได้');
      setMessageType('error');
      return;
    }

    // ถ้าอยากเตือนกรณียังไม่มีสลิป
    if (!hasSlip) {
      const ok = window.confirm(
        'ยังไม่พบสลิปแนบในระบบ ต้องการเช็กอินแทนผู้เข้าร่วมรายนี้หรือไม่?'
      );
      if (!ok) return;
    }

    try {
      setIsCalling(true);

      const res = await fetch('/api/admin/force-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attendeeId, action }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message || 'เช็กอินแทนไม่สำเร็จ');
        setMessageType('error');
        return;
      }

      setMessage(data.message || 'เช็กอินแทนเรียบร้อย');
      setMessageType('success');

      // refresh หน้า admin ให้ข้อมูลในตารางอัปเดต
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('force checkin button error', err);
      setMessage('เกิดข้อผิดพลาดขณะเช็กอินแทน');
      setMessageType('error');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="admin-forcecheckin">
      <button
        type="button"
        className="admin-forcecheckin__button"
        onClick={handleForceCheckin}
        disabled={isLoading}
        data-action={action}
        data-no-slip={!hasSlip}
        data-loading={isLoading}
      >
        {isLoading ? 'กำลังเช็กอิน…' : label}
      </button>
      {message && (
        <p 
          className="admin-forcecheckin__message" 
          data-type={messageType}
          title={message}
        >
          {message}
        </p>
      )}
    </div>
  );
}