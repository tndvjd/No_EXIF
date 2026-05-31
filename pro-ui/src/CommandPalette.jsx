import React, { useEffect, useRef, useState } from 'react';
import { Command, Search } from 'lucide-react';
import { gsap } from 'gsap';

function clampIndex(index, length) {
  if (!length) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

export function CommandPalette({
  open,
  query,
  actions,
  selectedIndex,
  onQueryChange,
  onSelectedIndexChange,
  onRun,
  onClose,
}) {
  const [rendered, setRendered] = useState(open);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const inputRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      setRendered(true);
    }
  }, [open]);

  useEffect(() => {
    if (!rendered) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      gsap.killTweensOf([backdropRef.current, panelRef.current]);

      if (open) {
        if (reduceMotion) {
          gsap.set([backdropRef.current, panelRef.current], { autoAlpha: 1, y: 0, scale: 1 });
          return;
        }
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .fromTo(backdropRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.16 })
          .fromTo(
            panelRef.current,
            { autoAlpha: 0, y: -8, scale: 0.985 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.24 },
            '<',
          );
        return;
      }

      if (reduceMotion) {
        setRendered(false);
        return;
      }
      gsap.timeline({ defaults: { ease: 'power2.in' }, onComplete: () => setRendered(false) })
        .to(panelRef.current, { autoAlpha: 0, y: -6, scale: 0.985, duration: 0.12 })
        .to(backdropRef.current, { autoAlpha: 0, duration: 0.1 }, '<');
    }, rootRef);

    return () => ctx.revert();
  }, [open, rendered]);

  useEffect(() => {
    if (!open || !rendered) return undefined;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, rendered]);

  useEffect(() => {
    if (open || rendered) return;
    const previous = previousFocusRef.current;
    if (previous && typeof previous.focus === 'function') previous.focus();
  }, [open, rendered]);

  if (!rendered) return null;

  const currentAction = actions[selectedIndex] || null;

  function requestRun(action) {
    if (!action || action.disabled) return;
    onRun(action);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onSelectedIndexChange(clampIndex(selectedIndex + 1, actions.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onSelectedIndexChange(clampIndex(selectedIndex - 1, actions.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      requestRun(currentAction);
      return;
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(panelRef.current?.querySelectorAll('input, button:not(:disabled)') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const activeDescendant = currentAction ? `command-option-${currentAction.id}` : undefined;

  return (
    <div className="command-palette-root" ref={rootRef} onKeyDown={handleKeyDown}>
      <button className="command-palette-backdrop" ref={backdropRef} type="button" onClick={onClose} aria-label="명령 팔레트 닫기" />
      <section
        className="command-palette-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="command-palette-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            placeholder="명령 검색"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-expanded="true"
            aria-activedescendant={activeDescendant}
            onChange={event => onQueryChange(event.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-list" id="command-palette-list" role="listbox" aria-label="명령 목록">
          {actions.length ? actions.map((action, index) => (
            <button
              key={action.id}
              id={`command-option-${action.id}`}
              className={`command-row${index === selectedIndex ? ' is-selected' : ''}${action.disabled ? ' is-disabled' : ''}`}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              disabled={action.disabled}
              onMouseEnter={() => onSelectedIndexChange(index)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => requestRun(action)}
            >
              <span className="command-row-icon"><Command size={17} /></span>
              <span className="command-row-copy">
                <strong>{action.title}</strong>
                <small>{action.disabled ? action.disabledReason : action.helper}</small>
              </span>
              <span className="command-row-scope">{action.scope}</span>
            </button>
          )) : (
            <div className="command-empty">
              <strong>일치하는 명령 없음</strong>
              <span>이미지, EXIF, metadata, Pixiv 같은 작업명으로 다시 검색하세요.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
