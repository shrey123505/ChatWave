import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, UserPlus, User as UserIcon, Users } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Sidebar({ onSelectUser }: { onSelectUser: (user: any) => void }) {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load existing users on mount so the user isn't faced with an empty screen!
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), limit(50));
        const snapshot = await getDocs(q);
        const users = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid !== user?.uid);
        setAllUsers(users);
      } catch (err) {
        console.error("Error loading users:", err);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [user]);

  // Filter users by username or name in real-time
  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const uname = (u.username || '').toLowerCase();
    const name = (u.name || '').toLowerCase();
    return uname.includes(q) || name.includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-surface/30">
      {/* Search Bar with high visibility */}
      <div className="p-4 border-b border-white/10 bg-black/20">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/70">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search name or @username..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:border-primary text-white placeholder:text-white/60 transition-colors text-sm shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/50 hover:text-white"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* List of Users */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <Users size={14} />
          {searchQuery ? 'Search Results' : 'Available Contacts'}
        </div>

        {loading ? (
          <div className="text-center p-6 text-text-secondary text-sm flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
            Loading contacts...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center p-8 text-text-secondary text-sm space-y-2">
            <UserPlus size={32} className="mx-auto opacity-40 text-primary" />
            <p className="font-medium">No users found</p>
            <p className="text-xs opacity-70">
              {searchQuery ? `No user matching "${searchQuery}"` : 'No other users registered yet.'}
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <button 
              key={u.uid}
              onClick={() => onSelectUser(u)}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/10 active:bg-white/15 rounded-xl transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-white/15 flex-shrink-0">
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={24} className="text-primary group-hover:scale-110 transition-transform" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-text truncate group-hover:text-primary transition-colors">
                  {u.name || 'User'}
                </h4>
                <p className="text-xs text-text-secondary truncate">
                  @{u.username || 'unknown'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
