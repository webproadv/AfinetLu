import { createClient } from '@supabase/supabase-js';

// Notifiche email agli owner delle fasi (invio tramite Resend).
//  - "sblocco": una fase diventa attiva (da iniziare) e l'owner è diverso da chi ha completato la fase precedente
//  - "ritardo": la fase è fuori SLA (scadenza teorica superata)
// Ogni owner riceve UNA email per tipo e per esecuzione, con l'elenco delle sue fasi.
// L'esito di ogni invio è registrato in notifiche_log (evita duplicati).

const SUPABASE_URL = 'https://qnjudthpwswzvklokioi.supabase.co';

export type TipoNotifica = 'sblocco' | 'ritardo';

type Riga = {
  fase_istanza_id: string;
  destinatario_id: string;
  email: string;
  nome: string;
  cliente_id: string;
  cliente: string;
  fase_numero: number;
  fase_nome: string;
  scadenza: string | null;
  sbloccata_da: string | null;
};

export type EsitoNotifiche = {
  configurato: boolean;
  inviate: number;
  fallite: number;
  dettaglio: string[];
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseUrl() {
  const u = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  if (!u) return '';
  return u.startsWith('http') ? u.replace(/\/$/, '') : `https://${u}`;
}

function formatData(d: string | null) {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
}

function costruisciEmail(tipo: TipoNotifica, nome: string, righe: Riga[]) {
  const url = baseUrl();
  const n = righe.length;
  const oggetto =
    tipo === 'sblocco'
      ? n === 1
        ? `Afinet – nuova fase da iniziare: ${righe[0].cliente}`
        : `Afinet – ${n} nuove fasi da iniziare`
      : n === 1
        ? `Afinet – fase fuori SLA: ${righe[0].cliente}`
        : `Afinet – ${n} fasi fuori SLA`;

  const intro =
    tipo === 'sblocco'
      ? n === 1
        ? 'È stata sbloccata una fase di cui sei owner:'
        : 'Sono state sbloccate queste fasi di cui sei owner:'
      : n === 1
        ? 'Questa fase di cui sei owner è fuori SLA (scadenza teorica superata):'
        : 'Queste fasi di cui sei owner sono fuori SLA (scadenza teorica superata):';

  const items = righe
    .map((r) => {
      const link = url ? `${url}/clienti/${r.cliente_id}` : '';
      const cliente = link
        ? `<a href="${esc(link)}" style="color:#1548e0;text-decoration:none"><b>${esc(r.cliente)}</b></a>`
        : `<b>${esc(r.cliente)}</b>`;
      const extra =
        tipo === 'sblocco'
          ? r.sbloccata_da
            ? ` · sbloccata da ${esc(r.sbloccata_da)}`
            : ''
          : '';
      return `<li style="margin:0 0 8px">${cliente}<br>Fase ${r.fase_numero} – ${esc(r.fase_nome)}<br><span style="color:#6b7280;font-size:13px">Scadenza teorica: ${formatData(r.scadenza)}${extra}</span></li>`;
    })
    .join('');

  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;color:#111827;max-width:560px">
<p>Ciao ${esc(nome)},</p><p>${intro}</p><ul style="padding-left:18px">${items}</ul>${
    url ? `<p><a href="${esc(url)}/dashboard" style="color:#1548e0">Apri Afinet</a></p>` : ''
  }<p style="color:#9ca3af;font-size:12px">Notifica automatica di Afinet.</p></div>`;

  const testo =
    `Ciao ${nome},\n\n${intro}\n\n` +
    righe
      .map((r) => `- ${r.cliente} – Fase ${r.fase_numero} ${r.fase_nome} (scadenza ${formatData(r.scadenza)})`)
      .join('\n') +
    (url ? `\n\n${url}/dashboard` : '');

  return { oggetto, html, testo };
}

export async function inviaNotifiche(tipi: TipoNotifica[] = ['sblocco', 'ritardo']): Promise<EsitoNotifiche> {
  const esito: EsitoNotifiche = { configurato: true, inviate: 0, fallite: 0, dettaglio: [] };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICHE_EMAIL_FROM;
  if (!serviceKey || !resendKey || !from) {
    esito.configurato = false;
    esito.dettaglio.push('Configurazione incompleta: servono SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFICHE_EMAIL_FROM');
    return esito;
  }

  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  for (const tipo of tipi) {
    const { data, error } = await supabase.rpc('notifiche_da_inviare', { p_tipo: tipo });
    if (error) {
      esito.dettaglio.push(`${tipo}: ${error.message}`);
      continue;
    }
    const righe = (data || []) as Riga[];

    const perDestinatario = new Map<string, Riga[]>();
    for (const r of righe) {
      const lista = perDestinatario.get(r.destinatario_id) || [];
      lista.push(r);
      perDestinatario.set(r.destinatario_id, lista);
    }

    for (const [destinatarioId, lista] of Array.from(perDestinatario.entries())) {
      const { oggetto, html, testo } = costruisciEmail(tipo, lista[0].nome, lista);
      let ok = false;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [lista[0].email], subject: oggetto, html, text: testo }),
        });
        ok = res.ok;
        if (!ok) esito.dettaglio.push(`${tipo} → ${lista[0].email}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      } catch (e: any) {
        esito.dettaglio.push(`${tipo} → ${lista[0].email}: ${e?.message || 'errore di rete'}`);
      }

      if (ok) esito.inviate += 1;
      else esito.fallite += 1;

      await supabase.from('notifiche_log').insert(
        lista.map((r) => ({
          fase_istanza_id: r.fase_istanza_id,
          tipo,
          destinatario_id: destinatarioId,
          canale: 'email',
          esito: ok ? 'inviata' : 'fallita',
        }))
      );
    }
  }

  return esito;
}
