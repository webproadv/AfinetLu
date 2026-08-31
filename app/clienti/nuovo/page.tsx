import { createSupabaseServerClient } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';

async function creaCliente(formData: FormData) {
  'use server';
  const supabase = createSupabaseServerClient();

  const ragione_sociale = String(formData.get('ragione_sociale') || '').trim();
  const referente = String(formData.get('referente') || '').trim() || null;
  const email = String(formData.get('email') || '').trim() || null;
  const telefono = String(formData.get('telefono') || '').trim() || null;
  const data_inserimento = String(formData.get('data_inserimento') || '');
  const servizio = String(formData.get('servizio') || '').trim();
  const costo = formData.get('costo') ? Number(formData.get('costo')) : null;

  if (!ragione_sociale || !data_inserimento) {
    throw new Error('Ragione sociale e data di inserimento sono obbligatorie');
  }

  const { data: cliente, error } = await supabase
    .from('clienti')
    .insert({ ragione_sociale, referente, email, telefono, data_inserimento, origine: 'manuale' })
    .select('id')
    .single();

  if (error || !cliente) {
    throw new Error(error?.message || 'Errore nella creazione del cliente');
  }

  if (servizio) {
    await supabase.from('servizi_acquistati').insert({ cliente_id: cliente.id, servizio, costo });
  }

  redirect(`/clienti/${cliente.id}`);
}

export default function NuovoClientePage() {
  const oggi = new Date().toISOString().slice(0, 10);
  return (
    <div className="form-card">
      <h2>Nuova pratica cliente</h2>
      <form action={creaCliente}>
        <label>
          Ragione sociale *
          <input name="ragione_sociale" required />
        </label>
        <label>
          Referente
          <input name="referente" />
        </label>
        <label>
          Email
          <input name="email" type="email" />
        </label>
        <label>
          Telefono
          <input name="telefono" />
        </label>
        <label>
          Data di inserimento *
          <input name="data_inserimento" type="date" defaultValue={oggi} required />
        </label>
        <fieldset>
          <legend>Servizio acquistato</legend>
          <label>
            Servizio
            <input name="servizio" placeholder="es. Gestione social media" />
          </label>
          <label>
            Costo (€)
            <input name="costo" type="number" step="0.01" />
          </label>
        </fieldset>
        <button type="submit" className="button">Crea pratica</button>
      </form>
    </div>
  );
}
