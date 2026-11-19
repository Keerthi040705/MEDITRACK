import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * Loads data from the API and exposes { data, loading, error, reload, setData }.
 * `deps` re-run the loader when they change (e.g. the user id).
 */
export function useApi(loader, deps = [], initial = []) {
  const { showToast } = useToast();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loaderRef.current();
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      setError(e.message);
      // Network problems are shown once by the connection banner instead of many toasts
      if (!e.network) showToast(e.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  return { data, setData, loading, error, reload };
}

/** Wraps an async action with a "busy" flag and success / error toasts. */
export function useAction() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn, successMessage) => {
    setBusy(true);
    try {
      const result = await fn();
      if (successMessage) showToast(typeof successMessage === 'function' ? successMessage(result) : successMessage, 'success');
      return { ok: true, result };
    } catch (e) {
      showToast(e.message, 'error');
      return { ok: false, error: e };
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  return { busy, run };
}
