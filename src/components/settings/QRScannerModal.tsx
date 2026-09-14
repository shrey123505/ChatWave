import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QRScannerModal({ onClose, onScan }: { onClose: () => void, onScan: (uid: string) => void }) {
  const [error, setError] = useState('');
  
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Expected format: https://domain.com?user=UID
        try {
          const url = new URL(decodedText);
          const uid = url.searchParams.get('user');
          if (uid) {
            html5QrCode.stop();
            onScan(uid);
            onClose();
          } else {
            toast.error("Invalid ChatWave QR code");
          }
        } catch(e) {
          toast.error("Invalid QR code format");
        }
      },
      (_) => {
        // Scanning errors are frequent, ignore them until success
      }
    ).catch(_ => {
      setError("Camera permission denied or camera not found.");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onClose, onScan]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50">
          <h2 className="text-xl font-bold">Scan QR Code</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center">
           {error ? (
             <div className="text-red-400 text-center p-4">{error}</div>
           ) : (
             <div id="reader" className="w-full max-w-sm rounded-xl overflow-hidden border-2 border-primary"></div>
           )}
           <p className="mt-4 text-text-secondary text-sm text-center">
             Point your camera at a friend's ChatWave QR code to instantly start chatting.
           </p>
        </div>
      </div>
    </div>
  );
}
