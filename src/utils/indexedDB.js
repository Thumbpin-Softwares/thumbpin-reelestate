const DB_NAME = 'RealEstateVideoDB';
const DB_VERSION = 3;
const STORES = {
  SESSIONS: 'sessions',
  PROPERTY_DATA: 'propertyData',
  AVATAR_DATA: 'avatarData',
  IMAGES: 'images',
  COMPOSITES: 'composites',
  SCRIPTS: 'scripts',
};

// ─── Singleton connection ────────────────────────────────────────────────────

let dbPromise = null;

const getDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const s = db.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionId' });
        s.createIndex('timestamp', 'timestamp', { unique: false });
        s.createIndex('isActive', 'isActive', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PROPERTY_DATA)) {
        const s = db.createObjectStore(STORES.PROPERTY_DATA, { keyPath: 'sessionId' });
        s.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.AVATAR_DATA)) {
        const s = db.createObjectStore(STORES.AVATAR_DATA, { keyPath: 'sessionId' });
        s.createIndex('avatarMode', 'avatarMode', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.IMAGES)) {
        const s = db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId', { unique: false });
        s.createIndex('type', 'type', { unique: false });
        s.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.COMPOSITES)) {
        const s = db.createObjectStore(STORES.COMPOSITES, { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SCRIPTS)) {
        const s = db.createObjectStore(STORES.SCRIPTS, { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });

  return dbPromise;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Wrap a single IDB request in a Promise
const req = (idbRequest) =>
  new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });

// Wrap a transaction's completion in a Promise (fire-and-forget put/delete calls inside cb)
const tx = (db, storeNames, mode, cb) =>
  new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    cb(t);
  });

// Convert a File to ArrayBuffer (native, no base64 overhead)
const fileToBuffer = (file) => file.arrayBuffer();

// Reconstruct a File from a stored image record (handles legacy base64 rows)
const recordToFile = (img) => {
  if (img.fileData instanceof ArrayBuffer || ArrayBuffer.isView(img.fileData)) {
    return new File([img.fileData], img.fileName, { type: img.fileType });
  }
  // Legacy base64 data URL stored before this rewrite
  const arr = img.fileData.split(',');
  const mime = img.fileType || arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new File([u8], img.fileName, { type: mime });
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

// Save session metadata + property brief + avatar data in one transaction
export const saveSessionProgress = async (sessionData) => {
  const db = await getDB();
  const { sessionId } = sessionData;

  const stores = [STORES.SESSIONS];
  if (sessionData.propertyBrief) stores.push(STORES.PROPERTY_DATA);
  if (sessionData.avatarMode || sessionData.selectedAvatar) stores.push(STORES.AVATAR_DATA);

  await tx(db, stores, 'readwrite', (t) => {
    t.objectStore(STORES.SESSIONS).put({
      sessionId,
      timestamp: Date.now(),
      lastActive: Date.now(),
      isActive: true,
      step: sessionData.step,
      metadata: sessionData.metadata || {},
    });

    if (sessionData.propertyBrief) {
      t.objectStore(STORES.PROPERTY_DATA).put({
        sessionId,
        lastUpdated: Date.now(),
        ...sessionData.propertyBrief,
      });
    }

    if (sessionData.avatarMode || sessionData.selectedAvatar) {
      t.objectStore(STORES.AVATAR_DATA).put({
        sessionId,
        avatarMode: sessionData.avatarMode,
        selectedAvatar: sessionData.selectedAvatar,
        avatarPrompt: sessionData.avatarPrompt || '',
        avatarVariantCount: sessionData.avatarVariantCount || 1,
        lastUpdated: Date.now(),
      });
    }
  });

  return sessionId;
};

// Load all session data in parallel reads
export const loadSessionProgress = async (sessionId) => {
  const db = await getDB();

  const [propertyData, avatarData, images] = await Promise.all([
    req(db.transaction([STORES.PROPERTY_DATA], 'readonly')
        .objectStore(STORES.PROPERTY_DATA).get(sessionId)),
    req(db.transaction([STORES.AVATAR_DATA], 'readonly')
        .objectStore(STORES.AVATAR_DATA).get(sessionId)),
    getImagesBySession(sessionId),
  ]);

  return {
    propertyBrief: propertyData ?? null,
    avatarData: avatarData ?? null,
    images,
  };
};

// Save images — parallel ArrayBuffer conversions, then one batched transaction
export const saveImagesToDB = async (sessionId, images, type = 'property') => {
  if (!images?.length) return;

  const db = await getDB();

  // Convert all files in parallel outside the transaction
  const records = await Promise.all(
    images.map(async (file, i) => ({
      id: `${sessionId}_${type}_${i}_${Date.now()}`,
      sessionId,
      type,
      index: i,
      fileName: file.name,
      fileType: file.type,
      fileData: await fileToBuffer(file),
      uploadedAt: Date.now(),
    }))
  );

  // Delete old + write new in one transaction
  await tx(db, [STORES.IMAGES], 'readwrite', (t) => {
    const store = t.objectStore(STORES.IMAGES);
    store.index('sessionId').getAll(sessionId).onsuccess = (e) => {
      e.target.result
        .filter((img) => img.type === type)
        .forEach((img) => store.delete(img.id));
      records.forEach((r) => store.put(r));
    };
  });
};

// Retrieve images for a session, optionally filtered by type
export const getImagesBySession = async (sessionId, type = null) => {
  const db = await getDB();
  const all = await req(
    db.transaction([STORES.IMAGES], 'readonly')
      .objectStore(STORES.IMAGES)
      .index('sessionId')
      .getAll(sessionId)
  );
  const filtered = type ? all.filter((img) => img.type === type) : all;
  return filtered.map(recordToFile);
};

// Save composites: delete old + write new in one transaction
export const saveCompositesToDB = async (sessionId, composites) => {
  if (!composites?.length) return;

  const db = await getDB();

  await tx(db, [STORES.COMPOSITES], 'readwrite', (t) => {
    const store = t.objectStore(STORES.COMPOSITES);
    store.index('sessionId').getAll(sessionId).onsuccess = (e) => {
      e.target.result.forEach((c) => store.delete(c.id));
      composites.forEach((composite, i) =>
        store.put({
          id: `${sessionId}_composite_${i}`,
          sessionId,
          index: i,
          url: composite.url,
          title: composite.title,
          propertyIndex: composite.propertyIndex,
          createdAt: Date.now(),
        })
      );
    };
  });
};

export const loadCompositesFromDB = async (sessionId) => {
  const db = await getDB();
  const all = await req(
    db.transaction([STORES.COMPOSITES], 'readonly')
      .objectStore(STORES.COMPOSITES)
      .index('sessionId')
      .getAll(sessionId)
  );
  return all
    .sort((a, b) => a.index - b.index)
    .map((c) => ({ url: c.url, title: c.title, propertyIndex: c.propertyIndex, file: null }));
};

// Save scripts: delete old + write new in one transaction
export const saveScriptsToDB = async (sessionId, scripts, isBatchMode) => {
  const db = await getDB();

  const records = [];
  if (isBatchMode && Array.isArray(scripts)) {
    scripts.forEach((s, i) =>
      records.push({
        id: `${sessionId}_script_${i}`,
        sessionId,
        index: i,
        hook: s.hook || '',
        walkthrough: s.walkthrough || '',
        cta: s.cta || '',
        fullScript: s.fullScript || '',
        _userIntent: s._userIntent || '',
        createdAt: Date.now(),
      })
    );
  } else if (typeof scripts === 'string') {
    records.push({
      id: `${sessionId}_script_single`,
      sessionId,
      index: 0,
      fullScript: scripts,
      createdAt: Date.now(),
    });
  }

  await tx(db, [STORES.SCRIPTS], 'readwrite', (t) => {
    const store = t.objectStore(STORES.SCRIPTS);
    store.index('sessionId').getAll(sessionId).onsuccess = (e) => {
      e.target.result.forEach((s) => store.delete(s.id));
      records.forEach((r) => store.put(r));
    };
  });
};

export const loadScriptsFromDB = async (sessionId) => {
  const db = await getDB();
  const all = await req(
    db.transaction([STORES.SCRIPTS], 'readonly')
      .objectStore(STORES.SCRIPTS)
      .index('sessionId')
      .getAll(sessionId)
  );
  return all.sort((a, b) => a.index - b.index);
};

export const getActiveSessions = async () => {
  const db = await getDB();
  return req(
    db.transaction([STORES.SESSIONS], 'readonly')
      .objectStore(STORES.SESSIONS)
      .index('isActive')
      .getAll(true)
  );
};

// Delete all data for a session in one multi-store transaction
export const deleteSession = async (sessionId) => {
  const db = await getDB();
  const allStores = [
    STORES.SESSIONS, STORES.PROPERTY_DATA, STORES.AVATAR_DATA,
    STORES.IMAGES, STORES.COMPOSITES, STORES.SCRIPTS,
  ];

  await tx(db, allStores, 'readwrite', (t) => {
    t.objectStore(STORES.SESSIONS).delete(sessionId);
    t.objectStore(STORES.PROPERTY_DATA).delete(sessionId);
    t.objectStore(STORES.AVATAR_DATA).delete(sessionId);

    for (const name of [STORES.IMAGES, STORES.COMPOSITES, STORES.SCRIPTS]) {
      const store = t.objectStore(name);
      store.index('sessionId').getAll(sessionId).onsuccess = (e) =>
        e.target.result.forEach((item) => store.delete(item.id));
    }
  });
};

// Clear generation data after video is produced
export const clearSessionAfterGeneration = async (sessionId, options = {}) => {
  const { keepSession = false, keepPropertyImages = false, keepAvatars = false } = options;
  const db = await getDB();

  const storeNames = [STORES.COMPOSITES, STORES.SCRIPTS, STORES.PROPERTY_DATA];
  if (!keepPropertyImages) storeNames.push(STORES.IMAGES);
  if (!keepAvatars) storeNames.push(STORES.AVATAR_DATA);
  storeNames.push(STORES.SESSIONS);

  try {
    await tx(db, storeNames, 'readwrite', (t) => {
      // Always clear composites and scripts
      for (const name of [STORES.COMPOSITES, STORES.SCRIPTS]) {
        const store = t.objectStore(name);
        store.index('sessionId').getAll(sessionId).onsuccess = (e) =>
          e.target.result.forEach((item) => store.delete(item.id));
      }

      // Always clear property brief
      t.objectStore(STORES.PROPERTY_DATA).delete(sessionId);

      if (!keepPropertyImages) {
        const imgStore = t.objectStore(STORES.IMAGES);
        imgStore.index('sessionId').getAll(sessionId).onsuccess = (e) =>
          e.target.result.forEach((img) => imgStore.delete(img.id));
      }

      if (!keepAvatars) {
        t.objectStore(STORES.AVATAR_DATA).delete(sessionId);
      }

      const sessStore = t.objectStore(STORES.SESSIONS);
      if (!keepSession) {
        sessStore.delete(sessionId);
      } else {
        sessStore.get(sessionId).onsuccess = (e) => {
          const session = e.target.result;
          if (session) {
            sessStore.put({
              ...session,
              videosGenerated: true,
              generatedAt: Date.now(),
              isActive: false,
              lastActive: Date.now(),
            });
          }
        };
      }
    });

    return { success: true, sessionId };
  } catch (error) {
    console.error('Error clearing session:', error);
    return { success: false, error: error.message };
  }
};

export const clearOldSessions = async (daysOld = 7) => {
  const db = await getDB();
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

  const all = await req(
    db.transaction([STORES.SESSIONS], 'readonly')
      .objectStore(STORES.SESSIONS)
      .index('timestamp')
      .getAll()
  );

  const old = all.filter((s) => s.timestamp < cutoff);
  const results = await Promise.allSettled(
    old.map((s) => clearSessionAfterGeneration(s.sessionId, { keepSession: false }))
  );

  const cleared = results.filter((r) => r.status === 'fulfilled').length;
  return { success: true, clearedCount: cleared };
};

export const resetSessionData = async (sessionId, preserveUserPreferences = true) =>
  clearSessionAfterGeneration(sessionId, {
    keepSession: true,
    keepPropertyImages: preserveUserPreferences,
    keepAvatars: preserveUserPreferences,
  });

// ─── Auto-save: per-session timeouts (avoids cross-session cancellation) ──────

const autoSaveTimeouts = new Map();

export const autoSaveProgress = (sessionId, getCurrentState, onSaveComplete) => {
  clearTimeout(autoSaveTimeouts.get(sessionId));

  const id = setTimeout(async () => {
    autoSaveTimeouts.delete(sessionId);
    try {
      const state = getCurrentState();
      await saveSessionProgress({
        sessionId,
        step: state.step,
        propertyBrief: state.propertyBrief,
        avatarMode: state.avatarMode,
        selectedAvatar: state.selectedAvatar,
        avatarPrompt: state.avatarPrompt,
        avatarVariantCount: state.avatarVariantCount,
        metadata: {
          lastEdited: Date.now(),
          propertyImagesCount: state.propertyImages?.length ?? 0,
          compositesCount: state.composites?.length ?? 0,
          selectedCount: state.selectedCompositeIndices?.size ?? 0,
        },
      });

      if (state.propertyImages?.length) {
        await saveImagesToDB(sessionId, state.propertyImages, 'property');
      }
      if (state.composites?.length) {
        await saveCompositesToDB(sessionId, state.composites);
      }
      if (state.structuredScripts?.length) {
        await saveScriptsToDB(sessionId, state.structuredScripts, true);
      } else if (state.script) {
        await saveScriptsToDB(sessionId, state.script, false);
      }

      onSaveComplete?.();
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, 2000);

  autoSaveTimeouts.set(sessionId, id);
};
