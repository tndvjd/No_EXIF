import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function ConfirmModal({ dialog, onCancel, onConfirm }) {
  if (!dialog) return null;

  return (
    <div className="confirm-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="confirm-icon">
          <ShieldCheck size={22} />
        </div>
        <div className="confirm-copy">
          <h2 id="confirm-title">{dialog.title}</h2>
          <p>{dialog.message}</p>
        </div>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>취소</button>
          <button className="confirm-confirm" onClick={onConfirm}>
            {dialog.confirmLabel || '확인'}
          </button>
        </div>
      </section>
    </div>
  );
}
