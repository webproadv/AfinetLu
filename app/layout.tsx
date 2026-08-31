import type { Metadata } from 'next';
import { ClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Afinet — Gestione workflow clienti',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="it">
        <body>
          <header className="topbar">
            <Link href="/dashboard" className="brand">Afinet</Link>
            <nav>
              <SignedIn>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/clienti/nuovo">Nuovo cliente</Link>
                <UserButton afterSignOutUrl="/sign-in" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal" />
              </SignedOut>
            </nav>
          </header>
          <main className="container">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
