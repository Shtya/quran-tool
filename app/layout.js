import "./globals.css";
import PWARegister from "../components/PWARegister";

export const metadata = {
  title: "مصحف المراجعة - أداة حفظ القرآن الكريم",
  description: "أداة ذكية لمراجعة وتحسين حفظ القرآن الكريم",
  applicationName: "مصحف المراجعة",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "مصحف المراجعة",
  },
};

export const viewport = {
  themeColor: "#1F7A63",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-background font-arabic">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}