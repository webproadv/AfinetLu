import { createSupabaseServerClient } from '../../../lib/supabase-server';
import Link from 'next/link';
import PrintButton from './print-button';

export const dynamic = 'force-dynamic';

const STATO_GENERALE_LABEL: Record<string, string> = {
  in_corso: 'In corso',
  in_ritardo: 'In ritardo',
  completato: 'Concluso',
  sospeso: 'Sospeso',
};

export default async function StampaClientiPage() {
  const supabase = createSupabaseServerClient();

  const { data: clienti, error } = await supabase
    .from('clienti')
    .select('id, ragione_sociale, stato_generale, durata_servizio_mesi, cicli_fatturati, servizi_acquistati(servizio)')
    .order('ragione_sociale', { ascending: true });

  if (error) {
    return <p>Errore nel caricamento dati: {error.message}</p>;
  }

  const righe = (clienti ?? []).map((c: any) => {
    const durata = c.durata_servizio_mesi ?? 1;
    const fatturati = c.cicli_fatturati ?? 0;
    const daFatturare = Math.max(durata - fatturati, 0);
    const servizioLabel = c.servizi_acquistati?.length > 0
      ? c.servizi_acquistati.map((s: any) => s.servizio).join(', ')
      : '\u2014';
    return {
      id: c.id,
      nome: c.ragione_sociale,
      servizio: servizioLabel,
      durata,
      fatturati,
      daFatturare,
      stato: STATO_GENERALE_LABEL[c.stato_generale] || c.stato_generale || '\u2014',
    };
  });

  const totaleFatturati = righe.reduce((acc, r) => acc + r.fatturati, 0);
  const totaleDaFatturare = righe.reduce((acc, r) => acc + r.daFatturare, 0);

  return (
    <div className="stampa-clienti">
      <div className="section-header no-print">
        <h2>Stampa lista clienti</h2>
        <div className="header-actions">
          <Link href="/dashboard" className="button-sm">\u2190 Torna alla dashboard</Link>
          <PrintButton />
        </div>
      </div>

      <div className="stampa-intestazione">
        <h1>Afinet \u2014 Servizi clienti</h1>
        <p>Generato il {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <table className="stampa-tabella">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Servizio</th>
            <th>Durata (mesi)</th>
            <th>Cicli fatturati</th>
            <th>Cicli da fatturare</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.id}>
              <td>{r.nome}</td>
              <td>{r.servizio}</td>
              <td>{r.durata}</td>
              <td>{r.fatturati}</td>
              <td>{r.daFatturare}</td>
              <td>{r.stato}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Totale</td>
            <td>{totaleFatturati}</td>
            <td>{totaleDaFatturare}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
