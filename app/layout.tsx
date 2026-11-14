import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import QueryProvider from "./components/QueryProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('transporte-df-theme') || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
  } catch(e) {}
})();
`;

const swScript = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      if (${process.env.NODE_ENV !== 'production'}) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          registrations.forEach(function(registration) {
            if (registration.active && registration.active.scriptURL === location.origin + '/sw.js') registration.unregister();
          });
        });
        return;
      }
      navigator.serviceWorker.register('/sw.js').then(
        function(registration) {
          console.log('ServiceWorker registration successful');
        },
        function(err) {
          console.log('ServiceWorker registration failed: ', err);
        }
      );
    });
  }
`;

export const metadata: Metadata = {
  title: {
    default: "Transporte DF - Encontre linhas e estações",
    template: "%s | Transporte DF",
  },
  description:
    "Aplicativo de transporte público do Distrito Federal. Encontre linhas de ônibus, estações de metrô e planeje suas rotas com facilidade.",
  applicationName: "Transporte DF",
  keywords: [
    "transporte",
    "ônibus",
    "metrô",
    "Brasília",
    "DF",
    "rotas",
    "linhas",
  ],
  authors: [{ name: "Transporte DF" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Transporte DF",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9E4D8" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body className={`${barlow.className} antialiased overscroll-none`}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
