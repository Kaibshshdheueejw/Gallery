/**
 * Memories — its own dedicated screen (moved out of For You). Reached from
 * the Timeline hamburger menu. Lists every memory collection (events with
 * 3+ items) newest-first as hero cards; tap opens the viewer, the play
 * button runs the fullscreen slideshow.
 */
import { useMemo, useState } from 'react';
import { navigate, openViewer, useApp } from '../../store';
import { memories } from '../../domain/usecases/library';
import { MemorySlideshow, memAspect } from './MemorySlideshow';
import { SectionTitle } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatMonthYear, relativeTime } from '../../core/utils';
import type { MediaItem } from '../../data/models';

export function MemoriesScreen() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [playing, setPlaying] = useState<MediaItem[] | null>(null);
  const mems = useMemo(() => memories(items), [items]);

  const back = () => navigate({ name: 'tabs' });

  return (
    <div className="screen slide-in">
      <header className="page-head with-back">
        <button type="button" className="back-btn glass glass-subtle" onClick={back} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="grow">
          <h1>{t('memories')}</h1>
          <span className="sub">{mems.length} collection{mems.length === 1 ? '' : 's'} · curated on-device</span>
        </div>
      </header>

      <div className="scroll-area padded">
        {mems.length === 0 ? (
          <p className="hint">No memories yet — collections appear once an event has three or more photos.</p>
        ) : (
          <>
            <SectionTitle>{t('memories')}</SectionTitle>
            <div className="mem-grid">
              {mems.map((m, idx) => (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  className="mem-card pressable"
                  style={{ aspectRatio: memAspect(m.items[0]), animationDelay: `${Math.min(idx, 12) * 40}ms` }}
                  onClick={() => openViewer(m.items.map((i) => i.id), 0)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openViewer(m.items.map((i) => i.id), 0); }}
                >
                  <span className="mem-media">{m.items[0] && <img src={m.items[0].src} alt={m.id} loading="lazy" decoding="async" />}</span>
                  <span className="mem-scrim" />
                  <span className="mem-badge">{t('memories')}</span>
                  <span className="mem-glass">
                    <span className="mem-txt">
                      <strong>{m.id}</strong>
                      <em>{formatMonthYear(m.at)} · {m.items.length} items · {relativeTime(m.at)}</em>
                    </span>
                    <button type="button" className="mem-play" aria-label="Play memory" onClick={(e) => { e.stopPropagation(); setPlaying(m.items); }}>
                      <Icon name="play" size={14} filled />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="scroll-pad" />
      </div>

      {playing && <MemorySlideshow items={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
