/**
 * 🏢 ESTABLISHMENT PUBLIC MODAL
 * Fiche de consultation établissement
 */

import BaseModal, { FormIcons, SocialIcons, ActionIcons } from './BaseModal.js';


class EstablishmentPublicModal extends BaseModal {
    constructor() {
        super();
        this.modalId = 'establishment-public-modal';
        this.photoBucket = 'establishment-photos';
        this.fromEvent = null;
    }

    async open(establishment, options = {}) {
        this.currentData = establishment;
        this.fromEvent = options.fromEvent || null;
        this.currentPhotoId = establishment?.photo_id || null;

        console.log('🏢 Ouverture fiche établissement:', establishment.nom);

        const html = this.getHTML();
        this.show(html);

        if (this.currentPhotoId) {
            await this.loadExistingPhoto();
        }

        this.setupClickableLinks();
    }

    getHTML() {
        const estab = this.currentData;
        
        const fullAddress = [estab.adresse, estab.code_postal, estab.ville]
            .filter(Boolean)
            .join(', ');

        const content = `
            <div class="public-modal-content">
                
                ${this.fromEvent ? `
                    <button class="btn-back-to-event" data-back-to-event>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Retour à "${this.escapeHtml(this.fromEvent.titre)}"
                    </button>
                ` : ''}

                <!-- 📍 Informations -->
                <section class="public-section">
                                        
                    <div class="public-info-grid">
                        <div class="public-info-item">
                            <span class="info-icon">${FormIcons.type}</span>
                            <div class="info-content">
                            <span class="info-value">${estab.type || '—'}</span>
                        </div>
                        </div>

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
                ${estab.description ? `<section class="public-section"><div class="public-description">${this.escapeHtml(estab.description).trim()}</div></section>` : ''}

                <!-- 📞 Contact -->
                ${estab.telephone || estab.email || estab.website ? `
                    <section class="public-section">                        
                        
                        <div class="public-contact-grid">
                            ${estab.telephone ? `
                                <a href="tel:${estab.telephone}" class="contact-item">
                                    <span class="contact-icon">${FormIcons.phone}</span>
                                    <span class="contact-value">${this.formatPhone(estab.telephone)}</span>
                                </a>
                            ` : ''}

                            ${estab.email ? `
                                <a href="mailto:${estab.email}" class="contact-item">
                                    <span class="contact-icon">${FormIcons.email}</span>
                                    <span class="contact-value">${this.escapeHtml(estab.email)}</span>
                                </a>
                            ` : ''}

                            ${estab.website ? `
                                <a href="${estab.website}" target="_blank" class="contact-item">
                                    <span class="contact-icon">${FormIcons.website}</span>
                                    <span class="contact-value">Site web</span>
                                </a>
                            ` : ''}
                        </div>
                    </section>
                ` : ''}

                <!-- 🌐 Réseaux sociaux -->
                ${estab.facebook_url || estab.instagram_url ? `
                    <section class="public-section">                        
                        
                        <div class="public-social-links">
                            ${estab.facebook_url ? `
                                <a href="${estab.facebook_url}" target="_blank" class="social-link facebook">
                                    ${SocialIcons.facebook}
                                    <span>Facebook</span>
                                </a>
                            ` : ''}

                            ${estab.instagram_url ? `
                                <a href="${estab.instagram_url}" target="_blank" class="social-link instagram">
                                    ${SocialIcons.instagram}
                                    <span>Instagram</span>
                                </a>
                            ` : ''}
                        </div>
                    </section>
                ` : ''}

            </div>
        `;

        return this.createMobileModal(content, {
            title: estab.nom,
            hasPhoto: true
        });
    }

    setupClickableLinks() {
    if (this.fromEvent) {
        const backBtn = this.modalElement.querySelector('[data-back-to-event]');
        if (backBtn) {
            backBtn.addEventListener('click', () => {                
                window.PublicEventModal.open(this.fromEvent);
                setTimeout(() => this.close(), 50);
            });
        }
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

    setupEventListeners() {
        super.setupEventListeners();
    }
}

const establishmentPublicModal = new EstablishmentPublicModal();
window.PublicEstablishmentModal = establishmentPublicModal;

export default establishmentPublicModal;