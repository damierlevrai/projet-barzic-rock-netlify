/**
 * 📏 DISTANCE CALCULATOR - Calculs géographiques
 * 
 * Formule Haversine : Distance précise sur sphère
 * Usage : Tri events par proximité
 */

class DistanceCalculator {
  static EARTH_RADIUS_KM = 6371;

  /**
   * 📏 HAVERSINE - Distance entre 2 points GPS (km)
   * @param {number} lat1 - Latitude point 1
   * @param {number} lon1 - Longitude point 1
   * @param {number} lat2 - Latitude point 2
   * @param {number} lon2 - Longitude point 2
   * @returns {number} Distance en km
   */
  static haversine(lat1, lon1, lat2, lon2) {
  // Validation input
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || 
      !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    console.error('❌ Haversine: coordonnées invalides', { lat1, lon1, lat2, lon2 });
    return 0;
  }

  const dLat = this.toRadians(lat2 - lat1);
  const dLon = this.toRadians(lon2 - lon1);

    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    // Formule Haversine
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * 🔄 TO RADIANS - Degrés → Radians
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 🔄 TO DEGREES - Radians → Degrés
   */
  static toDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  /**
   * 📐 FORMAT DISTANCE - Affichage lisible
   * @param {number} km - Distance en km
   * @returns {string} "5.2 km" ou "850 m"
   */
  static format(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }

    if (km < 10) {
      return `${km.toFixed(1)} km`;
    }

    return `${Math.round(km)} km`;
  }

  /**
   * 🎯 CALCULATE BEARING - Direction entre 2 points
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number} Angle en degrés (0-360)
   */
  static calculateBearing(lat1, lon1, lat2, lon2) {
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);
    const dLon = this.toRadians(lon2 - lon1);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    const bearingDeg = this.toDegrees(bearing);

    return (bearingDeg + 360) % 360;
  }

  /**
   * 🧭 GET DIRECTION - Direction cardinale
   * @param {number} bearing - Angle en degrés
   * @returns {string} "N", "NE", "E", etc.
   */
  static getDirection(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  /**
   * 📍 SORT BY DISTANCE - Trier array par proximité
   * @param {Array} items - Items avec latitude/longitude
   * @param {number} userLat
   * @param {number} userLon
   * @returns {Array} Items triés avec distance_km ajoutée
   */
  static sortByDistance(items, userLat, userLon) {
    return items
      .map(item => {
        // Calculer distance
        const distance = this.haversine(
          userLat, userLon,
          item.latitude, item.longitude
        );

        return {
          ...item,
          distance_km: parseFloat(distance.toFixed(2)),
          distance_formatted: this.format(distance)
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km);
  }

  /**
   * 🔍 FILTER BY RADIUS - Filtrer par rayon
   * @param {Array} items - Items avec latitude/longitude
   * @param {number} userLat
   * @param {number} userLon
   * @param {number} radiusKm - Rayon en km
   * @returns {Array} Items dans le rayon
   */
  static filterByRadius(items, userLat, userLon, radiusKm) {
    return items.filter(item => {
      if (!item.latitude || !item.longitude) return false;

      const distance = this.haversine(
        userLat, userLon,
        item.latitude, item.longitude
      );

      return distance <= radiusKm;
    });
  }

  /**
   * 📊 GET BOUNDING BOX - Zone géographique approximative
   * @param {number} centerLat
   * @param {number} centerLon
   * @param {number} radiusKm
   * @returns {Object} { minLat, maxLat, minLon, maxLon }
   */
  static getBoundingBox(centerLat, centerLon, radiusKm) {
    // 1° latitude ≈ 111 km
    const latDelta = radiusKm / 111;

    // 1° longitude varie selon latitude
    const lonDelta = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

    return {
      minLat: centerLat - latDelta,
      maxLat: centerLat + latDelta,
      minLon: centerLon - lonDelta,
      maxLon: centerLon + lonDelta
    };
  }

  /**
   * ✅ IS IN BOUNDING BOX - Vérifier si point dans zone
   */
  static isInBoundingBox(lat, lon, box) {
    return lat >= box.minLat && lat <= box.maxLat &&
           lon >= box.minLon && lon <= box.maxLon;
  }

  /**
   * 🎯 FIND NEAREST - Trouver le plus proche
   * @param {Array} items
   * @param {number} userLat
   * @param {number} userLon
   * @returns {Object} Item le plus proche avec distance
   */
  static findNearest(items, userLat, userLon) {
    if (!items || items.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const item of items) {
      if (!item.latitude || !item.longitude) continue;

      const distance = this.haversine(
        userLat, userLon,
        item.latitude, item.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          ...item,
          distance_km: parseFloat(distance.toFixed(2)),
          distance_formatted: this.format(distance)
        };
      }
    }

    return nearest;
  }

  /**
   * 📍 GROUP BY CITY - Grouper par ville
   * @param {Array} items
   * @param {number} userLat
   * @param {number} userLon
   * @returns {Object} { ville: [...items], ... } triées par distance
   */
  static groupByCity(items, userLat, userLon) {
  const groups = {};

  for (const item of items) {
    let city = item.ville || item.city || 'Non spécifié';
    
    // Normaliser: lowercase + sans accents
    city = city
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (!groups[city]) {
      groups[city] = [];
    }

    // Calculer distance
    const distance = this.haversine(
      userLat, userLon,
      item.latitude, item.longitude
    );

    groups[city].push({
      ...item,
      distance_km: parseFloat(distance.toFixed(2))
    });
  }

  // Trier items dans chaque ville
  for (const city in groups) {
    groups[city].sort((a, b) => a.distance_km - b.distance_km);
  }

  return groups;
}
}

// Export global
if (typeof window !== 'undefined') {
  window.DistanceCalculator = DistanceCalculator;
}

export default DistanceCalculator;