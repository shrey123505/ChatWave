import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  limit, 
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Search, 
  User as UserIcon, 
  Sparkles, 
  Lock, 
  MessageSquare, 
  Camera, 
  Mic, 
  ScanLine,
  UserPlus
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export interface ConversationItem {
  peerUid: string;
  peerName: string;
  peerUsername?: string;
  peerPhotoURL?: string;
  isPrivate?: boolean;
  lastMessage?: string;
  lastMessageType?: 'text' | 'image' | 'audio';
  lastMessageTime?: number;
  unread?: boolean;
  isOnline?: boolean;
}

export default function Sidebar({ 
  onSelectUser,
  onSelectChat,
  onOpenScanner,
  activeChatUid,
  mode = 'chats'
}: { 
  onSelectUser: (user: any) => void;
  onSelectChat?: (user: any) => void;
  onOpenScanner?: () => void;
  activeChatUid?: string | null;
  mode?: 'all' | 'chats' | 'search';
}) {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'online'>('all');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Real-time Listener for Active Conversations
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const convCol = collection(db, 'users', user.uid, 'conversations');
    const unsub = onSnapshot(convCol, (snap) => {
      const list: ConversationItem[] = snap.docs.map((d) => ({
        peerUid: d.id,
        ...d.data()
      })) as ConversationItem[];

      list.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      setConversations(list);
      setLoading(false);
    }, (err) => {
      console.warn("Conversations listener error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  // 2. Fetch Followed Users (To show contacts who haven't been messaged yet)
  useEffect(() => {
    if (!user?.uid) return;

    const followingCol = collection(db, 'users', user.uid, 'following');
    const unsub = onSnapshot(followingCol, async (snap) => {
      const uids = snap.docs.map((d) => d.id);
      if (uids.length === 0) {
        setFollowingUsers([]);
        return;
      }

      const usersData: any[] = [];
      for (const targetUid of uids.slice(0, 15)) {
        try {
          const userDoc = await getDoc(doc(db, 'users', targetUid));
          if (userDoc.exists()) {
            usersData.push({ uid: userDoc.id, ...userDoc.data() });
          }
        } catch {}
      }
      setFollowingUsers(usersData);
    });

    return () => unsub();
  }, [user?.uid]);

  // 3. Search Users in Real-Time by @username or Name
  useEffect(() => {
    const term = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!term) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        const matches = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u: any) => {
            if (u.uid === user?.uid) return false;
            const uname = (u.username || '').toLowerCase();
            const name = (u.name || '').toLowerCase();
            return uname.includes(term) || name.includes(term);
          });
        setSearchResults(matches);
      } catch (e) {
        console.error("User search failed:", e);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.uid]);

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '';
    const now = Date.now();
    const diffSec = Math.floor((now - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleOpenUser = (targetUser: any) => {
    if (onSelectChat) {
      onSelectChat(targetUser);
    } else {
      onSelectUser(targetUser);
    }
  };

  const hasSearch = searchQuery.trim().length > 0;
  const isSearchMode = mode === 'search';

  const filteredConversations = conversations.filter((c) => {
    if (filterType === 'unread') return !!c.unread;
    if (filterType === 'online') return !!c.isOnline;
    return true;
  });

  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <div className="flex flex-col h-full bg-surface/25">
      {/* Top Search Bar & Quick Filter Pills */}
      <div className="p-3 border-b border-white/[0.08] bg-black/20 space-y-2.5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
            <Search size={16} />
          </div>
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search by name or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus={isSearchMode}
            className="w-full pl-10 pr-8 py-2 bg-white/[0.07] border border-white/15 rounded-xl focus:outline-none focus:border-primary text-white placeholder:text-white/45 transition-colors text-xs sm:text-sm shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/50 hover:text-white text-lg font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills (Only on Chats View when not searching) */}
        {!hasSearch && !isSearchMode && conversations.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                filterType === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text'
              }`}
            >
              All ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('unread')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${
                filterType === 'unread'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('online')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${
                filterType === 'online'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Online</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Body Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* CASE 1: USER IS CURRENTLY SEARCHING */}
        {hasSearch ? (
          <div>
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-primary">
                <Sparkles size={14} /> Global Directory
              </span>
              <span className="text-[10px] text-text-secondary/70">
                {searchResults.length} found
              </span>
            </div>

            {searching ? (
              <div className="text-center p-8 text-text-secondary text-sm flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                Searching users...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center p-8 text-text-secondary text-sm space-y-2">
                <UserPlus size={36} className="mx-auto opacity-40 text-primary" />
                <p className="font-semibold text-text">No user found</p>
                <p className="text-xs opacity-70">
                  No account matching "@{searchQuery.trim().replace(/^@/, '')}". Double-check spelling.
                </p>
              </div>
            ) : (
              searchResults.map((u) => (
                <button 
                  key={u.uid}
                  onClick={() => handleOpenUser(u)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/10 active:bg-white/15 rounded-2xl transition-all text-left group"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-white/15">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={24} className="text-primary group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    {u.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-semibold text-text truncate group-hover:text-primary transition-colors text-sm">
                        {u.name || 'User'}
                      </h4>
                      {u.isPrivate && (
                        <span className="p-0.5 rounded bg-primary/10 border border-primary/20 text-primary" title="Private Account">
                          <Lock size={11} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary truncate">
                      @{u.username || 'unknown'}
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-xl bg-primary/20 text-primary font-semibold group-hover:bg-primary group-hover:text-white transition-all flex-shrink-0">
                    Message
                  </span>
                </button>
              ))
            )}
          </div>
        ) : isSearchMode ? (
          /* CASE 2: SEARCH TAB ON MOBILE WITHOUT QUERY */
          <div className="flex flex-col items-center justify-center p-8 text-center text-text-secondary space-y-4 my-6">
            <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xl">
              <Search size={28} />
            </div>
            <div>
              <h3 className="font-bold text-text text-base">Discover People on ChatWave</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-xs leading-relaxed">
                Search by <span className="text-primary font-medium">@username</span> or full name above to start an instant chat or video call.
              </p>
            </div>
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold transition-all shadow-md active:scale-95"
              >
                <ScanLine size={15} className="text-primary" />
                <span>Scan Friend's QR Code</span>
              </button>
            )}
          </div>
        ) : (
          /* CASE 3: CHATS LIST */
          <div>
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} className="text-primary" /> Direct Messages
              </span>
              {filteredConversations.length > 0 && (
                <span className="text-[10px] text-text-secondary/70 font-mono">
                  {filteredConversations.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-center p-8 text-text-secondary text-sm flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                Loading chats...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 my-3 mx-2 rounded-2xl bg-surface/50 border border-white/10 backdrop-blur-md text-center space-y-3 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center mx-auto shadow-inner">
                  <MessageSquare size={26} />
                </div>
                <div>
                  <h4 className="font-bold text-text text-sm sm:text-base">
                    {filterType !== 'all' ? `No ${filterType} chats` : 'No conversations yet'}
                  </h4>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    {filterType !== 'all'
                      ? 'Switch back to All to view your conversation history.'
                      : 'Search for friends by their @username or scan their QR code to start a private conversation.'}
                  </p>
                </div>
                {filterType !== 'all' ? (
                  <button
                    onClick={() => setFilterType('all')}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold"
                  >
                    Show All Chats
                  </button>
                ) : (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={() => searchInputRef.current?.focus()}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Search size={14} />
                      <span>Find People</span>
                    </button>
                    {onOpenScanner && (
                      <button
                        onClick={onOpenScanner}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <ScanLine size={14} className="text-primary" />
                        <span>Scan QR</span>
                      </button>
                    )}
                  </div>
                )}

                {followingUsers.length > 0 && filterType === 'all' && (
                  <div className="pt-4 border-t border-white/10 text-left">
                    <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Contacts You Follow
                    </p>
                    <div className="space-y-1">
                      {followingUsers.map((fu) => (
                        <button
                          key={fu.uid}
                          onClick={() => handleOpenUser(fu)}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden border border-white/10 flex-shrink-0 flex items-center justify-center">
                            {fu.photoURL ? (
                              <img src={fu.photoURL} alt={fu.name} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={16} className="text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text truncate">{fu.name}</p>
                            <p className="text-[10px] text-text-secondary truncate">@{fu.username}</p>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">
                            Chat
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* CONVERSATION LIST */
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const isActive = activeChatUid === conv.peerUid;
                  const targetUser = {
                    uid: conv.peerUid,
                    name: conv.peerName,
                    username: conv.peerUsername,
                    photoURL: conv.peerPhotoURL,
                    isPrivate: conv.isPrivate
                  };

                  return (
                    <button 
                      key={conv.peerUid}
                      onClick={() => handleOpenUser(targetUser)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group border ${
                        isActive
                          ? 'bg-primary/15 border-primary/35 shadow-md'
                          : 'hover:bg-white/[0.08] active:bg-white/15 border-transparent hover:border-white/5'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border transition-transform group-hover:scale-105 ${
                          isActive ? 'border-primary' : 'border-white/15'
                        }`}>
                          {conv.peerPhotoURL ? (
                            <img src={conv.peerPhotoURL} alt={conv.peerName} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={24} className="text-primary" />
                          )}
                        </div>
                        {conv.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface" />
                        )}
                      </div>

                      {/* Info & Last Message Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className={`font-semibold truncate transition-colors text-sm ${
                              isActive ? 'text-primary font-bold' : 'text-text group-hover:text-primary'
                            }`}>
                              {conv.peerName || 'User'}
                            </h4>
                            {conv.isPrivate && (
                              <span className="p-0.5 rounded bg-primary/10 border border-primary/20 text-primary flex-shrink-0" title="Private Account">
                                <Lock size={10} />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-text-secondary font-mono flex-shrink-0">
                            {formatRelativeTime(conv.lastMessageTime)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate flex items-center gap-1.5 ${
                            conv.unread ? 'text-white font-bold' : 'text-text-secondary'
                          }`}>
                            {conv.lastMessageType === 'image' && <Camera size={13} className="text-primary flex-shrink-0" />}
                            {conv.lastMessageType === 'audio' && <Mic size={13} className="text-primary flex-shrink-0" />}
                            <span className="truncate">{conv.lastMessage || 'Say hello! 👋'}</span>
                          </p>
                          {conv.unread && (
                            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse flex-shrink-0 shadow-sm" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
