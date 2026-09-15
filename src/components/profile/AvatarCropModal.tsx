import { useState, useRef } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function AvatarCropModal({
  imageSrc,
  onClose,
  onSave
}: {
  imageSrc: string;
  onClose: () => void;
  onSave: (croppedBase64: string) => Promise<void>;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });

  const CROP_SIZE = 240; // Diameter of circular crop window

  // Pointer Down (Mouse or Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move (Drag)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: startOffsetRef.current.x + dx,
      y: startOffsetRef.current.y + dy
    });
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Reset Position & Zoom
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Export cropped circle to 256x256 Base64 JPEG
  const handleApplyCrop = async () => {
    const img = imgRef.current;
    if (!img) return;

    setIsSaving(true);

    try {
      const canvas = document.createElement('canvas');
      const OUTPUT_SIZE = 256;
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Enable smooth image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Circular clip path so only round circle is exported
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Compute scaling from screen preview to canvas
      const displayedWidth = img.width;
      const displayedHeight = img.height;

      // Ratio of natural image to displayed image
      const scaleX = img.naturalWidth / displayedWidth;
      const scaleY = img.naturalHeight / displayedHeight;

      // Crop box on the displayed image (relative to image center)
      const previewCenterImgX = displayedWidth / 2 - offset.x;
      const previewCenterImgY = displayedHeight / 2 - offset.y;

      const cropWidthOnImg = (CROP_SIZE / zoom) * scaleX;
      const cropHeightOnImg = (CROP_SIZE / zoom) * scaleY;

      const sx = (previewCenterImgX * scaleX) - (cropWidthOnImg / 2);
      const sy = (previewCenterImgY * scaleY) - (cropHeightOnImg / 2);

      ctx.drawImage(
        img,
        sx,
        sy,
        cropWidthOnImg,
        cropHeightOnImg,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      await onSave(croppedBase64);
      onClose();
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-sm rounded-3xl overflow-hidden flex flex-col items-center bg-surface/95 border border-white/20 shadow-2xl">
        
        {/* Header */}
        <div className="w-full p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h3 className="font-bold text-base text-white">Crop Profile Photo</h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Circular Crop Viewport */}
        <div className="relative w-full h-72 sm:h-80 flex items-center justify-center bg-black/60 overflow-hidden cursor-move touch-none">
          {/* Draggable Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop Preview"
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDraggingRef.current ? 'none' : 'transform 0.08s ease-out'
            }}
            className="max-w-none max-h-none select-none pointer-events-auto"
          />

          {/* Dark Overlay with Circular Cutout */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle 120px at center, transparent 118px, rgba(0, 0, 0, 0.75) 120px)'
            }}
          />

          {/* Circular Frame Border Guide */}
          <div 
            className="absolute pointer-events-none rounded-full border-2 border-primary shadow-2xl ring-4 ring-black/40"
            style={{ width: `${CROP_SIZE}px`, height: `${CROP_SIZE}px` }}
          />
        </div>

        {/* Controls & Zoom Slider */}
        <div className="w-full p-5 space-y-4 bg-black/30 border-t border-white/10">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
              className="text-text-secondary hover:text-white p-1"
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <button 
              type="button" 
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
              className="text-text-secondary hover:text-white p-1"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-text-secondary hover:text-white transition-colors ml-1"
              title="Reset Position"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <p className="text-[11px] text-center text-text-secondary">
            Drag image to adjust position • Pinch or slider to zoom
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-semibold text-text-secondary hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 shadow-lg transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check size={18} />
                  Set Profile Picture
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
