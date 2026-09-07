import "./globals.css";

export const metadata = {
  title: "Dédoublonnage de mots-clés",
  description: "Analyse de similarité SERP pour dédoublonner des listes de mots-clés",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
