/**
 * 📤 PHOTO SERVICE - Upload unifié avec déduplication
 * 
 * Remplace : PhotoUploader.js + backgroundUploader.js
 * Upload : 1 version 600x600 vers Supabase Storage
 * Déduplication : Par hash (réutilise URL si existe)
 */

class PhotoService {
  
  /**
   * 📤 UPLOAD - Upload photo avec déduplication SHA-256
   */
  static async upload(imageData, eventId, bucket) {
  if (!window.supabaseInstance) {
    throw new Error('Supabase non disponible');
  }

  if (!imageData || !imageData.universal) {
    throw new Error('imageData.universal requis');
  }

  console.log('🖼️ PhotoService.upload - Event: ' + eventId + ', Bucket: ' + bucket);

  try {
    console.log('📦 Données reçues:', {
      hasBlob: !!imageData.universal,
      blobSize: imageData.universal?.size,
      blobType: imageData.universal?.type
    });
    
    let blob = imageData.universal;

    // Si c'est une dataURL, convertir en Blob
    if (typeof blob === 'string') {
      blob = this.dataURLToBlob(blob);
    }

    if (!(blob instanceof Blob)) {
      throw new Error('imageData.universal doit etre un Blob ou dataURL');
    }

    // 🔐 Calculer SHA-256 du blob
    const hash = await this.calculateBlobHash(blob);
    const fileName = `${hash}.webp`;
    
    console.log('🔐 Hash SHA-256 calculé: ' + hash.substring(0, 12));
    console.log('📊 Blob validé: ' + (blob.size / 1024).toFixed(0) + 'KB, type: ' + blob.type);

    // ✅ STEP 1: Vérifier si photo_hash existe DÉJÀ en IndexedDB local
    const existingRef = await this.checkPhotoHashLocal(hash);
    if (existingRef && existingRef.supabase_url) {
      console.log(`♻️ Photo réutilisée (local): ${hash.substring(0, 12)}`);
      return {
        photo_url: existingRef.supabase_url,
        hash,
        reused: true
      };
    }

    // ✅ STEP 2: Upload vers Supabase Storage
    console.log('🚀 Upload vers Supabase:', { bucket, fileName, size: (blob.size / 1024).toFixed(0) + 'KB' });

    try {
      const { data, error } = await window.supabaseInstance.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: blob.type || 'image/webp',
          upsert: false
        });

      // Si erreur "duplicate" → elle existe déjà dans Storage
if (error && error.message && error.message.includes('duplicate')) {
  console.log('♻️ Photo existe déjà (Supabase Storage)');
  const { data: { publicUrl } } = window.supabaseInstance.storage
    .from(bucket)
    .getPublicUrl(fileName);
  
  console.log('✅ URL récupérée même si duplicate:', publicUrl.substring(0, 60) + '...');
  
  return {
    photo_url: publicUrl,
    hash,
    reused: true
  };
}

      // ✅ Upload réussi - récupérer l'URL publique
      const { data: { publicUrl } } = window.supabaseInstance.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (!publicUrl) {
        throw new Error('URL publique non retournée par Supabase');
      }

      console.log('✅ Upload réussi (nouveau):', publicUrl.substring(0, 60) + '...');

      return {
        photo_url: publicUrl,
        hash,
        reused: false
      };

    } catch (error) {
      console.error('Upload error:', error.message);
      throw new Error('Upload echoue: ' + error.message);
    }

  } catch (error) {
    console.error('Upload error: ' + error.message);
    throw new Error('Upload echoue: ' + error.message);
  }
}

  /**
   * 🆕 CALCULATE BLOB HASH - SHA-256
   */
  static async calculateBlobHash(blob) {
    try {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hash calculation error:', error);
      // Fallback: hash simple (très rare)
      return Math.random().toString(36).substring(2, 15);
    }
  }

  static calculateHashFromBlob(blob) {
    if (!(blob instanceof Blob)) {
      throw new Error('Blob requis');
    }
    // Hash simple base sur size + type (garder pour compat)
    const sample = blob.size + '_' + blob.type;
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  static dataURLToBlob(dataURL) {
    if (typeof dataURL !== 'string') {
      throw new Error('dataURL doit etre une string');
    }
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * 🗑️ DELETE PHOTOS - Supprimer du storage
   */
  static async deletePhotos(bucket, photoUrls) {
    if (!photoUrls || photoUrls.length === 0) {
      console.log('ℹ️ Pas de photos à supprimer');
      return;
    }

    try {
      const filePaths = photoUrls
        .map(url => {
          if (!url) return null;
          const parts = url.split(`${bucket}/`);
          return parts[1];
        })
        .filter(Boolean);

      if (filePaths.length === 0) {
        console.log('⚠️ Aucun chemin valide à supprimer');
        return;
      }

      console.log(`🗑️ Suppression ${filePaths.length} photos...`);

      const { error } = await window.supabaseInstance.storage
        .from(bucket)
        .remove(filePaths);

      if (error) {
        console.warn('⚠️ Erreur suppression storage:', error);
      } else {
        console.log(`✅ ${filePaths.length} photos supprimées`);
      }

    } catch (error) {
      console.error('❌ Delete photos error:', error);
    }
  }

  /**
 * ✅ HELPER: Vérifier si photo_hash existe en IndexedDB local
 */

static async checkPhotoHashLocal(hash) {
  try {
    const allRefs = await window.IndexedDBManager?.getAll('photo_refs');
    if (!allRefs) return null;
    
    return allRefs.find(ref => ref.photo_hash === hash && ref.supabase_url);
  } catch (error) {
    console.warn('⚠️ Erreur check photo local:', error);
    return null;
  }
}

/**
 * ✅ HELPER: Vérifier si photo_hash existe dans Supabase photo_refs
 * (à appeler après upload pour déduplication cross-device)
 */
static async checkPhotoHashSupabase(hash) {
  try {
    const { data, error } = await window.supabaseInstance
      ?.from('photo_refs')
      .select('id, photo_url')
      .eq('photo_hash', hash)
      .limit(1)
      .single();
    
    if (error?.code === 'PGRST116') return null; // Pas trouvé
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.warn('⚠️ Erreur check photo Supabase:', error);
    return null;
  }
}

  /**
   * 📊 GET STORAGE STATS
   */
  static async getStorageStats(bucket) {
    try {
      const { data, error } = await window.supabaseInstance.storage
        .from(bucket)
        .list();

      if (error) throw error;

      const totalSize = data.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

      return {
        fileCount: data.length,
        totalSizeMB,
        files: data
      };

    } catch (error) {
      console.error('❌ Storage stats error:', error);
      return {
        fileCount: 0,
        totalSizeMB: 0,
        files: []
      };
    }
  }
}

// Export global
if (typeof window !== 'undefined') {
  window.PhotoService = PhotoService;
}

export default PhotoService;