/**
 * 🔄 DATA CHANGE DETECTOR - Détecter changements dans forms
 * Utilisé par AdminEstablishmentTab et AdminEventTab
 * Détermine si upload Supabase nécessaire et quel status
 */

class DataChangeDetector {
  /**
   * 🔍 DETECT CHANGES - Comparer données originales vs modifiées
   * @param {Object} original - Item original (depuis IndexedDB)
   * @param {Object} modified - Item modifié (depuis form)
   * @returns {Object} { hasChanges, changedFields, needsPhotoSync, photoChanged }
   */
  static detectEstablishmentChanges(original, modified) {
    const changes = {
      hasChanges: false,
      changedFields: [],
      needsPhotoSync: false,
      photoChanged: false,
      originalPhotoId: original.photo_id,
      newPhotoId: modified.photo_id
    };

    // Fields texte à comparer
    const textFields = [
      'nom', 
      'description', 
      'adresse', 
      'code_postal', 
      'ville', 
      'telephone', 
      'email', 
      'latitude', 
      'longitude'
    ];

    for (const field of textFields) {
      const originalValue = (original[field] || '').toString().trim();
      const modifiedValue = (modified[field] || '').toString().trim();
      
      if (originalValue !== modifiedValue) {
        changes.hasChanges = true;
        changes.changedFields.push(field);
      }
    }

    // Détecter changement photo
    if (original.photo_id !== modified.photo_id) {
      changes.hasChanges = true;
      changes.photoChanged = true;
      changes.needsPhotoSync = true;
      changes.changedFields.push('photo');
    }

    return changes;
  }

  /**
   * 🔍 DETECT CHANGES - Pour events
   */
  static detectEventChanges(original, modified) {
    const changes = {
      hasChanges: false,
      changedFields: [],
      needsPhotoSync: false,
      photoChanged: false,
      originalPhotoId: original.photo_id,
      newPhotoId: modified.photo_id
    };

    // Fields texte pour events
    const textFields = [
      'titre', 
      'description', 
      'adresse', 
      'code_postal', 
      'ville', 
      'telephone', 
      'email',
      'latitude',
      'longitude'
    ];

    for (const field of textFields) {
      const originalValue = (original[field] || '').toString().trim();
      const modifiedValue = (modified[field] || '').toString().trim();
      
      if (originalValue !== modifiedValue) {
        changes.hasChanges = true;
        changes.changedFields.push(field);
      }
    }

    // Dates
    if (original.date_debut !== modified.date_debut) {
      changes.hasChanges = true;
      changes.changedFields.push('date_debut');
    }

    if ((original.date_fin || null) !== (modified.date_fin || null)) {
      changes.hasChanges = true;
      changes.changedFields.push('date_fin');
    }

    // Photo
    if (original.photo_id !== modified.photo_id) {
      changes.hasChanges = true;
      changes.photoChanged = true;
      changes.needsPhotoSync = true;
      changes.changedFields.push('photo');
    }

    return changes;
  }

  /**
   * 📊 GET NEXT STATUS - Déterminer status après modification
   * @param {string} role - 'admin' ou 'organizer'
   * @param {string} originalStatus - Status original
   * @param {boolean} hasPhotoChange - Y a-t-il changement photo
   * @returns {string} Nouveau status
   */
  static getNextStatus(role, originalStatus, hasPhotoChange) {
    if (role === 'admin') {
      // Admin: status reste 'approved' même après modif
      // (admin valide implicitement ses modifs)
      return 'approved';
    }

    if (role === 'organizer') {
      // Orga: ANY change = status → 'pending' (revalidation requise)
      
      if (originalStatus === 'local') {
        // local → pending (première upload)
        return 'pending';
      } else if (originalStatus === 'pending') {
        // stay pending
        return 'pending';
      } else if (originalStatus === 'approved') {
        // approved → pending (revalidation requise)
        return 'pending';
      }
    }

    return originalStatus;
  }

  /**
   * 🎯 GET STATUS LABEL - Label lisible du status
   */
  static getStatusLabel(status) {
    const labels = {
      'local': '⚠️ Non synchronisé',
      'pending': '⏳ En attente de modération',
      'approved': '✅ Approuvé'
    };
    return labels[status] || status;
  }

  /**
   * 🎯 FORMAT CHANGES - Format lisible pour logs
   */
  static formatChanges(changes) {
    return {
      hasChanges: changes.hasChanges,
      fields: changes.changedFields.join(', '),
      photoChanged: changes.photoChanged
    };
  }
}

// Export
if (typeof window !== 'undefined') {
  window.DataChangeDetector = DataChangeDetector;
}

export default DataChangeDetector;
