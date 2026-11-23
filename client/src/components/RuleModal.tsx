import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { HotelRule, RuleCategory } from '../types';

interface RuleModalProps {
  open: boolean;
  editingRule: HotelRule | null;
  categories: RuleCategory[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: { title: string; category: RuleCategory; content: string }) => Promise<void>;
}

/**
 * Native <dialog> modal following modern-web-guidance `dialog` +
 * `validate-input-after-interaction`:
 * - Opened via `showModal()` (browser handles inert page, focus trap, Esc, focus return).
 * - No `role="dialog"` or `aria-modal` overrides.
 * - Uses `:user-invalid` + synced `aria-invalid` / `aria-describedby` + polite live region.
 */
export function RuleModal({
  open,
  editingRule,
  categories,
  saving,
  onClose,
  onSave,
}: RuleModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const headingId = useId();
  const titleHintId = useId();
  const titleErrorId = useId();
  const contentHintId = useId();
  const contentErrorId = useId();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RuleCategory>(categories[0] ?? 'Dining');
  const [content, setContent] = useState('');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [contentInvalid, setContentInvalid] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setTitle(editingRule?.title ?? '');
      setCategory(editingRule?.category ?? categories[0] ?? 'Dining');
      setContent(editingRule?.content ?? '');
      setTitleInvalid(false);
      setContentInvalid(false);
      setAnnouncement('');
      titleInputRef.current?.classList.remove('user-invalid-fallback');
      contentInputRef.current?.classList.remove('user-invalid-fallback');
      formRef.current?.reset();

      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, editingRule, categories]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const syncFieldValidity = (
    el: HTMLInputElement | HTMLTextAreaElement,
    setInvalid: (val: boolean) => void,
    label: string,
    errorText: string,
    announce: boolean,
  ) => {
    const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
    const wasSubmittedInvalid = el.classList.contains('user-invalid-fallback');
    const isInvalid =
      supportsUserInvalid && !wasSubmittedInvalid ? el.matches(':user-invalid') : !el.validity.valid;
    if (!isInvalid) {
      el.classList.remove('user-invalid-fallback');
    } else if (!supportsUserInvalid) {
      el.classList.add('user-invalid-fallback');
    }
    setInvalid(isInvalid);
    if (isInvalid && announce) {
      setAnnouncement(`${label}: ${errorText}`);
    } else if (!isInvalid) {
      setAnnouncement('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const titleEl = titleInputRef.current;
    const contentEl = contentInputRef.current;

    if (!form.checkValidity()) {
      if (titleEl && !titleEl.validity.valid) {
        titleEl.classList.add('user-invalid-fallback');
        setTitleInvalid(true);
      }
      if (contentEl && !contentEl.validity.valid) {
        contentEl.classList.add('user-invalid-fallback');
        setContentInvalid(true);
      }
      // Move focus to first invalid field per accessibility guidance
      const firstInvalid = form.querySelector<HTMLElement>(':invalid');
      firstInvalid?.focus();
      return;
    }

    await onSave({ title: title.trim(), category, content: content.trim() });
  };

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={headingId}
      {...({ closedby: 'closerequest' } as Record<string, string>)}
    >
      <div className="dialog-header">
        <h1 id={headingId} className="dialog-title">
          {editingRule ? 'Edit Hotel Rule' : 'Add New Hotel Rule'}
        </h1>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Close dialog"
          onClick={() => dialogRef.current?.close()}
        >
          ✕
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <div className="dialog-body">
          <div className="form-field">
            <label htmlFor="rule-title">Rule Title</label>
            <span id={titleHintId} className="field-hint">
              Short, descriptive heading (at least 3 characters), e.g. &ldquo;Breakfast Hours&rdquo;.
            </span>
            <input
              ref={titleInputRef}
              id="rule-title"
              type="text"
              required
              minLength={3}
              maxLength={80}
              autoFocus
              value={title}
              aria-invalid={titleInvalid ? 'true' : 'false'}
              aria-describedby={titleInvalid ? `${titleHintId} ${titleErrorId}` : titleHintId}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleInvalid && titleInputRef.current) {
                  syncFieldValidity(
                    titleInputRef.current,
                    setTitleInvalid,
                    'Rule Title',
                    'Enter a title with at least 3 characters.',
                    false,
                  );
                }
              }}
              onBlur={() => {
                if (titleInputRef.current) {
                  syncFieldValidity(
                    titleInputRef.current,
                    setTitleInvalid,
                    'Rule Title',
                    'Enter a title with at least 3 characters.',
                    true,
                  );
                }
              }}
            />
            <div id={titleErrorId} className="error-msg">
              <span role="img" aria-label="Error">
                ⚠
              </span>{' '}
              Enter a title with at least 3 characters.
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="rule-category">Category</label>
            <select
              id="rule-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as RuleCategory)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="rule-content">Hotel Rule Policy</label>
            <span id={contentHintId} className="field-hint">
              Write concrete facts (hours, locations, fees) — immediately embedded in Chroma DB on save.
            </span>
            <textarea
              ref={contentInputRef}
              id="rule-content"
              required
              minLength={10}
              maxLength={600}
              value={content}
              aria-invalid={contentInvalid ? 'true' : 'false'}
              aria-describedby={
                contentInvalid ? `${contentHintId} ${contentErrorId}` : contentHintId
              }
              onChange={(e) => {
                setContent(e.target.value);
                if (contentInvalid && contentInputRef.current) {
                  syncFieldValidity(
                    contentInputRef.current,
                    setContentInvalid,
                    'Hotel Rule Policy',
                    'Enter at least 10 characters describing the hotel policy.',
                    false,
                  );
                }
              }}
              onBlur={() => {
                if (contentInputRef.current) {
                  syncFieldValidity(
                    contentInputRef.current,
                    setContentInvalid,
                    'Hotel Rule Policy',
                    'Enter at least 10 characters describing the hotel policy.',
                    true,
                  );
                }
              }}
            />
            <div id={contentErrorId} className="error-msg">
              <span role="img" aria-label="Error">
                ⚠
              </span>{' '}
              Enter at least 10 characters describing the hotel policy.
            </div>
          </div>

          <div aria-live="polite" className="visually-hidden">
            {announcement}
          </div>
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Embedding & Saving…' : editingRule ? 'Save & Re-embed' : 'Add & Embed Rule'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Destructive action confirmation <dialog> with `autofocus` on the safe Cancel action,
 * `closedby="any"`, and bounding-rect light-dismiss fallback where `closedBy` is unsupported.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onCancel();
    };
    dialog.addEventListener('close', handleClose);

    // Fallback light-dismiss for browsers without HTMLDialogElement.prototype.closedBy
    let cleanupFallback = () => {};
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) dialog.close();
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupFallback();
    };
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={headingId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="dialog-header">
        <h1 id={headingId} className="dialog-title">
          {title}
        </h1>
      </div>
      <div className="dialog-body">
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <div className="dialog-footer">
        <button
          type="button"
          className="btn"
          autoFocus
          disabled={busy}
          onClick={() => dialogRef.current?.close()}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger-solid"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
