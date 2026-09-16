import { useState } from 'react';
import { 
  deleteUser, 
  reauthenticateWithPopup, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from 'firebase/auth';
import { 
  doc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { AlertTriangle, Trash2, Lock, X, ShieldAlert, Fingerprint } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<'warn' | 'verify'>('warn');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isGoogleUser = auth.currentUser?.providerData.some(
    (p) => p.providerId === 'google.com'
  );

  const cleanupUserData = async (uid: string) => {
    try {
      // 1. Delete user profile doc
      await deleteDoc(doc(db, 'users', uid));

      // 2. Delete user's active stories
      const storiesQuery = query(collection(db, 'stories'), where('creatorId', '==', uid));
      const storiesSnap = await getDocs(storiesQuery);
      if (!storiesSnap.empty) {
        const batch = writeBatch(db);
        storiesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (cleanupErr) {
      console.warn("Non-fatal error cleaning up Firestore sub-data:", cleanupErr);
    }
  };

  const handleReauthAndDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!auth.currentUser) return;
    
    setError('');
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      const uid = currentUser.uid;

      if (isGoogleUser) {
        // Re-authenticate with Google
        await reauthenticateWithPopup(currentUser, googleProvider);
      } else {
        // Re-authenticate with password
        if (!password.trim()) {
          setError('Please enter your password to confirm.');
          setLoading(false);
          return;
        }
        const email = currentUser.email || `${user?.displayName || 'user'}@chatwave.app`;
        const credential = EmailAuthProvider.credential(email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Cleanup Firestore records
      await cleanupUserData(uid);

      // Permanently delete Firebase Auth record
      await deleteUser(currentUser);

      // Clear local Zustand state
      setUser(null);
      toast.success('Your account has been permanently deleted.');
      onClose();
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Google verification was canceled.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col border border-red-500/30 shadow-2xl bg-surface/95 text-text">
        {/* Header */}
        <div className="p-4 border-b border-red-500/20 flex justify-between items-center bg-red-500/10">
          <div className="flex items-center gap-2 text-red-400 font-bold text-base">
            <AlertTriangle size={18} />
            <span>Delete Account Permanently</span>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-text-secondary hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-sm">
          {step === 'warn' ? (
            <>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2 text-red-200">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                  <ShieldAlert size={18} />
                  <span>Warning: This cannot be undone</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  Deleting your account will permanently remove:
                </p>
                <ul className="text-xs list-disc list-inside space-y-1 opacity-80">
                  <li>Your user profile, username, and bio</li>
                  <li>Your followers, following, and story posts</li>
                  <li>Your authentication credentials</li>
                </ul>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                To protect your account security, you will be required to verify your identity (
                {isGoogleUser ? 'Google confirmation' : 'Current password'}) in the next step.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Continue to Verify
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleReauthAndDelete} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-2">
                  <Fingerprint size={24} />
                </div>
                <h4 className="font-bold text-base text-text">Verify Identity</h4>
                <p className="text-xs text-text-secondary">
                  {isGoogleUser 
                    ? 'Confirm with your Google account to proceed with permanent deletion.' 
                    : 'Enter your current account password to confirm deletion.'}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl text-xs">
                  {error}
                </div>
              )}

              {isGoogleUser ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleReauthAndDelete()}
                    disabled={loading}
                    className="w-full py-3 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg text-xs"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Re-authenticate with Google & Delete</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      placeholder="Enter your current password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-red-500 text-text placeholder-text-secondary text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <>
                        <Trash2 size={14} /> Permanently Delete My Account
                      </>
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep('warn')}
                disabled={loading}
                className="w-full py-2 text-text-secondary hover:text-white text-xs transition-colors"
              >
                Go back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
