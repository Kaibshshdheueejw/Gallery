/**
 * For You — pure content discovery (§1). No header, no cleanup, no storage,
 * no people (those live in Settings → Storage & Cleanup and Albums).
 * Sections: Stories, Memories, On this day, Recently added, Featured moments,
 * Smart suggestions — each individually toggleable in Settings.
 */
import { useEffect, useMemo, useState } from 'react';
import { navigate, openViewer, requestSearch, requestSelect, rescanLibrary, setTab, useApp } from '../../store';
import { events, faceClusters, onThisDay, visibleItems } from '../../domain/usecases/library';
import { MemorySlideshow } from '../memories/MemorySlideshow';
import { Thumb } from '../../components/PhotoGrid';
import { ScreenMenu } from '../../components/ScreenMenu';
import { ProgressBar, SectionTitle } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';
import { formatMonthYear, relativeTime } from '../../core/utils';
import type { MediaItem } from '../../data/models';

/** honest, statistics-only "featured" score: sharp + well-exposed + interesting metadata */
function featureScore(i: MediaItem): number {
  const v = i.vision;
  if (!v) return 0;
  const sharp = Math.min(1, v.blur / 220);
  const exposure = 1 - Math.abs(v.brightness - 0.52) * 1.6;
  const meta = (i.place ? 0.18 : 0) + (i.event ? 0.14 : 0) + (i.favorite ? 0.1 : 0) + ((i.personIds?.length ?? 0) > 0 ? 0.08 : 0);
  return sharp * 0.5 + Math.max(0, exposure) * 0.32 + meta;
}

export function ForYouScreen() {
  const app = useApp();
  const { settings, items, report } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [playing, setPlaying] = useState<MediaItem[] | null>(null);
  const fy = settings.foryou;

  const vis = useMemo(() => visibleItems(items), [items]);
  const otd = useMemo(() => onThisDay(items), [items]);
  const stories = useMemo(() => {
    const cutoff = Date.now() - 21 * 86_400_000;
    return events(items)
      .filter((e) => e.items.length >= 3 && e.items[0].takenAt >= cutoff)
      .slice(0, 8);
  }, [items]);
  const recent = useMemo(() => [...vis].sort((a, b) => b.takenAt - a.takenAt).slice(0, 16), [vis]);
  const featured = useMemo(() => {
    // one per event/place where possible so the row stays varied
    const ranked = [...vis].filter((i) => i.kind === 'photo').sort((a, b) => featureScore(b) - featureScore(a));
    const seen = new Set<string>();
    const out: MediaItem[] = [];
    for (const i of ranked) {
      const key = i.event ?? i.place ?? i.folder;
      if (seen.has(key) && out.length < ranked.length - 1) continue;
      seen.add(key);
      out.push(i);
      if (out.length >= 4) break;
    }
    return out;
  }, [vis]);

  const suggestions = useMemo(() => {
    const out: Array<{ id: string; icon: string; label: string; desc: string; go: () => void }> = [];
    const dupGroups = report?.duplicates ?? [];
    if (settings.ai.duplicates && dupGroups.length) {
      out.push({
        id: 'dups', icon: 'copy', label: `${dupGroups.length} duplicate group${dupGroups.length > 1 ? 's' : ''}`,
        desc: 'Review & free space in Storage', go: () => navigate({ name: 'settings', page: 'cleanup' }),
      });
    }
    const blurry = vis.filter((i) => i.vision?.tags.includes('blurry'));
    if (settings.ai.blur && blurry.length) {
      out.push({ id: 'blur', icon: 'eye', label: `${blurry.length} blurry shot${blurry.length > 1 ? 's' : ''}`, desc: 'Flagged by the sharpness model', go: () => navigate({ name: 'album', album: { type: 'smart', id: 'blurry', title: t('blurry') } }) });
    }
    const clusters = settings.ai.faces ? faceClusters(items, app.faceNames) : [];
    const unnamed = clusters.filter((c) => !app.faceNames[c.id]);
    if (unnamed.length) {
      out.push({ id: 'people', icon: 'person', label: `${unnamed.length} people to name`, desc: 'Naming unlocks people search', go: () => setTab('albums') });
    }
    // tag-based discovery from the on-device scene tags
    const tagCount = new Map<string, number>();
    for (const i of vis) for (const tag of i.vision?.tags ?? []) {
      if (!['blurry', 'duplicate', 'video', 'screenshot', 'text', 'document'].includes(tag)) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
    const topTag = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topTag && topTag[1] >= 3) {
      out.push({ id: `tag-${topTag[0]}`, icon: 'search', label: `More “${topTag[0]}” moments`, desc: `${topTag[1]} photos match this scene`, go: () => { requestSearch(topTag[0]); setTab('search'); } });
    }
    out.push({ id: 'collage', icon: 'collage', label: 'Create a collage', desc: 'Pick photos in Timeline → Collage', go: () => { requestSelect(); setTab('timeline'); } });
    return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, vis, items, app.faceNames, settings.ai]);

  if (app.status !== 'ready') {
    return (
      <div className="screen center-col">
        <Icon name="sparkle" size={42} className="spin-slow" />
        <h2 style={{ fontSize: 17, fontWeight: 650 }}>{t('processing')}</h2>
        <ProgressBar value={app.scan.total ? app.scan.done / app.scan.total : 0} />
        <span className="muted">{app.scan.done}/{app.scan.total} · {t('on_device')}</span>
      </div>
    );
  }

  const menuItems = [
    { icon: 'settings', label: t('settings'), onClick: () => navigate({ name: 'settings' }) },
    { icon: 'storage', label: 'Storage & Cleanup', onClick: () => navigate({ name: 'settings', page: 'cleanup' }) },
    { icon: 'trash', label: t('trash'), onClick: () => navigate({ name: 'trash' }) },
    { icon: 'refresh', label: 'Refresh library', hint: 're-run the on-device scan', onClick: () => { rescanLibrary(); } },
  ];

  return (
    <div className="screen foryou-screen">
      <div className="foryou-menu"><ScreenMenu items={menuItems} /></div>

      <div className="scroll-area padded">
        <div className="scroll-pad small" />

        {fy.stories && stories.length > 0 && (
          <>
            <SectionTitle>Stories</SectionTitle>
            <div className="rail stories-rail">
              {stories.map((s) => (
                <button key={s.id} type="button" className="story-card pressable" onClick={() => setPlaying(s.items)}>
                  <span className="story-ring">
                    <span className="story-media"><Thumb item={s.items[0]} ratio="square" /></span>
                  </span>
                  <strong>{s.id}</strong>
                  <em>{s.items.length} items · {relativeTime(s.items[0].takenAt)}</em>
                </button>
              ))}
            </div>
          </>
        )}

        {fy.onThisDay && otd.length > 0 && (
          <>
            <SectionTitle>{t('on_this_day')}</SectionTitle>
            <div className="rail">
              {otd.map((i, idx) => (
                <button key={i.id} type="button" className="strip-card pressable" onClick={() => openViewer(otd.map((x) => x.id), idx)}>
                  <Thumb item={i} ratio="square" />
                  <em>{new Date(i.takenAt).getFullYear()}</em>
                </button>
              ))}
            </div>
          </>
        )}

        {fy.recently && recent.length > 0 && (
          <>
            <SectionTitle action={<button type="button" className="text-btn" onClick={() => setTab('timeline')}>See all <Icon name="chevronRight" size={14} /></button>}>
              Recently added
            </SectionTitle>
            <div className="rail">
              {recent.map((i, idx) => (
                <button key={i.id} type="button" className="strip-card pressable" onClick={() => openViewer(recent.map((x) => x.id), idx)}>
                  <Thumb item={i} ratio="square" />
                  <em>{relativeTime(i.takenAt)}</em>
                </button>
              ))}
            </div>
          </>
        )}

        {fy.featured && featured.length > 0 && (
          <>
            <SectionTitle>Featured moments</SectionTitle>
            <div className="featured-grid">
              {featured.map((f, idx) => (
                <button key={f.id} type="button" className="featured-card pressable" onClick={() => openViewer([f.id], 0)} style={{ animationDelay: `${idx * 45}ms` }}>
                  <img src={f.thumb ?? f.src} alt={f.title} loading="lazy" decoding="async" />
                  <span className="feat-scrim" />
                  <span className="feat-txt">
                    <strong>{f.event ?? f.place ?? 'Highlight'}</strong>
                    <em>{f.place ?? formatMonthYear(f.takenAt)} · sharpest & best-exposed</em>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {fy.suggestions && suggestions.length > 0 && (
          <>
            <SectionTitle>Smart suggestions</SectionTitle>
            <div className="card-list">
              {suggestions.map((s) => (
                <button key={s.id} type="button" className="info-card glass glass-subtle pressable-row suggest-card" onClick={s.go}>
                  <span className="card-icon"><Icon name={s.icon} size={20} /></span>
                  <span className="grow">
                    <strong>{s.label}</strong>
                    <em>{s.desc}</em>
                  </span>
                  <Icon name="chevronRight" size={16} className="chev" />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="privacy-note">
          <Icon name="shield" size={16} />
          <span>
            {report ? `${t('scanned').replace('{n}', String(report.items))} · ${t('faces_found').replace('{n}', String(report.faces))} · ${t('ocr_docs').replace('{n}', String(report.ocrDocs))} in ${Math.round(report.ms)} ms` : ''}
            {' '}— all {t('on_device').toLowerCase()}.
          </span>
        </div>
        <div className="scroll-pad" />
      </div>

      {playing && <MemorySlideshow items={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
