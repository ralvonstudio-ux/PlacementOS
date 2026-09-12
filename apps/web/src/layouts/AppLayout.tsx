import { Suspense, useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Topbar } from '@/components/topbar/Topbar';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

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

      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col min-h-screen overflow-hidden lg:ml-[260px] print:ml-0">
        <div className="print:hidden">
          <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        </div>

        <main ref={mainRef} className="flex-1 overflow-y-auto flex flex-col">
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
      </div>
    </div>
  );
}
