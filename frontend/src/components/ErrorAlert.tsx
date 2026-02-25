import { AlertCircle, X } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export default function ErrorAlert({ message, onDismiss }: Props) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 mb-6">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-red-400 hover:text-red-200 transition-colors flex-shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
