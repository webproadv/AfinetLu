export function isFuoriSla(fase: { stato: string; data_scadenza_teorica?: string | null }): boolean {
  if (!fase.data_scadenza_teorica) return false;
  if (fase.stato === 'completata') return false;
  const oggiStr = new Date().toISOString().slice(0, 10);
  return fase.data_scadenza_teorica < oggiStr;
}
