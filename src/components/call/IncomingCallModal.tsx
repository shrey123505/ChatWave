import { useEffect } from 'react';
import { Phone, PhoneOff, Video, User as UserIcon } from 'lucide-react';
import { startRingtone, stopRingtone } from '../../utils/notification';

export default function IncomingCallModal({
  call,
  onAccept,
  onDecline
}: {
  call: {
    id: string;
    callerId: string;
    callerName: string;
    callerPhotoURL?: string;
    type: 'video' | 'audio';
  };
  onAccept: () => void;
  onDecline: () => void;
}) {
  useEffect(() => {
    startRingtone();
    return () => {
      stopRingtone();
    };
  }, []);

  const handleAccept = () => {
    stopRingtone();
    onAccept();
  };

  const handleDecline = () => {
    stopRingtone();
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center text-white border border-white/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Caller Avatar with Pulsing Rings */}
        <div className="relative my-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-primary overflow-hidden shadow-2xl bg-surface flex items-center justify-center">
            {call.callerPhotoURL ? (
              <img src={call.callerPhotoURL} alt={call.callerName} className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={48} className="text-primary" />
            )}
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-35 pointer-events-none"></div>
        </div>

        {/* Caller Details */}
        <h3 className="text-xl sm:text-2xl font-bold mt-2">{call.callerName}</h3>
        <p className="text-xs sm:text-sm text-text-secondary mt-1 flex items-center gap-1.5 font-medium">
          {call.type === 'video' ? <Video size={16} className="text-primary" /> : <Phone size={16} className="text-primary" />}
          Incoming {call.type === 'video' ? 'Video' : 'Audio'} Call...
        </p>

        {/* Action Buttons: Decline and Accept */}
        <div className="flex items-center justify-center gap-10 mt-8 w-full">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleDecline}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-xl active:scale-95"
              title="Decline"
            >
              <PhoneOff size={24} />
            </button>
            <span className="text-xs text-red-400 font-medium">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all shadow-xl active:scale-95 animate-bounce"
              title="Accept"
            >
              {call.type === 'video' ? <Video size={24} /> : <Phone size={24} />}
            </button>
            <span className="text-xs text-emerald-400 font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
