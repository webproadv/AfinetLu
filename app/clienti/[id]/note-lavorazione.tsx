'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { creaNotaLavorazione, aggiornaNotaLavorazione, eliminaNotaLavorazione } from './note-actions';

type Nota = {
  id: string;
  data_nota: string;
  contenuto: string;
  autore?: string | null;
};

function formattaData(data: string) {
  try {
    return new Date(`${data}T00:00:00`).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return data;
  }
}

export default function NoteLavorazione({
  clienteId,
  note,
}: {
  clienteId: string;
  note: Nota[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [bozza, setBozza] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bozzaModifica, setBozzaModifica] = useState('');

  function apriCreazione() {
    setBozza('');
    setShowCreate(true);
  }

  function chiudiCreazione() {
    setShowCreate(false);
    setBozza('');
  }

  function confermaCreazione() {
    if (!bozza.trim()) return;
    startTransition(async () => {
      await creaNotaLavorazione(clienteId, bozza);
      setShowCreate(false);
      setBozza('');
      router.refresh();
    });
  }

  function iniziaModifica(nota: Nota) {
    setEditingId(nota.id);
    setBozzaModifica(nota.contenuto);
  }

  function annullaModifica() {
    setEditingId(null);
    setBozzaModifica('');
  }

  function salvaModifica(notaId: string) {
    if (!bozzaModifica.trim()) return;
    startTransition(async () => {
      await aggiornaNotaLavorazione(notaId, clienteId, bozzaModifica);
      setEditingId(null);
      setBozzaModifica('');
      router.refresh();
    });
  }

  function elimina(notaId: string) {
    if (!confirm("Eliminare questa nota di lavorazione? L'operazione non è reversibile.")) return;
    startTransition(async () => {
      await eliminaNotaLavorazione(notaId, clienteId);
      router.refresh();
    });
  }

  return (
    <aside className="note-lavorazione">
      <div className="note-lavorazione-head">
        <h3>Note di lavorazione</h3>
      </div>

      <button
        type="button"
        className="button-sm note-crea-btn"
        onClick={apriCreazione}
        disabled={isPending || showCreate}
      >
        + Crea nota di lavoro
      </button>

      {showCreate && (
        <div className="nota-card nota-form">
          <textarea
            value={bozza}
            onChange={(e) => setBozza(e.target.value)}
            placeholder="Descrivi il lavoro svolto..."
            rows={4}
            autoFocus
          />
          <div className="nota-azioni">
            <button type="button" className="button-sm print-link" onClick={chiudiCreazione} disabled={isPending}>
              Annulla
            </button>
            <button
              type="button"
              className="button-sm"
              onClick={confermaCreazione}
              disabled={isPending || !bozza.trim()}
            >
              Conferma
            </button>
          </div>
        </div>
      )}

      <div className="note-list">
        {note.length === 0 && !showCreate && (
          <p className="timeline-sub">Nessuna nota di lavorazione. Crea la prima nota per registrare l&apos;attività svolta.</p>
        )}

        {note.map((nota) =>
          editingId === nota.id ? (
            <div className="nota-card" key={nota.id}>
              <p className="nota-data">{formattaData(nota.data_nota)}</p>
              <textarea
                value={bozzaModifica}
                onChange={(e) => setBozzaModifica(e.target.value)}
                rows={4}
                autoFocus
              />
              <div className="nota-azioni">
                <button type="button" className="button-sm print-link" onClick={annullaModifica} disabled={isPending}>
                  Annulla
                </button>
                <button
                  type="button"
                  className="button-sm"
                  onClick={() => salvaModifica(nota.id)}
                  disabled={isPending || !bozzaModifica.trim()}
                >
                  Salva
                </button>
              </div>
            </div>
          ) : (
            <div className="nota-card" key={nota.id}>
              <p className="nota-data">
                {formattaData(nota.data_nota)}
                {nota.autore ? <span style={{ textTransform: 'capitalize' }}> · {nota.autore}</span> : null}
              </p>
              <p className="nota-testo">{nota.contenuto}</p>
              <div className="nota-azioni">
                <button
                  type="button"
                  className="button-sm print-link"
                  onClick={() => iniziaModifica(nota)}
                  disabled={isPending}
                >
                  Modifica
                </button>
                <button
                  type="button"
                  className="button-sm button-danger"
                  onClick={() => elimina(nota.id)}
                  disabled={isPending}
                >
                  Elimina
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
