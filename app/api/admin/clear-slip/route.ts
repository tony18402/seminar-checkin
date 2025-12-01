import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { attendeeId?: string } | null;

  if (!body?.attendeeId) {
    return NextResponse.json(
      { error: 'missing attendeeId' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('attendees')
    .update({ slip_url: null })
    .eq('id', body.attendeeId);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
