import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

/**
 * React Router's `errorElement` — catches anything thrown while rendering/loading a route,
 * including a `lazyWithReload` chunk import that still fails after its one automatic reload.
 * Without this, React Router falls back to its own unstyled "Unexpected Application Error!"
 * page, which is what a stale-deployment chunk 404 looks like by default.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText || `Error ${error.status}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  const isChunkLoadError = /failed to fetch dynamically imported module|dynamically imported module/i.test(message);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          {isChunkLoadError
            ? 'A new version of the app was published while this page was open. Reload to pick it up.'
            : message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
