'use client';
import { useRouter } from 'next/navigation';

export default function OwnerFilter({ owners, selected }: { owners: string[]; selected: string }) {
  const router = useRouter();
  return (
    <select
      className="owner-select"
      defaultValue={selected}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/dashboard?owner=${encodeURIComponent(v)}` : '/dashboard');
      }}
    >
      <option value="">Tutti gli owner</option>
      {owners.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
