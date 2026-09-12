import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export const Forbidden = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-base text-gray-500 mb-6">You don&apos;t have permission to view this page.</p>
        <button
          onClick={() => navigate(-1)}
          className="h-12 px-6 rounded-xl bg-violet-600 hover:bg-violet-700
                     text-base font-bold text-white transition-colors duration-150"
          type="button"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};
