// Helper server-side per creare cartelle su Google Drive tramite un service account
// Google Cloud (nessuna libreria esterna: JWT firmato a mano con il modulo "crypto" di Node).
//
// Variabili d'ambiente richieste (da impostare su Vercel, non nel codice):
//   GOOGLE_DRIVE_CLIENT_EMAIL     - email del service account (...@...iam.gserviceaccount.com)
//   GOOGLE_DRIVE_PRIVATE_KEY      - chiave privata del service account (PEM; va bene sia con "\n"
//                                    letterali che con vere andate a capo)
//   GOOGLE_DRIVE_PARENT_FOLDER_ID - id della cartella (o Drive condiviso) dentro cui creare le
//                                    cartelle dei singoli clienti. La cartella deve essere condivisa
//                                    con l'email del service account con permesso Editor.

import crypto from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Ripulisce la chiave privata da errori comuni di copia-incolla su Vercel:
// virgolette attorno al valore, un eventuale prefisso "NOME_VARIABILE=" incollato
// per sbaglio dentro il campo valore, "\n" letterali invece di vere andate a capo,
// interruzioni di riga in stile Windows (CRLF) e spazi superflui a inizio/fine.
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  const beginMarker = key.indexOf('-----BEGIN');
  if (beginMarker > 0) {
    key = key.slice(beginMarker);
  }

  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  key = key.replace(/\r\n/g, '\n').trim();

  if (!key.endsWith('-----END PRIVATE KEY-----') && !key.endsWith('\n')) {
    key += '\n';
  }

  return key;
}

async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw) {
    throw new Error(
      'Google Drive non configurato: mancano le variabili GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY su Vercel.'
    );
  }

  const privateKey = normalizePrivateKey(privateKeyRaw);

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error(
      'Google Drive: GOOGLE_DRIVE_PRIVATE_KEY su Vercel non sembra una chiave PEM valida (mancano i marcatori BEGIN/END). Ricontrolla il valore incollato.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(privateKey));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Autenticazione Google Drive fallita: ${data.error_description || data.error || res.status}`
    );
  }
  return data.access_token as string;
}

async function createFolder(
  name: string,
  parentId: string,
  token: string
): Promise<{ id: string; webViewLink: string }> {
  const res = await fetch(`${DRIVE_FILES_API}?fields=id,webViewLink&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Creazione cartella "${name}" fallita: ${data.error?.message || res.status}`);
  }
  return data;
}

// Crea la cartella del cliente dentro GOOGLE_DRIVE_PARENT_FOLDER_ID, con le 3 sottocartelle
// Copy / Riprese / Editing, e restituisce il link della cartella cliente.
export async function creaStrutturaCartelleCliente(nomeCliente: string): Promise<string> {
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parentId) {
    throw new Error('Google Drive non configurato: manca la variabile GOOGLE_DRIVE_PARENT_FOLDER_ID su Vercel.');
  }

  const token = await getAccessToken();
  const clientFolder = await createFolder(nomeCliente, parentId, token);
  await Promise.all(['Copy', 'Riprese', 'Editing'].map((sub) => createFolder(sub, clientFolder.id, token)));

  return clientFolder.webViewLink;
}
