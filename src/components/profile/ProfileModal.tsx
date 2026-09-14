import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { X, Camera, Lock, Globe, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

export default function ProfileModal({ 
  onClose, 
  initialProfile,
  targetUid, 
  onStartChat 
}: { 
  onClose: () => void; 
  initialProfile?: any;
  targetUid?: string;
  onStartChat?: (user: any) => void;
}) {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedUid = targetUid || initialProfile?.uid || user?.uid;
  const isSelf = !targetUid || (user && resolvedUid === user.uid);

  useEffect(() => {
    if (initialProfile && initialProfile.name) {
      setProfile(initialProfile);
      setLoading(false);
    }

    if (!resolvedUid) {
      setLoading(false);
      setError("No user ID provided.");
      return;
    }

    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const d = await getDoc(doc(db, 'users', resolvedUid));
        if (d.exists() && isMounted) {
          setProfile({ uid: d.id, ...d.data() });
          setError(null);
        } else if (isMounted && !initialProfile) {
          setError("User profile not found in database.");
        }
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        if (isMounted && !initialProfile) {
          setError("Could not load profile: " + (err?.message || "Permission issue"));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [resolvedUid, initialProfile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSelf) return;
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setProfile((prev: any) => ({ ...prev, photoURL: url }));
      toast.success('Profile photo updated!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed. Check storage permissions: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const togglePrivacy = async () => {
    if (!isSelf || !user || !profile) return;
    const newPrivacy = !profile.isPrivate;
    setProfile((prev: any) => ({ ...prev, isPrivate: newPrivacy }));
    try {
      await updateDoc(doc(db, 'users', user.uid), { isPrivate: newPrivacy });
      toast.success(`Profile is now ${newPrivacy ? 'Private' : 'Public'}`);
    } catch (err) {
      setProfile((prev: any) => ({ ...prev, isPrivate: !newPrivacy }));
      toast.error('Failed to update privacy setting.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text shadow-2xl border border-white/20 bg-surface/90">
        
        {/* Close Button Always Visible */}
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-white/20 transition-colors bg-black/40 text-white"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            <p className="text-text-secondary text-sm">Loading profile details...</p>
          </div>
        ) : error ? (
          <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle size={48} className="text-red-400" />
            <p className="text-red-300 font-medium">{error}</p>
            <button 
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center">
            {/* Avatar */}
            <div 
              className={`relative group mb-4 ${isSelf ? 'cursor-pointer' : ''}`} 
              onClick={() => isSelf && fileInputRef.current?.click()}
            >
              <div className="w-32 h-32 rounded-full border-4 border-primary/50 shadow-lg overflow-hidden bg-surface flex items-center justify-center">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl text-primary font-bold">
                    {(profile?.name || profile?.username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {isSelf && (
                <>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={28} className="text-white" />
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                    disabled={uploading} 
                  />
                </>
              )}
            </div>

            <h2 className="text-3xl font-bold mt-2">{profile?.name || 'Unnamed User'}</h2>
            <p className="text-text-secondary text-lg mt-1">@{profile?.username || 'user'}</p>
            {profile?.age && (
              <p className="text-xs text-text-secondary mt-1 bg-white/5 px-3 py-1 rounded-full">
                Age: {profile.age}
              </p>
            )}
            
            {/* Instagram Style Stats */}
            <div className="flex gap-10 mt-6 w-full justify-center border-y border-white/10 py-4 bg-white/5 rounded-xl">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{profile?.followersCount || 0}</p>
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{profile?.followingCount || 0}</p>
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Following</p>
              </div>
            </div>

            {/* If looking at someone else: Chat Button */}
            {!isSelf && onStartChat && (
              <button 
                onClick={() => onStartChat(profile)}
                className="mt-6 w-full py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:opacity-95 active:scale-98 transition-all shadow-lg text-lg"
              >
                <MessageSquare size={22} />
                Message / Chat Now
              </button>
            )}

            {/* If looking at own profile: Privacy toggle */}
            {isSelf && (
              <div className="w-full mt-6 p-4 bg-surface/50 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {profile?.isPrivate ? <Lock size={20} className="text-primary" /> : <Globe size={20} className="text-primary" />}
                  <div>
                    <p className="font-semibold text-sm">Private Account</p>
                    <p className="text-xs text-text-secondary">Only accepted followers can see profile info.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={profile?.isPrivate || false} 
                    onChange={togglePrivacy} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
