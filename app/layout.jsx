import './globals.css';

export const metadata = {
  title: 'Briefing IA — REEB Synapse',
  description: 'Briefing de onboarding e precificação automática para redes sociais',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
