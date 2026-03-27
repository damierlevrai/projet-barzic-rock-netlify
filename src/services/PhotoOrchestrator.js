/**
 * 🖼️ PHOTO ORCHESTRATOR - Gestion complète du cycle photo
 * Unifie : processFile, cache, upload, dedup, cleanup
 */

class PhotoOrchestrator {

  /**
 * 🎯 ATTACH PHOTO TO ITEM - Workflow complet avec dédup
 */
static async attachPhotoToItem(file, itemId, itemType) {
  try {
    console.log(`🖼️ Attaching photo to ${itemType}: ${itemId.substring(0, 8)}`);

    // STEP 1: Traiter image
    const processed = await this.processPhotoFile(file);
    console.log(`✅ Photo processed: ${processed.photoId.substring(0, 8)}, hash: ${processed.hash.substring(0, 12)}`);

    // STEP 2: 🆕 Vérifier déduplication (par hash)
    const existing = await this.findPhotoByHash(processed.hash);
    if (existing && existing.blob) {
      console.log('♻️ Photo réutilisée (IndexedDB)');
      return {
        reused: true,
        photoHash: existing.hash,
        photoId: existing.id,
        photoIdLocal: existing.id
      };
    }

    // STEP 3: Créer liaison photo_ref
    const photoRef = {
      id: this.generateId(),
      photo_hash: processed.hash,
      photo_id: processed.photoId,
      item_id: itemId,
      item_type: itemType,
      status: 'local',
      retries: 0,
      error: null,
      created_at: new Date().toISOString()
    };

    await window.IndexedDBManager.put('photo_refs', photoRef);
    console.log(`✅ PhotoRef stored: ${photoRef.id.substring(0, 8)}`);

    // STEP 4: Stocker blob en cache
    await window.IndexedDBManager.put('photos', {
      id: processed.photoId,
      blob: processed.blob,
      hash: processed.hash,
      status: 'local',
      created_at: new Date().toISOString(),
      size_kb: (processed.blob.size / 1024).toFixed(2)
    });

    return {
      reused: false,
      photoHash: processed.hash,
      photoId: photoRef.id,
      photoIdLocal: processed.photoId
    };

  } catch (error) {
    console.error('❌ Photo attachment failed:', error);
    throw error;
  }
}

/**
 * 🆕 FIND PHOTO BY HASH - Déduplication IndexedDB
 */
static async findPhotoByHash(hash) {
  try {
    const allPhotos = await window.IndexedDBManager.query('photos', 'hash', hash);
    return allPhotos && allPhotos.length > 0 ? allPhotos[0] : null;
  } catch (error) {
    console.warn('⚠️ Find photo by hash error:', error);
    return null;
  }
}

  /**
   * 📤 UPLOAD PHOTO - Avec retry et atomic update
   */
  static async uploadPhoto(photoRef) {
    try {
      console.log(`📤 Uploading photo: ${photoRef.id.substring(0, 8)}`);

      // Récupérer le blob du cache
      const photoData = await window.IndexedDBManager.get('photos', photoRef.photo_id);
      if (!photoData?.blob) {
        throw new Error('Photo blob not found in cache');
      }

      // Upload vers Supabase
      const result = await window.PhotoService?.upload(
        { universal: photoData.blob },
        photoRef.item_id,
        `${photoRef.item_type}-photos`
      );

      if (!result?.photo_url) {
        throw new Error('No photo URL returned from Supabase');
      }

      // Mettre à jour photo_ref avec URL
      photoRef.status = 'uploaded';
      photoRef.supabase_url = result.photo_url;
      photoRef.photo_hash = result.hash;
      photoRef.uploaded_at = new Date().toISOString();

      await window.IndexedDBManager.put('photo_refs', photoRef);
      console.log(`✅ Photo uploaded: ${result.photo_url.substring(0, 50)}...`);

      return result.photo_url;

    } catch (error) {
      console.error('❌ Photo upload failed:', error);
      
      // Marquer comme failed pour retry
      photoRef.status = 'failed';
      photoRef.error = error.message;
      photoRef.retries = (photoRef.retries || 0) + 1;

      await window.IndexedDBManager.put('photo_refs', photoRef);
      
      throw error;
    }
  }

  /**
 * 🔍 FIND EXISTING PHOTO BY HASH
 */
static async findExistingPhotoByHash(photoHash) {
  try {
    if (!photoHash) return null;
    
    const key = `photo_hash_${photoHash}`;
    const metadata = await IndexedDBManager.get('app_metadata', key);
    
    if (metadata && metadata.count > 0) {
      const allRefs = await IndexedDBManager.getAll('photo_refs');
      const ref = allRefs.find(r => r.photo_hash === photoHash);
      
      if (ref && ref.photo_id) {
        console.log(`✅ Photo existante trouvée: ${ref.photo_id.substring(0, 12)}`);
        return ref.photo_id;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Error finding existing photo:', error);
    return null;
  }
}

  /**
   * 🧹 CLEANUP - Supprimer photos orphelines + Supabase Storage
   */
  static async cleanup() {
    try {
      console.log('🧹 PhotoOrchestrator cleanup...');

      // Récupérer toutes les photos
      const allPhotos = await window.IndexedDBManager.getAll('photo_refs');
      const allEvents = await window.IndexedDBManager.getAll('events');
      const allEstabs = await window.IndexedDBManager.getAll('establishments');

      // Items valides
      const validItemIds = new Set([
        ...allEvents.map(e => e.id),
        ...allEstabs.map(e => e.id)
      ]);

      // Trouver orphelins
      const orphans = allPhotos.filter(p => 
      p.item_id && !validItemIds.has(p.item_id)  
      );

      let deletedLocal = 0;
      let deletedSupabase = 0;

      for (const orphan of orphans) {
        try {
          // Supprimer du cache local
          if (orphan.photo_id) {
            await window.IndexedDBManager.delete('photos', orphan.photo_id);
            deletedLocal++;
          }

          // Supprimer de Supabase Storage
          if (orphan.supabase_url) {
            await window.PhotoService?.deletePhotos(
              `${orphan.item_type}-photos`,
              [orphan.supabase_url]
            );
            deletedSupabase++;
          }

          // Supprimer la référence
          await window.IndexedDBManager.delete('photo_refs', orphan.id);
        } catch (error) {
          console.warn(`⚠️ Error deleting orphan ${orphan.id}:`, error);
        }
      }

      console.log(`🧹 Cleanup complete: ${deletedLocal} local, ${deletedSupabase} Supabase`);
      return { deletedLocal, deletedSupabase };

    } catch (error) {
      console.error('❌ Cleanup error:', error);
      return { deletedLocal: 0, deletedSupabase: 0, error: error.message };
    }
  }

  /**
   * 🔧 PROCESS PHOTO FILE - Traiter le fichier
   */
  static async processPhotoFile(file) {
    try {
      // Utiliser PhotoManager existant
      if (!window.PhotoManager) {
        throw new Error('PhotoManager not available');
      }

      const pm = new window.PhotoManager();
      const result = await pm.processFile(file);

      return {
        photoId: result.photoId,
        blob: result.universal,
        hash: await this.calculateHash(result.universal)
      };

    } catch (error) {
      console.error('❌ Process photo error:', error);
      throw error;
    }
  }

  /**
   * 🔐 CALCULATE HASH - SHA-256
   */
  static async calculateHash(blob) {
    try {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('❌ Hash calculation error:', error);
      throw error;
    }
  }

  /**
   * 🎲 GENERATE ID - Unique ID
   */
  static generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 📊 GET STATS - Statistiques des photos
   */
  static async getStats() {
    try {
      const allPhotos = await window.IndexedDBManager.getAll('photo_refs');
      const allPhotoData = await window.IndexedDBManager.getAll('photos');

      return {
        total_refs: allPhotos.length,
        uploaded: allPhotos.filter(p => p.status === 'uploaded').length,
        pending: allPhotos.filter(p => p.status === 'local').length,
        failed: allPhotos.filter(p => p.status === 'failed').length,
        total_blobs: allPhotoData.length,
        total_size_mb: (allPhotoData.reduce((sum, p) => sum + (p.size_kb || 0), 0) / 1024).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return { error: error.message };
    }
  }

  /**
   * 📸 GET PHOTO BLOB - Récupérer blob du cache local
   * Utilisé par les tabs pour afficher photos offline
   */
  static async getPhotoBlob(photoId) {
    try {
      const photo = await window.IndexedDBManager.get('photos', photoId);
      return photo?.blob || null;
    } catch (error) {
      console.warn('⚠️ Error getting photo blob:', photoId, error);
      return null;
    }
  }

  /**
   * 🖼️ GET PHOTO URL - Retourner blob OR Supabase URL (smart)
   * Priority 1: Blob local (offline)
   * Priority 2: URL Supabase (online)
   */
  static async getPhotoUrl(item) {
    // PRIORITY 1 : Blob local (offline disponible)
    if (item.photo_id) {
      const blob = await this.getPhotoBlob(item.photo_id);
      if (blob instanceof Blob) {
        const objectUrl = URL.createObjectURL(blob);
        console.log(`✅ ObjectURL créée: ${item.photo_id.substring(0, 8)}`);
        return objectUrl;
      }
    }

    // PRIORITY 2 : URL Supabase (après sync)
    if (item.photo_url && item.supabase_synced) {
      console.log(`📸 Using Supabase URL: ${item.photo_url.substring(0, 50)}...`);
      return item.photo_url;
    }

    return null;
  }

  /**
   * 📊 GET STATS FOR BACKUP - Stats photos pour AdminBackupTab export/import
   */
  static async getStatsForBackup() {
    try {
      const allPhotos = await window.IndexedDBManager.getAll('photos');
      const allRefs = await window.IndexedDBManager.getAll('photo_refs');
      
      const totalSizeBytes = allPhotos.reduce((sum, p) => sum + (p.blob?.size || 0), 0);
      
      return {
        total: allPhotos.length,
        total_refs: allRefs.length,
        uploaded: allRefs.filter(r => r.status === 'uploaded').length,
        pending: allRefs.filter(r => r.status === 'local').length,
        failed: allRefs.filter(r => r.status === 'failed').length,
        total_size_mb: (totalSizeBytes / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return { 
        error: error.message,
        total: 0,
        total_refs: 0,
        uploaded: 0,
        pending: 0,
        failed: 0,
        total_size_mb: 0
      };
    }
  }
}  // ✅ Fermeture de classe CORRECTE

// Export
if (typeof window !== 'undefined') {
  window.PhotoOrchestrator = PhotoOrchestrator;
}

export default PhotoOrchestrator;