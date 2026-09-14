import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, UserPlus, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Sidebar({ onSelectUser }: { onSelectUser: (user: any) => void }) {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const searchUsers = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '>=', searchQuery.toLowerCase()),
          where('username', '<=', searchQuery.toLowerCase() + '\uf8ff')
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map(doc => doc.data())
          .filter(u => u.uid !== user?.uid); // Don't show self
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching:", err);
      }
      setLoading(false);
    };
    
    const timeout = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search username..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface/50 border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary transition-colors"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <div className="text-center p-4 text-text-secondary">Searching...</div>}
        {!loading && searchQuery && searchResults.length === 0 && (
          <div className="text-center p-4 text-text-secondary">No users found.</div>
        )}
        
        {searchResults.map((u) => (
          <button 
            key={u.uid}
            onClick={() => onSelectUser(u)}
            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
              {u.photoURL ? (
                <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={24} className="text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-text">{u.name}</h4>
              <p className="text-sm text-text-secondary">@{u.username}</p>
            </div>
          </button>
        ))}
        
        {!searchQuery && (
          <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50 p-4 text-center space-y-2">
            <UserPlus size={32} />
            <p>Search for a username to start chatting!</p>
          </div>
        )}
      </div>
    </div>
  );
}
