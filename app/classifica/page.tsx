import { createSupabaseServerClient } from '../../lib/supabase-server';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

function primoDelMese(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function formattaMese(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function meseAdiacente(iso: string, delta: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + delta);
  return primoDelMese(d);
}

async function assegnaPremio(formData: FormData) {
  'use server';
  const supabase = createSupabaseServerClient();
  const utente_id = String(formData.get('utente_id') || '');
  const periodo = String(formData.get('periodo') || '');
  const descrizione = String(formData.get('descrizione') || '').trim() || null;

  if (!utente_id || !periodo) {
    throw new Error('Seleziona un collaboratore');
  }

  const { error } = await supabase.from('premi_assegnati').insert({
    utente_id,
    periodo,
    tipo_premio: 'top_mensile',
    descrizione,
  });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/classifica');
}

export default async function ClassificaPage({
  searchParams,
}: {
  searchParams: { mese?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { userId } = await auth();

  const periodo = searchParams.mese || primoDelMese(new Date());

  // Ricalcola la classifica del periodo mostrato prima di leggerla, così è sempre aggiornata
  // rispetto alle fasi completate fino ad ora.
  await supabase.rpc('calcola_classifica_periodo', { p_periodo: periodo });

  const { data: ioRaw } = await supabase
    .from('utenti_owner')
    .select('id, ruolo')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const io: any = ioRaw;
  const sonoAdmin = io?.ruolo === 'admin' || io?.ruolo === 'superadmin';

  const { data: classificaRaw } = await supabase
    .from('punteggi_periodo')
    .select('*, utenti_owner(nome, ruolo)')
    .eq('periodo', periodo)
    .order('posizione', { ascending: true });
  const classifica = classificaRaw || [];

  const { data: premiRaw } = await supabase
    .from('premi_assegnati')
    .select('*, utenti_owner(nome)')
    .eq('periodo', periodo)
    .order('assegnato_il', { ascending: false });
  const premi = premiRaw || [];

  const { data: staffRaw } = await supabase
    .from('utenti_owner')
    .select('id, nome, ruolo')
    .eq('attivo', true)
    .order('nome');
  const staff = (staffRaw || []).filter((u: any) => u.ruolo === 'staff' || u.ruolo === 'admin');

  const medaglie = ['🥇', '🥈', '🥉'];
  const meseCorrente = primoDelMese(new Date());

  return (
    <div>
      <div className="section-header">
        <h2>Classifica collaboratori</h2>
        <div className="header-actions">
          <a className="button-sm print-link" href={`/classifica?mese=${meseAdiacente(periodo, -1)}`}>
            ← Mese prec.
          </a>
          <span style={{ color: '#9ca3af', fontSize: 14, textTransform: 'capitalize' }}>
            {formattaMese(periodo)}
          </span>
          {periodo < meseCorrente && (
            <a className="button-sm print-link" href={`/classifica?mese=${meseAdiacente(periodo, 1)}`}>
              Mese succ. →
            </a>
          )}
        </div>
      </div>

      <p className="timeline-sub" style={{ marginBottom: 20, maxWidth: 640 }}>
        Il punteggio è la media dell&apos;indice di velocità (SLA atteso ÷ giorni lavorativi
        impiegati) sulle fasi completate nel mese: sopra 1× vuol dire più veloci del previsto.
        Contano solo le fasi chiuse dalla persona a cui erano davvero assegnate — non quelle
        completate da un admin per conto di altri.
      </p>

      {classifica.length === 0 ? (
        <p className="timeline-sub" style={{ marginBottom: 32 }}>
          Nessuna fase valida per il punteggio in questo mese.
        </p>
      ) : (
        <div className="client-list" style={{ marginBottom: 32 }}>
          {classifica.map((r: any, i: number) => (
            <div className="client-row" key={r.id}>
              <div className="client-row-head">
                <div className="client-name-wrap">
                  <span style={{ fontSize: 20 }}>{medaglie[i] || `${r.posizione}°`}</span>
                  <span className="client-name">{r.utenti_owner?.nome}</span>
                </div>
                <span className="badge badge-ok">
                  {Number(r.media_indice_velocita).toFixed(2)}× velocità media
                </span>
              </div>
              <p className="client-row-sub">{r.numero_task} fasi completate nel periodo</p>
            </div>
          ))}
        </div>
      )}

      {premi.length > 0 && (
        <>
          <h3>Premi assegnati questo mese</h3>
          <div className="client-list" style={{ marginBottom: 32 }}>
            {premi.map((p: any) => (
              <div className="client-row" key={p.id}>
                <p className="client-row-sub">
                  🏆 <span style={{ color: '#f9fafb', fontWeight: 600 }}>{p.utenti_owner?.nome}</span>
                  {' — '}
                  {p.descrizione || 'Top performer del mese'}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {sonoAdmin && (
        <div className="form-card">
          <h2>Assegna un premio</h2>
          <form action={assegnaPremio}>
            <input type="hidden" name="periodo" value={periodo} />
            <label>
              Collaboratore
              <select name="utente_id" required defaultValue="">
                <option value="" disabled>
                  Seleziona…
                </option>
                {staff.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descrizione (facoltativa)
              <input name="descrizione" placeholder="es. Top performer di settembre" />
            </label>
            <button type="submit" className="button">
              🏆 Assegna premio
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
