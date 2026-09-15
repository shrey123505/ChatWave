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
import { db, auth } from '../../lib/firebase';
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
  LogOut,
  Edit3,
  Ban,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { formatPresence } from '../../hooks/usePresence';
import EditProfileModal from './EditProfileModal';
import ReportUserModal from '../chat/ReportUserModal';
import AvatarCropModal from './AvatarCropModal';
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
  
  // Photo Upload & Crop States
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  
  // Follow / Block States
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Sub-modal states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

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
        // 1. Fetch User Profile
        const d = await getDoc(doc(db, 'users', resolvedUid));
        if (d.exists() && isMounted) {
          setProfile({ uid: d.id, ...d.data() });
          setError(null);
        } else if (isMounted && !initialProfile) {
          setError("User profile not found.");
        }

        // 2. If viewing another user, check if following and if blocked
        if (!isSelf && user?.uid && isMounted) {
          const followDoc = await getDoc(doc(db, 'users', resolvedUid, 'followers', user.uid));
          if (isMounted) setIsFollowing(followDoc.exists());

          const blockDoc = await getDoc(doc(db, 'users', user.uid, 'blockedUsers', resolvedUid));
          if (isMounted) setIsBlocked(blockDoc.exists());
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

  // File Select -> Opens Circular Crop Modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSelf) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Cropped Circular Base64 Photo (Instant < 200ms save!)
  const handleSaveCroppedPhoto = async (croppedBase64: string) => {
    if (!user) return;
    setUploading(true);
    const toastId = toast.loading('Saving profile picture...');

    try {
      // Direct Firestore update - superfast, zero external storage dependency
      await updateDoc(doc(db, 'users', user.uid), { photoURL: croppedBase64 });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: croppedBase64 });
        setUser({ ...auth.currentUser, photoURL: croppedBase64 });
      }

      setProfile((prev: any) => ({ ...prev, photoURL: croppedBase64 }));
      toast.success('Profile picture updated!', { id: toastId });
    } catch (err: any) {
      console.error("Failed to save profile picture:", err);
      toast.error('Failed to update picture: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Follow / Unfollow
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
        await setDoc(followerRef, { followedAt: new Date().toISOString() });
        await setDoc(followingRef, { followedAt: new Date().toISOString() });
        await updateDoc(doc(db, 'users', resolvedUid), { followersCount: increment(1) });
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(1) });
        toast.success(`Followed @${profile?.username || 'user'}`);
      } else {
        await deleteDoc(followerRef);
        await deleteDoc(followingRef);
        await updateDoc(doc(db, 'users', resolvedUid), { followersCount: increment(-1) });
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(-1) });
        toast(`Unfollowed @${profile?.username || 'user'}`);
      }
    } catch (err: any) {
      console.error("Follow action failed:", err);
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

  // Block / Unblock User
  const handleToggleBlock = async () => {
    if (!user || !resolvedUid || isSelf || blockLoading) return;
    setBlockLoading(true);

    const newBlockedState = !isBlocked;
    setIsBlocked(newBlockedState);

    try {
      const blockRef = doc(db, 'users', user.uid, 'blockedUsers', resolvedUid);
      if (newBlockedState) {
        await setDoc(blockRef, { blockedAt: new Date().toISOString() });
        toast.success(`Blocked @${profile?.username || 'user'}`);
      } else {
        await deleteDoc(blockRef);
        toast.success(`Unblocked @${profile?.username || 'user'}`);
      }
    } catch (err: any) {
      setIsBlocked(!newBlockedState);
      toast.error("Failed to update block status: " + err.message);
    } finally {
      setBlockLoading(false);
    }
  };

  // Privacy: Private Account
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

  // Privacy: Hide Last Seen
  const toggleHideLastSeen = async () => {
    if (!isSelf || !user || !profile) return;
    const newHide = !profile.hideLastSeen;
    setProfile((prev: any) => ({ ...prev, hideLastSeen: newHide }));
    try {
      await updateDoc(doc(db, 'users', user.uid), { hideLastSeen: newHide });
      toast.success(newHide ? "Last seen is now hidden" : "Last seen is now visible");
    } catch (err) {
      setProfile((prev: any) => ({ ...prev, hideLastSeen: !newHide }));
      toast.error('Failed to update setting.');
    }
  };

  const presenceText = formatPresence(profile?.isOnline, profile?.lastSeen, profile?.hideLastSeen);

  const content = (
    <div className={`glass-panel w-full ${embedded ? 'h-full max-w-full rounded-none border-none bg-transparent' : 'max-w-md rounded-2xl border border-white/20 bg-surface/90 shadow-2xl'} overflow-y-auto flex flex-col relative text-text`}>
      
      {/* Top Header Actions */}
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20 flex-shrink-0">
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
            className={`relative group mb-3 ${isSelf ? 'cursor-pointer' : ''}`} 
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
                  onChange={handleFileSelect} 
                  accept="image/*" 
                  className="hidden" 
                  disabled={uploading} 
                />
              </>
            )}
          </div>

          {/* Name, Username & Presence */}
          <h2 className="text-2xl md:text-3xl font-bold mt-1 text-center">{profile?.name || 'Unnamed User'}</h2>
          <p className="text-text-secondary text-sm mt-0.5">@{profile?.username || 'user'}</p>
          
          {presenceText && (
            <p className="text-xs text-emerald-400 mt-1 font-medium flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              {presenceText}
            </p>
          )}

          {/* Bio Section */}
          {profile?.bio ? (
            <p className="text-xs sm:text-sm text-text-secondary text-center mt-3 max-w-xs italic bg-white/5 border border-white/5 px-4 py-2 rounded-xl">
              "{profile.bio}"
            </p>
          ) : isSelf ? (
            <button
              onClick={() => setShowEditProfile(true)}
              className="text-xs text-primary hover:underline mt-2 flex items-center gap-1"
            >
              <Edit3 size={12} /> Add a bio
            </button>
          ) : null}
          
          {/* Instagram Style Stats (Followers / Following) */}
          <div className="flex gap-8 md:gap-12 mt-5 w-full justify-center border-y border-white/10 py-3 bg-white/5 rounded-xl">
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
            <div className="w-full mt-5 space-y-3">
              <div className="flex gap-3">
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

              {/* Block and Report Buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={handleToggleBlock}
                  disabled={blockLoading}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    isBlocked 
                      ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                      : 'border-white/10 hover:border-red-400/40 text-text-secondary hover:text-red-400'
                  }`}
                >
                  <Ban size={14} />
                  {isBlocked ? 'Unblock User' : 'Block User'}
                </button>

                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex-1 py-2 px-3 rounded-xl border border-white/10 hover:border-amber-400/40 text-text-secondary hover:text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <AlertTriangle size={14} />
                  Report User
                </button>
              </div>
            </div>
          )}

          {/* Own Profile: Edit Profile & Privacy Settings */}
          {isSelf && (
            <div className="w-full mt-5 space-y-3">
              {/* Edit Profile Button */}
              <button
                onClick={() => setShowEditProfile(true)}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-98 shadow-sm"
              >
                <Edit3 size={16} />
                Edit Profile
              </button>

              {/* Privacy: Private Account Toggle */}
              <div className="p-3.5 bg-surface/50 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {profile?.isPrivate ? <Lock size={18} className="text-primary" /> : <Globe size={18} className="text-primary" />}
                  <div>
                    <p className="font-semibold text-xs">Private Account</p>
                    <p className="text-[10px] text-text-secondary">Only followers can see profile info.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={profile?.isPrivate || false} 
                    onChange={togglePrivacy} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Privacy: Hide Last Seen Toggle */}
              <div className="p-3.5 bg-surface/50 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {profile?.hideLastSeen ? <EyeOff size={18} className="text-primary" /> : <Eye size={18} className="text-primary" />}
                  <div>
                    <p className="font-semibold text-xs">Hide Last Seen</p>
                    <p className="text-[10px] text-text-secondary">Don't show when you were last active.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={profile?.hideLastSeen || false} 
                    onChange={toggleHideLastSeen} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors text-text-secondary hover:text-white"
                >
                  <SettingsIcon size={15} />
                  Themes & QR Code
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Sub-modal */}
      {showEditProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditProfile(false)}
          onUpdated={(updated) => setProfile((prev: any) => ({ ...prev, ...updated }))}
        />
      )}

      {/* Report User Sub-modal */}
      {showReportModal && (
        <ReportUserModal
          targetUser={profile}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Avatar Circular Crop Modal */}
      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onSave={handleSaveCroppedPhoto}
        />
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
