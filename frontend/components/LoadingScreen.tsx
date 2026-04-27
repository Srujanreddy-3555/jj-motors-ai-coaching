'use client';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message = 'Loading…', className = '' }: LoadingScreenProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 min-h-[50vh] ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-2xl bg-[#FFC107]/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-8 h-8 border-2 border-[#FFC107]/20 border-t-[#FFC107] rounded-full loading-spinner" />
        </div>
      </div>
      <p className="text-gray-500 font-medium text-sm animate-pulse">{message}</p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#FFC107]"
            style={{ animation: 'loading-dots 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function LoadingSpinnerInline({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full loading-spinner ${className}`}
      aria-hidden
    />
  );
}
