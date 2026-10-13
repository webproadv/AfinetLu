import { createSupabaseServerClient } from '../../../../lib/supabase-server';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function salvaCliente(clienteId: string, formData: FormData) {
  'use server';
  const supabase = createSupabaseServerClient();

  const ragione_sociale = String(formData.get('ragione_sociale') || '').trim();
  const referente = String(formData.get('referente') || '').trim() || null;
  const email = String(formData.get('email') || '').trim() || null;
  const telefono = String(formData.get('telefono') || '').trim() || null;
  const drive_folder_url = String(formData.get('drive_folder_url') || '').trim() || null;
  const riprese_mensili = formData.get('riprese_mensili') === '2' ? 2 : 1;

  if (!ragione_sociale) {
    throw new Error('La ragione sociale è obbligatoria');
  }

  // .select() permette di accorgersi se le policy hanno bloccato la modifica (0 righe, nessun errore).
  const { data, error } = await supabase
    .from('clienti')
    .update({ ragione_sociale, referente, email, telefono, drive_folder_url, riprese_mensili })
    .eq('id', clienteId)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.length === 0) {
    throw new Error('Modifica non consentita: solo admin e superadmin possono modificare i dati del cliente.');
  }

  revalidatePath(`/clienti/${clienteId}`);
  revalidatePath('/dashboard');
  redirect(`/clienti/${clienteId}`);
}

export default async function ModificaClientePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { userId } = await auth();

  const { data: ioRaw } = await supabase
    .from('utenti_owner')
    .select('ruolo')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const io: any = ioRaw;
  const sonoAdmin = io?.ruolo === 'admin' || io?.ruolo === 'superadmin';
  if (!sonoAdmin) {
    redirect(`/clienti/${params.id}`);
  }

  const { data: cliente } = await supabase
    .from('clienti')
    .select('id, ragione_sociale, referente, email, telefono, drive_folder_url, riprese_mensili')
    .eq('id', params.id)
    .single();

  if (!cliente) notFound();

  return (
    <div className="form-card">
      <h2>Modifica cliente</h2>
      <form action={salvaCliente.bind(null, cliente.id)}>
        <label>
          Ragione sociale *
          <input name="ragione_sociale" defaultValue={cliente.ragione_sociale ?? ''} required />
        </label>
        <label>
          Referente
          <input name="referente" defaultValue={cliente.referente ?? ''} />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={cliente.email ?? ''} />
        </label>
        <label>
          Telefono
          <input name="telefono" defaultValue={cliente.telefono ?? ''} />
        </label>
        <label>
          Link cartella Drive
          <input name="drive_folder_url" type="url" defaultValue={cliente.drive_folder_url ?? ''} placeholder="https://drive.google.com/drive/folders/..." />
        </label>
        <label>
          Riprese mensili
          <select name="riprese_mensili" defaultValue={String(cliente.riprese_mensili ?? 1)}>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <div className="header-actions">
          <button type="submit" className="button">Salva modifiche</button>
          <Link href={`/clienti/${cliente.id}`} className="button-sm print-link">Annulla</Link>
        </div>
      </form>
    </div>
  );
}
