import { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Image as ImageIcon, Send, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CreateStoryModalProps {
  onClose: () => void;
}

export default function CreateStoryModal({ onClose }: CreateStoryModalProps) {
  const { user } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress and load image via Canvas
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1080;
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setSelectedImage(compressed);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Story to Firestore
  const handleShareStory = async () => {
    if (!user || !selectedImage || uploading) return;

    setUploading(true);
    const toastId = toast.loading('Sharing your story...');

    try {
      const now = Date.now();
      const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours from now

      await addDoc(collection(db, 'stories'), {
        userId: user.uid,
        userName: user.displayName || 'User',
        userUsername: (user as any).username || user.displayName || 'user',
        userPhotoURL: user.photoURL || '',
        mediaUrl: selectedImage,
        caption: caption.trim(),
        createdAt: new Date().toISOString(),
        expiresAt,
        viewers: []
      });

      toast.success('Story shared!', { id: toastId });
      onClose();
    } catch (err: any) {
      console.error("Failed to share story:", err);
      toast.error('Failed to share story: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col border border-white/10 bg-surface/95 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <h3 className="font-semibold text-lg text-text">Create Story</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Story Content Area */}
        <div className="p-5 flex flex-col items-center">
          {selectedImage ? (
            <div className="relative w-full aspect-[9/16] max-h-[440px] rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-lg border border-white/10">
              <img 
                src={selectedImage} 
                alt="Story Preview" 
                className="w-full h-full object-contain"
              />
              {/* Caption Overlay Preview */}
              {caption.trim() && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md text-white text-sm px-3.5 py-2 rounded-xl text-center border border-white/10 shadow-lg">
                  {caption}
                </div>
              )}
              {/* Change Image Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/20 transition-colors"
              >
                Change Photo
              </button>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[9/16] max-h-[380px] rounded-xl border-2 border-dashed border-white/20 hover:border-primary/60 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ImageIcon size={32} />
              </div>
              <div className="text-center">
                <p className="font-medium text-text text-sm">Select a photo for your story</p>
                <p className="text-xs text-text-secondary mt-1">Photos will disappear after 24 hours</p>
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />

          {/* Caption Input */}
          {selectedImage && (
            <div className="w-full mt-4">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 120))}
                placeholder="Add a caption... (optional)"
                maxLength={120}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
              />
              <div className="flex justify-between items-center text-[11px] text-text-secondary mt-1 px-1">
                <span>Disappears in 24 hours</span>
                <span>{caption.length}/120</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-xl hover:bg-white/10 text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShareStory}
            disabled={!selectedImage || uploading}
            className="px-5 py-2 text-sm rounded-xl bg-primary text-white font-medium hover:bg-primary/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Send size={15} />
                Share to Story
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
