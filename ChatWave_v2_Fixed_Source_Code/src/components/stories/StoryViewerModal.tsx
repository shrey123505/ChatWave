import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Trash2, Eye, ChevronLeft, ChevronRight, User as UserIcon, Heart, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { StoryGroup } from './StoriesBar';

interface StoryViewerModalProps {
  group: StoryGroup;
  onClose: () => void;
}

const STORY_REACTIONS = ['🔥', '❤️', '😂', '😍', '👏'];

export default function StoryViewerModal({ group, onClose }: StoryViewerModalProps) {
  const { user, userProfile } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const stories = group.stories;
  const currentStory = stories[currentIndex];
  const isSelf = user?.uid === group.userId;

  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);

  useEffect(() => {
    if (currentStory && user?.uid) {
      setHasLiked((currentStory.likes || []).includes(user.uid));
      setLikeCount(currentStory.likes?.length || 0);
    }
  }, [currentStory, user?.uid]);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory || !user || isSelf) return;

    const newLiked = !hasLiked;
    setHasLiked(newLiked);
    setLikeCount((prev) => Math.max(0, prev + (newLiked ? 1 : -1)));

    try {
      const storyRef = doc(db, 'stories', currentStory.id);
      if (newLiked) {
        await updateDoc(storyRef, {
          likes: arrayUnion(user.uid)
        });

        await addDoc(collection(db, 'users', group.userId, 'inbox'), {
          type: 'story_like',
          senderId: user.uid,
          senderName: userProfile?.name || user.displayName || user.email || 'Someone',
          senderPhotoURL: userProfile?.photoURL || user.photoURL || '',
          text: 'Liked your story',
          storyId: currentStory.id,
          timestamp: Date.now()
        }).catch(() => {});

        toast('Liked story! ❤️', { id: 'story-like-toast', duration: 1500 });
      } else {
        await updateDoc(storyRef, {
          likes: arrayRemove(user.uid)
        });
      }
    } catch (err) {
      console.warn("Error updating story like:", err);
      setHasLiked(!newLiked);
      setLikeCount((prev) => Math.max(0, prev + (!newLiked ? 1 : -1)));
    }
  };

  // Send direct story reply to chat
  const handleSendStoryReply = async (customText?: string) => {
    if (!user || !currentStory || isSelf || sendingReply) return;
    const textToSend = (customText ?? replyText).trim();
    if (!textToSend) return;

    setSendingReply(true);
    const chatId = [user.uid, group.userId].sort().join('_');
    const myName = userProfile?.name || user.displayName || 'Friend';
    const myPhoto = userProfile?.photoURL || user.photoURL || '';
    const myUsername = userProfile?.username || '';

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: myName,
        text: textToSend,
        type: 'text',
        seen: false,
        replyTo: {
          id: currentStory.id,
          text: `📖 Story: ${currentStory.caption || 'Photo'}`,
          senderName: group.userName
        },
        createdAt: serverTimestamp()
      });

      const now = Date.now();
      await setDoc(doc(db, 'users', user.uid, 'conversations', group.userId), {
        peerUid: group.userId,
        peerName: group.userName,
        peerUsername: group.userUsername || '',
        peerPhotoURL: group.userPhotoURL || '',
        lastMessage: textToSend,
        lastMessageType: 'text',
        lastMessageTime: now,
        unread: false,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});

      await setDoc(doc(db, 'users', group.userId, 'conversations', user.uid), {
        peerUid: user.uid,
        peerName: myName,
        peerUsername: myUsername,
        peerPhotoURL: myPhoto,
        lastMessage: textToSend,
        lastMessageType: 'text',
        lastMessageTime: now,
        unread: true,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});

      setReplyText('');
      setIsPaused(false);
      toast.success(`Sent reply to ${group.userName}!`, { duration: 1500 });
    } catch (err: any) {
      toast.error('Could not send reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    try {
      const diffMs = Date.now() - new Date(isoDate).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!currentStory || !user || isSelf) return;

    if (!currentStory.viewers.includes(user.uid)) {
      const storyRef = doc(db, 'stories', currentStory.id);
      updateDoc(storyRef, {
        viewers: arrayUnion(user.uid)
      }).catch((err) => console.warn("Could not mark story as viewed:", err));
    }
  }, [currentStory, user, isSelf]);

  useEffect(() => {
    setProgress(0);
    const DURATION = 5000;
    const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;

    const timer = setInterval(() => {
      if (isPausedRef.current) return;

      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [currentIndex, stories.length, onClose]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((idx) => idx + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory || !isSelf) return;
    if (!window.confirm("Are you sure you want to delete this story?")) return;

    try {
      await deleteDoc(doc(db, 'stories', currentStory.id));
      toast.success("Story deleted");
      if (stories.length <= 1) {
        onClose();
      } else {
        handleNext();
      }
    } catch (err: any) {
      toast.error("Failed to delete story: " + err.message);
    }
  };

  if (!currentStory) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex items-center justify-center select-none"
      onPointerDown={() => setIsPaused(true)}
      onPointerUp={() => {
        if (!replyText) setIsPaused(false);
      }}
    >
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/10">
        
        {/* Top Gradient & Controls */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex flex-col gap-3 pt-safe">
          
          {/* Segmented Progress Bars */}
          <div className="flex gap-1.5 w-full">
            {stories.map((s, idx) => (
              <div key={s.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-75"
                  style={{
                    width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Info Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-surface border border-white/20 flex-shrink-0">
                {group.userPhotoURL ? (
                  <img src={group.userPhotoURL} alt={group.userName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={18} className="text-text-secondary m-auto" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-white text-sm">
                  {group.userName}
                </span>
                <span className="text-[11px] text-white/60">
                  {formatTimeAgo(currentStory.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSelf && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStory();
                  }}
                  className="p-2 rounded-full bg-black/40 hover:bg-red-500/30 text-white hover:text-red-400 transition-colors"
                  title="Delete Story"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full bg-black/40 hover:bg-white/20 text-white transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Story Image View */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img 
            src={currentStory.mediaUrl} 
            alt="Story" 
            className="w-full h-full object-contain pointer-events-none"
          />

          <div 
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-0 inset-y-0 w-1/3 z-20 cursor-pointer"
          />
          <div 
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-0 inset-y-0 w-2/3 z-20 cursor-pointer"
          />

          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white items-center justify-center backdrop-blur-sm border border-white/10"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {currentIndex < stories.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white items-center justify-center backdrop-blur-sm border border-white/10"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Bottom Bar: Caption, Quick Reply & Viewers */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-2.5 pb-safe"
        >
          {currentStory.caption && (
            <div className="bg-black/60 backdrop-blur-md text-white text-sm px-4 py-2 rounded-xl border border-white/10 text-center shadow-lg">
              {currentStory.caption}
            </div>
          )}

          {/* Viewer Bottom Action: Quick Emoji Reactions + Direct Story Reply Input + Like Button */}
          {!isSelf && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2">
                {STORY_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendStoryReply(`Reacted ${emoji} to your story`)}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-base transition-transform active:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendStoryReply();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${group.userName.split(' ')[0]}...`}
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-primary backdrop-blur-md"
                />
                {replyText.trim() && (
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="p-2.5 rounded-full bg-primary text-white shadow-lg active:scale-95"
                  >
                    <Send size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className={`p-2.5 rounded-full backdrop-blur-xl border transition-all active:scale-125 shadow-xl flex items-center gap-1 ${
                    hasLiked
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-500'
                      : 'bg-black/60 border-white/20 text-white hover:bg-white/20'
                  }`}
                  title={hasLiked ? "Unlike" : "Like story"}
                >
                  <Heart size={18} className={hasLiked ? 'fill-rose-500 text-rose-500' : 'text-white'} />
                  {likeCount > 0 && (
                    <span className="text-xs font-bold">{likeCount}</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Creator Bottom Stats: Views and Likes */}
          {isSelf && (
            <div className="flex items-center justify-center gap-4 text-xs text-white/90 font-medium py-1">
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow">
                <Eye size={14} className="text-primary" />
                <span>{currentStory.viewers?.length || 0} views</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow">
                <Heart size={14} className="text-rose-400 fill-rose-400" />
                <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
