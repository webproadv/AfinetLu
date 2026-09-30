'use server';

import { createSupabaseServerClient } from '../../../lib/supabase-server';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

async function idUtenteCorrente(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string | null) {
  if (!userId) return null;
  const { data } = await supabase
    .from('utenti_owner')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

export async function creaNotaLavorazione(clienteId: string, contenuto: string) {
  const testo = contenuto.trim();
  if (!testo) return;

  const supabase = createSupabaseServerClient();
  const { userId } = await auth();
  const creatoDaId = await idUtenteCorrente(supabase, userId);

  const { error } = await supabase.from('note_lavorazione').insert({
    cliente_id: clienteId,
    contenuto: testo,
    creato_da_id: creatoDaId,
  });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/clienti/${clienteId}`);
}

export async function aggiornaNotaLavorazione(notaId: string, clienteId: string, contenuto: string) {
  const testo = contenuto.trim();
  if (!testo) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('note_lavorazione')
    .update({ contenuto: testo, aggiornato_il: new Date().toISOString() })
    .eq('id', notaId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/clienti/${clienteId}`);
}

export async function eliminaNotaLavorazione(notaId: string, clienteId: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('note_lavorazione').delete().eq('id', notaId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/clienti/${clienteId}`);
}
