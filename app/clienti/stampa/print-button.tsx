'use client';

export default function PrintButton() {
  return (
    <button type="button" className="button no-print" onClick={() => window.print()}>
      🖨️ Stampa
    </button>
  );
}
