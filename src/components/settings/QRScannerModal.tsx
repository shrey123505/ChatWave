import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function QRScannerModal({ 
  onClose, 
  onScan 
}: { 
  onClose: () => void; 
  onScan: (uid: string) => void;
}) {
  const [error, setError] = useState('');
  const [manualUid, setManualUid] = useState('');
  
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    let isMounted = true;

    const extractUid = (text: string) => {
      try {
        if (text.includes('user=')) {
          const match = text.match(/[?&]user=([^&#]+)/);
          if (match && match[1]) return match[1];
        }
        return text.trim();
      } catch {
        return text.trim();
      }
    };
    
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        const uid = extractUid(decodedText);
        if (uid && isMounted) {
          html5QrCode.stop().catch(() => {}).finally(() => {
            onScan(uid);
            onClose();
          });
        }
      },
      (_) => {}
    ).catch(err => {
      console.warn("Camera start warning:", err);
      if (isMounted) {
        setError("Camera permission denied or camera unavailable.");
      }
    });

    return () => {
      isMounted = false;
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [onClose, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUid.trim()) return;
    onScan(manualUid.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text border border-white/20 bg-surface/90">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera size={20} className="text-primary" />
            Scan QR Code
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center">
          {error ? (
            <div className="text-center p-4 space-y-2">
              <p className="text-red-400 text-sm font-medium">{error}</p>
              <p className="text-xs text-text-secondary">You can manually enter the User ID below:</p>
            </div>
          ) : (
            <div id="reader" className="w-full max-w-xs rounded-xl overflow-hidden border-2 border-primary/60 shadow-xl"></div>
          )}
          
          <p className="mt-4 text-text-secondary text-xs text-center max-w-xs">
            Point camera at a ChatWave QR code from the Settings modal.
          </p>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="mt-6 w-full flex gap-2">
            <input 
              type="text" 
              placeholder="Or paste User ID here..."
              value={manualUid}
              onChange={(e) => setManualUid(e.target.value)}
              className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-primary"
            />
            <button 
              type="submit"
              disabled={!manualUid.trim()}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-40"
            >
              Open
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
