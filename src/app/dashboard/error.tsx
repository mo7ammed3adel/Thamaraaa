"use client";

/**
 * Global error boundary for all dashboard routes.
 * Catches unhandled errors from server components (e.g. failed DB queries)
 * and provides a user-friendly recovery UI instead of a crash.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md w-full shadow-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-600 mb-6">
          An error occurred while loading this page. Please try again or contact support if the problem persists.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition shadow-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
