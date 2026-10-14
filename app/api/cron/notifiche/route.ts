import { NextResponse } from 'next/server';
import { inviaNotifiche } from '../../../../lib/notifiche';

export const dynamic = 'force-dynamic';

// Eseguito ogni giorno da Vercel Cron (vedi vercel.json): invia le email "fuori SLA"
// e recupera eventuali email di sblocco non ancora partite.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const esito = await inviaNotifiche(['sblocco', 'ritardo']);
  return NextResponse.json(esito);
}
