import { useRef } from 'react';
import type { MediaItem } from '../data/models';
import { cssFilterFor, cssTransformFor, isEdited } from '../features/editor/render';
import { formatDuration } from '../core/utils';
import { Icon } from '../core/icons';

export interface GridProps {
  items: MediaItem[];
  cols: number;
  ratio: 'square' | '4:3' | 'auto';
  selection?: Set<string> | null;
  onOpen?: (index: number) => void;
  onToggle?: (id: string) => void;
  onLongPress?: (id: string) => void;
  gap?: number;
  badge?: (item: MediaItem) => string | null;
}

export function Thumb({ item, ratio }: { item: MediaItem; ratio: GridProps['ratio'] }) {
  const style: React.CSSProperties = {
    aspectRatio: ratio === 'auto' ? `${item.w} / ${item.h}` : ratio === 'square' ? '1 / 1' : '4 / 3',
  };
  const filter = cssFilterFor(item);
  const transform = cssTransformFor(item);
  return (
    <div className="thumb" style={style}>
      <img
        src={item.src}
        alt={item.title}
        loading="lazy"
        decoding="async"
        style={{ filter: filter || undefined, transform: transform || undefined }}
        draggable={false}
      />
      {item.kind === 'video' && (
        <span className="badge video">
          <Icon name="play" size={11} filled /> {formatDuration(item.video?.duration ?? 0)}
        </span>
      )}
      {item.kind === 'screenshot' && <span className="badge corner"><Icon name="scanText" size={12} /></span>}
      {item.locked && <span className="badge corner"><Icon name="lock" size={12} /></span>}
      {isEdited(item) && <span className="badge corner left"><Icon name="wand" size={12} /></span>}
      {item.favorite && <span className="badge fav"><Icon name="heart" size={12} filled /></span>}
    </div>
  );
}

export function PhotoGrid({ items, cols, ratio, selection, onOpen, onToggle, onLongPress, gap = 2, badge }: GridProps) {
  const press = useRef<{ id: string; timer: number; x: number; y: number } | null>(null);
  const selecting = Boolean(selection);

  const startPress = (e: React.PointerEvent, id: string) => {
    if (!onLongPress) return;
    const x = e.clientX, y = e.clientY;
    const timer = window.setTimeout(() => {
      onLongPress(id);
      press.current = null;
      if (navigator.vibrate) navigator.vibrate(12);
    }, 420);
    press.current = { id, timer, x, y };
  };
  const movePress = (e: React.PointerEvent) => {
    if (!press.current) return;
    if (Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 12) {
      clearTimeout(press.current.timer);
      press.current = null;
    }
  };
  const endPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  const handleClick = (index: number, id: string) => {
    if (selecting && onToggle) onToggle(id);
    else onOpen?.(index);
  };

  const gridStyle: React.CSSProperties = ratio === 'auto'
    ? { columnCount: cols, columnGap: gap }
    : { gridTemplateColumns: `repeat(${cols}, 1fr)`, gap };

  return (
    <div className={ratio === 'auto' ? 'photo-grid masonry' : 'photo-grid'} style={gridStyle}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`cell${selection?.has(item.id) ? ' selected' : ''}${selecting ? ' selecting' : ''}`}
          style={ratio === 'auto' ? { breakInside: 'avoid', marginBottom: gap } : undefined}
          onClick={() => handleClick(index, item.id)}
          onPointerDown={(e) => startPress(e, item.id)}
          onPointerMove={movePress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => { e.preventDefault(); onLongPress?.(item.id); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') handleClick(index, item.id); }}
        >
          <Thumb item={item} ratio={ratio} />
          {badge?.(item) && <span className="badge bottom-left">{badge!(item)}</span>}
          {selecting && (
            <span className="check">
              {selection!.has(item.id) ? <Icon name="check" size={14} /> : null}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
