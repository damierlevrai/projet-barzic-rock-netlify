/**
 * 💾 ADMIN BACKUP TAB - Refactorisé
 */

import IndexedDBManager from "../../../services/IndexedDBManager.js";
import SyncEngine from "../../../services/SyncEngine.js";
import TabCacheManager from '../../../services/TabCacheManager.js';
import DashboardIcons from '../../../components/dashboard-icons.js';

class AdminBackupTab {
  constructor(dashboard) {
    this.dashboard = dashboard;
  }

  async render(container) {
    const stats = await this.getStats();
    container.innerHTML = this.getHTML(stats);
    this.setupEventListeners(container);
  }

  async getStats() {
    const dbStats = await IndexedDBManager.getStats();
    const photoStats = await window.PhotoOrchestrator?.getStatsForBackup();
    const lastSync = await IndexedDBManager.getMeta('lastSync');
    const lastCleanup = await IndexedDBManager.getMeta('lastCleanup');
    
    // Stats événements (futurs/passés)
    const eventStats = await this.getEventStats();
    
    return {
      establishments: dbStats.establishments,
      events: dbStats.events,
      eventsFuture: eventStats.future,
      eventsPast: eventStats.past,
      eventsToday: eventStats.today,
      images: photoStats?.total || 0,
      imagesPending: photoStats?.pending || 0,
      imagesUploaded: photoStats?.uploaded || 0,
      lastSync: lastSync ? new Date(lastSync).toLocaleString('fr-FR') : 'Jamais',
      lastCleanup: lastCleanup ? new Date(lastCleanup).toLocaleString('fr-FR') : 'Jamais',
      totalSizeMB: dbStats.totalSizeMB,
      imageSizeMB: photoStats?.total_size_mb || 0
    };
  }

  async getEventStats() {
    const allEvents = await IndexedDBManager.getAll("events");
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      future: allEvents.filter(e => new Date(e.date_debut) >= tomorrow).length,
      today: allEvents.filter(e => {
        const eventDate = new Date(e.date_debut);
        return eventDate >= today && eventDate < tomorrow;
      }).length,
      past: allEvents.filter(e => new Date(e.date_debut) < today).length
    };
  }

  getHTML(stats) {
    return `
      <section class="tab-panel active">
        
        <div class="panel-header-centered">
          <h2>💾 Sauvegarde & Données</h2>
          <p class="panel-description">Gestion des sauvegardes locales et synchronisation</p>
        </div>

        <div class="backup-sections">
          
          <!-- Section Statistiques -->
          <div class="backup-section">
            <div class="backup-section-header">
              <h3>${DashboardIcons.stats || '📊'} Statistiques IndexedDB</h3>
            </div>
            <div class="backup-section-content">
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-icon">🏢</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.establishments}</span>
                    <span class="stat-label">Établissements</span>
                  </div>
                </div>
                
                <div class="stat-box">
                  <div class="stat-icon">🎭</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.events}</span>
                    <span class="stat-label">Événements (total)</span>
                  </div>
                </div>
                
                <div class="stat-box">
                  <div class="stat-icon">📅</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.eventsToday}</span>
                    <span class="stat-label">Aujourd'hui</span>
                  </div>
                </div>
                
                <div class="stat-box">
                  <div class="stat-icon">🔮</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.eventsFuture}</span>
                    <span class="stat-label">Futurs</span>
                  </div>
                </div>
                
                <div class="stat-box status-warning">
                  <div class="stat-icon">⏳</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.eventsPast}</span>
                    <span class="stat-label">Passés (à nettoyer)</span>
                  </div>
                </div>
                
                <div class="stat-box">
                  <div class="stat-icon">📸</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.images}</span>
                    <span class="stat-label">Images</span>
                  </div>
                </div>
                
                <div class="stat-box status-warning">
                  <div class="stat-icon">🗑️</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.imagesOrphaned}</span>
                    <span class="stat-label">Photos orphelines</span>
                  </div>
                </div>
                
                <div class="stat-box">
                  <div class="stat-icon">💾</div>
                  <div class="stat-info">
                    <span class="stat-value">${stats.totalSizeMB} MB</span>
                    <span class="stat-label">Espace utilisé</span>
                  </div>
                </div>
              </div>
              
              <div class="backup-info-row">
                <span><strong>📄 Dernière synchro:</strong> ${stats.lastSync}</span>
                <span><strong>🧹 Dernier nettoyage:</strong> ${stats.lastCleanup}</span>
              </div>
            </div>
          </div>

          <!-- Section Export -->
          <div class="backup-section">
            <div class="backup-section-header">
              <h3>${DashboardIcons.download || '📤'} Exporter les données</h3>
            </div>
            <div class="backup-section-content">
              <p class="backup-description">Téléchargez une copie de vos données locales en format JSON.</p>
              
              <div class="backup-options">
                <label class="backup-checkbox">
                  <input type="checkbox" id="export-establishments" checked>
                  <span>🏢 Établissements</span>
                </label>
                <label class="backup-checkbox">
                  <input type="checkbox" id="export-events" checked>
                  <span>🎭 Événements</span>
                </label>
                <label class="backup-checkbox">
                  <input type="checkbox" id="export-profiles">
                  <span>👥 Profils (admin uniquement)</span>
                </label>
                <label class="backup-checkbox">
                  <input type="checkbox" id="export-images">
                  <span>📷 Cache images (fichier lourd)</span>
                </label>
              </div>

              <button class="btn-toolbar btn-primary btn-block" id="export-data">
                ${DashboardIcons.download || '📥'} Télécharger la sauvegarde
              </button>
            </div>
          </div>

          <!-- Section Import -->
          <div class="backup-section">
            <div class="backup-section-header">
              <h3>${DashboardIcons.upload || '📥'} Importer des données</h3>
            </div>
            <div class="backup-section-content">
              <p class="backup-description">Restaurez des données depuis un fichier de sauvegarde JSON.</p>
              
              <div class="backup-warning">
                ⚠️ <strong>Attention:</strong> L'import fusionnera les données (les plus récentes seront conservées).
              </div>

              <input type="file" id="import-file" accept=".json" style="display: none;">
              
              <button class="btn-toolbar btn-warning btn-block" id="import-data">
                ${DashboardIcons.upload || '📂'} Sélectionner un fichier
              </button>
            </div>
          </div>

          <!-- Section Maintenance -->
          <div class="backup-section">
            <div class="backup-section-header">
              <h3>${DashboardIcons.settings || '🔧'} Maintenance IndexedDB</h3>
            </div>
            <div class="backup-section-content">
              <p class="backup-description">Nettoyage automatique des données obsolètes.</p>
              
              <div class="maintenance-info">
                <div class="maintenance-rule">
                  <span class="rule-icon">✓</span>
                  <span class="rule-text">Événements passés > 1 jour → Supprimés à 3h</span>
                </div>
                <div class="maintenance-rule">
                  <span class="rule-icon">✓</span>
                  <span class="rule-text">Photos événements passés → Supprimées</span>
                </div>
                <div class="maintenance-rule">
                  <span class="rule-icon">✓</span>
                  <span class="rule-text">Photos orphelines > 7j → Supprimées</span>
                </div>
              </div>

              <button class="btn-toolbar btn-primary btn-block" id="cleanup-now">
                ${DashboardIcons.clean || '🧹'} Nettoyer maintenant
              </button>
              
              <button class="btn-toolbar btn-info btn-block" id="vacuum-db">
                ${DashboardIcons.optimize || '⚡'} Optimiser la base
              </button>
            </div>
          </div>

          <!-- Section Synchronisation -->
          <div class="backup-section">
            <div class="backup-section-header">
              <h3>${DashboardIcons.sync || '☁️'} Synchronisation Supabase</h3>
            </div>
            <div class="backup-section-content">
              <p class="backup-description">Synchroniser avec la base de données distante.</p>

              <button class="btn-toolbar btn-primary btn-block" id="force-sync">
                ${DashboardIcons.refresh || '🔄'} Synchroniser maintenant
              </button>
              
              <button class="btn-toolbar btn-info btn-block" id="upload-pending">
                ${DashboardIcons.upload || '📤'} Envoyer le contenu local
              </button>
            </div>
          </div>

          <!-- Zone Dangereuse -->
          <div class="backup-section danger-zone">
            <div class="backup-section-header">
              <h3>⚠️ Zone Dangereuse</h3>
            </div>
            <div class="backup-section-content">
              <p class="backup-description">Actions irréversibles. Utilisez avec précaution.</p>
              
              <button class="btn-toolbar btn-danger btn-block" id="clear-cache">
                🗑️ Vider le cache images
              </button>
              
              <button class="btn-toolbar btn-danger btn-block" id="clear-pending">
                ❌ Supprimer tous les "pending"
              </button>
              
              <button class="btn-toolbar btn-danger btn-block" id="reset-all">
                💣 Réinitialiser TOUTES les données
              </button>
            </div>
          </div>

        </div>
      </section>
    `;
  }

  setupEventListeners(container) {
    // Export
    const exportBtn = container.querySelector('#export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Import
    const importBtn = container.querySelector('#import-data');
    const importFile = container.querySelector('#import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => this.importData(e));
    }

    // Maintenance
    const cleanupBtn = container.querySelector('#cleanup-now');
    if (cleanupBtn) {
      cleanupBtn.addEventListener('click', () => this.cleanupNow());
    }

    const vacuumBtn = container.querySelector('#vacuum-db');
    if (vacuumBtn) {
      vacuumBtn.addEventListener('click', () => this.vacuumDB());
    }

    // Sync
    const forceSyncBtn = container.querySelector('#force-sync');
    if (forceSyncBtn) {
      forceSyncBtn.addEventListener('click', () => this.forceSync());
    }

    const uploadPendingBtn = container.querySelector('#upload-pending');
    if (uploadPendingBtn) {
      uploadPendingBtn.addEventListener('click', () => this.uploadPending());
    }

    // Danger zone
    const clearCacheBtn = container.querySelector('#clear-cache');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => this.clearCache());
    }

    const clearPendingBtn = container.querySelector('#clear-pending');
    if (clearPendingBtn) {
      clearPendingBtn.addEventListener('click', () => this.clearPending());
    }

    const resetAllBtn = container.querySelector('#reset-all');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => this.resetAll());
    }
  }

  async exportData() {
  const includeEstab = document.getElementById('export-establishments')?.checked;
  const includeEvents = document.getElementById('export-events')?.checked;
  const includeProfiles = document.getElementById('export-profiles')?.checked;
  const includeImages = document.getElementById('export-images')?.checked;

  const data = {
    exported_at: new Date().toISOString(),
    version: '2.1',
    app: 'Barzik Admin',
    data: {}
  };

  try {
    if (includeEstab) {
      data.data.establishments = await IndexedDBManager.getAll("establishments");
    }
    if (includeEvents) {
      data.data.events = await IndexedDBManager.getAll("events");
    }
    if (includeProfiles) {
      // Recuperer depuis Supabase (securise, pas les mots de passe)
      const { data: profiles } = await window.supabaseInstance
        .from('profiles')
        .select('id, email, nom, prenom, telephone, role, created_at');
      data.data.profiles = profiles;
    }
    if (includeImages) {
      const allPhotos = await IndexedDBManager.getAll("photos");
      
      // Convertir Blobs en Base64 pour export (Blobs ne sont pas serialisables en JSON)
      data.data.images = await Promise.all(allPhotos.map(async (photo) => {
        let base64Data = null;
        
        if (photo.blob instanceof Blob) {
          try {
            const arrayBuffer = await photo.blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            base64Data = btoa(String.fromCharCode.apply(null, uint8Array));
          } catch (error) {
            console.warn('[PHOTO] Erreur conversion Base64:', error);
          }
        }
        
        return {
          id: photo.id,
          hash: photo.hash,
          status: photo.status,
          created_at: photo.created_at,
          size_kb: photo.size_kb,
          base64_data: base64Data  // Stocke le Base64 au lieu du Blob
        };
      }));
      
      console.log('[PHOTO] Exported ' + data.data.images.length + ' photos (Base64)');
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barzik_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.dashboard.showNotification('✅ Sauvegarde téléchargée', 'success');
  } catch (error) {
    console.error('❌ Erreur export:', error);
    this.dashboard.showNotification('❌ Erreur export', 'error');
  }
}
      

  async importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const confirmed = confirm(
    '⚠️ IMPORT DE DONNÉES\n\n' +
    'Les données importées seront fusionnées avec les données existantes.\n' +
    'En cas de conflit, les données les plus récentes seront conservées.\n\n' +
    'Voulez-vous continuer ?'
  );

  if (!confirmed) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    // Validation
    if (!backup.version || !backup.data) {
      throw new Error('Format de fichier invalide');
    }

    let imported = 0;

    // Import establishments
    if (backup.data.establishments) {
      for (const estab of backup.data.establishments) {
        await IndexedDBManager.put("establishments", estab);
        imported++;
      }
    }

    // Import events
    if (backup.data.events) {
      for (const evt of backup.data.events) {
        await IndexedDBManager.put("events", evt);
        imported++;
      }
    }

    // Import images
    if (backup.data.images) {
      for (const img of backup.data.images) {
        let blob = null;
        
        // Reconvertir Base64 en Blob
        if (img.base64_data) {
          try {
            const binaryString = atob(img.base64_data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: 'application/octet-stream' });
            console.log('[PHOTO] Blob reconverti depuis Base64: ' + img.id.substring(0, 8));
          } catch (error) {
            console.warn('[PHOTO] Erreur reconversion Base64:', error);
          }
        }
        
        // Fallback ancien format (si blob direct)
        if (!blob && (img.blob || img.data)) {
          blob = img.blob || img.data;
        }
        
        if (blob) {
          await IndexedDBManager.put('photos', {
            id: img.id,
            blob: blob,
            hash: img.hash,
            status: img.status || 'imported',
            created_at: img.created_at || new Date().toISOString(),
            size_kb: img.size_kb || 0
          });
          imported++;
          console.log('[PHOTO] Imported photo: ' + img.id.substring(0, 8));
        }
      }
    }

    this.dashboard.showNotification(`✅ ${imported} élément(s) importé(s)`, 'success');
    this.refreshView();
  } catch (error) {
    console.error('❌ Erreur import:', error);
    this.dashboard.showNotification(`Erreur: ${error.message}`, 'error');
  }
}

  async cleanupNow() {
  if (!confirm('🧹 Lancer le nettoyage maintenant ?\n\nCela supprimera les événements passés et les photos obsolètes.')) {
    return;
  }

  try {
    // Utiliser la méthode vacuum (tout-en-un)
    const result = await IndexedDBManager.vacuum();
    
    // Sauvegarder date de nettoyage
    await IndexedDBManager.setMeta('lastCleanup', new Date().toISOString());

    this.dashboard.showNotification(`✅ ${result.total} élément(s) nettoyé(s) (${result.events} événements, ${result.photos} photos)`, 'success');
    this.refreshView();
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
    this.dashboard.showNotification('Erreur lors du nettoyage', 'error');
  }
}

  async vacuumDB() {
  if (!confirm('⚡ Optimiser la base de données ?\n\nCela peut prendre quelques secondes.')) {
    return;
  }

  try {
    const result = await IndexedDBManager.vacuum();
    await IndexedDBManager.setMeta('lastCleanup', new Date().toISOString());
    
    this.dashboard.showNotification(`✅ Optimisation terminée : ${result.total} élément(s) nettoyé(s)`, 'success');
    this.refreshView();
  } catch (error) {
    console.error('❌ Erreur optimisation:', error);
    this.dashboard.showNotification('Erreur lors de l\'optimisation', 'error');
  }
}

  async clearCache() {
    if (!confirm('🗑️ Vider le cache des images ?\n\n⚠️ Cette action est irréversible.')) {
      return;
    }

    try {
      await IndexedDBManager.clear('photos');
      await IndexedDBManager.clear('photo_refs');
      console.log('✅ Cleared photos and photo_refs stores');
      this.dashboard.showNotification('✅ Cache images vidé', 'success');
      this.refreshView();
    } catch (error) {
      console.error('❌ Erreur:', error);
      this.dashboard.showNotification('Erreur lors du vidage', 'error');
    }
  }

  async clearPending() {
    if (!confirm('❌ Supprimer TOUS les contenus "pending" ?\n\n⚠️ Action irréversible.')) {
      return;
    }

    try {
      const allEstab = await IndexedDBManager.getAll("establishments");
      const allEvents = await IndexedDBManager.getAll("events");
      
      const pendingEstab = allEstab.filter(e => e.status === 'pending');
      const pendingEvents = allEvents.filter(e => e.status === 'pending');

      for (const e of pendingEstab) {
        await IndexedDBManager.delete("establishments", e.id);
      }
      
      for (const e of pendingEvents) {
        await IndexedDBManager.delete("events", e.id);
      }

      const total = pendingEstab.length + pendingEvents.length;
      this.dashboard.showNotification(`✅ ${total} élément(s) supprimé(s)`, 'success');
      this.refreshView();
    } catch (error) {
      console.error('❌ Erreur:', error);
      this.dashboard.showNotification('Erreur lors de la suppression', 'error');
    }
  }

  async resetSync() {
  if (!confirm('🔄 Forcer une synchronisation complète ?\n\nCela va re-télécharger TOUTES les données depuis Supabase.')) {
    return;
  }

  try {
    // Supprimer la date de dernière sync
    await IndexedDBManager.deleteMeta('lastSync');
    
    this.dashboard.showNotification('🔄 Sync réinitialisée, rechargement...', 'info');
    
    // Attendre un peu et recharger
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Erreur reset sync:', error);
    this.dashboard.showNotification('Erreur lors du reset', 'error');
  }
}

  async resetAll() {
  const input = prompt(
    '💣 RÉINITIALISATION TOTALE 💣\n\n' +
    'Cela va supprimer:\n' +
    '- Tous les établissements\n' +
    '- Tous les événements\n' +
    '- Tout le cache images\n' +
    '- Toutes les métadonnées\n\n' +
    '⚠️ ACTION IRRÉVERSIBLE ⚠️\n\n' +
    'Tapez "RESET" pour confirmer:'
  );

  if (input !== 'RESET') {
    return;
  }

  try {
    await IndexedDBManager.clear("establishments");
    await IndexedDBManager.clear("events");
    await IndexedDBManager.clear("metadata");
    await IndexedDBManager.clear('photos');
    await IndexedDBManager.clear('photo_refs');

    this.dashboard.showNotification('✅ Toutes les données ont été réinitialisées', 'info');
    this.refreshView();
  } catch (error) {
    console.error('❌ Erreur:', error);
    this.dashboard.showNotification('Erreur lors de la réinitialisation', 'error');
  }
}

  async forceSync() {
    await this.dashboard.forceRefresh();
    this.refreshView();
  }

  async uploadPending() {
    if (!confirm('📤 Envoyer tous les éléments locaux vers Supabase ?\n\nIls passeront en statut "pending".')) {
      return;
    }

    try {
      const result = await SyncEngine.uploadPendingToSupabase(
        this.dashboard.userId,
        this.dashboard.role
      );
      
      if (result.success && result.uploaded > 0) {
        this.dashboard.showNotification(`✅ ${result.uploaded} élément(s) envoyé(s) !`, 'success');
      } else {
        this.dashboard.showNotification('🔭 Aucun élément local à envoyer', 'info');
      }
      
      this.refreshView();
    } catch (error) {
      console.error('❌ Erreur envoi:', error);
      this.dashboard.showNotification('Erreur lors de l\'envoi', 'error');
    }
  }

  refreshView() {
    const container = document.getElementById('tab-content');
    if (container) this.render(container);
  }
}

export default AdminBackupTab;