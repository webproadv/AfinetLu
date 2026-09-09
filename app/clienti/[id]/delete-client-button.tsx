'use client';

export default function DeleteClientButton({
  action,
  nomeCliente,
}: {
  action: () => void | Promise<void>;
  nomeCliente: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const conferma = window.confirm(
          `Eliminare definitivamente il cliente "${nomeCliente}"?\n\nVerranno cancellate anche tutte le fasi, i servizi e le cartelle di lavorazione collegate. L'operazione non è reversibile.`
        );
        if (!conferma) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="button-sm button-danger">
        🗑️ Elimina cliente
      </button>
    </form>
  );
}
