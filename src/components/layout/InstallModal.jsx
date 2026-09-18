import { X, Smartphone, Share, MoreVertical, PlusSquare, ArrowDownToLine } from "lucide-react";

export default function InstallModal({ isOpen, onClose, isIOS, onNativeInstall, hasNativePrompt }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card-glass w-full max-w-md p-6 relative border border-indigo-500/20 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Install Shivaayaha Ledger</h3>
            <p className="text-xs text-slate-400">Use it as a native mobile app</p>
          </div>
        </div>

        {/* If native prompt is ready */}
        {hasNativePrompt ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Click the button below to add Shivaayaha Silks to your device's home screen.
            </p>
            <button
              onClick={() => {
                onNativeInstall();
                onClose();
              }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Install Now
            </button>
          </div>
        ) : isIOS ? (
          /* iOS Safari Guide */
          <div className="space-y-4">
            <p className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl font-medium">
              Apple requires installing via Safari's Share menu:
            </p>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">1</span>
                <span>Open this site in <strong className="text-white">Safari</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">2</span>
                <span>Tap the <strong className="text-white">Share button</strong> (square with arrow <Share className="w-3.5 h-3.5 inline mx-1 text-indigo-400" />) at the bottom</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">3</span>
                <span>Scroll down and tap <strong className="text-white">Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-1 text-indigo-400" />)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">4</span>
                <span>Tap <strong className="text-white">Add</strong> in the top-right corner</span>
              </li>
            </ol>
            <button
              onClick={onClose}
              className="btn-secondary w-full text-xs font-semibold py-2.5 mt-2"
            >
              Got It
            </button>
          </div>
        ) : (
          /* Android Chrome Guide */
          <div className="space-y-4">
            <p className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl font-medium">
              Install directly from your Chrome browser:
            </p>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">1</span>
                <span>Tap the <strong className="text-white">Three Dots menu</strong> (<MoreVertical className="w-3.5 h-3.5 inline text-indigo-400" />) in the top-right corner of Chrome</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">2</span>
                <span>Select <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">3</span>
                <span>Tap <strong className="text-white">Install</strong> to confirm</span>
              </li>
            </ol>
            <button
              onClick={onClose}
              className="btn-secondary w-full text-xs font-semibold py-2.5 mt-2"
            >
              Got It
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
