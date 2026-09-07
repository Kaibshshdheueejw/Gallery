import { useMemo, useState } from 'react';
import { openViewer, pushRecentSearch, useApp } from '../../store';
import { smartSearch, EXAMPLE_QUERIES } from '../../domain/usecases/smartSearch';
import { faceClusters, places } from '../../domain/usecases/library';
import { PhotoGrid } from '../../components/PhotoGrid';
import { SelectionBar } from '../../components/SelectionBar';
import { useSelection } from '../../components/useSelection';
import { Chip, EmptyState, SectionTitle } from '../../components/ui';
import { Icon } from '../../core/icons';
import { translate } from '../../core/i18n';

export function SearchScreen() {
  const app = useApp();
  const { settings, items } = app;
  const t = (k: string) => translate(settings.lang, k);
  const [query, setQuery] = useState('');
  const selection = useSelection();

  const result = useMemo(() => smartSearch(query, items, app.faceNames), [query, items, app.faceNames]);
  const clusters = useMemo(() => faceClusters(items, app.faceNames), [items, app.faceNames]);
  const locs = useMemo(() => places(items), [items]);

  const append = (token: string) => setQuery((q) => (q ? `${q} ${token}` : token));

  return (
    <div className="screen">
      <header className="app-bar">
        <div className="search-field grow">
          <Icon name="search" size={19} />
          <input
            value={query}
            placeholder={t('search_hint')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) pushRecentSearch(query.trim()); }}
          />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Clear">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="scroll-area padded">
        {!query ? (
          <>
            {app.recentSearches.length > 0 && (
              <>
                <SectionTitle>Recent</SectionTitle>
                <div className="chip-row">
                  {app.recentSearches.map((q) => (
                    <Chip key={q} icon="history" label={q} onClick={() => setQuery(q)} />
                  ))}
                </div>
              </>
            )}
            <SectionTitle>Try natural language</SectionTitle>
            <div className="chip-row">
              {EXAMPLE_QUERIES.map((q) => <Chip key={q} icon="sparkle" label={q} onClick={() => setQuery(q)} />)}
            </div>
            {clusters.length > 0 && (
              <>
                <SectionTitle>{t('albums_people')}</SectionTitle>
                <div className="chip-row">
                  {clusters.map((c) => <Chip key={c.id} icon="person" label={c.name} onClick={() => append(c.name)} />)}
                </div>
              </>
            )}
            {locs.length > 0 && (
              <>
                <SectionTitle>{t('albums_places')}</SectionTitle>
                <div className="chip-row">
                  {locs.map((p) => <Chip key={p.id} icon="mapPin" label={p.id} onClick={() => append(p.id)} />)}
                </div>
              </>
            )}
            <SectionTitle>Things &amp; text</SectionTitle>
            <div className="chip-row">
              {['sunset', 'beach', 'food', 'cat', 'dog', 'flower', 'waterfall', 'night', 'diwali', 'invoice', 'blurry', 'duplicate', 'screenshot'].map((tag) => (
                <Chip key={tag} icon="tag" label={tag} onClick={() => append(tag)} />
              ))}
            </div>
            <p className="search-note"><Icon name="shield" size={14} /> {t('on_device')} — queries, OCR text and face names never leave this device.</p>
          </>
        ) : result.items.length === 0 ? (
          <EmptyState icon="search" title="No matches" hint={t('search_smart')} />
        ) : (
          <>
            <div className="intent-bar">
              <Icon name="sparkle" size={15} />
              <span>
                {result.intents.length
                  ? result.intents.map((i) => `${i.kind}: ${i.label}`).join(' · ')
                  : `text: ${query}`}
              </span>
              <em>{result.items.length}</em>
            </div>
            <PhotoGrid
              items={result.items}
              cols={4}
              ratio={settings.thumbRatio}
              selection={selection.active ? selection.selection : null}
              onOpen={(idx) => openViewer(result.items.map((i) => i.id), idx)}
              onToggle={selection.toggle}
              onLongPress={selection.enter}
            />
          </>
        )}
        <div className="scroll-pad" />
      </div>
      {selection.active && <SelectionBar selection={selection} />}
    </div>
  );
}
