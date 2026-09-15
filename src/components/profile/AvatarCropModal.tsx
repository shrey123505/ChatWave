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
  const [baseDimensions, setBaseDimensions] = useState<{ width: number; height: number } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });

  const CROP_SIZE = 260; // Generous diameter so full face fits cleanly

  // Auto-scale on image load so the photo fits nicely inside the circle by default
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (!naturalWidth || !naturalHeight) return;

    let initWidth = CROP_SIZE;
    let initHeight = CROP_SIZE;

    // Scale so the smaller dimension fits the circle (cover mode)
    if (naturalWidth < naturalHeight) {
      initWidth = CROP_SIZE;
      initHeight = CROP_SIZE * (naturalHeight / naturalWidth);
    } else {
      initHeight = CROP_SIZE;
      initWidth = CROP_SIZE * (naturalWidth / naturalHeight);
    }

    setBaseDimensions({ width: initWidth, height: initHeight });
  };

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

  // 1:1 Geometric Projection onto 300x300 Canvas
  const handleApplyCrop = async () => {
    const img = imgRef.current;
    if (!img || !baseDimensions) return;

    setIsSaving(true);

    try {
      const OUTPUT_SIZE = 300;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Clip strictly into round circle
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Ratio from screen crop window (260px) to output canvas (300px)
      const ratio = OUTPUT_SIZE / CROP_SIZE;

      // Image dimensions on canvas
      const canvasW = baseDimensions.width * zoom * ratio;
      const canvasH = baseDimensions.height * zoom * ratio;

      // Image center on canvas
      const centerX = (OUTPUT_SIZE / 2) + (offset.x * ratio);
      const centerY = (OUTPUT_SIZE / 2) + (offset.y * ratio);

      // Top-left draw coordinates
      const drawX = centerX - (canvasW / 2);
      const drawY = centerY - (canvasH / 2);

      ctx.drawImage(img, drawX, drawY, canvasW, canvasH);

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      await onSave(croppedBase64);
      onClose();
    } catch (err) {
      console.error("Crop save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-sm rounded-3xl overflow-hidden flex flex-col items-center bg-surface/95 border border-white/20 shadow-2xl">
        
        {/* Header */}
        <div className="w-full p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h3 className="font-bold text-base text-white">Adjust Profile Photo</h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Circular Crop Viewport */}
        <div className="relative w-full h-80 sm:h-84 flex items-center justify-center bg-black/70 overflow-hidden cursor-move touch-none">
          {/* Draggable & Scalable Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop Preview"
            onLoad={handleImageLoad}
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              width: baseDimensions ? `${baseDimensions.width}px` : 'auto',
              height: baseDimensions ? `${baseDimensions.height}px` : 'auto',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDraggingRef.current ? 'none' : 'transform 0.08s ease-out',
              maxWidth: 'none',
              maxHeight: 'none'
            }}
            className="pointer-events-auto select-none opacity-95 hover:opacity-100"
          />

          {/* Darkened Vignette Overlay with Center Hole */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle ${CROP_SIZE / 2}px at center, transparent ${CROP_SIZE / 2 - 2}px, rgba(0, 0, 0, 0.78) ${CROP_SIZE / 2}px)`
            }}
          />

          {/* Crisp Circular Frame Guide */}
          <div 
            className="absolute pointer-events-none rounded-full border-2 border-emerald-400/90 shadow-2xl ring-4 ring-black/50 flex items-center justify-center"
            style={{ width: `${CROP_SIZE}px`, height: `${CROP_SIZE}px` }}
          >
            {/* Subtle center alignment mark */}
            <div className="w-2 h-2 rounded-full bg-emerald-400/30"></div>
          </div>
        </div>

        {/* Controls & Zoom Slider */}
        <div className="w-full p-4 sm:p-5 space-y-3.5 bg-black/30 border-t border-white/10">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.2).toFixed(2)))}
              className="text-text-secondary hover:text-white p-1"
              title="Zoom out"
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
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <button 
              type="button" 
              onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.2).toFixed(2)))}
              className="text-text-secondary hover:text-white p-1"
              title="Zoom in"
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
            Drag photo to frame your face • Slider to zoom
          </p>

          {/* Action Buttons */}
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
              disabled={isSaving || !baseDimensions}
              className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-98 shadow-lg transition-all disabled:opacity-50"
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
