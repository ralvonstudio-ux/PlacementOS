import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Star } from 'lucide-react';
import { useTrainerFeedbackOverview } from '../hooks/useTrainerFeedback';

const BAR_COLOR = '#7C3AED';
const BAR_COLOR_LOW = '#F59E0B';

export function TrainerFeedbackOverviewCard() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useTrainerFeedbackOverview();

  const top = [...data].sort((a, b) => b.overallRating - a.overallRating).slice(0, 6);
  const chartData = [...top].reverse().map((t) => ({ name: t.facultyName.split(' ')[0], rating: t.overallRating }));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-semibold text-[#111827] tracking-tight">Trainer Feedback</h3>
        <button onClick={() => navigate('/tpo/trainer-feedback')} className="text-xs font-semibold text-violet-600 hover:text-violet-700">
          View all →
        </button>
      </div>
      <p className="text-[12px] text-[#6B7280] font-medium mb-3">Overall ratings from student feedback</p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-50 rounded-xl animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
          <Star className="w-8 h-8 text-gray-300 mb-2" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">No feedback submitted yet</p>
        </div>
      ) : (
        <div className="flex-1" style={{ minHeight: 200 }}>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 34)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 16 }}>
              <XAxis type="number" domain={[0, 5]} hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [Number(v).toFixed(2), 'Overall rating']} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="rating" radius={[0, 6, 6, 0]} barSize={16}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.rating < 3.5 ? BAR_COLOR_LOW : BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
