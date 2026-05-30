import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { runToastAction } from './appUtils.js';

export function ToastHost({ toast, onClose, onActionError }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timeoutMs = toast.actionLabel
      ? 9000
      : ['warning', 'error'].includes(toast.type)
        ? 6500
        : 2200;
    const timeout = window.setTimeout(onClose, timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [toast?.id, onClose]);

  if (!toast) return null;
  
  const handleAction = async () => {
    try {
      await runToastAction(toast.onAction);
      onClose();
    } catch (error) {
      onClose();
      onActionError?.(error);
    }
  };

  return (
    <div className={`toast ${toast.type || 'success'}`}>
      <CheckCircle2 size={30} />
      <div>
        <strong>{toast.title}</strong>
        {toast.detail ? <span>{toast.detail}</span> : null}
        {toast.actionLabel ? <button onClick={handleAction}>{toast.actionLabel}</button> : null}
      </div>
      <button className="toast-close" onClick={onClose} title="닫기">
        <X size={17} />
      </button>
    </div>
  );
}
