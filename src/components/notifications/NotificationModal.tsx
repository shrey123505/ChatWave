import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  writeBatch,
  setDoc,
  updateDoc,
  increment,
  getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  X, 
  Bell, 
  Phone, 
  Video, 
  UserPlus, 
  UserCheck, 
  Heart, 
  Trash2, 
  User as UserIcon,
  PhoneMissed,
  Megaphone
} from 'lucide-react';
import toast from 'react-hot-toast';

interface NotificationItem {
  id: string;
  type: 'message' | 'missed_call' | 'follow' | 'story_like' | 'broadcast';
  senderId: string;
  senderName: string;
  senderUsername?: string;
  senderPhotoURL?: string;
  title?: string;
  text?: string;
  callType?: 'audio' | 'video';
  storyId?: string;
  timestamp: number;
}

export default function NotificationModal({
  onClose,
  onStartCall,
  onSelectChat
}: {
  onClose: () => void;
  onStartCall: (targetUser: any, type: 'audio' | 'video') => void;
  onSelectChat: (targetUser: any) => void;
}) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'users', user.uid, 'inbox'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as NotificationItem[];

      setNotifications(items);
      setLoading(false);

      // Check following status for follow notifications
      const followItems = items.filter((i) => i.type === 'follow');
      if (followItems.length > 0) {
        const map: Record<string, boolean> = {};
        for (const item of followItems) {
          try {
            const check = await getDoc(doc(db, 'users', user.uid, 'following', item.senderId));
            map[item.senderId] = check.exists();
          } catch {}
        }
        setFollowingMap(map);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleDeleteItem = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'inbox', notifId));
    } catch {}
  };

  const handleClearAll = async () => {
    if (!user?.uid || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        batch.delete(doc(db, 'users', user.uid, 'inbox', n.id));
      });
      await batch.commit();
      toast.success('All notifications cleared');
    } catch (err: any) {
      toast.error('Failed to clear: ' + err.message);
    }
  };

  const handleFollowBack = async (e: React.MouseEvent, targetUid: string, targetName: string) => {
    e.stopPropagation();
    if (!user?.uid) return;

    try {
      const followerRef = doc(db, 'users', targetUid, 'followers', user.uid);
      const followingRef = doc(db, 'users', user.uid, 'following', targetUid);

      await setDoc(followerRef, { followedAt: new Date().toISOString() });
      await setDoc(followingRef, { followedAt: new Date().toISOString() });
      await updateDoc(doc(db, 'users', targetUid), { followersCount: increment(1) }).catch(() => {});
      await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(1) }).catch(() => {});

      setFollowingMap((prev) => ({ ...prev, [targetUid]: true }));
      toast.success(`You are now following ${targetName}!`);
    } catch (err: any) {
      toast.error('Failed to follow back: ' + err.message);
    }
  };

  const formatTime = (ts: number) => {
    try {
      const diff = Date.now() - ts;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/10 shadow-2xl bg-surface/95 text-text">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50">
          <div className="flex items-center gap-2 font-bold text-base">
            <Bell size={18} className="text-primary" />
            <span>Notifications</span>
            {notifications.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                {notifications.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-text-secondary hover:text-red-400 transition-colors px-2 py-1"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-text-secondary hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="p-8 text-center text-text-secondary text-xs flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-text-secondary space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                <Bell size={22} className="opacity-40 text-primary" />
              </div>
              <p className="font-semibold text-sm text-text">No new notifications</p>
              <p className="text-xs opacity-70">
                You'll see missed calls, follow alerts, and story likes right here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  onSelectChat({
                    uid: n.senderId,
                    name: n.senderName,
                    username: n.senderUsername,
                    photoURL: n.senderPhotoURL
                  });
                  onClose();
                }}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 rounded-xl transition-all flex items-center gap-3 cursor-pointer group"
              >
                {/* Sender Avatar with Activity Icon Badge */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-primary/20 overflow-hidden border border-white/15 flex items-center justify-center">
                    {n.senderPhotoURL ? (
                      <img src={n.senderPhotoURL} alt={n.senderName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={22} className="text-primary" />
                    )}
                  </div>
                  {/* Badge */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md border border-background">
                    {n.type === 'missed_call' ? (
                      <div className="w-full h-full bg-red-600 rounded-full flex items-center justify-center">
                        <PhoneMissed size={10} />
                      </div>
                    ) : n.type === 'follow' ? (
                      <div className="w-full h-full bg-primary rounded-full flex items-center justify-center">
                        <UserPlus size={10} />
                      </div>
                    ) : n.type === 'story_like' ? (
                      <div className="w-full h-full bg-rose-500 rounded-full flex items-center justify-center">
                        <Heart size={10} className="fill-white" />
                      </div>
                    ) : n.type === 'broadcast' ? (
                      <div className="w-full h-full bg-amber-500 text-black rounded-full flex items-center justify-center">
                        <Megaphone size={10} />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center">
                        💬
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-xs text-text truncate">
                      {n.type === 'broadcast' ? '📢 Platform Announcement' : (n.senderName || 'Friend')}
                    </h5>
                    <span className="text-[10px] text-text-secondary flex-shrink-0 ml-2">
                      {formatTime(n.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {n.type === 'missed_call' ? (
                      <span className="text-red-400 font-medium">Missed {n.callType === 'video' ? 'video' : 'audio'} call</span>
                    ) : n.type === 'follow' ? (
                      <span className="text-primary font-medium">Started following you</span>
                    ) : n.type === 'story_like' ? (
                      <span className="text-rose-400 font-medium">Liked your story ❤️</span>
                    ) : n.type === 'broadcast' ? (
                      <span className="text-amber-400 font-medium">{n.title ? `${n.title}: ` : ''}{n.text}</span>
                    ) : (
                      n.text || 'Sent a message'
                    )}
                  </p>
                </div>

                {/* Interactive Action Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {n.type === 'missed_call' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartCall(
                          { uid: n.senderId, name: n.senderName, photoURL: n.senderPhotoURL },
                          n.callType || 'audio'
                        );
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow active:scale-95 transition-all"
                      title="Call back"
                    >
                      {n.callType === 'video' ? <Video size={12} /> : <Phone size={12} />}
                      <span>Call</span>
                    </button>
                  )}

                  {n.type === 'follow' && (
                    <button
                      type="button"
                      onClick={(e) => handleFollowBack(e, n.senderId, n.senderName)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow active:scale-95 transition-all ${
                        followingMap[n.senderId]
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'bg-primary hover:bg-primary/90 text-white'
                      }`}
                    >
                      {followingMap[n.senderId] ? (
                        <>
                          <UserCheck size={12} /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus size={12} /> Follow
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(e, n.id)}
                    className="p-1.5 text-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100"
                    title="Delete notification"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
