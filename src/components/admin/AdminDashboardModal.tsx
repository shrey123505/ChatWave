import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Crown, 
  X, 
  Users, 
  BarChart3, 
  AlertTriangle, 
  Megaphone, 
  Trash2, 
  Ban, 
  CheckCircle2, 
  Search, 
  ShieldAlert, 
  Send, 
  Activity, 
  Sparkles, 
  Lock, 
  Unlock 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboardModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'reports' | 'broadcast'>('analytics');

  // State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [storiesCount, setStoriesCount] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // 1. Subscribe to users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setUsersList(list);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Admin user sync error:", err);
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  // 2. Subscribe to reports collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setReportsList(list);
    }, (err) => {
      console.error("Admin reports sync error:", err);
    });
    return () => unsub();
  }, []);

  // 3. Subscribe to stories collection count
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stories'), (snap) => {
      setStoriesCount(snap.size);
    }, (err) => {
      console.error("Admin stories sync error:", err);
    });
    return () => unsub();
  }, []);

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    const name = (u.name || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const uid = (u.uid || u.id || '').toLowerCase();
    return name.includes(q) || username.includes(q) || uid.includes(q);
  });

  const onlineUsersCount = usersList.filter((u) => u.isOnline).length;

  // Actions: Ban / Unban User
  const handleToggleBan = async (targetUser: any) => {
    if (targetUser.username === 'shreyprajapati11' || targetUser.role === 'admin') {
      toast.error("Cannot suspend an administrator account.");
      return;
    }

    const newBanState = !targetUser.isBanned;
    try {
      await updateDoc(doc(db, 'users', targetUser.id), {
        isBanned: newBanState
      });
      if (newBanState) {
        toast.success(`@${targetUser.username || 'user'} has been suspended.`);
      } else {
        toast.success(`@${targetUser.username || 'user'} suspension has been lifted.`);
      }
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  // Actions: Permanently Delete User
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.username === 'shreyprajapati11' || userToDelete.role === 'admin') {
      toast.error("Cannot delete an administrator account.");
      setUserToDelete(null);
      return;
    }

    setDeleting(true);
    const targetUid = userToDelete.id || userToDelete.uid;
    const targetUsername = userToDelete.username || 'user';

    try {
      // 1. Delete user doc
      await deleteDoc(doc(db, 'users', targetUid));

      // 2. Delete stories created by this user
      const storiesQuery = query(collection(db, 'stories'), where('creatorId', '==', targetUid));
      const storiesSnap = await getDocs(storiesQuery);
      if (!storiesSnap.empty) {
        const batch = writeBatch(db);
        storiesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      toast.success(`User @${targetUsername} has been permanently deleted.`);
      setUserToDelete(null);
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Actions: Dismiss / Delete Report
  const handleDeleteReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      toast.success("Report dismissed.");
    } catch (err: any) {
      toast.error("Failed to dismiss report: " + err.message);
    }
  };

  // Actions: Dispatch Global Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast.error("Please enter both title and message.");
      return;
    }

    setSendingBroadcast(true);
    const toastId = toast.loading("Sending broadcast to all users...");

    try {
      const now = Date.now();
      let sentCount = 0;

      for (const targetUser of usersList) {
        const uid = targetUser.id || targetUser.uid;
        if (!uid) continue;

        await addDoc(collection(db, 'users', uid, 'inbox'), {
          type: 'broadcast',
          senderId: user?.uid || 'admin',
          senderName: 'ChatWave Admin',
          title: broadcastTitle.trim(),
          text: broadcastMessage.trim(),
          timestamp: now
        }).catch((e) => console.warn(`Failed broadcast to ${uid}:`, e));

        sentCount++;
      }

      toast.success(`Broadcast sent to ${sentCount} user(s) successfully! 📢`, { id: toastId });
      setBroadcastTitle('');
      setBroadcastMessage('');
      setActiveTab('analytics');
    } catch (err: any) {
      toast.error("Broadcast failed: " + err.message, { id: toastId });
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="glass-panel w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col h-[92vh] max-h-[880px] text-text border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.15)] bg-surface/95 relative">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30">
              <Crown size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400">
                  ChatWave Command Center
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Logged in as <span className="text-amber-400 font-semibold">@shreyprajapati11</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-4 sm:px-6 bg-black/20 overflow-x-auto gap-2 sm:gap-4 no-scrollbar">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            <BarChart3 size={16} />
            <span>Overview & Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            <Users size={16} />
            <span>User Management ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'reports'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            <AlertTriangle size={16} />
            <span>Reports ({reportsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            <Megaphone size={16} />
            <span>Broadcast Announcement</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW & STATS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="glass-panel p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-xs font-medium">Registered Users</span>
                    <Users size={16} className="text-primary" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-text">
                    {usersList.length}
                  </div>
                  <p className="text-[11px] text-text-secondary">Total platform accounts</p>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="text-xs font-medium">Online Users</span>
                    <Activity size={16} />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
                    {onlineUsersCount}
                  </div>
                  <p className="text-[11px] text-emerald-400/80">Active real-time presence</p>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between text-primary">
                    <span className="text-xs font-medium">Active Stories</span>
                    <Sparkles size={16} />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-text">
                    {storiesCount}
                  </div>
                  <p className="text-[11px] text-text-secondary">Stories in 24h window</p>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                  <div className="flex items-center justify-between text-amber-400">
                    <span className="text-xs font-medium">Pending Reports</span>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-amber-400">
                    {reportsList.length}
                  </div>
                  <p className="text-[11px] text-text-secondary">Community safety queue</p>
                </div>
              </div>

              {/* Platform Health Section */}
              <div className="glass-panel p-5 rounded-xl border border-white/10 bg-white/5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" /> System Health & Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                    <span>Firestore Database</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                    <span>Firebase Auth</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                    <span>WebRTC Audio/Video</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="glass-panel p-5 rounded-xl border border-white/10 bg-white/5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                  Quick Actions
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setActiveTab('broadcast')}
                    className="py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-md shadow-primary/30 active:scale-95"
                  >
                    <Megaphone size={15} /> Send Global Announcement
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-text font-semibold text-xs transition-all flex items-center gap-2 border border-white/10 active:scale-95"
                  >
                    <Users size={15} /> Manage All Users
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter users by name, @username, or UID..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder:text-white/40 transition-all shadow-inner"
                />
              </div>

              {/* Users List */}
              {loadingUsers ? (
                <div className="text-center py-12 text-text-secondary text-sm">
                  Loading platform users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-text-secondary text-sm">
                  No users found matching "{searchFilter}".
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((u) => {
                    const isSelf = u.username === 'shreyprajapati11' || u.role === 'admin';
                    return (
                      <div 
                        key={u.id}
                        className="glass-panel p-3.5 sm:p-4 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* User Details */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {u.photoURL ? (
                              <img 
                                src={u.photoURL} 
                                alt={u.name} 
                                className="w-11 h-11 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-secondary text-white font-bold flex items-center justify-center text-sm shadow-md">
                                {u.name ? u.name[0].toUpperCase() : 'U'}
                              </div>
                            )}
                            {u.isOnline && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-surface rounded-full"></span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-text">{u.name || 'User'}</span>
                              <span className="text-xs text-text-secondary">@{u.username}</span>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                  👑 OWNER
                                </span>
                              )}
                              {u.isBanned && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                  <ShieldAlert size={10} /> SUSPENDED
                                </span>
                              )}
                              {u.isPrivate && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-secondary flex items-center gap-1">
                                  <Lock size={10} /> Private
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-secondary mt-0.5">
                              UID: <code className="font-mono text-[10px] text-white/50">{u.id}</code>
                              {u.createdAt && (
                                <span className="ml-2">
                                  • Joined {new Date(u.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isSelf && (
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {/* Ban / Unban Toggle */}
                            <button
                              onClick={() => handleToggleBan(u)}
                              title={u.isBanned ? "Lift Suspension" : "Suspend Account"}
                              className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                u.isBanned
                                  ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                  : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                              }`}
                            >
                              {u.isBanned ? (
                                <>
                                  <Unlock size={14} /> Lift Ban
                                </>
                              ) : (
                                <>
                                  <Ban size={14} /> Ban User
                                </>
                              )}
                            </button>

                            {/* Delete User Button */}
                            <button
                              onClick={() => setUserToDelete(u)}
                              title="Permanently Delete User"
                              className="p-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-all flex items-center gap-1.5"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ABUSE REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {reportsList.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 className="text-base font-bold text-text">No Abuse Reports</h3>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto">
                    The platform community is safe and clean! All user reports submitted via the chat room will appear here for administrative action.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportsList.map((r) => (
                    <div 
                      key={r.id}
                      className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-text">
                              Reported User: <span className="text-amber-400">@{r.reportedUsername || r.reportedUserName}</span>
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                              {r.reason}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1">
                            Reported by: <span className="text-white">{r.reporterName}</span> • {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'Recent'}
                          </p>
                          {r.details && (
                            <p className="text-xs text-text-secondary/90 mt-2 bg-black/20 p-2.5 rounded-lg border border-white/5">
                              "{r.details}"
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteReport(r.id)}
                          className="py-1.5 px-3 rounded-lg border border-white/10 hover:bg-white/10 text-xs text-text-secondary hover:text-white transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={13} /> Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GLOBAL BROADCAST */}
          {activeTab === 'broadcast' && (
            <form onSubmit={handleSendBroadcast} className="space-y-5 max-w-xl mx-auto">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Megaphone size={16} />
                  <span>Send Notification to All Users</span>
                </div>
                <p className="text-xs text-text-secondary">
                  This sends a platform announcement directly into every registered user's notification drawer with an instant alert.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-2 uppercase tracking-wider">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. 🚀 ChatWave Update Released!"
                  className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/20 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder:text-white/40 transition-all shadow-inner"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-2 uppercase tracking-wider">
                  Announcement Message
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={4}
                  placeholder="Write your announcement details here for all users to see..."
                  className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/20 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder:text-white/40 resize-none transition-all shadow-inner"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingBroadcast}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-primary text-white font-bold text-sm shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 disabled:opacity-50"
              >
                <Send size={16} />
                {sendingBroadcast ? 'Sending to all users...' : 'Dispatch Broadcast Now'}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* Delete Confirmation Sub-Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-red-500/30 bg-surface text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-red-400">Permanently Delete User?</h3>
            <p className="text-xs text-text-secondary">
              Are you sure you want to permanently delete <strong className="text-white">@{userToDelete.username}</strong> ({userToDelete.name})? This will wipe their profile and stories from the database.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
