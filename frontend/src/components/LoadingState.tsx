import { useEffect, useState } from 'react';
import { Music } from 'lucide-react';

const STEPS = [
  { label: 'Fetching video info…', duration: 2000 },
  { label: 'Downloading audio stream…', duration: 6000 },
  { label: 'Converting to MP3…', duration: 4000 },
  { label: 'Finalizing file…', duration: 2000 },
];

export default function LoadingState() {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const totalDuration = STEPS.reduce((a, s) => a + s.duration, 0);
    const interval = setInterval(() => {
      elapsed += 100;
      setProgress(Math.min((elapsed / totalDuration) * 100, 95));

      let acc = 0;
      for (let i = 0; i < STEPS.length; i++) {
        acc += STEPS[i].duration;
        if (elapsed < acc) {
          setStepIdx(i);
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="relative inline-flex items-center justify-center mb-8">
        <div className="w-24 h-24 rounded-full border-2 border-brand-500/20 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Music className="w-7 h-7 text-brand-400 animate-bounce" />
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">Converting…</h2>
      <p className="text-slate-400 text-sm mb-8">This may take a moment depending on video length</p>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300
              ${i === stepIdx ? 'bg-brand-600/10 border border-brand-500/20' : ''}
            `}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all
                ${i < stepIdx ? 'bg-brand-400' : i === stepIdx ? 'bg-brand-400 animate-pulse' : 'bg-white/15'}
              `}
            />
            <span
              className={`text-sm transition-colors
                ${i < stepIdx ? 'text-brand-400 line-through opacity-60' : i === stepIdx ? 'text-white' : 'text-slate-600'}
              `}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
