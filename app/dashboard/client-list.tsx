'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isFuoriSla } from '../../lib/sla';

const STATO_LABEL: Record<string, string> = {
  bloccata: 'Bloccata',
  da_iniziare: 'Da iniziare',
  in_corso: 'In corso',
  in_ritardo: 'In ritardo',
  completata: 'Completata',
};

function segClass(stato: string, fuoriSla: boolean) {
  if (fuoriSla) return 'seg seg-red';
  if (stato === 'completata') return 'seg seg-green';
  if (stato === 'in_ritardo') return 'seg seg-red';
  if (stato === 'in_corso' || stato === 'da_iniziare') return 'seg seg-amber';
  return 'seg seg-gray';
}

type Colore = 'verde' | 'giallo' | 'rosso';

function coloreRiga(haRitardo: boolean, inCorso: boolean): Colore {
  if (haRitardo) return 'rosso';
  if (inCorso) return 'giallo';
  return 'verde';
}

export default function ClientList({ righe }: { righe: any[] }) {
  const [ricerca, setRicerca] = useState('');
  const [coloreFiltro, setColoreFiltro] = useState<Colore | null>(null);

  const righeFiltrate = useMemo(() => {
    let r = righe;

    if (coloreFiltro) {
      r = r.filter((riga) => coloreRiga(riga.haRitardo, riga.inCorso) === coloreFiltro);
    }

    const q = ricerca.trim().toLowerCase();
    if (q.length >= 3) {
      r = r.filter((riga) => (riga.cliente?.ragione_sociale || '').toLowerCase().includes(q));
    }

    return r;
  }, [righe, ricerca, coloreFiltro]);

  const toggleColore = (c: Colore) => {
    setColoreFiltro((prev) => (prev === c ? null : c));
  };

  return (
    <>
      <div className="list-toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Cerca cliente (min. 3 caratteri)..."
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <div className="color-filter">
          <button
            type="button"
            className={`color-dot color-dot-verde ${coloreFiltro === 'verde' ? 'active' : ''}`}
            onClick={() => toggleColore('verde')}
            title="Solo clienti a norma"
            aria-pressed={coloreFiltro === 'verde'}
            aria-label="Filtra: a norma"
          />
          <button
            type="button"
            className={`color-dot color-dot-giallo ${coloreFiltro === 'giallo' ? 'active' : ''}`}
            onClick={() => toggleColore('giallo')}
            title="Solo clienti in corso"
            aria-pressed={coloreFiltro === 'giallo'}
            aria-label="Filtra: in corso"
          />
          <button
            type="button"
            className={`color-dot color-dot-rosso ${coloreFiltro === 'rosso' ? 'active' : ''}`}
            onClick={() => toggleColore('rosso')}
            title="Solo clienti in ritardo"
            aria-pressed={coloreFiltro === 'rosso'}
            aria-label="Filtra: in ritardo"
          />
        </div>
      </div>

      <div className="client-list">
        {righeFiltrate.length === 0 && <p>Nessuna pratica trovata.</p>}
        {righeFiltrate.map(({ cliente, fasi, faseCorrente, haRitardo, inCorso, ownerFaseCorrente }) => (
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
    </>
  );
}
