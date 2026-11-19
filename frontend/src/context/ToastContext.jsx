import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: '✓', error: '', info: '' };

export function ToastProvider({ children }) {
 const [toasts, setToasts] = useState([]);
 const nextId = useRef(1);

 const showToast = useCallback((message, type = 'info') => {
 const id = nextId.current++;
 setToasts((list) => [...list.slice(-2), { id, message: String(message), type }]);
 setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
 }, []);

 const value = useMemo(() => ({ showToast }), [showToast]);

 return (
 <ToastContext.Provider value={value}>
 {children}
 <div className="toast-container" aria-live="polite">
 {toasts.map((t) => (
 <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : ''}`}>
 <span style={{ fontSize: '1.1rem', color: 'var(--accent-emerald)' }}>{ICONS[t.type] || '✦'}</span>
 <span>{t.message}</span>
 </div>
 ))}
 </div>
 </ToastContext.Provider>
 );
}

export function useToast() {
 const ctx = useContext(ToastContext);
 if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
 return ctx;
}
