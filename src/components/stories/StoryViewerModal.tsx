import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Trash2, Eye, ChevronLeft, ChevronRight, User as UserIcon, Heart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { StoryGroup } from './StoriesBar';

interface StoryViewerModalProps {
  group: StoryGroup;
  onClose: () => void;
}

export default function StoryViewerModal({ group, onClose }: StoryViewerModalProps) {
  const { user, userProfile } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
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

        // Send notification to story creator's inbox
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

  // Format relative time (e.g. 2h ago)
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

  // Mark current story as viewed in Firestore
  useEffect(() => {
    if (!currentStory || !user || isSelf) return;

    if (!currentStory.viewers.includes(user.uid)) {
      const storyRef = doc(db, 'stories', currentStory.id);
      updateDoc(storyRef, {
        viewers: arrayUnion(user.uid)
      }).catch((err) => console.warn("Could not mark story as viewed:", err));
    }
  }, [currentStory, user, isSelf]);

  // 5-Second Timer Progress Bar
  useEffect(() => {
    setProgress(0);
    const DURATION = 5000; // 5 seconds per story
    const INTERVAL = 50; // update every 50ms
    const step = (INTERVAL / DURATION) * 100;

    const timer = setInterval(() => {
      if (isPausedRef.current) return;

      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Advance to next story or close
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

  // Navigate next / prev
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

  // Delete own story
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
      onPointerUp={() => setIsPaused(false)}
    >
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/10">
        
        {/* Top Gradient & Controls */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex flex-col gap-3">
          
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

            {/* Right Action Icons */}
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

          {/* Clickable Tap Zones: Left (Prev) & Right (Next) */}
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

          {/* Navigation Arrows for Desktop */}
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

        {/* Bottom Bar: Caption & Viewers */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 pointer-events-none">
          {currentStory.caption && (
            <div className="bg-black/60 backdrop-blur-md text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 text-center shadow-lg pointer-events-auto">
              {currentStory.caption}
            </div>
          )}

          {/* Viewer Bottom Action: Floating Like Button */}
          {!isSelf && (
            <div className="flex items-center justify-end pointer-events-auto px-2 py-1">
              <button
                type="button"
                onClick={handleToggleLike}
                className={`p-3 rounded-full backdrop-blur-xl border transition-all active:scale-125 shadow-xl flex items-center gap-1.5 ${
                  hasLiked
                    ? 'bg-rose-500/20 border-rose-500/60 text-rose-500'
                    : 'bg-black/60 border-white/20 text-white hover:bg-white/20'
                }`}
                title={hasLiked ? "Unlike" : "Like story"}
              >
                <Heart size={20} className={hasLiked ? 'fill-rose-500 text-rose-500 animate-bounce' : 'text-white'} />
                {likeCount > 0 && (
                  <span className="text-xs font-bold">{likeCount}</span>
                )}
              </button>
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
