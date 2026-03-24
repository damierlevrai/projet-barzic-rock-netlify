/**
 * 🎭 EVENT PUBLIC MODAL
 * Fiche de consultation événement
 */

import BaseModal, { FormIcons, SocialIcons, ActionIcons } from './BaseModal.js';
import IndexedDBManager from '../services/IndexedDBManager.js';

class EventPublicModal extends BaseModal {
    constructor() {
        super();
        this.modalId = 'event-public-modal';
        this.photoBucket = 'event-photos';
    }

    async open(event, establishment = null) {
        this.currentData = event;
        this.currentPhotoId = event?.photo_id || null;
        
        // Charger l'établissement si pas fourni
        if (!establishment && event.establishment_id) {
            establishment = await IndexedDBManager.get('establishments', event.establishment_id);
        }
        this.establishment = establishment;

        console.log('🎭 Ouverture fiche événement:', event.titre);

        const html = this.getHTML();
        this.show(html);

        if (this.currentPhotoId) {
            await this.loadExistingPhoto();
        }

        this.setupClickableLinks();
    }

    getHTML() {
        const evt = this.currentData;
        const estab = this.establishment;
        
        // Date intelligente
        const dateStr = this.formatSmartDate(evt.date_debut);
        
        // Adresse : custom ou établissement
        const eventAddress = evt.adresse || estab?.adresse;
        const eventCity = evt.ville || estab?.ville;
        const eventPostalCode = evt.code_postal || estab?.code_postal;
        
        const fullAddress = [eventAddress, eventPostalCode, eventCity]
            .filter(Boolean)
            .join(', ');

        // YouTube URLs
        const youtubeUrls = [evt.youtube_url1, evt.youtube_url2, evt.youtube_url3]
            .filter(Boolean);

        const content = `
            <div class="public-modal-content">

                <!-- 📍 Informations -->
                <section class="public-section">
                    <h3 class="public-section-title">
                        ${FormIcons.category} Informations
                    </h3>
                    
                    <div class="public-info-grid">
                        <div class="public-info-item">
                            <span class="info-icon">${FormIcons.category}</span>
                            <div class="info-content">
                                <span class="info-value">${evt.category || '—'}</span>                                
                            </div>
                        </div>

                        <div class="public-info-item">
                            <span class="info-icon">${FormIcons.date}</span>
                            <div class="info-content">                                
                                <span class="info-value">${dateStr}</span>
                            </div>
                        </div>

                        ${estab ? `
                            <div class="public-info-item clickable" data-open-establishment>
                                <span class="info-icon">${FormIcons.establishment}</span>
                                <div class="info-content">                                    
                                    <span class="info-value info-link">
                                        ${this.escapeHtml(estab.nom)}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9 18 15 12 9 6"/>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                        ` : ''}

                        ${fullAddress ? `
                            <div class="public-info-item">
                                <span class="info-icon">${FormIcons.location}</span>
                                <div class="info-content">                                    
                                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" 
                                       target="_blank" 
                                       class="info-value info-link">
                                        ${this.escapeHtml(fullAddress)}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                            <polyline points="15 3 21 3 21 9"/>
                                            <line x1="10" y1="14" x2="21" y2="3"/>
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </section>

                <!-- 📝 Description -->
                ${evt.description ? `<section class="public-section"><div class="public-description">${this.escapeHtml(evt.description).trim()}</div></section>` : ''}

                <!-- ▶️ Vidéos YouTube -->
                ${youtubeUrls.length > 0 ? `
                    <section class="public-section">
                        <h3 class="public-section-title">
                            ▶️ Vidéos
                        </h3>
                        <div class="public-youtube-grid ${youtubeUrls.length === 1 ? 'single' : youtubeUrls.length === 2 ? 'double' : 'triple'}">
                            ${youtubeUrls.map(url => this.createYouTubeEmbed(url)).join('')}
                        </div>
                    </section>
                ` : ''}

                <!-- 🌐 Liens -->
                ${evt.facebook_url || evt.bandcamp_url || evt.helloasso_url ? `
                    <section class="public-section">
                        <h3 class="public-section-title">
                            🌐 Liens
                        </h3>
                        
                        <div class="public-social-links">
                            ${evt.facebook_url ? `
                                <a href="${evt.facebook_url}" target="_blank" class="social-link facebook">
                                    ${SocialIcons.facebook}
                                    <span>Page Facebook</span>
                                </a>
                            ` : ''}

                            ${evt.bandcamp_url ? `
                                <a href="${evt.bandcamp_url}" target="_blank" class="social-link bandcamp">
                                    ${SocialIcons.bandcamp}
                                    <span>Bandcamp</span>
                                </a>
                            ` : ''}

                            ${evt.helloasso_url ? `
                                <a href="${evt.helloasso_url}" target="_blank" class="social-link helloasso">
                                    ${SocialIcons.helloasso}
                                    <span>Billetterie</span>
                                </a>
                            ` : ''}
                        </div>
                    </section>
                ` : ''}

            </div>
        `;

        return this.createMobileModal(content, {
            title: evt.titre,
            hasPhoto: true
        });
    }

    formatSmartDate(dateStr) {
        if (!dateStr) return 'Date non définie';
        
        const eventDate = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        
        const timeStr = eventDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Ce soir
        if (eventDay.getTime() === today.getTime()) {
            return `Ce soir à ${timeStr}`;
        }
        
        // Demain
        if (eventDay.getTime() === tomorrow.getTime()) {
            return `Demain à ${timeStr}`;
        }
        
        // Cette semaine (dans les 7 jours)
        const diffDays = Math.floor((eventDay - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
            return eventDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(/^\w/, c => c.toUpperCase());
        }
        
        // Plus loin
        return eventDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/^\w/, c => c.toUpperCase());
    }

    createYouTubeEmbed(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) return '';
        
        return `
            <div class="youtube-embed">
                <iframe 
                    src="https://www.youtube.com/embed/${videoId}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    loading="lazy">
                </iframe>
            </div>
        `;
    }

    extractYouTubeId(url) {
        if (!url) return null;
        
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/,
            /youtube\.com\/embed\/([^&\?\/]+)/,
            /youtube\.com\/v\/([^&\?\/]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    }

    setupClickableLinks() {
    const estabLink = this.modalElement.querySelector('[data-open-establishment]');
    if (estabLink && this.establishment) {
        estabLink.style.cursor = 'pointer';
        estabLink.addEventListener('click', () => {            
            const currentEvent = this.currentData;
            window.PublicEstablishmentModal.open(this.establishment, {
                fromEvent: currentEvent
            });            
            setTimeout(() => this.close(), 50);
        });
    }
}

    setupEventListeners() {
        super.setupEventListeners();
    }
}

const eventPublicModal = new EventPublicModal();
window.PublicEventModal = eventPublicModal;

export default eventPublicModal;