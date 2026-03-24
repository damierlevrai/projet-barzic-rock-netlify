/**
 * 🗺️ GEOCODING SERVICE - API Adresse + Nominatim (STRATÉGIE OPTIMALE)
 * 
 * ✅ API Adresse D'ABORD : Meilleur pour la France
 * ✅ Nominatim FALLBACK : Reconnaît plus de petites routes
 * ✅ Coordonnées PAR DÉFAUT : Jamais de freeze
 * ✅ ADRESSE UTILISATEUR : Toujours gardée complète
 */

class GeocodingService {
  static apiAdresseUrl = 'https://api-adresse.data.gouv.fr/search';
  static nominatimUrl = 'https://nominatim.openstreetmap.org';
  static nominatimUserAgent = 'BarzikApp/1.0 (contact@barzik.fr)';
  
  static lastRequestTime = 0;
  static minDelay = 500;
  static isWaiting = false;

  // Coordonnées par défaut (centre de la France)
  static defaultCoords = {
    latitude: 46.227638,
    longitude: 2.213749,
    display_name: 'France'
  };

  /**
   * 🗺️ GEOCODE ADDRESS - STRATÉGIE OPTIMALE
   * 1. API Adresse (La Poste) - Meilleur pour France
   * 2. Nominatim (OSM) - Reconnaît plus de petites routes
   * 3. Coordonnées par défaut - Jamais de freeze
   * 
   * ⭐ IMPORTANT : Garde TOUJOURS l'adresse complète saisie par l'utilisateur
   */
  static async geocodeAddress(adresse, ville, codePostal = null) {
    try {
      console.log('🗺️ Geocoding: Tentative API Adresse...');
      
      // STEP 1: Essayer API Adresse (LA POSTE)
      try {
        const result1 = await this.geocodeWithApiAdresse(adresse, ville, codePostal);
        if (result1) {
          // ✅ API Adresse a trouvé → retourner avec adresse utilisateur complète
          return {
            ...result1,
            display_name: adresse, // ⭐ GARDER ADRESSE UTILISATEUR
            adresse_complete: adresse,
            source: 'api-adresse'
          };
        }
      } catch (error1) {
        console.warn('⚠️ API Adresse échouée:', error1.message);
      }

      // STEP 2: Fallback Nominatim (OpenStreetMap)
      console.log('🗺️ Geocoding: Fallback Nominatim...');
      try {
        const result2 = await this.geocodeWithNominatim(adresse, ville, codePostal);
        if (result2) {
          // ✅ Nominatim a trouvé → retourner avec adresse utilisateur complète
          return {
            ...result2,
            display_name: adresse, // ⭐ GARDER ADRESSE UTILISATEUR
            adresse_complete: adresse,
            source: 'nominatim'
          };
        }
      } catch (error2) {
        console.warn('⚠️ Nominatim échouée:', error2.message);
      }

      // STEP 3: Fallback coordonnées par défaut (NE PAS FREEZE)
      console.warn('⚠️ Geocoding indisponible, utilisation coordonnées par défaut');
      return {
        latitude: this.defaultCoords.latitude,
        longitude: this.defaultCoords.longitude,
        display_name: adresse, // ⭐ GARDER ADRESSE UTILISATEUR
        adresse_complete: adresse,
        city: ville,
        postcode: codePostal,
        fallback: true,
        source: 'default'
      };

    } catch (error) {
      console.error('❌ Geocoding error:', error);
      // Ne jamais thrower - retourner fallback
      return {
        latitude: this.defaultCoords.latitude,
        longitude: this.defaultCoords.longitude,
        display_name: adresse,
        adresse_complete: adresse,
        city: ville,
        postcode: codePostal,
        fallback: true,
        source: 'default'
      };
    }
  }

  /**
   * 📬 GEOCODE WITH API ADRESSE - La Poste/INSEE (MEILLEUR POUR FRANCE)
   */
  static async geocodeWithApiAdresse(adresse, ville, codePostal) {
    await this.waitRateLimit();

    // Construire query optimale pour API Adresse
    const query = codePostal 
      ? `${adresse} ${codePostal}`
      : `${adresse} ${ville}`;

    console.log('📬 API Adresse query:', query);

    const params = new URLSearchParams({
      q: query,
      limit: 1,
      autosearch: 1
    });

    const response = await fetch(`${this.apiAdresseUrl}?${params}`);

    if (!response.ok) {
      throw new Error(`API Adresse error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error('API Adresse: Aucune adresse trouvée');
    }

    const feature = data.features[0];
    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    console.log('✅ API Adresse trouvée:', props.label);

    return {
      latitude: coords[1],
      longitude: coords[0],
      city: props.city || props.municipality || ville,
      postcode: props.postcode || codePostal,
      address: {
        road: props.street,
        city: props.city,
        postcode: props.postcode,
        county: props.county,
        state: props.region
      }
    };
  }

  /**
   * 🌍 GEOCODE WITH NOMINATIM - OpenStreetMap (MEILLEUR FALLBACK)
   * ⭐ Reconnaît souvent les petites routes que API Adresse ne voit pas
   */
  static async geocodeWithNominatim(adresse, ville, codePostal) {
    await this.waitRateLimit();

    const parts = [];
    if (adresse) parts.push(adresse);
    if (codePostal) parts.push(codePostal);
    if (ville) parts.push(ville);
    parts.push('France');

    const query = parts.join(', ');

    console.log('🌍 Nominatim query:', query);

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: 1,
      countrycodes: 'fr',
      addressdetails: 1
    });

    const response = await fetch(`${this.nominatimUrl}/search?${params}`, {
      headers: {
        'User-Agent': this.nominatimUserAgent
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('Nominatim: Aucune coordonnée trouvée');
    }

    const result = data[0];

    const cleanDisplayName = [
      result.address?.road,
      result.address?.city || result.address?.town,
      result.address?.county,
      result.address?.state
    ].filter(Boolean).join(', ');

    console.log('✅ Nominatim trouvée:', cleanDisplayName);

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      city: result.address?.city || result.address?.town || result.address?.village || ville,
      postcode: result.address?.postcode || codePostal,
      address: result.address
    };
  }

  /**
   * 🔍 SEARCH CITIES - Autocomplete villes (API Adresse)
   */
  static async searchCities(query) {
    if (!query || query.length < 2) {
      return [];
    }

    await this.waitRateLimit();

    try {
      const params = new URLSearchParams({
        q: query,
        type: 'municipality',
        limit: 10,
        autocomplete: 1
      });

      const response = await fetch(`${this.apiAdresseUrl}?${params}`);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (!data.features) {
        return [];
      }

      return data.features.map(item => {
        const props = item.properties;
        const coords = item.geometry.coordinates;
        return {
          name: props.city || props.municipality || props.name,
          latitude: coords[1],
          longitude: coords[0],
          display_name: props.label,
          postcode: props.postcode
        };
      });

    } catch (error) {
      console.error('❌ City search error:', error);
      return [];
    }
  }

  /**
   * 🔄 REVERSE GEOCODE - Coordonnées → adresse
   */
  static async reverseGeocode(latitude, longitude) {
    await this.waitRateLimit();

    try {
      // Essayer API Adresse reverse
      try {
        const params = new URLSearchParams({
          lon: longitude,
          lat: latitude,
          type: 'street'
        });

        const response = await fetch(`https://api-adresse.data.gouv.fr/reverse?${params}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const props = data.features[0].properties;
            return {
              city: props.city,
              postcode: props.postcode,
              display_name: props.label,
              address: { city: props.city, postcode: props.postcode }
            };
          }
        }
      } catch (e) {
        console.warn('API Adresse reverse échouée, fallback Nominatim');
      }

      // Fallback Nominatim
      const params = new URLSearchParams({
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1
      });

      const response = await fetch(`${this.nominatimUrl}/reverse?${params}`, {
        headers: {
          'User-Agent': this.nominatimUserAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim reverse error: ${response.status}`);
      }

      const data = await response.json();

      return {
        city: data.address?.city || data.address?.town || data.address?.village,
        postcode: data.address?.postcode,
        display_name: data.display_name,
        address: data.address
      };

    } catch (error) {
      console.error('❌ Reverse geocode error:', error);
      return {
        city: 'France',
        postcode: null,
        display_name: 'Position inconnue'
      };
    }
  }

  /**
   * ⏱️ WAIT RATE LIMIT
   */
  static async waitRateLimit() {
    let waitCount = 0;
    while (this.isWaiting && waitCount < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waitCount++;
    }

    this.isWaiting = true;

    try {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;

      if (elapsed < this.minDelay) {
        const waitTime = this.minDelay - elapsed;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      this.lastRequestTime = Date.now();
    } finally {
      this.isWaiting = false;
    }
  }

  /**
   * 🔤 NORMALIZE CITY
   */
  static normalizeCity(city) {
    if (!city) return null;

    return city
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * 📍 GET BOUNDING BOX
   */
  static getBoundingBox(latitude, longitude, radiusKm) {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    return {
      minLat: latitude - latDelta,
      maxLat: latitude + latDelta,
      minLon: longitude - lonDelta,
      maxLon: longitude + lonDelta
    };
  }
}

// Export global
if (typeof window !== 'undefined') {
  window.GeocodingService = GeocodingService;
}

export default GeocodingService;