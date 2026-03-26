/**
 * 👥 ADMIN ACCOUNT TAB - CORRIGÉ
 * Source primaire : IndexedDB (offline-first)
 * Sync : Supabase à la demande
 */

import IndexedDBManager from "../../../services/IndexedDBManager.js";
import TabCacheManager from '../../../services/TabCacheManager.js';
import DashboardIcons from '../../../components/dashboard-icons.js';

class AdminAccountTab {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.filter = 'all';
        this.searchQuery = '';
        this.accounts = [];
        
        // Pool d'objectURLs (NOUVEAU)
        this.photoObjectUrls = dashboard.globalPhotoPool;
    }

    async render(container) {
  // Utiliser cache
  const cached = await TabCacheManager.getOrFetch(
    'accounts',
    () => this.getFilteredAccounts()
  );

  this.accounts = cached?.items || [];
  this.filter = cached?.filter || 'all';
  this.searchQuery = cached?.searchQuery || '';

  container.innerHTML = await this.getHTML(this.accounts);
  this.setupEventListeners(container);
}

    /**
     * ✅ SOURCE PRIMAIRE : IndexedDB (offline-first)
     */
    async getFilteredAccounts() {
        try {
            // 1. Récupérer depuis IndexedDB (offline)
            let accounts = await IndexedDBManager.getAll('profiles');

            console.log(`📦 Profiles locaux : ${accounts.length}`);

            // Si vide, faire un fetch Supabase une seule fois
            if (accounts.length === 0) {
                console.log('📥 Profiles vides, sync Supabase...');
                await this.syncProfilesFromSupabase();
                accounts = await IndexedDBManager.getAll('profiles');
            }

            // Filter is_active
            accounts = accounts.filter(a => a.is_active !== false);

            // 2. Compter établissements localement depuis IndexedDB
            const allEstablishments = await IndexedDBManager.getAll('establishments');
            const estabCountByOwner = {};
            
            allEstablishments.forEach(estab => {
                if (estab.owner_id) {
                    estabCountByOwner[estab.owner_id] = (estabCountByOwner[estab.owner_id] || 0) + 1;
                }
            });

            // 3. Ajouter count à chaque compte
            const accountsWithCount = accounts.map(account => ({
                ...account,
                establishments: [{ count: estabCountByOwner[account.id] || 0 }]
            }));

            // 4. Appliquer filtres
            let filtered = accountsWithCount;

            if (this.filter !== 'all') {
                filtered = filtered.filter(a => a.role === this.filter);
            }

            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                filtered = filtered.filter(a =>
                    a.nom?.toLowerCase().includes(query) ||
                    a.prenom?.toLowerCase().includes(query) ||
                    a.email?.toLowerCase().includes(query)
                );
            }

            return filtered;

        } catch (error) {
            console.error('❌ Erreur getFilteredAccounts:', error);
            return [];
        }
    }

    /**
     * 🔄 SYNC PROFILES depuis Supabase (une seule fois)
     */
    async syncProfilesFromSupabase() {
        try {
            const { data: profiles, error } = await window.supabaseInstance
                .from('profiles')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (profiles && profiles.length > 0) {
                for (const profile of profiles) {
                    await IndexedDBManager.put('profiles', profile);
                }
                console.log(`✅ ${profiles.length} profiles synced`);
            }

        } catch (error) {
            console.error('❌ Erreur sync profiles:', error);
        }
    }

    async getHTML(accounts) {
        const stats = this.getStats(accounts);

        return `
            <section class="tab-panel active">
                
                <div class="panel-header-centered">
                    <h2>👥 Gestion des Comptes</h2>
                    <p class="panel-description">Administration des utilisateurs et organisateurs</p>
                    
                    <div class="quick-stats">
                        ${this.createStatItem('all', stats.total, 'Total')}
                        ${this.createStatItem('admin', stats.admin, 'Admins')}
                        ${this.createStatItem('organizer', stats.organizer, 'Organisateurs')}
                        ${this.createStatItem('public', stats.public, 'Public')}
                    </div>
                </div>
                
                <div class="toolbar-section">
                    <div class="toolbar-left">
                        <div class="search-container">
                            <input type="text" class="search-input" id="search-accounts"
                                   placeholder="Rechercher un compte..."
                                   value="${this.searchQuery}">
                            <span class="search-icon">${DashboardIcons.search}</span>
                        </div>
                    </div>
                    
                    <div class="toolbar-right">
    <div class="toolbar-actions">
        <button class="btn-toolbar" id="refresh-accounts" title="Actualiser">
            ${DashboardIcons.refresh}
        </button>
        <button class="btn-toolbar btn-primary" id="create-account" title="Créer un compte">
            ${DashboardIcons.add} Nouveau
        </button>
    </div>
</div>
                </div>
                
                <div class="establishments-grid">
                    ${accounts.length > 0 ? await this.getCardsHTML(accounts) : this.getEmptyStateHTML()}
                </div>
            </section>
        `;
    }

    createStatItem(filter, value, label) {
        const isActive = this.filter === filter;
        return `
            <div class="stat-item ${isActive ? 'active' : ''}" data-filter="${filter}">
                <span class="stat-number">${value}</span>
                <span class="stat-label">${label}</span>
            </div>
        `;
    }

    getStats(accounts) {
        return {
            total: accounts.length,
            admin: accounts.filter(a => a.role === 'admin').length,
            organizer: accounts.filter(a => a.role === 'organizer').length,
            public: accounts.filter(a => a.role === 'public').length
        };
    }

    async getCardsHTML(accounts) {
        const cards = await Promise.all(accounts.map(async (account) => {
            const createdDate = account.created_at ?
                new Date(account.created_at).toLocaleDateString('fr-FR') : 'N/A';
            
            const establishmentCount = account.establishments?.[0]?.count || 0;
            const roleInfo = this.getRoleInfo(account.role);
            const displayName = account.displayName || 'Sans nom';

            return `
                <article class="establishment-card" data-id="${account.id}">
                    <div class="card-photo-section">
    ${this.getGeneratedAvatarHTML(account)}
    <!-- Pas de status dot pour accounts (la couleur suffit) -->
</div>

                    <div class="card-info-section-centered">
                        <h3 class="card-title">${displayName}</h3>
                        <p class="card-type">${roleInfo.label}</p>
                        <p class="card-address">${account.email}</p>
                        
                        <div class="card-meta">
                            ${account.telephone ? `<span class="meta-item">📱 ${this.formatPhone(account.telephone)}</span>` : ''}
                            <span class="meta-item">🏢 ${establishmentCount} établissement${establishmentCount > 1 ? 's' : ''}</span>
                        </div>
                        
                        <div class="card-details">
                            <div class="detail-item">
                                <span class="detail-label">Inscrit:</span>
                                <span class="detail-value">${createdDate}</span>
                            </div>
                        </div>
                    </div>

                    <!-- FAB Actions -->
${account.role !== 'admin' ? `
    <button class="card-fab-delete" data-action="delete-account" data-id="${account.id}" title="Supprimer le compte">
        ${DashboardIcons.delete}
    </button>
` : ''}

<button class="card-fab-edit" data-action="edit-account" data-id="${account.id}" title="Modifier le compte">
    ${DashboardIcons.edit}
</button>

${establishmentCount > 0 ? `
    <button class="card-fab-eye" data-action="view-establishments" data-id="${account.id}" title="Voir établissements">
        ${DashboardIcons.eye}
    </button>
` : ''}
                    
                </article>
            `;
        }));

        return cards.join('');
    }

    getRoleInfo(role) {
        const roles = {
            'admin': { icon: '👑', label: 'Administrateur', class: 'status-approved' },
            'organizer': { icon: '🎭', label: 'Organisateur', class: 'status-pending' },
            'public': { icon: '👤', label: 'Public', class: 'status-local' }
        };
        return roles[role] || { icon: '👤', label: 'Utilisateur', class: 'status-unknown' };
    }

    getEmptyStateHTML() {
        const messages = {
            'all': {
                icon: DashboardIcons.emptyBox,
                title: 'Aucun compte',
                message: 'Aucun compte utilisateur enregistré'
            },
            'admin': {
                icon: '👑',
                title: 'Aucun administrateur',
                message: 'Aucun compte administrateur'
            },
            'organizer': {
                icon: '🎭',
                title: 'Aucun organisateur',
                message: 'Aucun compte organisateur'
            },
            'public': {
                icon: '👤',
                title: 'Aucun public',
                message: 'Aucun compte public'
            }
        };

        const config = messages[this.filter] || messages['all'];

        return `
            <div class="empty-state">
                <div class="empty-icon">${config.icon}</div>
                <h3>${config.title}</h3>
                <p>${config.message}</p>
            </div>
        `;
    }

    setupEventListeners(container) {
    container.querySelectorAll('.stat-item').forEach(item => {
        item.addEventListener('click', () => {
            this.filter = item.dataset.filter;
            TabCacheManager.updateFilter('accounts', this.filter);
            this.refreshView();    
        });
    });

    const createBtn = container.querySelector('#create-account');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            this.createAccount();
        });
    }

    const searchInput = container.querySelector('#search-accounts');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            TabCacheManager.updateSearch('accounts', this.searchQuery);
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.refreshView(), 300);
        });
    }

    const refreshBtn = container.querySelector('#refresh-accounts');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            this.dashboard.forceRefresh();
        });
    }

    if (this._containerClickHandler) {
    container.removeEventListener('click', this._containerClickHandler);
}

// ✅ CRÉER le nouveau listener
this._containerClickHandler = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    e.stopPropagation();
    e.preventDefault();

    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;

    switch (action) {
        case 'create-account':
            await this.createAccount();
            break;
        case 'edit-account':
            await this.editAccount(id);
            break;
        case 'view-establishments':
            await this.viewEstablishments(id);
            break;
        case 'delete-account':
            await this.deleteAccount(id);
            break;
    }
};

container.addEventListener('click', this._containerClickHandler);
    
    if (this._profileUpdatedHandler) {
    window.removeEventListener('profileUpdated', this._profileUpdatedHandler);
    console.log('🧹 Ancien handler profileUpdated supprimé');
}
    
    this._profileUpdatedHandler = async (e) => {
    console.log('👂 profileUpdated event reçu:', e.detail.profileId);
    
    try {
        // Attendre que le modal soit fermé
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Si le modal est encore ouvert, skip
        if (document.querySelector('.modal-overlay')) {
            console.log('Modal encore ouvert, skip update');
            return;
        }
        
        const updated = await IndexedDBManager.get('profiles', e.detail.profileId);
        
        if (updated) {
            console.log('✅ Profil rechargé depuis IndexedDB');
            // ❌ SUPPRIMÉ : TabCacheManager.invalidate('accounts');
            
            const card = document.querySelector(`[data-id="${e.detail.profileId}"]`);
            if (card) {
                const displayName = updated.displayName || 'Sans nom';
                const titleEl = card.querySelector('.card-title');
                const addressEl = card.querySelector('.card-address');
                
                if (titleEl) titleEl.textContent = displayName;
                if (addressEl) addressEl.textContent = updated.email;
                
                console.log('✅ Card mise à jour immédiatement');
            }
        }
    } catch (error) {
        console.error('❌ Erreur profileUpdated:', error);
    }
};
    
    window.addEventListener('profileUpdated', this._profileUpdatedHandler);
}

    async createAccount() {
    await new Promise(resolve => setTimeout(resolve, 50));
    await window.ProfileModal.open(null);
    
}


async editAccount(accountId) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const account = await IndexedDBManager.get('profiles', accountId);
    if (!account) {
        this.dashboard.showNotification('Compte introuvable', 'error');
        return;
    }
    await window.ProfileModal.open(account);
}
getGeneratedAvatarHTML(account) {
    const initials = (account.displayName?.split(' ')[0]?.[0] || 'A') +
                     (account.displayName?.split(' ')[1]?.[0] || 'D');
    
    const roleColors = {
        'admin': '#667eea',
        'organizer': '#10b981',
        'public': '#f59e0b'
    };
    
    const bgColor = roleColors[account.role] || '#6b7280';
    
    return `
        <div class="avatar-card" style="
            background: linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%);
            width: 100%;
            height: 180px;
            border-radius: 12px 12px 0 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 48px;
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        ">
            ${initials.toUpperCase()}
        </div>
    `;
}

    async viewEstablishments(accountId) {
        try {
            // Récupérer depuis IndexedDB d'abord
            const establishments = await IndexedDBManager.query('establishments', 'owner_id', accountId);

            if (!establishments || establishments.length === 0) {
                this.dashboard.showNotification('Aucun établissement pour ce compte', 'info');
                return;
            }

            const html = `
                <div class="modal-overlay" id="establishments-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>🏢 Établissements du compte</h3>
                            <button class="modal-close" onclick="document.getElementById('establishments-modal').remove()">
                                ${DashboardIcons.close || '✕'}
                            </button>
                        </div>
                        <div class="modal-body">
                            <ul class="establishments-list">
                                ${establishments.map(e => `
                                    <li class="establishment-item" data-id="${e.id}">
                                        <span class="establishment-name">${e.nom}</span>
                                        <span class="establishment-status status-${e.status}">${e.status}</span>
                                        <button class="btn-link" onclick="AdminDashboardInstance.openPublicEstablishment('${e.id}')">
                                            Voir →
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', html);

        } catch (error) {
            console.error('❌ Erreur:', error);
            this.dashboard.showNotification('Erreur lors du chargement', 'error');
        }
    }

    async deleteAccount(accountId) {
    try {
        const account = await IndexedDBManager.get('profiles', accountId);

        if (!account) {
            this.dashboard.showNotification('Compte introuvable', 'error');
            return;
        }

        if (account.role === 'admin') {
            this.dashboard.showNotification('Impossible de supprimer un compte administrateur', 'error');
            return;
        }

        const displayName = account.displayName || 'Sans nom';
        const establishments = await IndexedDBManager.query('establishments', 'owner_id', accountId);
        const estabCount = establishments.length;

        // NOUVEAU : Demander la raison
        const confirmed = confirm(
    `Supprimer le compte ${displayName} (${account.email}) ?\n\nCette action est irréversible.`
);

if (!confirmed) {
    this.dashboard.showNotification('Suppression annulée', 'info');
    return;
}

        // NOUVEAU : Confirmation finale avec raison
        const confirmText = `SUPPRIMER ${displayName.toUpperCase()}`;
        const userInput = prompt(
            `SUPPRESSION DEFINITIVE DU COMPTE\n\n` +
            `Compte : ${displayName}\n` +
            `Email : ${account.email}\n` +
            `Etablissements : ${estabCount}\n` +
            `Raison : ${adminReason || '(aucune)'}\n\n` +
            `Cette action supprimera :\n` +
            `• Le compte utilisateur\n` +
            `• Tous ses etablissements (${estabCount})\n` +
            `• Tous ses evenements\n\n` +
            `ACTION IRREVERSIBLE\n\n` +
            `Tapez exactement : ${confirmText}`
        );

        if (userInput !== confirmText) {
            this.dashboard.showNotification('Suppression annulee', 'info');
            return;
        }

        // NOUVEAU : Marquer comme supprime localement avec raison
        account.is_active = false;
        account.deletion_approved_at = new Date().toISOString();
        account.deletion_admin_reason = adminReason || null;
        account.updated_at = new Date().toISOString();

        await IndexedDBManager.put('profiles', account);

        console.log('Appel Edge Function delete-user-account');
        console.log('userId:', accountId);
        console.log('Raison:', adminReason);

        // NOUVEAU : Marquer comme supprime localement avec raison
account.is_active = false;
account.deletion_approved_at = new Date().toISOString();
account.deletion_admin_reason = adminReason || null;
account.updated_at = new Date().toISOString();

await IndexedDBManager.put('profiles', account);

console.log('Appel Edge Function delete-user-account');
console.log('userId:', accountId);
console.log('Raison:', adminReason);

// 🆕 RÉCUPÉRER LE TOKEN
console.log('🔑 Récupération session...');
const { data: { session } } = await window.supabaseInstance.auth.getSession();
console.log('🔑 Session token:', session?.access_token ? 'OK' : 'MANQUANT');

console.log('🚀 Invoke delete-user-account...');
const { data, error } = await window.supabaseInstance.functions.invoke('delete-user-account', {
    body: {
    userId: accountId,
    deletion_approved_at: new Date().toISOString()
},
    headers: {
        'Authorization': `Bearer ${session?.access_token}`
    }
});

console.log('✅ Response error:', error);
console.log('✅ Response data:', data);

if (error) {
    throw new Error(error.message || 'Erreur suppression compte');
}

if (!data?.success) {
    throw new Error(data?.error || 'Compte non supprime');
}

        console.log('Compte supprime :', data.message);
        this.dashboard.showNotification(`Compte ${displayName} supprime (raison: ${adminReason || 'aucune'})`, 'success');

        TabCacheManager.invalidate('accounts');
        this.refreshView();

    } catch (error) {
        console.error("Erreur suppression:", error);
        this.dashboard.showNotification(`Erreur: ${error.message}`, "error");
    }
}

    formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
        }
        return phone;
    }

    refreshView() {
        const container = document.getElementById('tab-content');
        if (container) {
            this.render(container);
        }
    }

    cleanup() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
    }
}

export default AdminAccountTab;