import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "J.J.'s Motors — AI Sales Coach",
  description: "AI-powered phone-based sales practice for J.J.'s Auto Service Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}
