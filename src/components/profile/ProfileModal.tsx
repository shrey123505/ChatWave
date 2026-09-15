import { useState, useEffect, useRef } from 'react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  increment 
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../lib/firebase';
import { 
  X, 
  Camera, 
  Lock, 
  Globe, 
  MessageSquare, 
  AlertCircle, 
  UserPlus, 
  UserCheck, 
  Settings as SettingsIcon,
  LogOut
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { compressImage } from '../../utils/imageCompressor';
import toast from 'react-hot-toast';

export default function ProfileModal({ 
  onClose, 
  initialProfile,
  targetUid, 
  onStartChat,
  onOpenSettings,
  embedded = false
}: { 
  onClose?: () => void; 
  initialProfile?: any;
  targetUid?: string;
  onStartChat?: (user: any) => void;
  onOpenSettings?: () => void;
  embedded?: boolean;
}) {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
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
    const fetchProfileData = async () => {
      try {
        // Fetch User Profile
        const d = await getDoc(doc(db, 'users', resolvedUid));
        if (d.exists() && isMounted) {
          setProfile({ uid: d.id, ...d.data() });
          setError(null);
        } else if (isMounted && !initialProfile) {
          setError("User profile not found.");
        }

        // If viewing another user, check if already following
        if (!isSelf && user?.uid && isMounted) {
          const followDoc = await getDoc(doc(db, 'users', resolvedUid, 'followers', user.uid));
          if (isMounted) {
            setIsFollowing(followDoc.exists());
          }
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

    fetchProfileData();
    return () => { isMounted = false; };
  }, [resolvedUid, initialProfile, isSelf, user?.uid]);

  // Robust Photo Upload (Base64 compression + Storage fallback)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSelf) return;
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      // 1. Compress image to clean lightweight base64 (<25KB)
      const base64Photo = await compressImage(file, 250, 250, 0.75);

      let finalPhotoUrl = base64Photo;

      // 2. Try Firebase Storage if available
      try {
        const storageRef = ref(storage, `profiles/${user.uid}`);
        await uploadBytes(storageRef, file);
        finalPhotoUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Storage upload bypassed, using optimized direct store:", storageErr);
      }
      
      // 3. Update Firestore Document
      await updateDoc(doc(db, 'users', user.uid), { photoURL: finalPhotoUrl });

      // 4. Update Firebase Auth Profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: finalPhotoUrl });
        setUser({ ...auth.currentUser, photoURL: finalPhotoUrl });
      }

      setProfile((prev: any) => ({ ...prev, photoURL: finalPhotoUrl }));
      toast.success('Profile photo updated!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Follow / Unfollow System
  const handleToggleFollow = async () => {
    if (!user || !resolvedUid || isSelf || followingLoading) return;
    setFollowingLoading(true);

    const newFollowingState = !isFollowing;
    setIsFollowing(newFollowingState);
    setProfile((prev: any) => ({
      ...prev,
      followersCount: Math.max(0, (prev?.followersCount || 0) + (newFollowingState ? 1 : -1))
    }));

    try {
      const followerRef = doc(db, 'users', resolvedUid, 'followers', user.uid);
      const followingRef = doc(db, 'users', user.uid, 'following', resolvedUid);

      if (newFollowingState) {
        // Follow
        await setDoc(followerRef, { followedAt: new Date().toISOString() });
        await setDoc(followingRef, { followedAt: new Date().toISOString() });
        await updateDoc(doc(db, 'users', resolvedUid), { followersCount: increment(1) });
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(1) });
        toast.success(`Followed @${profile?.username || 'user'}`);
      } else {
        // Unfollow
        await deleteDoc(followerRef);
        await deleteDoc(followingRef);
        await updateDoc(doc(db, 'users', resolvedUid), { followersCount: increment(-1) });
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(-1) });
        toast(`Unfollowed @${profile?.username || 'user'}`);
      }
    } catch (err: any) {
      console.error("Follow action failed:", err);
      // Revert optimistic update
      setIsFollowing(!newFollowingState);
      setProfile((prev: any) => ({
        ...prev,
        followersCount: Math.max(0, (prev?.followersCount || 0) + (!newFollowingState ? 1 : -1))
      }));
      toast.error("Failed to update follow status: " + err.message);
    } finally {
      setFollowingLoading(false);
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

  const content = (
    <div className={`glass-panel w-full ${embedded ? 'h-full max-w-full rounded-none border-none bg-transparent' : 'max-w-md rounded-2xl border border-white/20 bg-surface/90 shadow-2xl'} overflow-y-auto flex flex-col relative text-text`}>
      
      {/* Top Header Actions */}
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20">
        <h3 className="font-bold text-lg flex items-center gap-2">
          {isSelf ? 'My Profile' : `@${profile?.username || 'User'}`}
        </h3>
        <div className="flex items-center gap-2">
          {isSelf && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
              title="Settings"
            >
              <SettingsIcon size={20} />
            </button>
          )}
          {isSelf && (
            <button
              onClick={() => auth.signOut()}
              className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          )}
          {!embedded && onClose && (
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-white/20 transition-colors bg-black/40 text-white"
              title="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>
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
          {!embedded && onClose && (
            <button 
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm"
            >
              Go Back
            </button>
          )}
        </div>
      ) : (
        <div className="p-6 md:p-8 flex flex-col items-center flex-1">
          {/* Avatar with Camera Overlay */}
          <div 
            className={`relative group mb-4 ${isSelf ? 'cursor-pointer' : ''}`} 
            onClick={() => isSelf && fileInputRef.current?.click()}
          >
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-primary/60 shadow-xl overflow-hidden bg-surface flex items-center justify-center">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl md:text-5xl text-primary font-bold">
                  {(profile?.name || profile?.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {isSelf && (
              <>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={26} className="text-white" />
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

          <h2 className="text-2xl md:text-3xl font-bold mt-1 text-center">{profile?.name || 'Unnamed User'}</h2>
          <p className="text-text-secondary text-base mt-0.5">@{profile?.username || 'user'}</p>
          {profile?.age && (
            <p className="text-xs text-text-secondary mt-1.5 bg-white/5 px-3 py-0.5 rounded-full border border-white/5">
              Age: {profile.age}
            </p>
          )}
          
          {/* Instagram Style Stats (Followers / Following) */}
          <div className="flex gap-8 md:gap-12 mt-6 w-full justify-center border-y border-white/10 py-3.5 bg-white/5 rounded-xl">
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-primary">{profile?.followersCount || 0}</p>
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-primary">{profile?.followingCount || 0}</p>
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Following</p>
            </div>
          </div>

          {/* Action Buttons for Other Users */}
          {!isSelf && (
            <div className="w-full mt-6 flex gap-3">
              {/* Follow / Following Button */}
              <button
                onClick={handleToggleFollow}
                disabled={followingLoading}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all shadow-md active:scale-98 ${
                  isFollowing
                    ? 'bg-white/15 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-primary hover:bg-primary/90 text-white'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck size={18} />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Follow
                  </>
                )}
              </button>

              {/* Message / Chat Button */}
              {onStartChat && (
                <button 
                  onClick={() => onStartChat(profile)}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:opacity-95 active:scale-98 transition-all shadow-lg text-sm"
                >
                  <MessageSquare size={18} />
                  Message
                </button>
              )}
            </div>
          )}

          {/* Own Profile: Privacy Settings & Account options */}
          {isSelf && (
            <div className="w-full mt-6 space-y-4">
              <div className="p-4 bg-surface/50 rounded-xl border border-white/5 flex items-center justify-between">
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

              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <SettingsIcon size={18} />
                  Theme & QR Code Settings
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      {content}
    </div>
  );
}
