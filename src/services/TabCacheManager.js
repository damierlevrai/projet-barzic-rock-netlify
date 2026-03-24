/**
 * 💾 TAB CACHE MANAGER - Cache mémoire des onglets
 * 
 * Stocke résultats par tab (memory-based, pas IndexedDB)
 * Switch rapide entre onglets
 * Invalidation manuelle ou auto
 */

class TabCacheManager {
  static cache = {
    establishments: { 
      items: [], 
      filter: 'all', 
      sort: 'name',
      searchQuery: '',
      timestamp: null 
    },
    events: { 
      items: [], 
      filter: 'all', 
      sort: 'date',
      searchQuery: '',
      timestamp: null 
    },
    moderation: { 
      itemsLocal: [], 
      itemsPending: [],
      view: 'all',
      timestamp: null 
    },
    accounts: {
      items: [],
      filter: 'all',
      searchQuery: '',
      timestamp: null
    },
    backup: {
      stats: null,
      timestamp: null
    }
  };

  static AUTO_INVALIDATE_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * 💾 SET - Stocker cache pour un tab
   * @param {string} tabName - 'establishments', 'events', 'moderation', etc
   * @param {Object} data - Données à cacher
   */
  static set(tabName, data) {
    if (!this.cache[tabName]) {
      console.warn(`⚠️ Tab inconnu: ${tabName}`);
      return;
    }

    this.cache[tabName] = {
      ...this.cache[tabName],
      ...data,
      timestamp: Date.now()
    };

    console.log(`💾 Cache ${tabName} mis à jour`, data);

    // Auto-invalidate après 5min
    this.scheduleInvalidate(tabName);
  }

  /**
   * 🔍 GET - Récupérer cache pour un tab
   * @param {string} tabName
   * @returns {Object|null} Cache ou null si expiré
   */
  static get(tabName) {
    if (!this.cache[tabName]) return null;

    const cached = this.cache[tabName];

    // Vérifier expiration (5 min)
    if (cached.timestamp) {
      const age = Date.now() - cached.timestamp;
      if (age > this.AUTO_INVALIDATE_MS) {
        console.log(`⏰ Cache ${tabName} expiré (${Math.floor(age / 1000)}s)`);
        this.invalidate(tabName);
        return null;
      }
    }

    return cached;
  }

  /**
   * 🔄 GET OR FETCH - Récupérer cache ou fetch IndexedDB
   * @param {string} tabName
   * @param {Function} fetchFn - Fonction pour fetch (await IndexedDBManager.getAll(), etc)
   */
  static async getOrFetch(tabName, fetchFn) {
  // 1. Check cache
  const cached = this.get(tabName);
  if (cached?.items?.length > 0) {
    console.log(`🚀 Cache hit: ${tabName}`);
    return cached;
  }

  // 2. Éviter race conditions: vérifier un flag de fetch en cours
  if (this.cache[tabName]._isFetching) {
    console.log(`⏳ Fetch en cours pour ${tabName}, attendre...`);
    // Attendre 100ms et réessayer
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.get(tabName) || { items: [] };
  }

  // 3. Marquer comme fetching
  this.cache[tabName]._isFetching = true;

  try {
    console.log(`📦 Cache miss, fetching ${tabName}...`);
    const items = await fetchFn();

    // 4. Store en cache
    this.set(tabName, { items });

    return this.get(tabName);
  } finally {
    // 5. Marquer fetch terminé
    this.cache[tabName]._isFetching = false;
  }
}

  /**
   * 🗑️ INVALIDATE - Effacer cache d'un tab
   */
  static invalidate(tabName) {
  if (!this.cache[tabName]) return;

  console.log(`🗑️ Cache ${tabName} invalidé`);

  // Nettoyer le timeout en attente
  if (this.cache[tabName]._invalidateTimeout) {
    clearTimeout(this.cache[tabName]._invalidateTimeout);
    this.cache[tabName]._invalidateTimeout = null;
  }

  // Réinitialiser avec structure de base
  if (tabName === 'moderation') {
    this.cache[tabName] = { 
      itemsLocal: [], 
      itemsPending: [],
      view: 'all',
      timestamp: null,
      _invalidateTimeout: null  // ← Ajouter
    };
  } else if (tabName === 'backup') {
    this.cache[tabName] = { 
      stats: null, 
      timestamp: null,
      _invalidateTimeout: null  // ← Ajouter
    };
  } else {
    this.cache[tabName] = {
      ...this.cache[tabName],
      items: [],
      timestamp: null,
      _invalidateTimeout: null  // ← Ajouter
    };
  }
}

  /**
   * 🧹 CLEAR ALL - Vider tout le cache
   */
  static clearAll() {
    console.log('🧹 Cache complètement vidé');
    Object.keys(this.cache).forEach(key => this.invalidate(key));
  }

  /**
   * ⏰ SCHEDULE INVALIDATE - Auto-invalidate après 5min
   */
  static scheduleInvalidate(tabName) {
    // Annuler timeout précédent (s'il existe)
    if (this.cache[tabName]._invalidateTimeout) {
      clearTimeout(this.cache[tabName]._invalidateTimeout);
    }

    // Créer nouveau timeout
    this.cache[tabName]._invalidateTimeout = setTimeout(() => {
      console.log(`⏰ Auto-invalidate: ${tabName}`);
      this.invalidate(tabName);
    }, this.AUTO_INVALIDATE_MS);
  }

  /**
   * 📊 GET CACHE INFO - Infos cache
   */
  static getCacheInfo() {
    const info = {};

    Object.keys(this.cache).forEach(tabName => {
      const cached = this.cache[tabName];
      const age = cached.timestamp ? Date.now() - cached.timestamp : null;
      const isExpired = age > this.AUTO_INVALIDATE_MS;

      info[tabName] = {
        size: cached.items?.length || 0,
        age_ms: age,
        expired: isExpired,
        has_data: !!(cached.items?.length > 0 || cached.itemsLocal?.length > 0)
      };
    });

    return info;
  }

  /**
   * 📋 INVALIDATE ON LOGOUT - Vider cache à la déconnexion
   */
  static onLogout() {
    console.log('👋 Logout: vider cache');
    this.clearAll();
  }

  /**
   * 🔄 UPDATE FILTER - Mettre à jour filter/sort d'un tab
   */
  static updateFilter(tabName, filter, sort = null, searchQuery = '') {
    if (!this.cache[tabName]) return;

    this.cache[tabName] = {
      ...this.cache[tabName],
      filter,
      sort: sort || this.cache[tabName].sort,
      searchQuery
    };

    console.log(`🔄 ${tabName} filter updated:`, { filter, sort, searchQuery });
  }

  /**
   * 🔍 UPDATE SEARCH - Mettre à jour recherche d'un tab
   */
  static updateSearch(tabName, searchQuery) {
    if (!this.cache[tabName]) return;

    this.cache[tabName].searchQuery = searchQuery;
    console.log(`🔍 ${tabName} search:`, searchQuery);
  }
}

// Export global
if (typeof window !== 'undefined') {
  window.TabCacheManager = TabCacheManager;
}

export default TabCacheManager;