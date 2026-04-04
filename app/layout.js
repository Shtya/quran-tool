import "./globals.css";

export const metadata = {
  title: "مصحف المراجعة - أداة حفظ القرآن الكريم",
  description: "أداة ذكية لمراجعة وتحسين حفظ القرآن الكريم",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background font-arabic">
        {children}
      </body>
    </html>
  );
}
