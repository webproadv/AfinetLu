import { createSupabaseServerClient } from '../../lib/supabase-server';
import { isFuoriSla } from '../../lib/sla';
import Link from 'next/link';
import OwnerFilter from './owner-filter';

export const dynamic = 'force-dynamic';

function segClass(stato: string, fuoriSla: boolean) {
  if (fuoriSla) return 'seg seg-red';
  if (stato === 'completata') return 'seg seg-green';
  if (stato === 'in_ritardo') return 'seg seg-red';
  if (stato === 'in_corso' || stato === 'da_iniziare') return 'seg seg-amber';
  return 'seg seg-gray';
}

const STATO_LABEL: Record<string, string> = {
  bloccata: 'Bloccata',
  da_iniziare: 'Da iniziare',
  in_corso: 'In corso',
  in_ritardo: 'In ritardo',
  completata: 'Completata',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { owner?: string };
}) {
  const supabase = createSupabaseServerClient();
  const ownerFiltro = searchParams?.owner || '';

  const { data: clienti, error } = await supabase
    .from('clienti')
    .select(
      'id, ragione_sociale, fasi_istanza(id, stato, data_scadenza_teorica, fasi_template(numero, nome), fasi_istanza_owners(utenti_owner(id, nome)))'
    )
    .order('creato_il', { ascending: false });

  const { data: ownerRows } = await supabase.from('utenti_owner').select('id, nome, ruolo');

  if (error) {
    return <p>Errore nel caricamento dati: {error.message}</p>;
  }

  const tutti = clienti ?? [];
  const owners = (ownerRows ?? []).map((o: any) => o.nome).sort();

  const carico: Record<string, number> = {};
  tutti.forEach((c: any) => {
    c.fasi_istanza.forEach((f: any) => {
      if (f.stato === 'completata') return;
      (f.fasi_istanza_owners || []).forEach((r: any) => {
        const nome = r.utenti_owner?.nome;
        if (nome) carico[nome] = (carico[nome] || 0) + 1;
      });
    });
  });

  const righeComplete = tutti.map((c: any) => {
    const fasi = [...c.fasi_istanza].sort(
      (a: any, b: any) => a.fasi_template.numero - b.fasi_template.numero
    );
    const faseCorrente = fasi.find((f: any) => f.stato !== 'completata') ?? fasi[fasi.length - 1];
    const haRitardo = fasi.some((f: any) => f.stato === 'in_ritardo' || isFuoriSla(f));
    const inCorso = !haRitardo && fasi.some((f: any) => f.stato === 'in_corso' || f.stato === 'da_iniziare');
    const ownerFaseCorrente = (faseCorrente?.fasi_istanza_owners || [])
      .map((r: any) => r.utenti_owner?.nome)
      .filter(Boolean)
      .join(', ');
    return { cliente: c, fasi, faseCorrente, haRitardo, inCorso, ownerFaseCorrente };
  });

  const righe = ownerFiltro
    ? righeComplete.filter(({ fasi }) =>
        fasi.some((f: any) =>
          (f.fasi_istanza_owners || []).some((r: any) => r.utenti_owner?.nome === ownerFiltro)
        )
      )
    : righeComplete;

  const totaliPratiche = righe.length;
  const clientiInRitardo = righe.filter((r) => r.haRitardo).length;
  const completateTot = righe.reduce(
    (acc, r) => acc + r.fasi.filter((f: any) => f.stato === 'completata').length,
    0
  );
  const fasiTot = righe.reduce((acc, r) => acc + r.fasi.length, 0);
  const slaRispettati = fasiTot > 0 ? Math.round(((fasiTot - clientiInRitardo) / fasiTot) * 100) : 100;

  return (
    <div>
      <div className="metrics">
        <div className="metric-card">
          <p className="metric-label">Pratiche attive</p>
          <p className="metric-value">{totaliPratiche}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Con fasi in ritardo</p>
          <p className="metric-value danger">{clientiInRitardo}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Fasi completate</p>
          <p className="metric-value">{completateTot}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">SLA rispettati</p>
          <p className="metric-value success">{slaRispettati}%</p>
        </div>
      </div>

      <div className="section-header">
        <h2>Pratiche clienti</h2>
        <div className="header-actions">
          <OwnerFilter owners={owners} selected={ownerFiltro} />
          <Link href="/clienti/nuovo" className="button">+ Nuova pratica</Link>
        </div>
      </div>

      <div className="client-list">
        {righe.length === 0 && <p>Nessuna pratica trovata.</p>}
        {righe.map(({ cliente, fasi, faseCorrente, haRitardo, inCorso, ownerFaseCorrente }) => (
          <Link href={`/clienti/${cliente.id}`} key={cliente.id} className="client-row">
            <div className="client-row-head">
              <div className="client-name-wrap">
                <span className="client-name">{cliente.ragione_sociale}</span>
                <span className={`badge ${haRitardo ? 'badge-danger' : inCorso ? 'badge-warn' : 'badge-ok'}`}>
                  {haRitardo ? 'In ritardo' : inCorso ? 'In corso' : 'A norma'}
                </span>
              </div>
              <span className="client-row-sub">
                Fase {faseCorrente?.fasi_template?.numero ?? '-'} · {faseCorrente?.fasi_template?.nome ?? '-'} · owner{' '}
                {ownerFaseCorrente || '—'}
              </span>
            </div>
            <div className="seg-bar">
              {fasi.map((f: any) => (
                <div
                  key={f.id}
                  className={segClass(f.stato, isFuoriSla(f))}
                  title={`${f.fasi_template.nome}: ${isFuoriSla(f) ? 'Fuori SLA' : STATO_LABEL[f.stato]}`}
                />
              ))}
            </div>
          </Link>
        ))}
      </div>

      <h3>Carico per owner</h3>
      <div className="owner-load">
        {owners.length === 0 && <p>Nessun owner registrato.</p>}
        {owners.map((o) => (
          <div className="owner-load-item" key={o}>
            <p className="owner-load-name">{o}</p>
            <p className="owner-load-count">
              {carico[o] || 0} <span>task attivi</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
