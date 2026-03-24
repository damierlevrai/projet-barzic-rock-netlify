/**
 * 🛡️ ADMIN MODERATION TAB - Nouveau flux offline-first
 * 
 * CHANGEMENT CLÉS :
 * ✅ Approuver = Sauve local immédiatement + Affiche succès
 * ✅ Upload Supabase en arrière-plan (non-bloquant)
 * ✅ Si erreur réseau = Reste "pending_upload" pour retry auto
 */

import IndexedDBManager from "../../../services/IndexedDBManager.js";
import TabCacheManager from '../../../services/TabCacheManager.js';
import PhotoService from "../../../services/PhotoService.js";
import GeocodingService from "../../../services/GeocodingService.js";
import SyncQueue from "../../../services/offline/SyncQueue.js";
import DashboardIcons from '../../../components/dashboard-icons.js';



class AdminModerationTab {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.view = 'all';
        this.isProcessing = false;
        this.photoObjectUrls = dashboard.globalPhotoPool;
    }

    async getPendingItems() {
    const events = await IndexedDBManager.getAll('events');
    const establishments = await IndexedDBManager.getAll('establishments');
    
    return {
        events: events.filter(e => e.status === 'pending'),
        establishments: establishments.filter(e => e.status === 'pending')
    };
}

    async render(container) {
    // Fetch depuis IndexedDB
    const { events, establishments } = await this.getPendingItems();
    
    // Stocker en cache
    TabCacheManager.set('moderation', {
        events,
        establishments,
        view: this.view
    });
    
    this.events = events;
    this.establishments = establishments;
    
    container.innerHTML = await this.getHTML(establishments, events);
    this.setupEventListeners(container);
}

    async getHTML(establishments, events) {
    // establishments = establishments (orga pending)
    // events = events (events locaux)
    
    const totalPending = (establishments?.length || 0) + (events?.length || 0);
        
        return `
            <section class="tab-panel active">
                
                <div class="panel-header-centered">
                    <h2>Modération</h2>                    
                    
                    <div class="quick-stats">
                        <div class="stat-item ${this.view==='all'?'active':''}" data-view="all">
                            <span class="stat-number">${totalPending}</span>
                            <span class="stat-label">Total</span>
                        </div>
                        <div class="stat-item ${this.view==='establishments'?'active':''}" data-view="establishments">
                            <span class="stat-number">${establishments.length}</span>
                            <span class="stat-label">Établissements</span>
                        </div>
                        <div class="stat-item ${this.view==='events'?'active':''}" data-view="events">
                            <span class="stat-number">${events.length}</span>
                            <span class="stat-label">Événements</span>
                        </div>
                    </div>
                </div>

                ${totalPending > 0 ? `
                    <div class="toolbar-section">
                        <div class="toolbar-left"></div>
                        <div class="toolbar-right">
                            <div class="toolbar-actions">
                                ${(this.view === 'all' || this.view === 'establishments') && establishments.length > 0 ? `
                                    <button class="btn-toolbar btn-primary" id="approve-all-establishments">
                                        ${DashboardIcons.check} Tout approuver (Établissements)
                                    </button>
                                ` : ''}
                                ${(this.view === 'all' || this.view === 'events') && events.length > 0 ? `
                                    <button class="btn-toolbar btn-primary" id="approve-all-events">
                                        ${DashboardIcons.check} Tout approuver (Événements)
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${totalPending === 0 ? this.getEmptyStateHTML() : `
                    <div class="moderation-content">
                        
                        ${(this.view === 'all' || this.view === 'establishments') && establishments.length > 0 ? `
                            <div class="moderation-section">
                                <h3 class="section-title">🏢 Établissements en attente (${establishments.length})</h3>
                               <div class="establishments-grid">
                        ${await this.getEstablishmentCardsHTML(establishments)}
                            </div>
                            </div>
                        ` : ''}

                        ${(this.view === 'all' || this.view === 'events') && events.length > 0 ? `
                            <div class="moderation-section">
                                <h3 class="section-title">🎭 Événements en attente (${events.length})</h3>
                                <div class="establishments-grid">
                        ${await this.getEventCardsHTML(events)}
                            </div>
                            </div>
                        ` : ''}

                        
                    </div>
                `}
            </section>
        `;
    }

    async getEstablishmentCardsHTML(establishments) {
        const cards = await Promise.all(establishments.map(async (estab) => {
            const photoUrl = await this.getPhotoUrl(estab);
            const createdDate = estab.created_at ? 
                new Date(estab.created_at).toLocaleDateString('fr-FR') : 'N/A';
            
            const originInfo = this.getItemOriginInfo(estab);
            
            return `
                <article class="establishment-card" data-id="${estab.id}">
                    
                    <div class="card-photo-section" data-view-type="establishments" data-view-id="${estab.id}">
                        ${photoUrl
                            ? `<img src="${photoUrl}" alt="${estab.nom}" class="card-photo" loading="lazy">`
                            : `<div class="card-photo-placeholder">
                                 <span class="placeholder-icon">🏢</span>
                               </div>`}
                        
                        <div class="card-status-dot ${originInfo.class}" title="${originInfo.tooltip}"></div>
                    </div>
                    ${estab.sync_pending ? `<div class="card-pending-upload-badge">⏳ Sync en attente</div>` : ''}
                    <div class="card-info-section-centered">
                        <h3 class="card-title">${estab.nom || 'Sans nom'}</h3>
                        <p class="card-type">${estab.type || '–'}</p>
                        <p class="card-address">${estab.adresse || 'Adresse non renseignée'}</p>
                        
                        <div class="card-meta">
                            ${estab.telephone ? `<span class="meta-item">📱 Tél.</span>` : ''}
                            ${estab.email ? `<span class="meta-item">📧 Email</span>` : ''}
                            ${estab.website ? `<span class="meta-item">🌐 Site</span>` : ''}
                        </div>
                        
                        <div class="card-details">
                            <div class="detail-item">
                                <span class="detail-label">Créée:</span>
                                <span class="detail-value">${createdDate}</span>
                            </div>
                        </div>
                    </div>

                    <!-- FAB Reject -->
                    <button class="card-fab-delete" data-action="reject" data-type="establishments" data-id="${estab.id}" title="Rejeter">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>

                    <!-- FAB Approve -->
                    <button class="card-fab-edit" data-action="approve" data-type="establishments" data-id="${estab.id}" title="Approuver">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                    
                </article>
            `;
        }));
        
        return cards.join('');
    }

    async getEventCardsHTML(events) {
        const cards = await Promise.all(events.map(async (evt) => {
            const photoUrl = await this.getPhotoUrl(evt);
            const eventDate = evt.date_debut ? new Date(evt.date_debut) : null;
            const dateStr = eventDate ? eventDate.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'N/A';
            
            const originInfo = this.getItemOriginInfo(evt);
            
            return `
                <article class="establishment-card" data-id="${evt.id}">
                    
                    <div class="card-photo-section" data-view-type="events" data-view-id="${evt.id}">
                        ${photoUrl
                            ? `<img src="${photoUrl}" alt="${evt.titre}" class="card-photo" loading="lazy">`
                            : `<div class="card-photo-placeholder">
                                 <span class="placeholder-icon">🎭</span>
                               </div>`}
                        
                        <div class="card-status-dot ${originInfo.class}" title="${originInfo.tooltip}"></div>
                    </div>
                    ${evt.sync_pending ? `<div class="card-pending-upload-badge">⏳ Sync en attente</div>` : ''}
                    <div class="card-info-section-centered">
                        <h3 class="card-title">${evt.titre || 'Sans titre'}</h3>
                        <p class="card-type">${evt.category || '–'}</p>
                        <p class="card-address">📅 ${dateStr}</p>
                        
                        <div class="card-meta">
                            ${evt.facebook_url ? `<span class="meta-item">📘 Facebook</span>` : ''}
                            ${evt.bandcamp_url ? `<span class="meta-item">🎵 Bandcamp</span>` : ''}
                        </div>
                        
                        <div class="card-details">
                            ${evt.description ? `
                                <div class="detail-item">
                                    <span class="detail-value">${evt.description.substring(0, 60)}${evt.description.length > 60 ? '...' : ''}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- FAB Reject -->
                    <button class="card-fab-delete" data-action="reject" data-type="events" data-id="${evt.id}" title="Rejeter">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>

                    <!-- FAB Approve -->
                    <button class="card-fab-edit" data-action="approve" data-type="events" data-id="${evt.id}" title="Approuver">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                    
                </article>
            `;
        }));

        return cards.join('');
    }

    async getPhotoUrl(item) {
    // ✅ PRIORITÉ 1 : Blob local via pool global
    if (item.photo_id) {
        // Vérifier si déjà dans le pool global
        if (this.photoObjectUrls.has(item.photo_id)) {
            const pooledUrl = this.photoObjectUrls.get(item.photo_id);
            if (pooledUrl && pooledUrl.startsWith('blob:')) {
                return pooledUrl;
            }
        }
        
        // Créer objectURL et la stocker UNIQUEMENT dans le pool global
        try {
            const photoData = await window.IndexedDBManager.get('photos', item.photo_id);
            if (photoData?.blob && photoData.blob instanceof Blob) {
                const objectUrl = URL.createObjectURL(photoData.blob);
                this.photoObjectUrls.set(item.photo_id, objectUrl);  // ✅ POOL GLOBAL
                console.log(`✅ ObjectURL créée et pooled: ${item.photo_id.substring(0, 8)}`);
                return objectUrl;
            }
        } catch (error) {
            console.warn('⚠️ Blob indisponible:', item.photo_id.substring(0, 8));
        }
    }
    
    // ✅ PRIORITÉ 2 : URL Supabase (fallback)
    if (item.photo_url && item.supabase_synced) {
        return item.photo_url;
    }
    
    // ✅ PRIORITÉ 3 : Aucune photo
    return null;
}

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <span class="empty-icon">✅</span>
                <h3>Aucun contenu en attente</h3>
                <p>Tous les établissements et événements ont été traités</p>
            </div>
        `;
    }

    getItemOriginInfo(item) {
        switch (item.status) {
            case "local":
                return { class: "status-local", tooltip: "Local, non envoyé" };
            case "pending":
                return { class: "status-pending", tooltip: "En attente de validation" };
            case "approved":
                return { class: "status-approved", tooltip: "Validé et publié" };
            default:
                return { class: "status-unknown", tooltip: "Statut inconnu" };
        }
    }

    setupEventListeners(container) {
        // Stats filters
        container.querySelectorAll('.stat-item').forEach(item => {
  item.addEventListener('click', () => {
    this.view = item.dataset.view;
    TabCacheManager.set('moderation', {
      events: this.events,
      establishments: this.establishments,
      view: this.view
    });
    this.refreshView();
  });
});
        
        // Clic sur photos pour ouvrir les fiches
        container.addEventListener('click', (e) => {
            const photoSection = e.target.closest('.card-photo-section');
            if (photoSection && !e.target.closest('[data-action]')) {
                const type = photoSection.dataset.viewType;
                const id = photoSection.dataset.viewId;
                
                if (type === 'events') {
                    this.dashboard.openPublicEvent(id);
                } else if (type === 'establishments') {
                    this.dashboard.openPublicEstablishment(id);
                }
            }
        });
        
        // Délégation approve/reject
        container.addEventListener('click', async (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn || this.isProcessing) return;
            
            e.stopPropagation();
            e.preventDefault();
            
            const action = actionBtn.dataset.action;
            const type = actionBtn.dataset.type;
            const id = actionBtn.dataset.id;
                
            if (action === 'approve') {
                await this.handleApprove(type, id, actionBtn);
            } else if (action === 'reject') {
                await this.handleReject(type, id, actionBtn);
            }
        });

        // Boutons "Tout approuver"
        const approveAllEstabBtn = container.querySelector('#approve-all-establishments');
        if (approveAllEstabBtn) {
            approveAllEstabBtn.addEventListener('click', () => this.approveAllEstablishments());
        }

        const approveAllEventsBtn = container.querySelector('#approve-all-events');
        if (approveAllEventsBtn) {
            approveAllEventsBtn.addEventListener('click', () => this.approveAllEvents());
        }
    }
    
    /**
     * ✅ NOUVEAU FLUX - Approve (OFFLINE-FIRST)
     * 
     * ÉTAPES :
     * 1. Charger l'item local
     * 2. Marquer comme "approved" + "sync_pending" localement
     * 3. Afficher succès IMMÉDIATEMENT
     * 4. Lancer upload Supabase en arrière-plan (via SyncQueue)
     */
    async handleApprove(type, id, button) {
    if (button.disabled || this.isProcessing) return;
    
    this.isProcessing = true; 
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '...';
    
    // ===== AJOUTER ICI =====
    try {
        // STEP 1: Charger l'item local
        const item = await IndexedDBManager.get(type, id);
        if (!item) throw new Error('Item introuvable');

        // STEP 2: Marquer comme approved localement
        item.status = 'approved';
        
        await IndexedDBManager.put(type, item);
        console.log(`Approuvé localement: ${id.substring(0, 8)}`);

        // STEP 3: Afficher succès TOUT DE SUITE
        button.textContent = 'Approuvé';
        this.dashboard.showNotification('Item approuvé', 'success');

        // STEP 4: Sync vers Supabase en arrière-plan
        this.dashboard.triggerSync().catch(err => {
            console.warn('Sync background échouée:', err);
        });

        // Invalider cache modération
        TabCacheManager.invalidate('moderation');

        // Recharger la vue après délai
        await new Promise(resolve => setTimeout(resolve, 300));
        const container = document.getElementById('tab-content');
        if (container) {
            await this.render(container);
        }
        
    } catch (error) {
        console.error('Erreur approbation:', error);
        this.dashboard.showNotification(`Erreur: ${error.message}`, 'error');
        button.disabled = false;
        button.textContent = originalText;
    } finally {
        this.isProcessing = false;
    }        
       
    }

    /**
     * 🔄 Ajouter à la queue pour upload Supabase
     * (Lance en arrière-plan, ne bloque pas l'UI)
     */
    async queueApprovalUpload(type, id, item) {
        try {
            // Préparer les données pour Supabase
            const supabaseData = await this.prepareSupabaseData(type, item);

            // Ajouter à la queue avec priority haute
            await SyncQueue.add(
                type,
                id,
                'approve',
                supabaseData,
                'high' // Priorité haute pour approvals
            );

            console.log(`📋 Approval ajouté à queue: ${id.substring(0, 8)}`);

            // Déclencher le traitement de la queue
            SyncQueue.processQueue().catch(err => {
                console.warn('⚠️ Erreur processQueue:', err);
            });

        } catch (error) {
            console.error('❌ Erreur queueApprovalUpload:', error);
            this.dashboard.showNotification('⚠️ En attente de sync...', 'warning');
        }
    }

    

    /**
     * ❌ REJECT - Supprimer localement et ajouter à queue
     */
    async handleReject(type, id, button) {
    if (button.disabled || this.isProcessing) return;
    
    const reason = prompt('Raison du rejet (optionnel):');
    if (reason === null) return;  // User cancelled
    
    this.isProcessing = true;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '...';
    
    try {
        // STEP 1: Charger l'item
        const item = await IndexedDBManager.get(type, id);
        if (!item) throw new Error('Item introuvable');

        // STEP 2: Marquer comme rejected (PAS supprimer)
        item.status = 'rejected';
        item.rejection_reason = reason || 'Rejeté par modération';
        item.rejected_at = new Date().toISOString();
        
        await IndexedDBManager.put(type, item);
        console.log(`Rejeté: ${id.substring(0, 8)} - ${item.rejection_reason}`);

        // STEP 3: Envoyer à Supabase
        await window.supabaseInstance.from(type)
            .update({
                status: 'rejected',
                rejection_reason: item.rejection_reason,
                rejected_at: item.rejected_at,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        // STEP 4: Afficher succès
        button.textContent = 'Rejeté';
        this.dashboard.showNotification('Item rejeté', 'success');

        // STEP 5: Sync en arrière-plan
        this.dashboard.triggerSync().catch(err => {
            console.warn('Sync échouée:', err);
        });

        // Invalider cache + recharger
        TabCacheManager.invalidate('moderation');
        await new Promise(resolve => setTimeout(resolve, 300));
        const container = document.getElementById('tab-content');
        if (container) {
            await this.render(container);
        }
        
    } catch (error) {
        console.error('Erreur rejet:', error);
        this.dashboard.showNotification(`Erreur: ${error.message}`, 'error');
        button.disabled = false;
        button.textContent = originalText;
    } finally {
        this.isProcessing = false;
    }
}

    async approveAllEstablishments() {
    const all = await IndexedDBManager.getAll("establishments");
    const pending = all.filter(e => e.status === 'pending' || e.status === 'local');
    
    if (pending.length === 0) {
        this.dashboard.showNotification('Aucun établissement en attente', 'info');
        return;
    }
    
    if (!confirm(`Approuver ${pending.length} établissement(s) ?`)) return;

    this.isProcessing = true;

    for (const est of pending) {
        try {
            est.status = 'approved';
            await IndexedDBManager.put('establishments', est);
        } catch (error) {
            console.error('Erreur:', est.id, error);
        }
    }

    this.isProcessing = false;
    
    this.dashboard.showNotification(`${pending.length} établissement(s) approuvé(s)`, 'success');
    
    // Sync en arrière-plan
    this.dashboard.triggerSync().catch(err => {
        console.warn('Sync échouée:', err);
    });

    // Invalider cache
    TabCacheManager.invalidate('moderation');

    await new Promise(resolve => setTimeout(resolve, 300));
    const container = document.getElementById('tab-content');
    if (container) {
        await this.render(container);
    }
}

    async approveAllEvents() {
    const all = await IndexedDBManager.getAll("events");
    const pending = all.filter(e => e.status === 'pending' || e.status === 'local');
    
    if (pending.length === 0) {
        this.dashboard.showNotification('Aucun événement en attente', 'info');
        return;
    }
    
    if (!confirm(`Approuver ${pending.length} événement(s) ?`)) return;

    this.isProcessing = true;

    for (const evt of pending) {
        try {
            evt.status = 'approved';
            await IndexedDBManager.put('events', evt);
        } catch (error) {
            console.error('Erreur:', evt.id, error);
        }
    }

    this.isProcessing = false;
    
    this.dashboard.showNotification(`${pending.length} événement(s) approuvé(s)`, 'success');
    
    // Sync en arrière-plan
    this.dashboard.triggerSync().catch(err => {
        console.warn('Sync échouée:', err);
    });

    // Invalider cache
    TabCacheManager.invalidate('moderation');

    await new Promise(resolve => setTimeout(resolve, 300));
    const container = document.getElementById('tab-content');
    if (container) {
        await this.render(container);
    }
}

    cleanup() {
    // NE PAS révoquer les blob URLs - les garder vivants
    console.log('Cleanup ModerationTab - pool conservé');
}

}

export default AdminModerationTab;