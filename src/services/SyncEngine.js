/**
 * 🔄 SYNC ENGINE - Synchronisation offline-first
 * Refactorisé: bugs fixes, duplication éliminée, code propre
 */

import IndexedDBManager from '../services/IndexedDBManager.js';
import DistanceCalculator from './DistanceCalculator.js';

class SyncEngine {
  // ========================
  // CUTOFF DATES
  // ========================

  static getCutoffDate() {
    const now = new Date();
    const cutoff = new Date(now);
    
    if (now.getHours() < 3) {
      cutoff.setDate(cutoff.getDate() - 1);
    }
    
    cutoff.setHours(3, 0, 0, 0);
    return cutoff;
  }

  // ========================
  // MAIN SYNC ORCHESTRATOR
  // ========================

  /**
   * Point d'entrée: upload local → Supabase, puis download Supabase → local
   */
  static async syncAll(role, userId, force = false) {
    console.log(`🔄 SyncEngine.syncAll - Role: ${role}, User: ${userId}`);

    try {
      if (!window.supabaseInstance) {
        throw new Error('Supabase non disponible');
      }

      // 1. Upload local → Supabase
      if (role === 'admin' || role === 'organizer') {
        await this.syncItemsToSupabase('events', 'event', role, userId);
        await this.syncItemsToSupabase('establishments', 'establishment', role, userId);
      }

      // 2. Download Supabase → local
      if (role === 'admin') {
        await this.syncAdminData(userId, force);
      } else if (role === 'organizer') {
        await this.syncOrganizerData(userId, force);
      } else {
        await this.syncPublicData(force);
      }

      // 3. Cleanup
      await this.cleanupExpiredEvents();
      await this.cleanupOrphanedPhotos();

      // 4. Update timestamps
      await IndexedDBManager.setMeta('lastSync', new Date().toISOString());
      await IndexedDBManager.setMeta('lastSyncRole', role);
      await IndexedDBManager.setMeta('firstSyncCompleted', 'true');

      console.log('✅ Sync terminée');
      return { success: true, timestamp: new Date().toISOString() };

    } catch (error) {
      console.error('❌ Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================
  // UNIFIED UPLOAD (REFACTORED)
  // ========================

  /**
 * Synchroniser items (events ou establishments) vers Supabase
 */
static async syncItemsToSupabase(storeName, itemType, role, userId) {
  console.log(`🔤 Sync ${storeName} to Supabase...`);

  try {
    const tableName = storeName === 'events' ? 'events' : 'establishments';
    const localItems = await IndexedDBManager.getAll(storeName);

    const itemsToSync = localItems.filter(item => 
      this.shouldSyncItem(item, role, userId)
    );

    console.log(`🔤 ${itemsToSync.length} ${itemType} to sync`);

    if (itemsToSync.length === 0) {
      return { success: true, synced: 0 };
    }

    let synced = 0;

    for (const item of itemsToSync) {
      try {
        console.log(`🔤 [${synced + 1}/${itemsToSync.length}] Syncing ${itemType.slice(0, -1)}: ${item.id.substring(0, 8)}`);

        let photoUrl = item.photo_url;
        let photoHash = item.photo_hash;

        if (item.photo_id && !photoUrl) {
          try {
            const photoData = await IndexedDBManager.get('photos', item.photo_id);
            
            if (photoData?.blob) {
              const isOnline = window.NetworkStatus?.isOnline?.();
              
              if (isOnline) {
                const uploadResult = await window.PhotoService?.upload(
                  { universal: photoData.blob },
                  item.id,
                  `${itemType === 'event' ? 'event' : 'establishment'}-photos`
                );
                
                if (uploadResult?.photo_url) {
                  photoUrl = uploadResult.photo_url;
                  photoHash = uploadResult.hash || photoData.hash;
                  
                  photoData.supabase_url = photoUrl;
                  photoData.status = 'uploaded';
                  await IndexedDBManager.put('photos', photoData);
                  
                  console.log(`✅ Photo uploadée: ${photoHash.substring(0,12)}`);
                }
              } else {
                console.log(`⏳ Photo en attente (offline): ${item.photo_id.substring(0,8)}`);
              }
            }
          } catch (photoErr) {
            console.warn(`⚠️ Photo upload failed: ${photoErr.message}`);
          }
        }

        if (photoHash && photoUrl) {
          await this.syncPhotoRef(item.id, itemType, photoHash, photoUrl);
          await this.updatePhotoMetadata(photoHash);
        } else if (photoHash && !photoUrl && !item.photo_url) {
          console.log(`⏳ Photo_refs NOT created yet (photo not uploaded): ${photoHash.substring(0,12)}`);
        }

        const statusToSync = this.mapStatusForSync(item.status, role);

        const supabaseData = itemType === 'event'
          ? this.prepareEventSupabaseData(item, statusToSync, photoUrl, photoHash)
          : this.prepareEstablishmentSupabaseData(item, statusToSync, photoUrl, photoHash);

        const { error } = await window.supabaseInstance
          .from(tableName)
          .upsert(supabaseData, { onConflict: 'id' })
          .select()
          .single();

        if (error) throw error;

        await IndexedDBManager.put(storeName, {
          ...supabaseData,
          photo_id: item.photo_id,
          supabase_synced: true,
          source: 'supabase'
        });

        console.log(`✅ ${itemType.slice(0, -1)} synced`);
        synced++;

      } catch (error) {
        console.error(`❌ ERROR syncing ${itemType.slice(0, -1)} ${item.id.substring(0, 8)}:`, error.message);
        synced++;
      }
    }

    console.log(`✅ ${synced}/${itemsToSync.length} ${itemType} synced`);
    return { success: true, synced };

  } catch (error) {
    console.error(`❌ Erreur syncItemsToSupabase:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * ✅ UPLOADER PHOTO_REF VERS SUPABASE
 */
static async syncPhotoRef(itemId, itemType, photoHash, photoUrl) {
  try {
    console.log(`📸 syncPhotoRef: ${photoHash.substring(0,12)} for ${itemType}`);
    
    const { data: existing } = await window.supabaseInstance
      .from('photo_refs')
      .select('id')
      .eq('photo_hash', photoHash)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .maybeSingle();
    
    if (existing) {
      console.log(`✅ Photo_ref déjà à Supabase: ${photoHash.substring(0,12)}`);
      await this.updatePhotoMetadata(photoHash);
      return;
    }
    
    const { error } = await window.supabaseInstance
      .from('photo_refs')
      .insert({
        photo_hash: photoHash,
        photo_url: photoUrl || null,
        item_id: itemId,
        item_type: itemType,
        status: 'uploaded',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    console.log(`✅ Photo_ref créée Supabase: ${photoHash.substring(0,12)}`);
    
    await this.updatePhotoMetadata(photoHash);
    
  } catch (error) {
    console.warn(`⚠️ Erreur syncPhotoRef: ${error.message}`);
  }
}


/**
 * ✅ SYNC photo_refs depuis Supabase vers IndexedDB local
 * (appelée après syncAdminData/syncOrganizerData)
 */
static async syncPhotoRefsFromSupabase() {
  console.log('📸 Sync photo_refs depuis Supabase...');
  
  try {
    const { data: photoRefs, error } = await window.supabaseInstance
      .from('photo_refs')
      .select('*');
    
    if (error) throw error;
    
    if (!photoRefs || photoRefs.length === 0) {
      console.log('ℹ️ Aucune photo_refs à synchroniser');
      return;
    }

    let synced = 0;

    for (const ref of photoRefs) {
      try {
        // Vérifier si elle existe déjà
        const existing = await IndexedDBManager.get('photo_refs', ref.id);
        
        if (existing) {
          console.log(`📸 photo_refs déjà en local: ${ref.id.substring(0, 8)}`);
          synced++;
          continue;
        }

        // Sauvegarder dans IndexedDB local
        await IndexedDBManager.put('photo_refs', {
          id: ref.id,
          photo_hash: ref.photo_hash,
          photo_url: ref.photo_url,
          item_id: ref.item_id,
          item_type: ref.item_type,
          status: ref.status,
          retries: ref.retries || 0,
          error: ref.error || null,
          created_at: ref.created_at,
          updated_at: ref.updated_at
        });

        synced++;

      } catch (itemErr) {
        console.warn(`⚠️ Erreur sync photo_ref ${ref.id}:`, itemErr.message);
      }
    }

    console.log(`✅ ${synced}/${photoRefs.length} photo_refs synced`);

  } catch (error) {
    console.warn('⚠️ Erreur sync photo_refs:', error.message);
  }
}

/**
 * ✅ HELPER: Télécharger blob depuis Supabase Storage
 */
static async downloadPhotoBlob(photoUrl, photoHash) {
  try {
    const response = await fetch(photoUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const photoId = `${photoHash.substring(0, 12)}_${Date.now()}`;

    await IndexedDBManager.put('photos', {
      id: photoId,
      blob,
      hash: photoHash,
      status: 'downloaded',
      supabase_url: photoUrl,
      created_at: new Date().toISOString(),
      size_kb: (blob.size / 1024).toFixed(2)
    });

    console.log(`📸 Photo téléchargée: ${photoHash.substring(0, 12)}`);

  } catch (error) {
    console.warn(`⚠️ Photo download échoué:`, error.message);
    throw error;
  }
}

/**
 * ✅ METTRE À JOUR APP_METADATA (count des références)
 */
static async updatePhotoMetadata(photoHash) {
  try {
    const { data: refs, error: countError } = await window.supabaseInstance
      .from('photo_refs')
      .select('id', { count: 'exact' })
      .eq('photo_hash', photoHash);

    if (countError) throw countError;

    const count = refs ? refs.length : 0;
    
    if (count === 0) {
      const key = `photo_hash_${photoHash}`;
      const { error: deleteError } = await window.supabaseInstance
        .from('app_metadata')
        .delete()
        .eq('key', key);
      
      if (deleteError) throw deleteError;
      console.log(`🗑️ app_metadata supprimée (count = 0): ${photoHash.substring(0,12)}`);
    } else {
      const key = `photo_hash_${photoHash}`;
      const { error } = await window.supabaseInstance
        .from('app_metadata')
        .upsert({
          key: key,
          hash: photoHash,
          count: count,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) throw error;
      console.log(`📊 app_metadata: ${photoHash.substring(0,12)} = ${count} refs`);
    }
  } catch (error) {
    console.warn(`⚠️ Erreur updatePhotoMetadata: ${error.message}`);
  }
}

  // ========================
  // HELPER: SHOULD SYNC ITEM
  // ========================

  static shouldSyncItem(item, role, userId) {
    const isLocal = this.normalizeBoolean(item.created_locally);
    const notSynced = item.supabase_synced !== true;

    if (!isLocal || !notSynced) return false;

    if (role === 'admin') {
      return ['local', 'pending', 'approved'].includes(item.status);
    }

    if (role === 'organizer') {
      return item.status === 'pending' && item.owner_id === userId;
    }

    return false;
  }

  // ========================
  // HELPER: MAP STATUS
  // ========================

  static mapStatusForSync(localStatus, role) {
    if (localStatus === 'local') {
      return 'approved';
    }
    return localStatus;
  }

  // ========================
  // HELPER: PREPARE EVENT DATA
  // ========================

  static prepareEventSupabaseData(evt, statusToSync, photoUrl, photoHash) {
    return {
      id: evt.id,
      titre: evt.titre,
      category: evt.category,
      description: evt.description || null,
      adresse: evt.adresse || null,
      ville: evt.ville || null,
      code_postal: evt.code_postal || null,
      latitude: evt.latitude,
      longitude: evt.longitude,
      location: evt.longitude && evt.latitude 
        ? `POINT(${evt.longitude} ${evt.latitude})`
        : null,
      date_debut: evt.date_debut,
      date_fin: evt.date_fin || null,
      establishment_id: evt.establishment_id || null,
      facebook_url: evt.facebook_url || null,
      bandcamp_url: evt.bandcamp_url || null,
      helloasso_url: evt.helloasso_url || null,
      youtube_url1: evt.youtube_url1 || null,
      youtube_url2: evt.youtube_url2 || null,
      youtube_url3: evt.youtube_url3 || null,
      photo_url: photoUrl || null,
      photo_hash: photoHash || null,
      owner_id: evt.owner_id,
      status: statusToSync,
      version: (evt.version || 0) + 1,
      created_locally: false,
      supabase_synced: true,
      conflicted: false,
      rejected_at: evt.rejected_at || null,
      created_at: evt.created_at,
      updated_at: new Date().toISOString()
    };
  }

  // ========================
  // HELPER: PREPARE ESTABLISHMENT DATA
  // ========================

  static prepareEstablishmentSupabaseData(est, statusToSync, photoUrl, photoHash) {
    return {
      id: est.id,
      nom: est.nom,
      type: est.type,
      description: est.description || null,
      adresse: est.adresse,
      adresse_complete: est.adresse_complete || null,
      ville: est.ville,
      code_postal: est.code_postal || null,
      city_normalized: est.city_normalized,
      latitude: est.latitude,
      longitude: est.longitude,
      location: est.longitude && est.latitude 
        ? `POINT(${est.longitude} ${est.latitude})`
        : null,
      telephone: est.telephone || null,
      email: est.email || null,
      website: est.website || null,
      facebook_url: est.facebook_url || null,
      instagram_url: est.instagram_url || null,
      photo_url: photoUrl || null,
      photo_hash: photoHash || null,
      owner_id: est.owner_id,
      status: statusToSync,
      version: (est.version || 0) + 1,
      created_locally: false,
      supabase_synced: true,
      conflicted: false,
      rejected_at: est.rejected_at || null,
      created_at: est.created_at,
      updated_at: new Date().toISOString()
    };
  }

  
  // ========================
  // DOWNLOAD: ADMIN DATA
  // ========================

  static async syncAdminData(userId, force = false) {
    console.log('👑 Sync Admin data...');

    const lastSync = await IndexedDBManager.getMeta('lastSync');
    const existingEventCount = await IndexedDBManager.getAll('events').then(e => e.length);
    const isFirstSync = !lastSync || existingEventCount === 0;
    const cutoffDate = this.getCutoffDate().toISOString();

    let userLocation = null;
    try {
      userLocation = await window.LocationManager?.getUserLocation().catch(() => null);
    } catch (error) {
      console.warn('⚠️ Position non disponible:', error.message);
    }

    const eventsQuery = window.supabaseInstance
      .from('events')
      .select('*')
      .in('status', ['pending', 'approved', 'local'])
      .gte('date_debut', cutoffDate)
      .order('date_debut', { ascending: true });

    const estabQuery = window.supabaseInstance
      .from('establishments')
      .select('*')
      .in('status', ['pending', 'approved', 'local'])
      .order('updated_at', { ascending: false });

    const profilesQuery = window.supabaseInstance
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const deltaCondition = !isFirstSync && !force && lastSync;

    if (deltaCondition) {
      eventsQuery.gt('updated_at', lastSync);
      estabQuery.gt('updated_at', lastSync);
      profilesQuery.gt('updated_at', lastSync);
    }

    const [eventsResult, estabResult, profilesResult] = await Promise.all([
      eventsQuery,
      estabQuery,
      profilesQuery
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (estabResult.error) throw estabResult.error;
    if (profilesResult.error) throw profilesResult.error;

    let events = eventsResult.data || [];
    let establishments = estabResult.data || [];
    const profiles = profilesResult.data || [];

    if (userLocation && events.length > 0) {
      events = DistanceCalculator.sortByDistance(events, userLocation.latitude, userLocation.longitude)
        .filter(e => e.distance_km <= 50)
        .slice(0, 150);
    } else {
      events = events.slice(0, 150);
    }

    if (userLocation && establishments.length > 0) {
      establishments = DistanceCalculator.sortByDistance(establishments, userLocation.latitude, userLocation.longitude)
        .filter(e => e.distance_km <= 50)
        .slice(0, 150);
    } else {
      establishments = establishments.slice(0, 150);
    }

    console.log(`📥 Admin fetch: ${events.length} events, ${establishments.length} establishments, ${profiles.length} profiles`);

    await this.mergeItems('events', events);
    await this.mergeItems('establishments', establishments);
    await this.mergeItems('profiles', profiles);

    await this.syncPhotosForItems('events', events);
    await this.syncPhotosForItems('establishments', establishments);
    
  }

  // ========================
  // DOWNLOAD: ORGANIZER DATA
  // ========================

  static async syncOrganizerData(userId, force = false) {
    console.log('🎭 Sync Organizer data...');

    const lastSync = await IndexedDBManager.getMeta('lastSync');
    const existingEventCount = await IndexedDBManager.getAll('events').then(e => e.length);
    const isFirstSync = !lastSync || existingEventCount === 0;
    const cutoffDate = this.getCutoffDate().toISOString();

    let eventsQuery = window.supabaseInstance
      .from('events')
      .select('*')
      .eq('owner_id', userId)
      .gte('date_debut', cutoffDate)
      .order('date_debut', { ascending: true });

    let estabQuery = window.supabaseInstance
      .from('establishments')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    const deltaCondition = !isFirstSync && !force && lastSync;

    if (deltaCondition) {
      eventsQuery = eventsQuery.gt('updated_at', lastSync);
      estabQuery = estabQuery.gt('updated_at', lastSync);
    }

    const [eventsResult, estabResult] = await Promise.all([eventsQuery, estabQuery]);

    if (eventsResult.error) throw eventsResult.error;
    if (estabResult.error) throw estabResult.error;

    const events = eventsResult.data || [];
    const establishments = estabResult.data || [];

    console.log(`📥 Orga fetch: ${events.length} events, ${establishments.length} establishments`);

    await this.mergeItems('events', events);
    await this.mergeItems('establishments', establishments);

    await this.syncPhotosForItems('events', events);
    await this.syncPhotosForItems('establishments', establishments);
    
  }

  // ========================
  // DOWNLOAD: PUBLIC DATA
  // ========================

  static async syncPublicData(force = false) {
    console.log('🌍 Sync Public data...');

    const lastSync = await IndexedDBManager.getMeta('lastSync');
    const cutoffDate = this.getCutoffDate().toISOString();

    let userLocation = null;
    try {
      userLocation = await window.LocationManager?.getUserLocation().catch(() => null);
    } catch (error) {
      console.warn('⚠️ Position non disponible:', error.message);
    }

    let eventsQuery = window.supabaseInstance
      .from('events')
      .select('*')
      .eq('status', 'approved')
      .gte('date_debut', cutoffDate)
      .order('date_debut', { ascending: true });

    let estabQuery = window.supabaseInstance
      .from('establishments')
      .select('*')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false });

    if (lastSync && !force) {
      eventsQuery = eventsQuery.gt('updated_at', lastSync);
      estabQuery = estabQuery.gt('updated_at', lastSync);
    }

    const [eventsResult, estabResult] = await Promise.all([eventsQuery, estabQuery]);

    if (eventsResult.error) throw eventsResult.error;
    if (estabResult.error) throw estabResult.error;

    let events = eventsResult.data || [];
    let establishments = estabResult.data || [];

    if (userLocation) {
      events = DistanceCalculator.sortByDistance(events, userLocation.latitude, userLocation.longitude)
        .filter(e => e.distance_km <= 50)
        .slice(0, 150);

      establishments = DistanceCalculator.sortByDistance(establishments, userLocation.latitude, userLocation.longitude)
        .filter(e => e.distance_km <= 50)
        .slice(0, 150);
    } else {
      events = events.slice(0, 150);
      establishments = establishments.slice(0, 150);
    }

    console.log(`📥 Public fetch: ${events.length} events, ${establishments.length} establishments`);

    await this.mergeItems('events', events);
    await this.mergeItems('establishments', establishments);

    await this.syncPhotosForItems('events', events);
    await this.syncPhotosForItems('establishments', establishments);
    
  }

  // ========================
  // MERGE ITEMS
  // ========================

  static async mergeItems(storeName, incomingItems) {
    if (!incomingItems || incomingItems.length === 0) {
      console.log(`ℹ️ Pas de nouvelles données [${storeName}]`);
      return;
    }

    console.log(`🔀 Merge ${incomingItems.length} items dans [${storeName}]`);

    for (const item of incomingItems) {
      const existingItem = await IndexedDBManager.get(storeName, item.id);

      const mergedItem = {
        ...item,
        created_locally: existingItem?.created_locally ?? false,
        photo_id: existingItem?.photo_id || item.photo_id || null,
        source: 'supabase',
        supabase_synced: true
      };

      if (mergedItem.adresse_complete && !mergedItem.adresse) {
        const parts = mergedItem.adresse_complete.split(',').map(p => p.trim());
        mergedItem.adresse = parts[0] || '';
        if (parts.length >= 3) {
          mergedItem.code_postal = parts[1] || '';
          mergedItem.ville = parts[2] || '';
        } else if (parts.length === 2) {
          mergedItem.ville = parts[1] || '';
        }
      }

      if (mergedItem.ville && !mergedItem.city_normalized) {
        mergedItem.city_normalized = this.normalizeCity(mergedItem.ville);
      }

      await IndexedDBManager.put(storeName, mergedItem);
    }

    console.log(`✅ Merge ${storeName} terminé`);
  }

  // ========================
  // PHOTO SYNC
  // ========================

  static async syncPhotosForItems(storeName, items) {
    if (!items || items.length === 0) return;

    console.log(`📸 Photos sync pour [${storeName}]...`);

    let downloaded = 0;

    for (const item of items) {
      if (!item.photo_url || !item.id) continue;

      try {
        if (item.photo_id) {
          try {
            const photoData = await IndexedDBManager.get('photos', item.photo_id);
            if (photoData?.blob) {
              console.log(`📸 Photo déjà en cache: ${item.photo_id.substring(0, 8)}`);
              continue;
            }
          } catch (cacheError) {
            console.warn('⚠️ Erreur vérification photo cache:', cacheError.message);
          }
        }

        const existingItem = await IndexedDBManager.get(storeName, item.id);
        if (existingItem?.photo_url === item.photo_url && existingItem?.photo_id) {
          item.photo_id = existingItem.photo_id;
          console.log(`📸 Photo URL identique, réutilisation: ${item.photo_id.substring(0, 8)}`);
          continue;
        }

        console.log(`📸 Fetch photo: ${item.photo_url.substring(0, 50)}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await fetch(item.photo_url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const blob = await response.blob();
          console.log(`📸 Blob reçu: ${(blob.size / 1024).toFixed(0)}KB`);

          let photoId = item.photo_id;
          if (!photoId) {
            photoId = `photo_${item.id.substring(0, 8)}_${Date.now()}`;
          }

          const photoHash = await this.calculatePhotoHash(blob);
          await IndexedDBManager.put('photos', {
            id: photoId,
            blob,
            hash: photoHash,
            status: 'downloaded',
            created_at: new Date().toISOString(),
            size_kb: (blob.size / 1024).toFixed(2)
          });

          item.photo_id = photoId;
          await IndexedDBManager.put(storeName, item);

          downloaded++;

        } finally {
          clearTimeout(timeoutId);
        }

      } catch (error) {
        console.warn(`📸 Photo download échouée ${item.id}:`, error.message);
      }
    }

    if (downloaded > 0) {
      console.log(`${downloaded} photo(s) téléchargée(s)`);
    }
  }

  // ========================
  // CLEANUP
  // ========================

  static async cleanupExpiredEvents() {
    console.log('🧹 Cleanup expired events...');

    const allEvents = await IndexedDBManager.getAll('events');
    const cutoffDate = this.getCutoffDate();
    let cleaned = 0;
    let photosDeleted = 0;

    for (const event of allEvents) {
      const eventDate = new Date(event.date_debut);

      if (eventDate < cutoffDate) {
        const allRefs = await IndexedDBManager.getAll('photo_refs');
        const eventPhotos = allRefs.filter(ref => ref.item_id === event.id && ref.item_type === 'event');

        for (const photoRef of eventPhotos) {
          try {
            if (photoRef.photo_id) {
              await IndexedDBManager.delete('photos', photoRef.photo_id);
              photosDeleted++;
            }

            if (photoRef.supabase_url) {
              await window.PhotoService?.deletePhotos('event-photos', [photoRef.supabase_url]);
            }

            await IndexedDBManager.delete('photo_refs', photoRef.id);
          } catch (error) {
            console.warn('⚠️ Error deleting photo:', error);
          }
        }

        await IndexedDBManager.delete('events', event.id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} events expirés nettoyés, ${photosDeleted} photos supprimées`);
    }
  }

  static async cleanupOrphanedPhotos() {
  console.log('🧹 Cleanup orphaned photos...');

  if (!window.IndexedDBManager) return;

  try {
    // Récupérer TOUS les items qui ont des photos
    const allEvents = await IndexedDBManager.getAll('events');
    const allEstablishments = await IndexedDBManager.getAll('establishments');
    const allPhotoRefs = await IndexedDBManager.getAll('photo_refs');

    // ✅ Créer un Set de TOUS les photo_ids utilisés
    const usedPhotoIds = new Set();
    
    // Depuis les items (establishments/events) qui ont photo_id
    allEvents.forEach(e => {
      if (e.photo_id) usedPhotoIds.add(e.photo_id);
    });
    
    allEstablishments.forEach(est => {
      if (est.photo_id) usedPhotoIds.add(est.photo_id);
    });
    
    // Depuis les photo_refs qui ont un item_id valide
    allPhotoRefs.forEach(ref => {
      if (ref.item_id && ref.photo_id) usedPhotoIds.add(ref.photo_id);
    });

    // ✅ Trouver les blobs orphelins (pas utilisés)
    const allBlobs = await IndexedDBManager.getAll('photos');
    const orphanBlobs = allBlobs.filter(blob => !usedPhotoIds.has(blob.id));

    if (orphanBlobs.length > 0) {
      let deletedBlobs = 0;

      for (const orphanBlob of orphanBlobs) {
        try {
          await IndexedDBManager.delete('photos', orphanBlob.id);
          deletedBlobs++;
        } catch (error) {
          console.warn(`⚠️ Error deleting orphan blob:`, error);
        }
      }

      console.log(`🗑️ ${deletedBlobs} orphaned blobs deleted`);
    }
  } catch (error) {
    console.error('❌ Cleanup orphaned photos error:', error);
  }
}

  // ========================
  // HELPERS
  // ========================

  static normalizeBoolean(value) {
    return value === true || value === 'true';
  }

  static normalizeCity(city) {
    if (!city) return null;

    return city
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  static async calculatePhotoHash(blob) {
    try {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('⚠️ Hash calculation error:', error);
      return null;
    }
  }

  static async getSyncStatus() {
    const lastSync = await IndexedDBManager.getMeta('lastSync');
    const lastSyncRole = await IndexedDBManager.getMeta('lastSyncRole');

    return {
      lastSync,
      lastSyncRole,
      needsSync: !lastSync || this.isStale(lastSync)
    };
  }

  static isStale(lastSync) {
    if (!lastSync) return true;

    const lastSyncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now - lastSyncDate;
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours > 1;
  }
}

if (typeof window !== 'undefined') {
  window.SyncEngine = SyncEngine;
}

export default SyncEngine;