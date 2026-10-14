import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { Plus, User as UserIcon } from 'lucide-react';

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userUsername?: string;
  userPhotoURL?: string;
  mediaUrl: string;
  caption?: string;
  createdAt: string;
  expiresAt: number;
  viewers: string[];
  likes?: string[];
}

export interface StoryGroup {
  userId: string;
  userName: string;
  userUsername?: string;
  userPhotoURL?: string;
  stories: Story[];
  hasUnseen: boolean;
}

interface StoriesBarProps {
  onOpenCreate: () => void;
  onViewStory: (group: StoryGroup) => void;
}

export default function StoriesBar({ onOpenCreate, onViewStory }: StoriesBarProps) {
  const { user, userProfile } = useAuthStore();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myGroup, setMyGroup] = useState<StoryGroup | null>(null);
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());

  // 1. Subscribe to Current User's Following List (Privacy Shield)
  useEffect(() => {
    if (!user?.uid) return;

    const followingRef = collection(db, 'users', user.uid, 'following');
    const unsub = onSnapshot(followingRef, (snapshot) => {
      const uids = new Set<string>();
      snapshot.docs.forEach((d) => uids.add(d.id));
      setFollowingUids(uids);
    }, (err) => {
      console.warn("Error subscribing to following list for stories:", err);
    });

    return () => unsub();
  }, [user?.uid]);

  // 2. Real-time listener for active stories
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, 'stories'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const now = Date.now();
      const activeStories: Story[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Story;
        if (data.expiresAt && data.expiresAt > now) {
          activeStories.push({
            ...data,
            id: docSnap.id,
            viewers: Array.isArray(data.viewers) ? data.viewers : []
          });
        }
      });

      // Sort by newest first
      activeStories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Group stories by userId
      const groupsMap = new Map<string, Story[]>();
      activeStories.forEach((s) => {
        const existing = groupsMap.get(s.userId) || [];
        existing.push(s);
        groupsMap.set(s.userId, existing);
      });

      // Split into own group and followed users' groups
      let userOwnGroup: StoryGroup | null = null;
      const otherGroups: StoryGroup[] = [];

      // Check each group
      for (const [uId, stories] of groupsMap.entries()) {
        const first = stories[0];

        if (uId === user.uid) {
          // Current User's own story group
          userOwnGroup = {
            userId: uId,
            userName: userProfile?.name || user.displayName || 'You',
            userUsername: userProfile?.username || 'you',
            userPhotoURL: userProfile?.photoURL || user.photoURL || first.userPhotoURL || '',
            stories,
            hasUnseen: false
          };
        } else if (followingUids.has(uId)) {
          // PRIVACY GUARD: Only include if current user actually follows this person!
          const hasUnseen = stories.some((s) => !s.viewers.includes(user.uid));
          
          // Use latest live user profile details if available
          let livePhoto = first.userPhotoURL || '';
          let liveName = first.userName || 'User';

          try {
            const uDoc = await getDoc(doc(db, 'users', uId));
            if (uDoc.exists()) {
              const uData = uDoc.data();
              if (uData.photoURL) livePhoto = uData.photoURL;
              if (uData.name) liveName = uData.name;
            }
          } catch {}

          otherGroups.push({
            userId: uId,
            userName: liveName,
            userUsername: first.userUsername,
            userPhotoURL: livePhoto,
            stories,
            hasUnseen
          });
        }
      }

      // Sort friends: unseen stories first
      otherGroups.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0));

      setMyGroup(userOwnGroup);
      setStoryGroups(otherGroups);
    });

    return () => unsubscribe();
  }, [user?.uid, followingUids, userProfile]);

  // Current user's avatar (prioritizes edited Firestore photoURL over Google photoURL)
  const myPhoto = userProfile?.photoURL || user?.photoURL;

  return (
    <div className="flex-shrink-0 w-full border-b border-white/[0.08] bg-black/10 backdrop-blur-md px-3 py-2.5 overflow-x-auto no-scrollbar flex items-center gap-3.5">
      
      {/* 1. Current User "Your Story" Item */}
      <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
        <div className="relative">
          {/* Avatar Ring */}
          <div 
            onClick={() => {
              if (myGroup && myGroup.stories.length > 0) {
                onViewStory(myGroup);
              } else {
                onOpenCreate();
              }
            }}
            className={`w-14 h-14 rounded-full p-[2px] transition-transform active:scale-95 ${
              myGroup && myGroup.stories.length > 0
                ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600'
                : 'border-2 border-dashed border-white/25 hover:border-primary/60'
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-surface flex items-center justify-center border border-black/50">
              {myPhoto ? (
                <img src={myPhoto} alt="Your profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={24} className="text-text-secondary" />
              )}
            </div>
          </div>

          {/* Plus Add Button Badge */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCreate();
            }}
            className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-110 active:scale-95 transition-transform"
            title="Add to Story"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>

        <span className="text-[11px] font-medium text-text-secondary mt-1.5 max-w-[62px] truncate text-center">
          {myGroup ? 'Your Story' : 'Add Story'}
        </span>
      </div>

      {/* 2. Friends' Stories (Followed Contacts Only) */}
      {storyGroups.map((group) => (
        <div 
          key={group.userId} 
          onClick={() => onViewStory(group)}
          className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
        >
          <div 
            className={`w-14 h-14 rounded-full p-[2.5px] transition-all duration-200 active:scale-95 ${
              group.hasUnseen
                ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md shadow-rose-500/10'
                : 'border border-white/20'
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-surface flex items-center justify-center border border-black/60">
              {group.userPhotoURL ? (
                <img src={group.userPhotoURL} alt={group.userName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={24} className="text-text-secondary" />
              )}
            </div>
          </div>
          <span className="text-[11px] font-medium text-text mt-1.5 max-w-[62px] truncate text-center">
            {group.userName.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
}
