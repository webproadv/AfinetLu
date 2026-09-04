import { createSupabaseServerClient } from '../../../lib/supabase-server';
import { isFuoriSla } from '../../../lib/sla';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const STATO_LABEL: Record<string, string> = {
  bloccata: 'Bloccata',
  da_iniziare: 'Da iniziare',
  in_corso: 'In corso',
  in_ritardo: 'In ritardo',
  completata: 'Completata',
};

async function completaFase(faseId: string, clienteId: string) {
  'use server';
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.rpc('completa_fase_e_sblocca', { p_fase_id: faseId });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/clienti/${clienteId}`);
  revalidatePath('/dashboard');
}

async function creaCartelleDrive(clienteId: string, nomeCliente: string) {
  'use server';
  const { creaStrutturaCartelleCliente } = await import('../../../lib/google-drive');
  const url = await creaStrutturaCartelleCliente(nomeCliente);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('clienti').update({ drive_folder_url: url }).eq('id', clienteId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/clienti/${clienteId}`);
}

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { userId } = await auth();

  const { data: cliente } = await supabase
    .from('clienti')
    .select('*, servizi_acquistati(*)')
    .eq('id', params.id)
    .single();

  if (!cliente) notFound();

  const { data: ioRaw } = await supabase
    .from('utenti_owner')
    .select('id, ruolo')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const io: any = ioRaw;
  const sonoAdmin = io?.ruolo === 'admin' || io?.ruolo === 'superadmin';

  const { data: fasiRaw } = await supabase
    .from('fasi_istanza')
    .select('*, fasi_template(*), fasi_istanza_owners(utenti_owner(id, nome))')
    .eq('cliente_id', params.id);

  const fasi = (fasiRaw || []).sort((a: any, b: any) => a.fasi_template.numero - b.fasi_template.numero);

  return (
    <div>
      <div className="client-header">
        <h2>{cliente.ragione_sociale}</h2>
        {cliente.drive_folder_url && (
          <p>
            <a
              className="drive-link"
              href={cliente.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              📁 Apri cartella Drive
            </a>
          </p>
        )}
        <p>
          {cliente.referente ? `Referente: ${cliente.referente} · ` : ''}
          Inserito il {cliente.data_inserimento}
        </p>
        <p>
          {cliente.email ? <>Email: <a href={`mailto:${cliente.email}`}>{cliente.email}</a></> : 'Email: —'}
          {' · '}
          {cliente.telefono ? <>Telefono: <a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a></> : 'Telefono: —'}
        </p>
        {(cliente.stato_generale || cliente.origine) && (
          <p>
            {cliente.stato_generale ? `Stato: ${cliente.stato_generale}` : ''}
            {cliente.stato_generale && cliente.origine ? ' · ' : ''}
            {cliente.origine ? `Origine: ${cliente.origine}` : ''}
          </p>
        )}
        {cliente.servizi_acquistati?.length > 0 && (
          <p>Servizi: {cliente.servizi_acquistati.map((s: any) => s.servizio).join(', ')}</p>
        )}
      </div>

      <div className="timeline">
        {fasi.map((f: any) => {
          const ownerNomi = (f.fasi_istanza_owners || [])
            .map((r: any) => r.utenti_owner?.nome)
            .filter(Boolean);
          const sonoAssegnato =
            sonoAdmin || (f.fasi_istanza_owners || []).some((r: any) => r.utenti_owner?.id === io?.id);
          const puoCompletare = f.stato !== 'completata' && f.stato !== 'bloccata' && sonoAssegnato;
          const fuoriSla = isFuoriSla(f);

          return (
            <div className={`timeline-item stato-${f.stato}${fuoriSla ? ' fuori-sla' : ''}`} key={f.id}>
              <div className="timeline-num">{String(f.fasi_template.numero).padStart(2, '0')}</div>
              <div className="timeline-body">
                <p className="timeline-title">
                  {f.fasi_template.nome}
                  {fuoriSla && <span className="badge badge-danger" style={{ marginLeft: 8 }}>Fuori SLA</span>}
                </p>
                <p className="timeline-sub">
                  Owner: {ownerNomi.length > 0 ? ownerNomi.join(', ') : '—'} · Scadenza teorica:{' '}
                  {f.data_scadenza_teorica || '—'} · Stato: {STATO_LABEL[f.stato]}
                </p>
                {f.fasi_template.numero === 3 && f.stato !== 'bloccata' && !cliente.drive_folder_url && sonoAssegnato && (
                  <form action={creaCartelleDrive.bind(null, cliente.id, cliente.ragione_sociale)}>
                    <button type="submit" className="button-sm button-drive">
                      📁 Crea cartelle su Drive
                    </button>
                  </form>
                )}
                {puoCompletare && (
                  <form action={completaFase.bind(null, f.id, cliente.id)}>
                    <button type="submit" className="button-sm">Segna come completata</button>
                  </form>
                )}
                {f.stato !== 'completata' && f.stato !== 'bloccata' && !sonoAssegnato && (
                  <p className="timeline-sub" style={{ fontStyle: 'italic' }}>
                    Solo {ownerNomi.join(' o ') || 'l\'owner assegnato'} può completare questa fase
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
