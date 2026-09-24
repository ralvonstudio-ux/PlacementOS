import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  /** Omit to render a read-only display (e.g. in an aggregated summary). */
  onChange?: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export const StarRating = ({ value, onChange, max = 5, size = 'md', className }: StarRatingProps) => {
  const readOnly = !onChange;
  const starSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className={cn('inline-flex items-center gap-1', className)} role={readOnly ? undefined : 'radiogroup'}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          role={readOnly ? undefined : 'radio'}
          aria-checked={readOnly ? undefined : star === value}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          tabIndex={readOnly ? -1 : 0}
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onKeyDown={(e) => {
            if (!onChange) return;
            if (e.key === 'ArrowRight' && star < max) onChange(Math.min(max, value + 1));
            if (e.key === 'ArrowLeft' && star > 1) onChange(Math.max(1, value - 1));
          }}
          className={cn(
            'transition-transform',
            readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500/40 rounded'
          )}
        >
          <Star
            className={cn(starSize, star <= value ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300')}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
};
