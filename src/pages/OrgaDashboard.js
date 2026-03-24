/**
 * 🎵 ORGADASHBOARD BACKGROUNDUPLOADER - Dashboard organisateur offline-first
 * - 2 onglets: Mes Événements + Mon Établissement
 * - Sauvegarde locale BackgroundUploader
 * - Soumission groupée vers Supabase
 * - Réutilise AdminModals (contexte auto-détecté)
 */

import Auth from '../services/auth.js';
import GlobalDataCache from '../services/GlobalDataCache.js';
import { BackgroundUploader, ImageCache } from '../services/BackgroundUploader.js';

class OrgaDashboard {
    constructor() {
        this.container = null;
        this.currentUser = null;
        this.activeTab = 'events';
        this.isLoading = false;
        
        // Données fusionnées (local + Supabase)
        this.userEvents = [];
        this.userEstablishment = null;
        this.stats = {};

        // Filtres pour les événements
        this.eventFilters = {
            search: '',
            status: 'all', // 'all', 'upcoming', 'past', 'pending'
            category: 'all'
        };

        // Event listeners bound
        this.boundEventListeners = new Map();
        
        console.log('🎵 OrgaDashboard BackgroundUploader créé');
    }

    async init() {
        console.log('🎵 Initialisation OrgaDashboard BackgroundUploader...');
        
        // Vérifier auth et rôle
        if (!Auth.isAuthenticated()) {
            window.BarzikApp.navigateTo('/auth');
            return;
        }

        this.currentUser = Auth.getCurrentUser();
        if (this.currentUser.role !== 'organizer' && this.currentUser.role !== 'user') {
            window.BarzikApp.navigateTo('/public');
            return;
        }

        this.container = document.getElementById('app');
        if (!this.container) {
            throw new Error('Container #app non trouvé');
        }
        
        // Nettoyer anciens listeners
        this.removeAllEventListeners();
        
        // ÉCOUTER BackgroundUploader
        this.setupBackgroundUploaderListener();
        
        // CHARGEMENT INITIAL
        if (!GlobalDataCache.isReady()) {
            this.showFullPageLoading();
            await GlobalDataCache.loadAll();
            this.hideFullPageLoading();
        }
        
        // Charger données fusionnées
        await this.loadAllData();
        
        // Rendre interface
        await this.render();
        
        console.log('🎵 OrgaDashboard BackgroundUploader initialisé');
    }

    // ÉCOUTER les changements BackgroundUploader
    setupBackgroundUploaderListener() {
        const backgroundUpdateHandler = (e) => {
            console.log('🔄 Mise à jour BackgroundUploader détectée (Orga)');
            this.loadAllData();
            this.renderActiveTab();
            this.updateCounters();
        };
        
        window.addEventListener('backgroundUploaderUpdate', backgroundUpdateHandler);
        this.boundEventListeners.set('backgroundUploaderUpdate', backgroundUpdateHandler);
    }

    // CHARGER toutes les données (fusion BackgroundUploader + Supabase)
    async loadAllData() {
        try {
            // Données Supabase depuis GlobalDataCache
            const supabaseEvents = GlobalDataCache.getEvents();
            const supabaseEstablishments = GlobalDataCache.getEstablishments();

            // Fusion avec données locales BackgroundUploader
            const allEvents = BackgroundUploader.getAllData('events', supabaseEvents);
            const allEstablishments = BackgroundUploader.getAllData('establishments', supabaseEstablishments);
            
            // Filtrer pour l'utilisateur actuel uniquement
            this.userEvents = allEvents.filter(e => e.organisateur_id === this.currentUser.id);
            this.userEstablishment = allEstablishments.find(e => e.owner_id === this.currentUser.id);
            
            this.calculateStats();
            console.log('📊 Données organisateur fusionnées:', {
                events: this.userEvents.length,
                establishment: this.userEstablishment ? '✅' : '❌',
                localPending: this.getLocalPendingCount()
            });
        } catch (error) {
            console.error('Erreur chargement données organisateur:', error);
        }
    }

    calculateStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.stats = {
            totalEvents: this.userEvents.length,
            upcomingEvents: this.userEvents.filter(e => {
                const eventDate = new Date(e.date_debut);
                return eventDate >= today;
            }).length,
            pastEvents: this.userEvents.filter(e => {
                const eventDate = new Date(e.date_debut);
                return eventDate < today;
            }).length,
            pendingEvents: this.userEvents.filter(e => e.status === 'pending' || e.isLocalPending).length,
            localPendingEvents: this.userEvents.filter(e => e.isLocalPending).length
        };
    }

    getLocalPendingCount() {
        const backgroundStatus = BackgroundUploader.getStatus();
        return backgroundStatus.data.events + (this.userEstablishment?.isLocalPending ? 1 : 0);
    }

    async render() {
        if (!this.container) return;
        
        this.container.innerHTML = this.getHTML();
        this.setupEventListeners();
        this.renderActiveTab();
        
        console.log('🎵 OrgaDashboard rendu avec données fusionnées');
    }

    getHTML() {
        const userName = this.currentUser?.name || this.currentUser?.email || 'Organisateur';
        const backgroundStatus = BackgroundUploader.getStatus();
        const localCount = this.getLocalPendingCount();
        
        return `
            <div class="orga-dashboard">
                <header class="orga-header">
                    <div class="header-container">
                        <div class="header-brand">
                            <div class="brand-logo">
                                <img src="public/logos/logo-rond-30px.svg" 
                                     alt="Barzik Logo" 
                                     width="40" 
                                     height="40" 
                                     class="logo-img"
                                     onerror="this.style.display='none';">
                            </div>
                            <div class="brand-text">
                                <h1 class="brand-title">BARZIK ORGANISATEUR</h1>
                                <span class="brand-subtitle">Dashboard Rock Events</span>
                            </div>
                        </div>
                        
                        <div class="header-meta">
                            <div class="local-status">
                                <span class="status-indicator ${localCount > 0 ? 'pending' : 'synced'}">
                                    ${localCount > 0 ? `💾 ${localCount} local` : '✅ Synchronisé'}
                                </span>
                            </div>
                            <div class="header-user">
                                <span class="user-greeting">🤘 Salut ${userName}</span>
                                <div class="header-actions">
                                    <button class="btn btn-sm btn-outline" onclick="window.BarzikApp.navigateTo('/public')">
                                        👁️ Voir le public
                                    </button>
                                    <button class="btn btn-sm btn-outline" onclick="window.OrgaDashboardInstance.logout()">
                                        🚪 Déconnexion
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <!-- Stats Rapides -->
                <section class="stats-section">
                    <div class="stats-container">
                        <div class="stats-grid">
                            <div class="stat-card stat-primary">
                                <div class="stat-icon">🎵</div>
                                <div class="stat-content">
                                    <div class="stat-number">${this.stats.totalEvents}</div>
                                    <div class="stat-label">Événements créés</div>
                                </div>
                            </div>
                            
                            <div class="stat-card stat-success">
                                <div class="stat-icon">📅</div>
                                <div class="stat-content">
                                    <div class="stat-number">${this.stats.upcomingEvents}</div>
                                    <div class="stat-label">À venir</div>
                                </div>
                            </div>
                            
                            <div class="stat-card stat-warning">
                                <div class="stat-icon">⏳</div>
                                <div class="stat-content">
                                    <div class="stat-number">${this.stats.pendingEvents}</div>
                                    <div class="stat-label">En attente</div>
                                </div>
                            </div>
                            
                            <div class="stat-card ${this.stats.localPendingEvents > 0 ? 'stat-info' : 'stat-secondary'}">
                                <div class="stat-icon">💾</div>
                                <div class="stat-content">
                                    <div class="stat-number">${this.stats.localPendingEvents}</div>
                                    <div class="stat-label">Locaux</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Navigation 2 onglets -->
                <nav class="dashboard-nav">
                    <div class="nav-container">
                        <ul class="nav-tabs">
                            <li class="nav-item">
                                <button class="nav-tab ${this.activeTab === 'events' ? 'active' : ''}" 
                                        data-tab="events">
                                    <span class="tab-icon">🎭</span>
                                    <span class="tab-text">Mes Événements</span>
                                    <span class="tab-counter">${this.userEvents.length}</span>
                                    ${this.stats.localPendingEvents > 0 ? '<span class="tab-alert">●</span>' : ''}
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-tab ${this.activeTab === 'establishment' ? 'active' : ''}" 
                                        data-tab="establishment">
                                    <span class="tab-icon">🏢</span>
                                    <span class="tab-text">Mon Établissement</span>
                                    ${this.userEstablishment?.isLocalPending ? '<span class="tab-alert">●</span>' : ''}
                                </button>
                            </li>
                        </ul>
                        
                        <!-- BOUTON SOUMISSION GROUPÉE -->
                        ${localCount > 0 ? `
                            <div class="nav-actions">
                                <button class="btn btn-success btn-lg" onclick="window.OrgaDashboardInstance.submitAllEvents()">
                                    📤 Soumettre mes créations (${localCount})
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </nav>

                <main class="dashboard-main">
                    <div id="tab-content" class="tab-content">
                        <!-- Le contenu sera généré dynamiquement -->
                    </div>
                </main>
            </div>
        `;
    }

    setupEventListeners() {
        // Event listeners pour les onglets
        document.querySelectorAll('.nav-tab').forEach(tab => {
            const clickHandler = (e) => {
                e.preventDefault();
                const tabName = tab.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            };
            
            tab.addEventListener('click', clickHandler);
            tab._clickHandler = clickHandler;
        });

        // Instance globale pour méthodes onclick
        window.OrgaDashboardInstance = this;
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        
        // Mettre à jour UI des onglets
        document.querySelectorAll('.nav-tab').forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
        });
        
        this.renderActiveTab();
    }

    renderActiveTab() {
        const container = document.getElementById('tab-content');
        if (!container) return;

        switch (this.activeTab) {
            case 'events':
                container.innerHTML = this.getEventsTabHTML();
                this.setupEventsFilters();
                break;
            case 'establishment':
                container.innerHTML = this.getEstablishmentTabHTML();
                break;
            default:
                container.innerHTML = this.getEventsTabHTML();
        }
    }

    // ===========================================
    // ONGLET MES ÉVÉNEMENTS AVEC FILTRES
    // ===========================================

    getEventsTabHTML() {
        const filteredEvents = this.getFilteredEvents();
        
        return `
            <section class="tab-panel active">
                <div class="panel-header">
                    <div class="panel-title">
                        <h2>🎭 Mes Événements</h2>
                        <p class="panel-description">
                            ${this.userEvents.length} événements créés
                            ${this.stats.localPendingEvents > 0 ? ` • ${this.stats.localPendingEvents} en local` : ''}
                        </p>
                    </div>
                    <div class="panel-actions">
                        <button class="btn btn-secondary" onclick="window.OrgaDashboardInstance.exportMyEvents()">
                            📤 Exporter
                        </button>
                        <button class="btn btn-primary" onclick="window.AdminModals.openEventModal()">
                            ➕ Nouvel Événement
                        </button>
                    </div>
                </div>

                <div class="panel-content">
                    <!-- Filtres événements -->
                    <div class="table-filters">
                        <div class="filter-group">
                            <input type="text" 
                                   id="event-search" 
                                   class="filter-input" 
                                   placeholder="🔍 Rechercher dans mes événements..."
                                   value="${this.eventFilters.search}"
                                   oninput="window.OrgaDashboardInstance.updateEventFilter('search', this.value)">
                        </div>
                        
                        <div class="filter-group">
                            <label for="event-status-filter" class="filter-label">Statut:</label>
                            <select id="event-status-filter" class="filter-select" 
                                    onchange="window.OrgaDashboardInstance.updateEventFilter('status', this.value)">
                                <option value="all" ${this.eventFilters.status === 'all' ? 'selected' : ''}>Tous</option>
                                <option value="upcoming" ${this.eventFilters.status === 'upcoming' ? 'selected' : ''}>📅 À venir</option>
                                <option value="past" ${this.eventFilters.status === 'past' ? 'selected' : ''}>⏰ Passés</option>
                                <option value="pending" ${this.eventFilters.status === 'pending' ? 'selected' : ''}>⏳ En attente</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="event-category-filter" class="filter-label">Catégorie:</label>
                            <select id="event-category-filter" class="filter-select"
                                    onchange="window.OrgaDashboardInstance.updateEventFilter('category', this.value)">
                                <option value="all" ${this.eventFilters.category === 'all' ? 'selected' : ''}>Toutes</option>
                                <option value="concert" ${this.eventFilters.category === 'concert' ? 'selected' : ''}>🎵 Concert</option>
                                <option value="djset" ${this.eventFilters.category === 'djset' ? 'selected' : ''}>🎧 DJ Set</option>
                                <option value="karaoke" ${this.eventFilters.category === 'karaoke' ? 'selected' : ''}>🎤 Karaoké</option>
                                <option value="jam" ${this.eventFilters.category === 'jam' ? 'selected' : ''}>🎸 Jam Session</option>
                                <option value="festival" ${this.eventFilters.category === 'festival' ? 'selected' : ''}>🎪 Festival</option>
                                <option value="performance" ${this.eventFilters.category === 'performance' ? 'selected' : ''}>🎭 Performance</option>
                            </select>
                        </div>
                        
                        <div class="filter-stats">
                            <span class="stat-badge">📋 ${filteredEvents.length} affichés</span>
                            ${this.stats.pendingEvents > 0 ? `<span class="stat-badge pending">⏳ ${this.stats.pendingEvents} en attente</span>` : ''}
                        </div>
                    </div>

                    ${this.userEvents.length === 0 ? this.getEmptyEventsHTML() : 
                      this.getEventsTableHTML(filteredEvents)}
                </div>
            </section>
        `;
    }

    getFilteredEvents() {
        let filtered = [...this.userEvents];
        
        // Filtre par recherche textuelle
        if (this.eventFilters.search) {
            const search = this.eventFilters.search.toLowerCase();
            filtered = filtered.filter(event => 
                event.titre?.toLowerCase().includes(search) ||
                event.description?.toLowerCase().includes(search)
            );
        }
        
        // Filtre par statut
        if (this.eventFilters.status !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            filtered = filtered.filter(event => {
                const eventDate = new Date(event.date_debut);
                
                switch (this.eventFilters.status) {
                    case 'upcoming':
                        return eventDate >= today;
                    case 'past':
                        return eventDate < today;
                    case 'pending':
                        return event.status === 'pending' || event.isLocalPending;
                    default:
                        return true;
                }
            });
        }
        
        // Filtre par catégorie
        if (this.eventFilters.category !== 'all') {
            filtered = filtered.filter(event => event.category === this.eventFilters.category);
        }
        
        // Trier par date (plus récents en premier)
        filtered.sort((a, b) => {
            const dateA = new Date(a.date_debut);
            const dateB = new Date(b.date_debut);
            return dateB - dateA;
        });
        
        return filtered;
    }

    updateEventFilter(filterType, value) {
        this.eventFilters[filterType] = value;
        this.renderActiveTab();
    }

    setupEventsFilters() {
        // Les listeners sont inline pour simplifier
        console.log('Filtres événements organisateur configurés');
    }

    getEmptyEventsHTML() {
        return `
            <div class="empty-state">
                <span class="empty-icon">🎵</span>
                <h3>Aucun événement créé</h3>
                <p>Commencez par créer votre premier événement rock !</p>
                ${!this.userEstablishment ? `
                    <p class="establishment-notice">
                        💡 Pensez d'abord à créer votre établissement dans l'onglet "Mon Établissement"
                    </p>
                ` : ''}
                <button class="btn btn-primary" onclick="window.AdminModals.openEventModal()">
                    ➕ Créer mon premier événement
                </button>
            </div>
        `;
    }

    getEventsTableHTML(events) {
        const rows = events.map(event => {
            const eventDate = new Date(event.date_debut);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isUpcoming = eventDate >= today;
            
            return `
                <tr onclick="window.OrgaDashboardInstance.viewEvent('${event.id}')" class="${event.isLocalPending ? 'row-local' : ''}">
                    <td>
                        <div class="table-item">
                            <div class="item-photo">
                                ${(() => {
                                    const photoSrc = this.getPhotoSrc(event, 'thumbnail');
                                    return photoSrc ? 
                                        `<img src="${photoSrc}" alt="${event.titre}">` :
                                        `<div class="photo-placeholder">${this.getCategoryIcon(event.category)}</div>`;
                                })()}
                            </div>
                            <div class="item-details">
                                <strong>${event.titre}</strong>
                                <small>${this.getCategoryName(event.category)}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${eventDate.toLocaleDateString('fr-FR')}<br>
                        <small>${eventDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</small>
                    </td>
                    <td>
                        <span class="status-badge ${event.isLocalPending ? 'status-local' : 
                                                    event.status === 'pending' ? 'status-pending' : 
                                                    event.status === 'approved' ? 'status-approved' : 
                                                    isUpcoming ? 'status-upcoming' : 'status-past'}">
                            ${event.isLocalPending ? '💾 Local' : 
                              event.status === 'pending' ? '⏳ En attente' : 
                              event.status === 'approved' ? '✅ Approuvé' : 
                              isUpcoming ? '📅 À venir' : '⏰ Passé'}
                        </span>
                    </td>
                    <td>
                        <div class="actions-group">
                            <button class="action-btn action-btn-edit" 
                                    onclick="event.stopPropagation();window.OrgaDashboardInstance.editEvent('${event.id}')" 
                                    title="Modifier">✏️</button>
                            <button class="action-btn action-btn-delete" 
                                    onclick="event.stopPropagation();window.OrgaDashboardInstance.deleteEvent('${event.id}')" 
                                    title="Supprimer">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-container">
                <table class="orga-table">
                    <thead>
                        <tr>
                            <th>Événement</th>
                            <th>Date</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                ${events.length !== this.userEvents.length ? `<p class="table-note">Affichage de ${events.length} événements sur ${this.userEvents.length} total</p>` : ''}
            </div>
        `;
    }

    // ===========================================
    // ONGLET MON ÉTABLISSEMENT
    // ===========================================

    getEstablishmentTabHTML() {
        return `
            <section class="tab-panel active">
                <div class="panel-header">
                    <div class="panel-title">
                        <h2>🏢 Mon Établissement</h2>
                        <p class="panel-description">
                            ${this.userEstablishment ? 
                              'Gérez les informations de votre lieu d\'événements' : 
                              'Créez votre établissement pour organiser vos événements'}
                        </p>
                    </div>
                    <div class="panel-actions">
                        ${this.userEstablishment ? `
                            <button class="btn btn-secondary" onclick="window.OrgaDashboardInstance.editEstablishment()">
                                ✏️ Modifier
                            </button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.AdminModals.openEstablishmentModal()">
                                ➕ Créer mon établissement
                            </button>
                        `}
                    </div>
                </div>

                <div class="panel-content">
                    ${this.userEstablishment ? this.getEstablishmentCardHTML() : this.getEmptyEstablishmentHTML()}
                </div>
            </section>
        `;
    }

    getEstablishmentCardHTML() {
        const estab = this.userEstablishment;
        
        return `
            <div class="establishment-card ${estab.isLocalPending ? 'local-pending' : ''}">
                <div class="establishment-header">
                    <div class="establishment-photo">
                        ${(() => {
                            const photoSrc = this.getPhotoSrc(estab, 'medium');
                            return photoSrc ? 
                                `<img src="${photoSrc}" alt="${estab.nom}">` :
                                `<div class="photo-placeholder">${this.getEstablishmentTypeIcon(estab.type)}</div>`;
                        })()}
                    </div>
                    <div class="establishment-info">
                        <h3>${estab.nom}</h3>
                        <span class="establishment-type">
                            ${this.getEstablishmentTypeIcon(estab.type)} ${this.getEstablishmentTypeName(estab.type)}
                        </span>
                        <span class="status-badge ${estab.isLocalPending ? 'status-local' : estab.status === 'pending' ? 'status-pending' : 'status-approved'}">
                            ${estab.isLocalPending ? '💾 Local' : estab.status === 'pending' ? '⏳ En attente' : '✅ Approuvé'}
                        </span>
                    </div>
                </div>
                
                <div class="establishment-details">
                    <div class="detail-row">
                        <strong>📍 Adresse:</strong>
                        <span>${estab.adresse}</span>
                    </div>
                    
                    ${estab.telephone ? `
                        <div class="detail-row">
                            <strong>📞 Téléphone:</strong>
                            <span>${estab.telephone}</span>
                        </div>
                    ` : ''}
                    
                    ${estab.email ? `
                        <div class="detail-row">
                            <strong>📧 Email:</strong>
                            <span>${estab.email}</span>
                        </div>
                    ` : ''}
                    
                    ${estab.website ? `
                        <div class="detail-row">
                            <strong>🌐 Site web:</strong>
                            <span><a href="${estab.website}" target="_blank">${estab.website}</a></span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="establishment-social">
                    ${estab.facebook_url ? `<a href="${estab.facebook_url}" target="_blank" class="social-link">📘 Facebook</a>` : ''}
                    ${estab.instagram_url ? `<a href="${estab.instagram_url}" target="_blank" class="social-link">📸 Instagram</a>` : ''}
                </div>
                
                <div class="establishment-stats">
                    <div class="stat-item">
                        <span class="stat-value">${this.userEvents.length}</span>
                        <span class="stat-label">Événements créés</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.stats.upcomingEvents}</span>
                        <span class="stat-label">À venir</span>
                    </div>
                </div>
            </div>
        `;
    }

    getEmptyEstablishmentHTML() {
        return `
            <div class="empty-state">
                <span class="empty-icon">🏢</span>
                <h3>Aucun établissement configuré</h3>
                <p>Créez votre établissement pour organiser vos événements</p>
                <div class="empty-benefits">
                    <div class="benefit-item">
                        <span class="benefit-icon">🎭</span>
                        <span>Créez des événements dans votre lieu</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">📍</span>
                        <span>Votre adresse sera automatiquement associée</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">📱</span>
                        <span>Partagez vos réseaux sociaux</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="window.AdminModals.openEstablishmentModal()">
                    ➕ Créer mon établissement
                </button>
            </div>
        `;
    }

    // ===========================================
    // ACTIONS ET MÉTHODES
    // ===========================================

    // SOUMISSION GROUPÉE VERS SUPABASE
    async submitAllEvents() {
        const localCount = this.getLocalPendingCount();
        
        if (localCount === 0) {
            this.showNotification('Aucun élément local à soumettre', 'info');
            return;
        }

        if (!confirm(`Soumettre ${localCount} élément(s) vers Supabase pour validation admin ?`)) {
            return;
        }

        try {
            this.showNotification('📤 Soumission en cours...', 'info');
            this.showFullPageLoading();

            // Envoyer via BackgroundUploader
            const results = await BackgroundUploader.submitAllToSupabase();
            
            this.hideFullPageLoading();

            const totalSuccess = results.establishments.success.length + results.events.success.length;
            const totalErrors = results.establishments.errors.length + results.events.errors.length;

            if (totalErrors === 0) {
                this.showNotification(`✅ ${totalSuccess} élément(s) soumis avec succès ! En attente de validation admin.`, 'success');
            } else {
                this.showNotification(`⚠️ ${totalSuccess} réussis, ${totalErrors} erreurs`, 'warning');
                console.error('Erreurs soumission:', results);
            }

            // Recharger les données
            await this.manualRefresh();

        } catch (error) {
            this.hideFullPageLoading();
            console.error('❌ Erreur soumission groupée:', error);
            this.showNotification('❌ Erreur lors de la soumission: ' + error.message, 'error');
        }
    }

    // Actions CRUD
    editEvent(eventId) {
        const event = this.userEvents.find(e => e.id === eventId);
        if (event) {
            window.AdminModals.openEventModal(event);
        }
    }

    viewEvent(eventId) {
        this.editEvent(eventId);
    }

    deleteEvent(eventId) {
        if (confirm('Supprimer cet événement ?')) {
            window.AdminModals.deleteEvent(eventId);
        }
    }

    editEstablishment() {
        if (this.userEstablishment) {
            window.AdminModals.openEstablishmentModal(this.userEstablishment);
        }
    }

    // Refresh manuel
    async manualRefresh() {
        try {
            this.showNotification('🔄 Actualisation...', 'info');
            
            await GlobalDataCache.manualRefresh();
            await this.loadAllData();
            this.renderActiveTab();
            
            this.showNotification('✅ Données actualisées', 'success');
            
        } catch (error) {
            console.error('Erreur refresh:', error);
            this.showNotification('❌ Erreur actualisation: ' + error.message, 'error');
        }
    }

    exportMyEvents() {
        const dataStr = JSON.stringify(this.userEvents, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mes-evenements-barzik-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('📤 Événements exportés', 'success');
    }

    async logout() {
        if (confirm('Se déconnecter ?')) {
            const result = await Auth.logout();
            if (result.success) {
                window.BarzikApp.navigateTo('/auth');
            }
        }
    }

    // ===========================================
    // UTILITAIRES
    // ===========================================

    getPhotoSrc(item, sizeKey = 'thumbnail') {
        if (item.photo_url?.startsWith('temp_')) {
            const cached = ImageCache.get(item.photo_url);
            if (cached && cached.data) {
                return cached.data[sizeKey] || cached.data.thumbnail || cached.data.medium;
            }
        }
        return item.photo_url;
    }

    getCategoryIcon(category) {
        const icons = {
            'concert': '🎵', 'djset': '🎧', 'karaoke': '🎤',
            'jam': '🎸', 'festival': '🎪', 'performance': '🎭'
        };
        return icons[category] || '🎵';
    }

    getCategoryName(category) {
        const names = {
            'concert': 'Concert', 'djset': 'DJ Set', 'karaoke': 'Karaoké',
            'jam': 'Jam Session', 'festival': 'Festival', 'performance': 'Performance'
        };
        return names[category] || 'Événement';
    }

    getEstablishmentTypeIcon(type) {
        const icons = {
            'bar': '🍺', 'restaurant': '🍽️', 'club': '🕺',
            'salle': '🏛️', 'cafe': '☕', 'autre': '🏢'
        };
        return icons[type] || '🏢';
    }

    getEstablishmentTypeName(type) {
        const names = {
            'bar': 'Bar', 'restaurant': 'Restaurant', 'club': 'Club',
            'salle': 'Salle', 'cafe': 'Café', 'autre': 'Autre'
        };
        return names[type] || 'Établissement';
    }

    updateCounters() {
        const eventsCounter = document.querySelector('[data-tab="events"] .tab-counter');
        if (eventsCounter) eventsCounter.textContent = this.userEvents.length;
    }

    showFullPageLoading() {
        const loadingHTML = `
            <div class="full-page-loading">
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p>Soumission en cours...</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
    }

    hideFullPageLoading() {
        const loading = document.querySelector('.full-page-loading');
        if (loading) loading.remove();
    }

    showNotification(message, type = 'info') {
        if (window.BarzikToast) {
            window.BarzikToast.show(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    removeAllEventListeners() {
        this.boundEventListeners.forEach((handler, event) => {
            window.removeEventListener(event, handler);
        });
        this.boundEventListeners.clear();
    }

    destroy() {
        this.removeAllEventListeners();
        
        if (window.OrgaDashboardInstance === this) {
            window.OrgaDashboardInstance = null;
        }

        console.log('🎵 OrgaDashboard BackgroundUploader détruit');
    }
}

// Export global
window.OrgaDashboard = OrgaDashboard;

export default OrgaDashboard;