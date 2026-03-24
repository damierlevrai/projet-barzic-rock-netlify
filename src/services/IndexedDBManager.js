/**
 * 🗄️ INDEXEDDB MANAGER v4 - Cache centralisé offline-first
 * 
 * CENTRALISÉ : Une seule DB pour TOUT
 * - events, establishments, profiles (données)
 * - photos (ex-BarzikImageCache)
 * - locations (ex-BarzikLocationDB)
 * - photo_refs (liaisons)
 * - sync_queue (queue persistante)
 * - conflicts (versioning)
 * - metadata (system)
 */

class IndexedDBManager {
  static dbName = 'BarzikDB';
  static version = 4;
  static db = null;

  /**
   * 🔧 INIT - Initialiser IndexedDB
   */
  static async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ IndexedDB init error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB ready:', this.dbName, 'v' + this.version);
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        const oldVersion = event.oldVersion;

        console.log(`🔄 Upgrading IndexedDB: v${oldVersion} → v${this.version}`);

        // Migration v0 → v1 (tables de base)
        if (oldVersion < 1) {
          this.createStoresV1(db);
        }

        // Migration v1 → v2 (colonnes géo)
        if (oldVersion < 2) {
          this.upgradeToV2(db, transaction);
        }

        // Migration v2 → v3 (sync_queue)
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('sync_queue')) {
            const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
            queueStore.createIndex('status', 'status', { unique: false });
            queueStore.createIndex('priority', 'priority', { unique: false });
            queueStore.createIndex('createdAt', 'createdAt', { unique: false });
            console.log('✅ Store sync_queue créé');
          }
        }

        // Migration v3 → v4 (fusion ImageCache + LocationManager + photo_refs + conflicts)
        if (oldVersion < 4) {
          this.upgradeToV4(db, transaction);
        }
      };
    });
  }

  /**
   * 📚 CREATE STORES V1 - Tables de base
   */
  static createStoresV1(db) {
    // EVENTS
    if (!db.objectStoreNames.contains('events')) {
      const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
      eventsStore.createIndex('date_debut', 'date_debut', { unique: false });
      eventsStore.createIndex('status', 'status', { unique: false });
      eventsStore.createIndex('updated_at', 'updated_at', { unique: false });
      eventsStore.createIndex('owner_id', 'owner_id', { unique: false });
    }

    // ESTABLISHMENTS
    if (!db.objectStoreNames.contains('establishments')) {
      const estabStore = db.createObjectStore('establishments', { keyPath: 'id' });
      estabStore.createIndex('updated_at', 'updated_at', { unique: false });
      estabStore.createIndex('status', 'status', { unique: false });
      estabStore.createIndex('owner_id', 'owner_id', { unique: false });
    }

    // PROFILES
    if (!db.objectStoreNames.contains('profiles')) {
      const profilesStore = db.createObjectStore('profiles', { keyPath: 'id' });
      profilesStore.createIndex('role', 'role', { unique: false });
      profilesStore.createIndex('updated_at', 'updated_at', { unique: false });
      console.log('✅ Profiles store créé');
    }

    // METADATA
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }

    console.log('✅ Stores v1 créés');
  }

  /**
   * 📚 UPGRADE V2 - Colonnes géo
   */
  static upgradeToV2(db, transaction) {
    if (db.objectStoreNames.contains('events')) {
      const eventsStore = transaction.objectStore('events');
      if (!eventsStore.indexNames.contains('city_normalized')) {
        eventsStore.createIndex('city_normalized', 'city_normalized', { unique: false });
      }
      if (!eventsStore.indexNames.contains('latitude')) {
        eventsStore.createIndex('latitude', 'latitude', { unique: false });
      }
      if (!eventsStore.indexNames.contains('longitude')) {
        eventsStore.createIndex('longitude', 'longitude', { unique: false });
      }
    }

    if (db.objectStoreNames.contains('establishments')) {
      const estabStore = transaction.objectStore('establishments');
      if (!estabStore.indexNames.contains('city_normalized')) {
        estabStore.createIndex('city_normalized', 'city_normalized', { unique: false });
      }
    }

    console.log('✅ Upgrade v2 terminé (géolocalisation)');
  }

  /**
   * 📚 UPGRADE V4 - Fusion ImageCache + LocationManager + Photos
   */
  static upgradeToV4(db, transaction) {
  // PHOTOS
  if (!db.objectStoreNames.contains('photos')) {
    const photosStore = db.createObjectStore('photos', { keyPath: 'id' });
    photosStore.createIndex('hash', 'hash', { unique: false });
    photosStore.createIndex('status', 'status', { unique: false });
    photosStore.createIndex('uploaded_at', 'uploaded_at', { unique: false });
    console.log('✅ Store photos créé');
  }

  // PHOTO_REFS
  if (!db.objectStoreNames.contains('photo_refs')) {
    const photoRefsStore = db.createObjectStore('photo_refs', { keyPath: 'id' });
    photoRefsStore.createIndex('photo_hash', 'photo_hash', { unique: false });
    photoRefsStore.createIndex('item_id', 'item_id', { unique: false });
    photoRefsStore.createIndex('status', 'status', { unique: false });
    console.log('✅ Store photo_refs créé');
  }

  // LOCATIONS
  if (!db.objectStoreNames.contains('locations')) {
    const locStore = db.createObjectStore('locations', { keyPath: 'type' });
    locStore.createIndex('savedAt', 'savedAt', { unique: false });
    console.log('✅ Store locations créé');
  }

  // CONFLICTS
  if (!db.objectStoreNames.contains('conflicts')) {
    const conflStore = db.createObjectStore('conflicts', { keyPath: 'id' });
    conflStore.createIndex('item_id', 'item_id', { unique: false });
    conflStore.createIndex('timestamp', 'timestamp', { unique: false });
    console.log('✅ Store conflicts créé');
  }

  // APP_METADATA (mirroir de Supabase)
  if (!db.objectStoreNames.contains('app_metadata')) {
    const metadataStore = db.createObjectStore('app_metadata', { keyPath: 'key' });
    metadataStore.createIndex('hash', 'hash', { unique: false });
    console.log('✅ Store app_metadata créé');
  }

  console.log('✅ Upgrade v4 terminé (centralisé)');
}

  /**
   * 💾 PUT - Insert/Update
   */
  static async put(storeName, item) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        console.log(`💾 Put [${storeName}]:`, item.id || item.key);
        resolve(item);
      };

      request.onerror = () => {
        console.error(`❌ Put error [${storeName}]:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 📖 GET - Read by ID
   */
  static async get(storeName, id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`❌ Get error [${storeName}]:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 📚 GETALL - Read all items
   */
  static async getAll(storeName) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error(`❌ GetAll error [${storeName}]:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 🔍 QUERY - Query by index
   */
  static async query(storeName, indexName, value) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error(`❌ Query error [${storeName}.${indexName}]:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 🗑️ DELETE - Supprimer un item
   */
  static async delete(storeName, id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ Deleted [${storeName}]:`, id);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`❌ Delete error [${storeName}]:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 🧹 CLEAR - Vider un store
   */
  static async clear(storeName) {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`🧹 Cleared [${storeName}]`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Clear error [${storeName}]:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 📊 STATS - Statistiques + quota
   */
  static async getStats() {
    await this.init();

    const stats = {
      events: 0,
      establishments: 0,
      photos: 0,
      photo_refs: 0,
      locations: 0,
      conflicts: 0,
      metadata: 0,
      totalSizeMB: 0,
      quotaMB: 0,
      usedPercent: 0
    };

    stats.events = (await this.getAll('events')).length;
    stats.establishments = (await this.getAll('establishments')).length;
    stats.photos = (await this.getAll('photos')).length;
    stats.photo_refs = (await this.getAll('photo_refs')).length;
    stats.locations = (await this.getAll('locations')).length;
    stats.conflicts = (await this.getAll('conflicts')).length;
    stats.metadata = (await this.getAll('metadata')).length;

    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      stats.totalSizeMB = (estimate.usage / (1024 * 1024)).toFixed(2);
      stats.quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
      stats.usedPercent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
    }

    return stats;
  }

  /**
   * 📝 METADATA - Accesseurs rapides
   */
  static async getMeta(key) {
    const item = await this.get('metadata', key);
    return item ? item.value : null;
  }

  static async setMeta(key, value) {
    return this.put('metadata', { key, value, updated_at: new Date().toISOString() });
  }

  static async deleteMeta(key) {
    return this.delete('metadata', key);
  }

  /**
   * 📅 CLEANUP OLD EVENTS - Supprimer événements passés
   */
  static async cleanupOldEvents() {
    await this.init();

    const cutoffDate = this.getCutoffDate();
    let cleaned = 0;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['events'], 'readwrite');
      const store = tx.objectStore('events');
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          const evt = cursor.value;
          const eventDate = new Date(evt.date_debut);

          if (eventDate < cutoffDate) {
            cursor.delete();
            cleaned++;
            console.log('🗑️ Événement passé supprimé:', evt.titre);
          }

          cursor.continue();
        } else {
          if (cleaned > 0) {
            console.log(`🧹 ${cleaned} événement(s) passé(s) nettoyé(s)`);
          }
          resolve(cleaned);
        }
      };

      request.onerror = () => {
        console.error('❌ Erreur cleanup events:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 📅 GET CUTOFF DATE - Aujourd'hui à 3h ou hier 3h
   */
  static getCutoffDate() {
    const now = new Date();
    const cutoff = new Date(now);
    
    if (now.getHours() < 3) {
      cutoff.setDate(cutoff.getDate() - 1);
    }
    
    cutoff.setHours(3, 0, 0, 0);
    return cutoff;
  }

  /**
   * ⚡ VACUUM - Optimisation complète
   */
  static async vacuum() {
    console.log('🧹 Optimisation IndexedDB...');
    
    try {
      const cleanedEvents = await this.cleanupOldEvents();
      
      const total = cleanedEvents;
      console.log('✅ Nettoyage terminé: ' + total + ' élément(s)');
      
      return {
        events: cleanedEvents,
        total: total
      };
    } catch (error) {
      console.error('❌ Erreur vacuum:', error);
      return { events: 0, total: 0 };
    }
  }
}

// ✅ Export global + Planification nettoyage automatique
if (typeof window !== 'undefined') {
  window.IndexedDBManager = IndexedDBManager;
  
  function getDelayUntil3AM() {
    const now = new Date();
    const next3AM = new Date(now);
    
    if (now.getHours() < 3) {
      next3AM.setHours(3, 0, 0, 0);
    } else {
      next3AM.setDate(next3AM.getDate() + 1);
      next3AM.setHours(3, 0, 0, 0);
    }
    
    return next3AM - now;
  }
  
  function scheduleCleanup() {
    const delay = getDelayUntil3AM();
    const hoursUntil = Math.round(delay / 1000 / 60 / 60);
    console.log(`⏰ Prochain nettoyage dans ${hoursUntil}h`);
    
    setTimeout(async () => {
      try {
        console.log('🧹 Nettoyage automatique à 3h...');
        const result = await IndexedDBManager.vacuum();
        await IndexedDBManager.setMeta('lastCleanup', new Date().toISOString());
        console.log(`✅ Nettoyage terminé : ${result.total} élément(s)`);
      } catch (error) {
        console.error('❌ Erreur cleanup automatique:', error.message);
      } finally {
        scheduleCleanup();
      }
    }, delay);
  }
  
  scheduleCleanup();
  
  // Nettoyage au démarrage (si dernier cleanup > 24h)
  IndexedDBManager.init()
    .then(async () => {
      const lastCleanup = await IndexedDBManager.getMeta('lastCleanup');
      if (!lastCleanup || Date.now() - new Date(lastCleanup) > 24 * 60 * 60 * 1000) {
        console.log('🧹 Nettoyage au démarrage...');
        const result = await IndexedDBManager.vacuum();
        await IndexedDBManager.setMeta('lastCleanup', new Date().toISOString());
        console.log(`✅ Startup cleanup: ${result.total} éléments nettoyés`);
      }
    })
    .catch(error => {
      console.error('❌ IndexedDB init failed:', error.message);
      console.warn('⚠️ App en mode dégradé (IndexedDB indisponible)');
    });
}

export default IndexedDBManager;