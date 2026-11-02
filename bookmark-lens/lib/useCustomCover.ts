import { useEffect, useState } from 'react';
import { readCustomCover } from './custom-covers';
import { subscribeCache } from './cache-events';
export function useCustomCover(bookmarkId: string) {
  const [image, setImage] = useState<{ id: string; url: string }>();
  useEffect(() => {
    let alive = true, objectUrl: string | undefined, revision = 0;
    const load = async () => {
      const current = ++revision;
      try {
        const record = await readCustomCover(bookmarkId);
        if (!alive || current !== revision) return;
        const next = record ? URL.createObjectURL(record.blob) : undefined;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = next;
        setImage(next ? { id: bookmarkId, url: next } : undefined);
      } catch { /* Preserve the previous visible cover if the database is unavailable. */ }
    };
    void load();
    const unsubscribe = subscribeCache(() => void load());
    return () => { alive = false; unsubscribe(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bookmarkId]);
  return image?.id === bookmarkId ? image.url : undefined;
}
