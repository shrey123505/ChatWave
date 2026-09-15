import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { X, AlertTriangle, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const REPORT_REASONS = [
  'Spam or advertising',
  'Harassment or bullying',
  'Inappropriate content',
  'Fake account or impersonation',
  'Hate speech',
  'Other'
];

export default function ReportUserModal({
  targetUser,
  onClose
}: {
  targetUser: any;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !targetUser) return;

    setSubmitting(true);
    const toastId = toast.loading("Submitting report...");

    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterName: user.displayName || user.email || 'Anonymous',
        reportedUserId: targetUser.uid,
        reportedUserName: targetUser.name || 'User',
        reportedUsername: targetUser.username || '',
        reason: selectedReason,
        details: details.trim(),
        createdAt: serverTimestamp()
      });

      toast.success("Thank you. The report has been received.", { id: toastId });
      onClose();
    } catch (err: any) {
      console.error("Report submission failed:", err);
      toast.error("Failed to submit report: " + err.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text border border-white/20 bg-surface/90 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="text-lg font-bold flex items-center gap-2 text-amber-400">
            <AlertTriangle size={20} />
            Report @{targetUser?.username || 'User'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-text-secondary">
            Your report is confidential. Help us keep ChatWave safe and respectful.
          </p>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
              Reason for reporting
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((reason) => (
                <label 
                  key={reason}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors text-sm ${
                    selectedReason === reason 
                      ? 'border-primary bg-primary/10 text-text font-medium' 
                      : 'border-white/10 hover:border-white/20 text-text-secondary'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-primary"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Additional details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Provide any additional context or details..."
              className="w-full px-3.5 py-2.5 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder-white/40 text-sm shadow-inner resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg text-sm disabled:opacity-50"
          >
            <Send size={18} />
            Submit Report
          </button>
        </form>
      </div>
    </div>
  );
}
