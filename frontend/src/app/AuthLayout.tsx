import type { ReactNode } from 'react';

// Full-page auth layout: a thumbnail panel on large screens, the form on the
// right. The panel is pure type — no image assets to ship or license.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-1/2 flex-col justify-between bg-muted p-10 lg:flex">
        <p className="text-lg font-semibold">
          Ilham{' '}
          <span dir="rtl" lang="ar" className="font-arabic">
            إلهام
          </span>
        </p>
        <div className="flex flex-col gap-4">
          <p dir="rtl" lang="ar" className="font-arabic text-4xl leading-loose">
            إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ
          </p>
          <p className="text-lg text-muted-foreground">
            Actions are judged by intentions — the opening hadith of Sahih al-Bukhari.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          A hadith study platform. A teacher leads the study.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
