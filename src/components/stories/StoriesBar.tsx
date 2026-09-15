import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
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
  const { user } = useAuthStore();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myGroup, setMyGroup] = useState<StoryGroup | null>(null);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for active stories
    const q = query(collection(db, 'stories'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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

      // Split into own group and other users' groups
      let userOwnGroup: StoryGroup | null = null;
      const otherGroups: StoryGroup[] = [];

      groupsMap.forEach((stories, uId) => {
        const first = stories[0];
        const hasUnseen = stories.some((s) => !s.viewers.includes(user.uid));
        const group: StoryGroup = {
          userId: uId,
          userName: first.userName || 'User',
          userUsername: first.userUsername,
          userPhotoURL: first.userPhotoURL,
          stories,
          hasUnseen
        };

        if (uId === user.uid) {
          userOwnGroup = group;
        } else {
          otherGroups.push(group);
        }
      });

      // Sort friends: unseen stories first
      otherGroups.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0));

      setMyGroup(userOwnGroup);
      setStoryGroups(otherGroups);
    });

    return () => unsubscribe();
  }, [user]);

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
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Your profile" className="w-full h-full object-cover" />
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

      {/* 2. Friends' Stories */}
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
