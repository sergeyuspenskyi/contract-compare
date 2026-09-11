import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Contract Compare', description: 'Compare contractual meaning, clause by clause.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
