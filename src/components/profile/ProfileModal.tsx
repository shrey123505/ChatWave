import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { X, Camera, Lock, Globe } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const d = await getDoc(doc(db, 'users', user.uid));
      if (d.exists()) {
        setProfile(d.data());
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setProfile({ ...profile, photoURL: url });
      toast.success('Profile photo updated!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to upload: ' + err.message, { id: toastId });
    }
    setUploading(false);
  };

  const togglePrivacy = async () => {
    if (!user || !profile) return;
    const newPrivacy = !profile.isPrivate;
    setProfile({ ...profile, isPrivate: newPrivacy });
    try {
      await updateDoc(doc(db, 'users', user.uid), { isPrivate: newPrivacy });
      toast.success(`Profile is now ${newPrivacy ? 'Private' : 'Public'}`);
    } catch (err) {
      setProfile({ ...profile, isPrivate: !newPrivacy }); // revert
      toast.error('Failed to update privacy.');
    }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text">
        <div className="absolute top-4 right-4 z-10">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors bg-black/20">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* Avatar */}
          <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full border-4 border-surface overflow-hidden bg-surface flex items-center justify-center">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-primary font-bold">{profile?.name?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" disabled={uploading} />
          </div>

          <h2 className="text-2xl font-bold">{profile?.name}</h2>
          <p className="text-text-secondary">@{profile?.username}</p>
          
          <div className="flex gap-8 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{profile?.followersCount || 0}</p>
              <p className="text-sm text-text-secondary">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{profile?.followingCount || 0}</p>
              <p className="text-sm text-text-secondary">Following</p>
            </div>
          </div>

          <div className="w-full mt-8 p-4 bg-surface/50 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profile?.isPrivate ? <Lock size={20} className="text-primary" /> : <Globe size={20} className="text-primary" />}
              <div>
                <p className="font-semibold">Private Account</p>
                <p className="text-xs text-text-secondary">Only followers can see your posts.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={profile?.isPrivate || false} onChange={togglePrivacy} className="sr-only peer" />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
