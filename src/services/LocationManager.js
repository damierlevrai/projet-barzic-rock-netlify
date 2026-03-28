/**
 * 📍 LOCATION MANAGER V2 - IndexedDB + Memory
 * 
 * PRIMARY : IndexedDB (persiste entre sessions)
 * TEMPORARY : Memory (ne persiste pas, session only)
 */

class LocationManager {
  static dbName = 'BarzikLocationDB';
  static storeName = 'locations';
  static version = 1;
  static db = null;

  // Memory cache (session only)
  static temporaryLocation = null;
  static primaryLocation = null;

  /**
   * 🔧 INIT - Initialiser IndexedDB
   */
  static async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ Erreur IndexedDB LocationManager:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ LocationManager IndexedDB initialisé');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'type' });
          store.createIndex('savedAt', 'savedAt', { unique: false });
          console.log('✅ Store locations créé');
        }
      };
    });
  }

  /**
   * 📍 GET USER LOCATION - Position actuelle
   * Ordre de priorité :
   * 1. Temporary (autre ville) - memory
   * 2. Primary (IndexedDB) - persiste
   * 3. GPS nouveau
   */
  static async getUserLocation(forceRefresh = false) {
    console.log('📍 LocationManager.getUserLocation...');

    // 1. Si temporary location en memory, la retourner
    if (this.temporaryLocation && !forceRefresh) {
      console.log('📍 Position temporaire (memory):', this.temporaryLocation.city);
      return { ...this.temporaryLocation, source: 'temporary' };
    }

    // 2. Si primary location en memory et pas forceRefresh, la retourner
    if (this.primaryLocation && !forceRefresh) {
      console.log('📍 Position primaire (memory):', this.primaryLocation.city);
      return { ...this.primaryLocation, source: 'primary' };
    }

    // 3. Charger primary depuis IndexedDB si en memory pas disponible
    if (!this.primaryLocation && !forceRefresh) {
      const dbLocation = await this.getPrimaryLocationFromDB();
      if (dbLocation) {
        this.primaryLocation = dbLocation;
        console.log('📍 Position primaire (IndexedDB):', dbLocation.city);
        return { ...dbLocation, source: 'primary' };
      }
    }

    // 4. Demander GPS
    try {
      const gpsLocation = await this.requestGeolocation();

      // Sauvegarder en IndexedDB comme primary
      await this.savePrimaryLocation(gpsLocation);
      this.primaryLocation = gpsLocation;
      this.temporaryLocation = null; // Reset temporary

      console.log('📍 Position GPS obtenue:', gpsLocation.city);
      return { ...gpsLocation, source: 'gps' };

    } catch (error) {
      console.warn('⚠️ GPS non disponible:', error.message);

      // Fallback : utiliser primary même expiré
      const dbLocation = await this.getPrimaryLocationFromDB();
      if (dbLocation) {
        this.primaryLocation = dbLocation;
        return { ...dbLocation, source: 'primary_expired' };
      }

      throw new Error('Aucune position disponible');
    }
  }

  /**
   * 🌍 REQUEST GEOLOCATION - Demander GPS navigateur
   */
  static async requestGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }

    const options = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 300000  // Accepter une position de moins de 5min
};

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          let city = 'Ville inconnue';
          let postcode = null;
          let display_name = null;

          // Essayer reverse geocode avec timeout
          if (window.GeocodingService) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);

              const address = await window.GeocodingService.reverseGeocode(latitude, longitude);
              clearTimeout(timeoutId);

              if (address) {
                city = address.city || city;
                postcode = address.postcode || postcode;
                display_name = address.display_name || display_name;
              }
            } catch (geocodeError) {
              console.warn('⚠️ Reverse geocode échoué, utiliser fallback:', geocodeError.message);
              // Continuer avec fallback
            }
          }

          resolve({
            latitude,
            longitude,
            city,
            postcode,
            display_name,
            timestamp: Date.now()
          });

        } catch (error) {
          console.error('❌ GPS success handler error:', error.message);
          reject(error);
        }
      },
      (error) => {
        console.error('❌ GPS error:', error.message);
        reject(new Error(`GPS: ${error.message}`));
      },
      options
    );
  });
}

  /**
   * 💾 SAVE PRIMARY LOCATION - Sauvegarder en IndexedDB
   */
  static async savePrimaryLocation(location) {
    await this.init();

    const data = {
      type: 'primary',
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      postcode: location.postcode,
      display_name: location.display_name,
      savedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(data);

      request.onsuccess = () => {
        console.log('💾 Position primaire sauvegardée en IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Erreur save primary location:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 🔍 GET PRIMARY LOCATION FROM DB - Lire IndexedDB
   */
  static async getPrimaryLocationFromDB() {
  try {
    await this.init();

    return new Promise((resolve) => {  // ← Pas de reject
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get('primary');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('⚠️ Erreur get primary location:', request.error);
        resolve(null);  // ← Retourner null au lieu de reject
      };
    });
  } catch (error) {
    console.error('⚠️ getPrimaryLocationFromDB error:', error.message);
    return null;
  }
}

  /**
   * 🌆 SET TEMPORARY LOCATION - Autre ville (memory only)
   * @param {string} cityName - Nom de la ville
   * @note Cette position ne persiste PAS entre sessions
   */
  /**
 * 🌎 SET TEMPORARY LOCATION - Autre ville (memory only)
 * @param {string} cityName - Nom de la ville
 * @note Valide via GeocodingService
 */
static async setTemporaryLocation(cityName) {
    try {
      const cities = await window.GeocodingService?.searchCities(cityName);
      if (!cities || cities.length === 0) {
        throw new Error('Ville non trouvée');
      }

      const city = cities[0];

      this.temporaryLocation = {
        latitude: city.latitude,
        longitude: city.longitude,
        city: city.name,
        display_name: city.display_name,
        postcode: city.postcode,
        timestamp: Date.now()
      };

      console.log('🌍 Position temporaire définie (memory):', city.name);

// Persister en IndexedDB pour admin/orga
const user = window.Auth?.getCurrentUser?.();
if (user?.role === 'admin' || user?.role === 'organizer') {
    await this.savePrimaryLocation({
        ...this.temporaryLocation,
        source: 'manual'
    });
    this.primaryLocation = { ...this.temporaryLocation };
    console.log('💾 Position manuelle persistée pour admin/orga');
}

// Invalider cache...
// Trigger sync...

return this.temporaryLocation;
    } catch (error) {
      console.error('❌ Set temporary location error:', error);
      throw error;
    }
  }

  /**
   * 🔄 RESET TEMPORARY - Revenir à position primaire
   */
  static resetTemporary() {
    this.temporaryLocation = null;
    console.log('🔄 Position temporaire réinitialisée');
  }

  /**
   * 📊 GET STATUS - État actuel des positions
   */
  static async getStatus() {
    const dbLocation = await this.getPrimaryLocationFromDB();

    return {
      hasPrimary: !!dbLocation || !!this.primaryLocation,
      primaryCity: this.primaryLocation?.city || dbLocation?.city || null,
      hasTemporary: !!this.temporaryLocation,
      temporaryCity: this.temporaryLocation?.city || null,
      currentLocation: this.temporaryLocation || this.primaryLocation || dbLocation
    };
  }

  /**
 * 🎯 GET CURRENT LOCATION - Position active (temp ou primary)
 */
static async getCurrentLocationCity() {
    const status = await this.getStatus();
    
    if (status.temporaryCity) {
        return status.temporaryCity;
    }
    
    if (status.primaryCity) {
        return status.primaryCity;
    }
    
    return null;
}

  /**
   * 🗑️ CLEAR PRIMARY - Supprimer position primaire
   */
  static async clearPrimary() {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete('primary');

      request.onsuccess = () => {
        this.primaryLocation = null;
        console.log('🗑️ Position primaire supprimée');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Erreur clear primary:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 🗑️ CLEAR TEMPORARY - Supprimer position temporaire
   */
  static clearTemporary() {
    this.temporaryLocation = null;
    console.log('🗑️ Position temporaire supprimée');
  }

  /**
   * ✅ HAS CACHED LOCATION - Vérifier si position existe
   */
  static async hasCachedLocation() {
    const dbLocation = await this.getPrimaryLocationFromDB();
    return !!(dbLocation || this.primaryLocation || this.temporaryLocation);
  }

  /**
   * 📊 GET CACHE INFO - Infos cache
   */
  static async getCacheInfo() {
    const dbLocation = await this.getPrimaryLocationFromDB();
    const current = this.temporaryLocation || this.primaryLocation || dbLocation;

    if (!current) {
      return {
        exists: false,
        location: null
      };
    }

    const age = Date.now() - current.savedAt;
    const ageHours = Math.floor(age / (1000 * 60 * 60));

    return {
      exists: true,
      ageHours,
      location: {
        city: current.city,
        type: this.temporaryLocation ? 'temporary' : 'primary',
        savedAt: new Date(current.savedAt).toLocaleString('fr-FR')
      }
    };
  }

  /**
   * 🔄 REFRESH LOCATION - Forcer nouveau GPS
   */
  static async refreshLocation() {
    console.log('🔄 Rafraîchissement position...');

    try {
      const location = await this.requestGeolocation();
      await this.savePrimaryLocation(location);
      this.primaryLocation = location;
      this.temporaryLocation = null;
      return location;
    } catch (error) {
      console.error('❌ Refresh location error:', error);
      throw error;
    }
  }

  /**
   * 📍 GET CURRENT OR PROMPT - Position ou demande choix
   */
  static async getCurrentOrPrompt() {
    // Vérifier si position existe
    const hasLocation = await this.hasCachedLocation();
    
    if (hasLocation) {
      const location = this.temporaryLocation || this.primaryLocation || await this.getPrimaryLocationFromDB();
      return {
        hasLocation: true,
        location,
        needsPrompt: false
      };
    }

    // Pas de position → demander choix user
    return {
      hasLocation: false,
      location: null,
      needsPrompt: true
    };
  }

  /**
   * 🎯 GET DISTANCE TO - Distance vers coordonnées
   */
  static async getDistanceTo(targetLat, targetLon) {
    try {
      const userLocation = await window.LocationManager?.getUserLocation().catch(() => null);

      const distance = window.DistanceCalculator?.haversine(
        userLocation.latitude,
        userLocation.longitude,
        targetLat,
        targetLon
      );

      return {
        distance_km: parseFloat(distance.toFixed(2)),
        distance_formatted: window.DistanceCalculator?.format(distance)
      };

    } catch (error) {
      console.error('❌ Get distance error:', error);
      return null;
    }
  }
}

// Auto-init
if (typeof window !== 'undefined') {
  LocationManager.init().catch(e => console.warn('LocationManager init error:', e));
  window.LocationManager = LocationManager;
}

export default LocationManager;