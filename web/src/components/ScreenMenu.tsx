/**
 * ScreenMenu — the top-right hamburger (§6). Replaces the old storage-icon +
 * gear pair on every tab: a single three-line glass button that opens the
 * Liquid Glass popup (scale/fade/slide-in, backdrop blur, outside-tap and
 * Escape close). Settings is always the first, most prominent entry.
 */
import { GlassPopupMenu, usePopupAnchor, type PopupMenuItem } from './GlassPopupMenu';
import { Icon } from '../core/icons';

export function ScreenMenu({ items, title, label = 'Menu' }: { items: PopupMenuItem[]; title?: string; label?: string }) {
  const menu = usePopupAnchor();
  return (
    <>
      <button
        ref={menu.btnRef}
        type="button"
        className={`icon-btn screen-menu-btn${menu.open ? ' open' : ''}`}
        aria-label={label}
        aria-expanded={menu.open}
        onClick={menu.toggle}
      >
        <span className="burger">
          <Icon name="menu" size={21} />
        </span>
      </button>
      {menu.open && <GlassPopupMenu items={items} anchorRect={menu.rect} onClose={menu.close} title={title} />}
    </>
  );
}
