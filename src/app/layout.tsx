import "./globals.css";

export const metadata = {
  title: "Splitwise Analytics Pro",
  description: "Analyze your Splitwise exports with beautiful insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
