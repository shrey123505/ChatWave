import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { X, User, AtSign, FileText, Calendar, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditProfileModal({
  profile,
  onClose,
  onUpdated
}: {
  profile: any;
  onClose: () => void;
  onUpdated: (updatedData: any) => void;
}) {
  const { user, setUser, userProfile, setUserProfile } = useAuthStore();
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [age, setAge] = useState(profile?.age || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.uid !== profile.uid) {
      toast.error("You can only edit your own profile.");
      return;
    }

    const trimmedName = name.trim();
    const cleanUsername = username.trim().replace(/\s+/g, '').toLowerCase();

    if (!trimmedName) {
      toast.error("Name cannot be empty.");
      return;
    }

    if (!cleanUsername) {
      toast.error("Username cannot be empty.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Saving profile changes...");

    try {
      const updatedFields = {
        name: trimmedName,
        username: cleanUsername,
        bio: bio.trim().slice(0, 150),
        age: age ? Number(age) || age : ''
      };

      // 1. Update Firestore User Document
      await updateDoc(doc(db, 'users', user.uid), updatedFields);

      // 2. Update Firebase Auth Profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmedName });
        setUser({ ...auth.currentUser, displayName: trimmedName });
      }
      setUserProfile({ ...userProfile, ...updatedFields });

      toast.success("Profile updated successfully!", { id: toastId });
      onUpdated(updatedFields);
      onClose();
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error("Failed to update: " + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text border border-white/20 bg-surface/90 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User size={20} className="text-primary" />
            Edit Profile
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
          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                <User size={18} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={40}
                placeholder="Your display name"
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder-white/40 text-sm shadow-inner"
              />
            </div>
          </div>

          {/* Username Field */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                <AtSign size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                required
                maxLength={30}
                placeholder="username"
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder-white/40 text-sm shadow-inner"
              />
            </div>
          </div>

          {/* Bio Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Bio
              </label>
              <span className="text-[10px] text-text-secondary/70">
                {bio.length}/150
              </span>
            </div>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none text-text-secondary">
                <FileText size={18} />
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={150}
                rows={3}
                placeholder="Write a short bio about yourself..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder-white/40 text-sm shadow-inner resize-none"
              />
            </div>
          </div>

          {/* Age Field */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Age
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                <Calendar size={18} />
              </div>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={10}
                max={120}
                placeholder="Your age"
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder-white/40 text-sm shadow-inner"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 transition-all shadow-lg text-sm disabled:opacity-50"
          >
            <Save size={18} />
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
