/**
 * MemorySlideshow — fullscreen auto-advancing playback of a memory collection
 * (shared by the Memories screen and For You stories).
 */
import { useEffect, useState } from 'react';
import { ProgressBar } from '../../components/ui';
import { formatMonthYear } from '../../core/utils';
import type { MediaItem } from '../../data/models';

export function MemorySlideshow({ items, onClose }: { items: MediaItem[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 2600);
    return () => clearInterval(id);
  }, [items.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="slideshow" onPointerDown={onClose}>
      {items.map((item, i) => (
        <div key={item.id} className={`slide${i === index ? ' on' : ''}`}>
          <img src={item.src} alt={item.title} />
        </div>
      ))}
      <div className="slide-hud">
        <strong>{items[0]?.event ?? 'Memory'}</strong>
        <span>{formatMonthYear(items[0]?.takenAt ?? Date.now())} · {index + 1}/{items.length}</span>
        <ProgressBar value={(index + 1) / items.length} />
      </div>
    </div>
  );
}

/** intelligent aspect: landscape → 16/10, portrait → 4/5, else 1/1 */
export function memAspect(item: MediaItem | undefined): string {
  if (!item) return '16 / 10';
  const ar = item.w / item.h;
  if (ar > 1.15) return '16 / 10';
  if (ar < 0.9) return '4 / 5';
  return '1 / 1';
}
