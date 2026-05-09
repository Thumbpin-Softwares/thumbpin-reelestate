// src/app/utils/indexedDB.js

// Database configuration
const DB_NAME = 'RealEstateVideoDB';
const DB_VERSION = 3;
const STORES = {
  SESSIONS: 'sessions',
  PROPERTY_DATA: 'propertyData',
  AVATAR_DATA: 'avatarData',
  IMAGES: 'images',
  COMPOSITES: 'composites',
  SCRIPTS: 'scripts'
};

// Open database connection
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionId' });
        sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
        sessionStore.createIndex('isActive', 'isActive', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.PROPERTY_DATA)) {
        const propertyStore = db.createObjectStore(STORES.PROPERTY_DATA, { keyPath: 'sessionId' });
        propertyStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.AVATAR_DATA)) {
        const avatarStore = db.createObjectStore(STORES.AVATAR_DATA, { keyPath: 'sessionId' });
        avatarStore.createIndex('avatarMode', 'avatarMode', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.IMAGES)) {
        const imageStore = db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
        imageStore.createIndex('sessionId', 'sessionId', { unique: false });
        imageStore.createIndex('type', 'type', { unique: false });
        imageStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.COMPOSITES)) {
        const compositeStore = db.createObjectStore(STORES.COMPOSITES, { keyPath: 'id' });
        compositeStore.createIndex('sessionId', 'sessionId', { unique: false });
        compositeStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.SCRIPTS)) {
        const scriptStore = db.createObjectStore(STORES.SCRIPTS, { keyPath: 'id' });
        scriptStore.createIndex('sessionId', 'sessionId', { unique: false });
        scriptStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// Helper: Convert file to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

// Helper: Convert base64 to file
const base64ToFile = (base64, filename, mimeType) => {
  const arr = base64.split(',');
  const mime = mimeType || arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Generate session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Save session progress
export const saveSessionProgress = async (sessionData) => {
  const db = await openDB();
  const sessionId = sessionData.sessionId;
  
  // Save session metadata
  await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SESSIONS], 'readwrite');
    const store = transaction.objectStore(STORES.SESSIONS);
    const request = store.put({
      sessionId,
      timestamp: Date.now(),
      lastActive: Date.now(),
      isActive: true,
      step: sessionData.step,
      metadata: sessionData.metadata || {}
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
  
  // Save property brief
  if (sessionData.propertyBrief) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROPERTY_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.PROPERTY_DATA);
      const request = store.put({
        sessionId,
        lastUpdated: Date.now(),
        ...sessionData.propertyBrief
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  // Save avatar data
  if (sessionData.avatarMode || sessionData.selectedAvatar) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.AVATAR_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.AVATAR_DATA);
      const request = store.put({
        sessionId,
        avatarMode: sessionData.avatarMode,
        selectedAvatar: sessionData.selectedAvatar,
        avatarPrompt: sessionData.avatarPrompt || '',
        avatarVariantCount: sessionData.avatarVariantCount || 1,
        lastUpdated: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  return sessionId;
};

// Load session progress
export const loadSessionProgress = async (sessionId) => {
  const db = await openDB();
  
  let propertyData = null;
  let avatarData = null;
  let images = [];
  
  try {
    // Load property data
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROPERTY_DATA], 'readonly');
      const store = transaction.objectStore(STORES.PROPERTY_DATA);
      const request = store.get(sessionId);
      request.onsuccess = () => {
        propertyData = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
    
    // Load avatar data
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.AVATAR_DATA], 'readonly');
      const store = transaction.objectStore(STORES.AVATAR_DATA);
      const request = store.get(sessionId);
      request.onsuccess = () => {
        avatarData = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
    
    // Load images
    images = await getImagesBySession(sessionId);
    
    return {
      propertyBrief: propertyData || null,
      avatarData: avatarData || null,
      images: images
    };
  } catch (error) {
    console.error('Error loading session:', error);
    return {
      propertyBrief: null,
      avatarData: null,
      images: []
    };
  }
};

// Save images to IndexedDB
export const saveImagesToDB = async (sessionId, images, type = 'property') => {
  if (!images || images.length === 0) return;
  
  const db = await openDB();
  
  // First, delete existing images of this type
  await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.IMAGES], 'readwrite');
    const store = transaction.objectStore(STORES.IMAGES);
    const index = store.index('sessionId');
    
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      const existingImages = request.result.filter(img => img.type === type);
      let deleteCount = 0;
      
      if (existingImages.length === 0) {
        resolve();
        return;
      }
      
      existingImages.forEach(img => {
        const deleteRequest = store.delete(img.id);
        deleteRequest.onsuccess = () => {
          deleteCount++;
          if (deleteCount === existingImages.length) {
            resolve();
          }
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
  
  // Save new images
  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const fileData = await fileToBase64(file);
    
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.IMAGES], 'readwrite');
      const store = transaction.objectStore(STORES.IMAGES);
      const request = store.put({
        id: `${sessionId}_${type}_${i}_${Date.now()}`,
        sessionId,
        type: type,
        index: i,
        fileName: file.name,
        fileType: file.type,
        fileData: fileData,
        uploadedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

// Get images by session
export const getImagesBySession = async (sessionId, type = null) => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.IMAGES], 'readonly');
    const store = transaction.objectStore(STORES.IMAGES);
    const index = store.index('sessionId');
    
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      let images = request.result;
      if (type) {
        images = images.filter(img => img.type === type);
      }
      
      const files = images.map(img => 
        base64ToFile(img.fileData, img.fileName, img.fileType)
      );
      resolve(files);
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

// Save composites
export const saveCompositesToDB = async (sessionId, composites) => {
  if (!composites || composites.length === 0) return;
  
  const db = await openDB();
  
  // Delete existing composites
  await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.COMPOSITES], 'readwrite');
    const store = transaction.objectStore(STORES.COMPOSITES);
    const index = store.index('sessionId');
    
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      const existing = request.result;
      let deleteCount = 0;
      
      if (existing.length === 0) {
        resolve();
        return;
      }
      
      existing.forEach(comp => {
        const deleteRequest = store.delete(comp.id);
        deleteRequest.onsuccess = () => {
          deleteCount++;
          if (deleteCount === existing.length) {
            resolve();
          }
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
  
  // Save new composites
  for (let i = 0; i < composites.length; i++) {
    const composite = composites[i];
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.COMPOSITES], 'readwrite');
      const store = transaction.objectStore(STORES.COMPOSITES);
      const request = store.put({
        id: `${sessionId}_composite_${i}`,
        sessionId,
        index: i,
        url: composite.url,
        title: composite.title,
        propertyIndex: composite.propertyIndex,
        createdAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

// Load composites
export const loadCompositesFromDB = async (sessionId) => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.COMPOSITES], 'readonly');
    const store = transaction.objectStore(STORES.COMPOSITES);
    const index = store.index('sessionId');
    
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      const composites = request.result.sort((a, b) => a.index - b.index);
      resolve(composites.map(comp => ({
        url: comp.url,
        title: comp.title,
        propertyIndex: comp.propertyIndex,
        file: null
      })));
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

// Save scripts
export const saveScriptsToDB = async (sessionId, scripts, isBatchMode) => {
  const db = await openDB();
  
  // Delete existing scripts
  await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SCRIPTS], 'readwrite');
    const store = transaction.objectStore(STORES.SCRIPTS);
    const index = store.index('sessionId');
    
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      const existing = request.result;
      let deleteCount = 0;
      
      if (existing.length === 0) {
        resolve();
        return;
      }
      
      existing.forEach(script => {
        const deleteRequest = store.delete(script.id);
        deleteRequest.onsuccess = () => {
          deleteCount++;
          if (deleteCount === existing.length) {
            resolve();
          }
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
  
  // Save new scripts
  if (isBatchMode && Array.isArray(scripts)) {
    for (let i = 0; i < scripts.length; i++) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.SCRIPTS], 'readwrite');
        const store = transaction.objectStore(STORES.SCRIPTS);
        const request = store.put({
          id: `${sessionId}_script_${i}`,
          sessionId,
          index: i,
          hook: scripts[i].hook || '',
          walkthrough: scripts[i].walkthrough || '',
          cta: scripts[i].cta || '',
          fullScript: scripts[i].fullScript || '',
          _userIntent: scripts[i]._userIntent || '',
          createdAt: Date.now()
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    }
  } else if (typeof scripts === 'string') {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCRIPTS], 'readwrite');
      const store = transaction.objectStore(STORES.SCRIPTS);
      const request = store.put({
        id: `${sessionId}_script_single`,
        sessionId,
        index: 0,
        fullScript: scripts,
        createdAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

// Load scripts
export const loadScriptsFromDB = async (sessionId) => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SCRIPTS], 'readonly');
    const store = transaction.objectStore(STORES.SCRIPTS);
    const index = store.index('sessionId');
    
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => a.index - b.index));
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

// Get active sessions
export const getActiveSessions = async () => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SESSIONS], 'readonly');
    const store = transaction.objectStore(STORES.SESSIONS);
    const index = store.index('isActive');
    
    const request = index.getAll(true);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

// Delete session
export const deleteSession = async (sessionId) => {
  const db = await openDB();
  const stores = [STORES.SESSIONS, STORES.PROPERTY_DATA, STORES.AVATAR_DATA, STORES.IMAGES, STORES.COMPOSITES, STORES.SCRIPTS];
  
  for (const storeName of stores) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      if (storeName === STORES.IMAGES || storeName === STORES.COMPOSITES || storeName === STORES.SCRIPTS) {
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);
        
        request.onsuccess = () => {
          const items = request.result;
          let deleteCount = 0;
          
          if (items.length === 0) {
            resolve();
            return;
          }
          
          items.forEach(item => {
            const deleteRequest = store.delete(item.id);
            deleteRequest.onsuccess = () => {
              deleteCount++;
              if (deleteCount === items.length) {
                resolve();
              }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        };
        request.onerror = () => reject(request.error);
      } else {
        const request = store.delete(sessionId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }
      
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

// Auto-save progress
let autoSaveTimeout;
export const autoSaveProgress = (sessionId, getCurrentState, onSaveComplete) => {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
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
          propertyImagesCount: state.propertyImages?.length || 0,
          compositesCount: state.composites?.length || 0,
          selectedCount: state.selectedCompositeIndices?.size || 0
        }
      });
      
      if (state.propertyImages?.length > 0) {
        await saveImagesToDB(sessionId, state.propertyImages, 'property');
      }
      
      if (state.composites?.length > 0) {
        await saveCompositesToDB(sessionId, state.composites);
      }
      
      if (state.structuredScripts?.length > 0) {
        await saveScriptsToDB(sessionId, state.structuredScripts, true);
      } else if (state.script) {
        await saveScriptsToDB(sessionId, state.script, false);
      }
      
      if (onSaveComplete) onSaveComplete();
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, 2000);
};

// Clear session data after video generation
export const clearSessionAfterGeneration = async (sessionId, options = {}) => {
  const {
    keepSession = false,     // Keep session metadata but clear generation data
    keepPropertyImages = false, // Keep property images
    keepAvatars = false,     // Keep avatar data
  } = options;
  
  const db = await openDB();
  
  try {
    // Clear composites (always clear after generation)
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.COMPOSITES], 'readwrite');
      const store = transaction.objectStore(STORES.COMPOSITES);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);
      
      request.onsuccess = () => {
        const composites = request.result;
        let deleteCount = 0;
        
        if (composites.length === 0) {
          resolve();
          return;
        }
        
        composites.forEach(composite => {
          const deleteRequest = store.delete(composite.id);
          deleteRequest.onsuccess = () => {
            deleteCount++;
            if (deleteCount === composites.length) {
              console.log(`Cleared ${deleteCount} composites`);
              resolve();
            }
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
    
    // Clear scripts
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCRIPTS], 'readwrite');
      const store = transaction.objectStore(STORES.SCRIPTS);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);
      
      request.onsuccess = () => {
        const scripts = request.result;
        let deleteCount = 0;
        
        if (scripts.length === 0) {
          resolve();
          return;
        }
        
        scripts.forEach(script => {
          const deleteRequest = store.delete(script.id);
          deleteRequest.onsuccess = () => {
            deleteCount++;
            if (deleteCount === scripts.length) {
              console.log(`Cleared ${deleteCount} scripts`);
              resolve();
            }
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
    
    // Clear property images if not keeping them
    if (!keepPropertyImages) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.IMAGES], 'readwrite');
        const store = transaction.objectStore(STORES.IMAGES);
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);
        
        request.onsuccess = () => {
          const images = request.result;
          let deleteCount = 0;
          
          if (images.length === 0) {
            resolve();
            return;
          }
          
          images.forEach(image => {
            const deleteRequest = store.delete(image.id);
            deleteRequest.onsuccess = () => {
              deleteCount++;
              if (deleteCount === images.length) {
                console.log(`Cleared ${deleteCount} images`);
                resolve();
              }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        };
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    }
    
    // Clear avatar data if not keeping
    if (!keepAvatars) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.AVATAR_DATA], 'readwrite');
        const store = transaction.objectStore(STORES.AVATAR_DATA);
        const request = store.delete(sessionId);
        request.onsuccess = () => {
          console.log('Cleared avatar data');
          resolve();
        };
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    }
    
    // Clear property brief data
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROPERTY_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.PROPERTY_DATA);
      const request = store.delete(sessionId);
      request.onsuccess = () => {
        console.log('Cleared property data');
        resolve();
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
    
    // Update session metadata to mark as generated
    if (keepSession) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.SESSIONS], 'readwrite');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.get(sessionId);
        
        request.onsuccess = () => {
          const session = request.result;
          if (session) {
            session.videosGenerated = true;
            session.generatedAt = Date.now();
            session.isActive = false;
            session.lastActive = Date.now();
            
            const updateRequest = store.put(session);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } else {
      // Delete session completely
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.SESSIONS], 'readwrite');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.delete(sessionId);
        request.onsuccess = () => {
          console.log('Cleared session');
          resolve();
        };
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    }
    
    console.log(`Session ${sessionId} cleaned up successfully`);
    return { success: true, sessionId };
    
  } catch (error) {
    console.error('Error clearing session:', error);
    return { success: false, error: error.message };
  }
};

// Clear old sessions (older than specified days)
export const clearOldSessions = async (daysOld = 7) => {
  const db = await openDB();
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  
  try {
    // Get sessions older than cutoff
    const sessions = await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SESSIONS], 'readonly');
      const store = transaction.objectStore(STORES.SESSIONS);
      const index = store.index('timestamp');
      const request = index.getAll();
      
      request.onsuccess = () => {
        const allSessions = request.result;
        const oldSessions = allSessions.filter(s => s.timestamp < cutoffTime);
        resolve(oldSessions);
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
    
    // Delete each old session
    const results = [];
    for (const session of sessions) {
      const result = await clearSessionAfterGeneration(session.sessionId, { keepSession: false });
      results.push(result);
    }
    
    console.log(`Cleared ${results.length} old sessions`);
    return { success: true, clearedCount: results.length };
    
  } catch (error) {
    console.error('Error clearing old sessions:', error);
    return { success: false, error: error.message };
  }
};

// Clear all data for a specific session after video generation
export const resetSessionData = async (sessionId, preserveUserPreferences = true) => {
  return await clearSessionAfterGeneration(sessionId, {
    keepSession: true,
    keepPropertyImages: preserveUserPreferences,
    keepAvatars: preserveUserPreferences
  });
};