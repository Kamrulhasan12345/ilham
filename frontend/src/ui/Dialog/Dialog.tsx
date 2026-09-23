import { type ReactNode, useEffect, useRef } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}

/** A consequence, stated before the choice. Verifying needs no dialogue;
    declining and deleting do — through this. Native dialog: focus moves
    in, Escape closes, the backdrop is inert. */
export function Dialog({ open, title, children, actions, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // jsdom and very old browsers have no showModal: fall back to the
    // plain open attribute. The content stays reachable either way.
    if (open && !node.open) {
      if (typeof node.showModal === 'function') node.showModal();
      else node.setAttribute('open', '');
    }
    if (!open && node.open) {
      if (typeof node.close === 'function') node.close();
      else node.removeAttribute('open');
    }
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onCancel = () => onClose();
    node.addEventListener('cancel', onCancel);
    return () => node.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="dialog-title">
      <h2 className={styles.title} id="dialog-title">
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </dialog>
  );
}
