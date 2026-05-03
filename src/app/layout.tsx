import type { ReactNode } from "react";

import "@/styles/globals.css";
import "aos/dist/aos.css";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans", preload: false });


type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="und" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
        try {
          const t = localStorage.getItem('sf_theme_cache');
          if (t) {
            const p = JSON.parse(t).resolved_palette;
            if (p && typeof p === 'object') {
              const r = document.documentElement;
              Object.entries(p).forEach(([k, v]) => {
                r.style.setProperty('--' + k, v);
              });
              var pageBg = p['background'];
              if (pageBg && typeof pageBg === 'string') {
                r.style.backgroundColor = pageBg;
              }
              var headerBg = p['header'] || p['background'];
              if (headerBg) {
                var rgb = parseInt(headerBg.slice(1),16);
                var r2=rgb>>16, g=rgb>>8&255, b=rgb&255;
                var lum=(0.299*r2+0.587*g+0.114*b)/255;
                document.documentElement.setAttribute(
                  'data-theme-mode',
                  lum<0.5?'dark':'light'
                );
              }
            }
          }
        } catch(e) {}
      `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=Noto+Sans+Bengali:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
