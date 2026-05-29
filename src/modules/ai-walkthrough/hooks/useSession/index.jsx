import { useState, useEffect, useCallback } from 'react';
import { loadSessionProgress, saveSessionProgress } from '@/utils/indexedDB';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const useSession = (sessionId, isClient) => {
  const [step, setStep] = useState(0);
  const [sessionData, setSessionData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sessionMetadata, setSessionMetadata] = useState({
    createdAt: Date.now(),
    lastSaved: Date.now(),
    completedSteps: [],
  });

  useEffect(() => {
    if (!sessionId || !isClient) return;

    let cancelled = false;

    loadSessionProgress(sessionId)
      .then((saved) => {
        if (cancelled) return;
        if (saved?.propertyBrief) {
          const fresh = Date.now() - saved.propertyBrief.lastUpdated < SESSION_TTL_MS;
          if (fresh) setSessionData(saved);
        }
        setIsLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load session:', err);
          setIsLoaded(true);
        }
      });

    return () => { cancelled = true; };
  }, [sessionId, isClient]);

  const saveSession = useCallback(async (data) => {
    if (!sessionId || !isClient) return;

    try {
      await saveSessionProgress({
        sessionId,
        ...data,
        metadata: { lastEdited: Date.now(), ...data.metadata },
      });
      setSessionMetadata((prev) => ({ ...prev, lastSaved: Date.now() }));
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [sessionId, isClient]);

  return { step, setStep, sessionData, isLoaded, sessionMetadata, saveSession };
};
