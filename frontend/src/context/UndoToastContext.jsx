import { createContext, useCallback, useContext, useRef, useState } from 'react';

const UndoToastContext = createContext(null);

const DURATION_MS = 6000;

// Mounted once at the app root (see App.jsx) rather than per-page, so a
// pending delete survives the user navigating to a different route before
// the undo window closes — a page-local timer would get torn down with the
// component and lose track of the still-pending delete.
export function UndoToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, onUndo }
  const pendingRef = useRef(null); // { timerId, onCommit }

  const commitPending = useCallback(() => {
    if (!pendingRef.current) return;
    const { onCommit } = pendingRef.current;
    pendingRef.current = null;
    onCommit();
  }, []);

  // Removing something optimistically (already gone from the list) and only
  // actually deleting it server-side once the undo window closes — Undo is
  // then just "put it back locally," no API call ever made for that case.
  const deleteWithUndo = useCallback(
    ({ message, onUndo, onCommit }) => {
      // A second delete before the first one's window closes commits the
      // first immediately rather than silently dropping it.
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timerId);
        commitPending();
      }

      const timerId = setTimeout(() => {
        pendingRef.current = null;
        setToast(null);
        onCommit();
      }, DURATION_MS);

      pendingRef.current = { timerId, onCommit };
      setToast({ message, onUndo });
    },
    [commitPending]
  );

  function handleUndo() {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timerId);
      pendingRef.current = null;
    }
    toast?.onUndo();
    setToast(null);
  }

  return (
    <UndoToastContext.Provider value={{ deleteWithUndo }}>
      {children}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-slate-900 text-white text-sm rounded-lg shadow-xl px-4 py-3 print:hidden">
          <span>{toast.message}</span>
          <button onClick={handleUndo} className="font-medium text-blue-300 hover:text-blue-200 shrink-0">
            Undo
          </button>
        </div>
      )}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast() {
  return useContext(UndoToastContext);
}
