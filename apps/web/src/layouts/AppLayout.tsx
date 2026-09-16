import { Suspense, useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { BottomNav } from '@/components/sidebar/BottomNav';
import { Topbar } from '@/components/topbar/Topbar';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  // Faculty gets a bottom tab bar on mobile instead of the sidebar drawer —
  // the sidebar itself stays hidden below `lg` for that role (still there,
  // unchanged, at desktop widths).
  const isFacultyMobile = user?.role === 'faculty';

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // `main` (not window) is the actual scroll container here, and React Router
  // never resets its scrollTop on navigation — so leaving a page scrolled down
  // and opening a new one left that new page's header off-screen until the
  // user manually scrolled back up.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={cn('flex h-screen overflow-hidden bg-white')}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={cn('print:hidden', isFacultyMobile && 'hidden lg:block')}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col min-h-screen overflow-hidden lg:ml-[260px] print:ml-0">
        <div className="print:hidden">
          <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} hideMenuButton={isFacultyMobile} />
        </div>

        <main ref={mainRef} className={cn('flex-1 overflow-y-auto flex flex-col', isFacultyMobile && 'pb-16 lg:pb-0')}>
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center py-24">
                <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
