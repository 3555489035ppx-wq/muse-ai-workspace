import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, ChevronDown, Info, LoaderCircle, Search, X } from 'lucide-react';
import { useMuseStore } from '../stores/useMuseStore';

/** @param {{ children: React.ReactNode; className?: string; variant?: string; loading?: boolean; icon?: React.ElementType | null } & Record<string, any>} props */
export function Button({ children, className = '', variant = 'default', loading = false, icon: Icon = undefined, ...props }) {
  const resolvedVariant = { default: 'primary', quiet: 'secondary' }[variant] ?? variant;
  return <button type={props.type ?? 'button'} className={`button button--${variant} button--${resolvedVariant} ${className}`} disabled={loading || props.disabled} aria-busy={loading || undefined} data-loading={loading || undefined} {...props}>
    {loading ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : Icon ? <Icon aria-hidden="true" size={16} /> : null}
    <span>{children}</span>
  </button>;
}

export function IconButton({ label, children, className = '', selected = undefined, ...props }) {
  const inferredSelected = selected ?? (className.includes('is-active') ? true : undefined);
  return <button type={props.type ?? 'button'} aria-label={label} aria-pressed={inferredSelected} title={label} className={`icon-button ${className}`} {...props}>{children}</button>;
}

export function handleSearchKeyDown(event, value, onChange) {
  if (event.key === 'Escape' && value) {
    event.preventDefault();
    onChange({ target: { value: '' } });
    return 'clear';
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    return 'prevent-submit';
  }
  return 'ignore';
}

export function SearchInput({
  label,
  value,
  onChange,
  placeholder,
  resultCount,
  loading = false,
  className = '',
}) {
  let status = '';
  if (loading) status = '正在搜索';
  else if (typeof resultCount === 'number') status = value.trim() ? `找到 ${resultCount} 条结果` : `共 ${resultCount} 条结果`;
  return <div className={`search-input liquid-glass-control ${className}`} role="search">
    <Search aria-hidden="true" size={16} />
    <input
      aria-label={label}
      value={value}
      onChange={onChange}
      onKeyDown={(event) => handleSearchKeyDown(event, value, onChange)}
      placeholder={placeholder}
    />
    {loading ? <LoaderCircle aria-hidden="true" className="spin" size={15} /> : value ? <button type="button" aria-label={`清除${label}`} onClick={() => onChange({ target: { value: '' } })}><X aria-hidden="true" size={15} /></button> : null}
    {status ? <span className="visually-hidden" role="status">{status}</span> : null}
  </div>;
}

export function nextEnabledOptionIndex(options, current, direction) {
  if (!options.length) return -1;
  const enabled = options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled);
  if (!enabled.length) return -1;
  if (direction === 'first') return enabled[0].index;
  if (direction === 'last') return enabled[enabled.length - 1].index;
  const currentPosition = enabled.findIndex(({ index }) => index === current);
  if (direction === 'previous') return enabled[(currentPosition <= 0 ? enabled.length : currentPosition) - 1].index;
  return enabled[(currentPosition + 1 + enabled.length) % enabled.length].index;
}

export function CustomSelect({ label, value, options, onChange, disabled = false, className = '' }) {
  const listId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 220 });
  const selected = options[selectedIndex] ?? options[0];
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const openMenu = (index = selectedIndex) => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = Math.min(320, options.length * 44 + 8);
      const roomBelow = window.innerHeight - rect.bottom;
      const top = roomBelow >= estimatedHeight ? rect.bottom + 6 : Math.max(8, rect.top - estimatedHeight - 6);
      setPosition({
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - Math.max(rect.width, 220) - 8)),
        top,
        width: Math.max(rect.width, 220),
      });
    }
    setActiveIndex(index);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.setTimeout(() => menuRef.current?.querySelector(`[data-option-index="${activeIndex}"]`)?.focus(), 0);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [activeIndex, open]);
  const select = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };
  const move = (direction) => {
    const next = nextEnabledOptionIndex(options, activeIndex, direction);
    if (next < 0) return;
    setActiveIndex(next);
    window.setTimeout(() => menuRef.current?.querySelector(`[data-option-index="${next}"]`)?.focus(), 0);
  };
  const onTriggerKeyDown = (event) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 'previous' : event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : 'next';
      openMenu(nextEnabledOptionIndex(options, selectedIndex, direction));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open ? close() : openMenu();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };
  const menu = open ? createPortal(<div
    ref={menuRef}
    id={listId}
    className="select-menu"
    role="listbox"
    aria-label={label}
    style={{ left: position.left, top: position.top, width: position.width }}
    onKeyDown={(event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); move('next'); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move('previous'); }
      else if (event.key === 'Home') { event.preventDefault(); move('first'); }
      else if (event.key === 'End') { event.preventDefault(); move('last'); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(activeIndex); }
      else if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'Tab') close(false);
    }}
  >
    {options.map((option, index) => <button
      type="button"
      id={`${listId}-option-${index}`}
      className={index === activeIndex ? 'is-active' : ''}
      data-option-index={index}
      key={option.value}
      role="option"
      aria-selected={option.value === value}
      disabled={option.disabled}
      onClick={() => select(index)}
    >{option.label}</button>)}
  </div>, document.body) : null;
  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`custom-select liquid-glass-control ${className}`}
      role="combobox"
      aria-controls={listId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={label}
      aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
      disabled={disabled}
      onClick={() => (open ? close() : openMenu())}
      onKeyDown={onTriggerKeyDown}
    ><span>{selected?.label ?? '请选择'}</span><ChevronDown aria-hidden="true" size={16} /></button>
    {menu}
  </>;
}

export function nextInteractiveIndex(items, current, direction) {
  if (!items.length) return -1;
  const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled);
  if (!enabled.length) return -1;
  const currentPosition = enabled.findIndex(({ index }) => index === current);
  const delta = direction === 'previous' ? -1 : 1;
  return enabled[(currentPosition + delta + enabled.length) % enabled.length].index;
}

function ChoiceGroup({ label, value, onChange, items, variant }) {
  const refs = useRef([]);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const activate = (index) => {
    const item = items[index];
    if (!item || item.disabled) return;
    onChange(item.value);
  };
  const onKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'Home') next = items.findIndex((item) => !item.disabled);
    else if (event.key === 'End') next = items.findLastIndex((item) => !item.disabled);
    else next = nextInteractiveIndex(items, index, ['ArrowLeft', 'ArrowUp'].includes(event.key) ? 'previous' : 'next');
    if (next < 0) return;
    refs.current[next]?.focus();
    activate(next);
  };
  const isTabs = variant === 'tabs';
  return <div className={`choice-group choice-group--${variant}`} role={isTabs ? 'tablist' : 'group'} aria-label={label}>
    {items.map((item, index) => <button
      key={item.value}
      ref={(node) => { refs.current[index] = node; }}
      type="button"
      role={isTabs ? 'tab' : undefined}
      aria-selected={isTabs ? item.value === value : undefined}
      aria-pressed={!isTabs ? item.value === value : undefined}
      aria-controls={isTabs ? item.panelId : undefined}
      tabIndex={index === selectedIndex ? 0 : -1}
      disabled={item.disabled}
      className={item.value === value ? 'is-selected' : ''}
      onClick={() => activate(index)}
      onKeyDown={(event) => onKeyDown(event, index)}
    >{item.label}</button>)}
  </div>;
}

export function Tabs(props) {
  return <ChoiceGroup {...props} variant="tabs" />;
}

export function SegmentedControl(props) {
  return <ChoiceGroup {...props} variant="segmented" />;
}

/** @param {{ label: React.ReactNode; hint?: string; error?: string; children: React.ReactNode | ((id: string) => React.ReactNode); id?: string }} props */
export function Field({ label, hint = undefined, error = undefined, children, id: providedId = undefined }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const child = typeof children === 'function' ? children(id) : children;
  const control = React.isValidElement(child) && ['input', 'textarea', 'select'].includes(child.type)
    ? React.cloneElement(child, {
      id: child.props.id ?? id,
      'aria-describedby': [child.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? 'true' : child.props['aria-invalid'],
    })
    : child;
  return <div className="field" data-invalid={error ? 'true' : undefined}>
    <label className="field__label" htmlFor={id}>{label}</label>
    {hint ? <span className="field__hint" id={hintId}>{hint}</span> : null}
    {control}
    {error ? <span className="field__error" id={errorId} role="alert"><AlertCircle aria-hidden="true" size={13} />{error}</span> : null}
  </div>;
}

/** @param {{ items: readonly string[]; tone?: string; onRemove?: (item: string) => void }} props */
export function TagList({ items, tone = 'default', onRemove = undefined }) {
  return <div className="tag-list">{items?.map((item) => <span className={`tag tag--${tone}`} key={item}>{item}{onRemove ? <button onClick={() => onRemove(item)} aria-label={`移除${item}`}><X size={12} /></button> : null}</span>)}</div>;
}

export function Surface({ title, action, children, className = '' }) {
  return <section className={`surface ${className}`}>{title ? <header className="surface__header"><h3>{title}</h3>{action}</header> : null}{children}</section>;
}

export function Card({ header, children, footer, actions, className = '' }) {
  return <article className={`content-card ${className}`}>
    {header ? <header className="content-card__header">{header}</header> : null}
    <div className="content-card__body">{children}</div>
    {footer || actions ? <footer className="content-card__footer"><div>{footer}</div>{actions ? <div className="content-card__actions">{actions}</div> : null}</footer> : null}
  </article>;
}

export function StatusPill({ status, children }) {
  return <span className={`status status--${status}`}>{children}</span>;
}

/** @param {{ title: React.ReactNode; description: React.ReactNode; action?: React.ReactNode }} props */
export function EmptyState({ title, description, action = undefined }) {
  return <div className="empty-state"><div className="empty-state__mark"><Info size={24} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

/** @param {{ title?: React.ReactNode; description: React.ReactNode; onRetry?: () => void; retryLabel?: string }} props */
export function ErrorState({ title = '加载失败', description, onRetry = undefined, retryLabel = '重试' }) {
  return <div className="error-state" role="alert"><div className="error-state__mark"><AlertCircle aria-hidden="true" size={24} /></div><h3>{title}</h3><p>{description}</p>{onRetry ? <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button> : null}</div>;
}

export function Skeleton({ lines = 3, label = '正在加载内容' }) {
  return <div className="skeleton" role="status" aria-label={label}>{Array.from({ length: lines }, (_, index) => <span key={index} aria-hidden="true" style={{ '--skeleton-line': `${Math.max(46, 100 - index * 17)}%` }} />)}</div>;
}

export function LoadingState({ title = '正在准备内容', description }) {
  return <div className="loading-state" role="status" aria-live="polite"><LoaderCircle aria-hidden="true" className="spin" size={22} /><div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div></div>;
}

export function ProcessingCard({ job }) {
  if (job.status === 'idle') return null;
  const failed = job.status === 'failed';
  return <div className={`processing-card ${failed ? 'processing-card--failed' : ''}`} role="status" aria-live="polite" data-state={job.status}>
    {failed ? <AlertCircle size={18} /> : job.status === 'success' ? <CheckCircle2 size={18} /> : <LoaderCircle className="spin" size={18} />}
    <span>{job.message}</span>
  </div>;
}

export function ToastStack() {
  const toasts = useMuseStore((state) => state.toasts);
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`toast toast--${toast.type}`} key={toast.id}><CheckCircle2 size={16} />{toast.message}</div>)}</div>;
}

export function Modal({ open, title, description, onClose, children = null, closeOnBackdrop = true }) {
  const dialogRef = useRef(null);
  const descriptionId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const appRoot = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;
    appRoot?.setAttribute('aria-hidden', 'true');
    appRoot?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key !== 'Tab') return;
      const focusable = [...dialogRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []]
        .filter((element) => !element.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    window.setTimeout(() => dialogRef.current?.querySelector('button')?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', handler);
      appRoot?.removeAttribute('aria-hidden');
      appRoot?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose, open]);
  if (!open) return null;
  const content = <div className="dialog-backdrop" data-state="open" role="presentation" onMouseDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) onClose?.(); }}><div ref={dialogRef} className="dialog liquid-glass-surface" role="dialog" aria-modal="true" aria-label={title} aria-describedby={description ? descriptionId : undefined}><h2>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}{children}</div></div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

export function ConfirmDialog({ open, title, description, confirmText = '确认', onCancel, onConfirm, danger = false, loading = false }) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const handleConfirm = async () => {
    if (pendingRef.current || loading) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onConfirm?.();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return <Modal open={open} title={title} description={description} onClose={pending || loading ? undefined : onCancel} closeOnBackdrop={!pending && !loading}>
    <div className="dialog__actions"><Button variant="quiet" onClick={onCancel} disabled={pending || loading}>取消</Button><Button variant={danger ? 'danger' : 'default'} onClick={() => void handleConfirm()} loading={pending || loading}>{confirmText}</Button></div>
  </Modal>;
}

function overlayPosition(anchor, width = 280, height = 180) {
  if (!anchor || typeof window === 'undefined') return { left: 8, top: 8, width };
  const rect = anchor.getBoundingClientRect();
  const resolvedWidth = Math.min(width, window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - resolvedWidth - 8));
  const roomBelow = window.innerHeight - rect.bottom;
  const top = roomBelow >= height + 8 ? rect.bottom + 8 : Math.max(8, rect.top - height - 8);
  return { left, top, width: resolvedWidth };
}

export function Popover({ label, trigger, children, disabled = false }) {
  const id = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 280 });
  const close = (restore = true) => {
    setOpen(false);
    if (restore) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const openPanel = () => {
    if (disabled) return;
    setPosition(overlayPosition(triggerRef.current));
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) close(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => panelRef.current?.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus(), 0);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  return <>
    <button ref={triggerRef} type="button" className="popover-trigger" aria-label={label} aria-controls={id} aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onClick={() => open ? close() : openPanel()}>{trigger}</button>
    {open ? createPortal(<div ref={panelRef} id={id} className="popover-panel" role="dialog" aria-label={label} style={position}>{children}</div>, document.body) : null}
  </>;
}

export function Tooltip({ label, children, delay = 350 }) {
  const id = useId();
  const anchorRef = useRef(null);
  const timerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 220 });
  const show = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setPosition(overlayPosition(anchorRef.current, 220, 56));
      setOpen(true);
    }, delay);
  };
  const hide = () => {
    window.clearTimeout(timerRef.current);
    setOpen(false);
  };
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  const child = React.isValidElement(children) ? React.cloneElement(children, {
    ref: anchorRef,
    'aria-describedby': open ? id : children.props['aria-describedby'],
    onMouseEnter: (event) => { children.props.onMouseEnter?.(event); show(); },
    onMouseLeave: (event) => { children.props.onMouseLeave?.(event); hide(); },
    onFocus: (event) => { children.props.onFocus?.(event); show(); },
    onBlur: (event) => { children.props.onBlur?.(event); hide(); },
    onKeyDown: (event) => { children.props.onKeyDown?.(event); if (event.key === 'Escape') hide(); },
  }) : children;
  return <>{child}{open ? createPortal(<div id={id} className="tooltip" role="tooltip" style={position}>{label}</div>, document.body) : null}</>;
}
