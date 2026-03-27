/**
 * 🎭 BASE MODAL - ARCHITECTURE OPTIMISÉE V2
 * 
 * PATTERN: Template Method
 * Logique centralisée, config déclarative
 * À override : getFormFieldsConfig(), getValidationConfig(), getStoreName()
 */

import PhotoManager from '../services/PhotoManager.js';
import PhotoOrchestrator from '../services/PhotoOrchestrator.js';
import IndexedDBManager from '../services/IndexedDBManager.js';
import Auth from '../services/auth.js';

// ============================================
// 🎨 ICONES SVG - CENTRALISÉES
// ============================================

export const FormIcons = {
    phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    email: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 6l8 6 8-6"/></svg>`,
    website: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    location: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    address: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    city: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-2"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/></svg>`,
    postalCode: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>`,
    description: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    name: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    title: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    type: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="22"/></svg>`,
    category: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 12l9-2v6"/></svg>`,
    establishment: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M6 4h12l2 17H4L6 4z"/></svg>`,
    date: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    time: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

export const ActionIcons = {
    save: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    add: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    remove: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    photo: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    valid: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    loading: `<svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>`,
};

export const SocialIcons = {
    facebook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="url(#ig)"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#f58529"/><stop offset="50%" style="stop-color:#dd2a7b"/><stop offset="100%" style="stop-color:#8134af"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    bandcamp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#629aa9"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>`,
    helloasso: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#49c5b1"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/></svg>`,
};

export const ModernIcons = { ...FormIcons, ...ActionIcons, ...SocialIcons };

// ============================================
// ✅ VALIDATION
// ============================================

export class FormValidation {
    static validateEmail(email) {
        if (!email) return { valid: true, message: '' };
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
            valid: regex.test(email),
            message: regex.test(email) ? '' : 'Email invalide'
        };
    }

    static validateRequired(value, fieldName = 'Ce champ') {
        const valid = value && value.toString().trim() !== '';
        return {
            valid,
            message: valid ? '' : `${fieldName} est obligatoire`
        };
    }

    static validateUrl(url) {
        if (!url) return { valid: true, message: '' };
        try {
            new URL(url);
            return { valid: true, message: '' };
        } catch {
            return { valid: false, message: 'URL invalide' };
        }
    }

    static validatePhone(phone) {
        if (!phone) return { valid: true, message: '' };
        const regex = /^[0-9\s\-\+\(\)\.]{8,}$/;
        return {
            valid: regex.test(phone),
            message: regex.test(phone) ? '' : 'Numéro invalide'
        };
    }
}

// ============================================
// 🎭 BASE MODAL - TEMPLATE METHOD
// ============================================

export class BaseModal {
    constructor() {
    this.isOpen = false;
    this.currentData = null;
    this.isEdit = false;
    this.isProcessing = false;
    this.photoManager = null;
    this.modalId = 'base-modal';
    this.photoBucket = 'default-photos';
    this.modalElement = null;
    this.scrollPosition = undefined;
    this.handleEscape = null;
    this.allowPhotoUpload = true;
    this.isCreating = false;
    
    // Photo management - clarifiés
    this.existingPhotoId = null;    // Photo déjà sauvegardée en IndexedDB
    this.currentNewPhotoId = null;  // Photo nouvelle en cours d'upload
    
    // AJOUTER - ObjectURL management
    this.previewObjectUrl = null;       // ObjectURL du preview en modal
    this.existingPhotoObjectUrl = null; // ObjectURL de la photo existante
    this.currentNewPhotoBlob = null;    // Blob sélectionné EN MÉMOIRE
    this.currentPhotoHash = null;       // Hash de la photo
}

    // ============================================
    // 🎯 ABSTRACT METHODS - À OVERRIDE
    // ============================================

    /**
     * @returns {Array} Config des champs du formulaire
     */
    getFormFieldsConfig() {
        throw new Error('getFormFieldsConfig() doit être implémentée');
    }

    /**
     * @returns {Array} Config validation des champs
     */
    getValidationConfig() {
        throw new Error('getValidationConfig() doit être implémentée');
    }

    /**
     * @returns {string} Nom de la table IndexedDB
     */
    getStoreName() {
        throw new Error('getStoreName() doit être implémentée');
    }

    /**
     * @returns {string} Titre du modal
     */
    getTitle() {
        throw new Error('getTitle() doit être implémentée');
    }

    /**
     * @returns {string} Nom du tab cache (ex: 'events', 'establishments')
     */
    getCacheTabName() {
        throw new Error('getCacheTabName() doit être implémentée');
    }

    /**
     * @returns {string} Status par défaut ('local' ou 'pending')
     */
        
    /**
    * Déterminer le statut selon rôle et connectivité
    */
    getStatus() {
    const user = this.getCurrentUser();
    const isOnline = window.NetworkStatus?.isOnline?.();
    
    console.log(`Status determination: role=${user?.role}, online=${isOnline}`);
    
    if (user?.role === 'admin') {
        const status = isOnline ? 'approved' : 'local';
        console.log(`Admin status: ${status}`);
        return status;
    } else {
        console.log(`Non-admin status: pending`);
        return 'pending';
    }
}

    /**
     * @returns {string} Message de succès
     */
    getSuccessMessage(isEdit) {
        return isEdit ? 'Modifié avec succès' : 'Créé avec succès';
    }

    /**
     * Transform FormData avant sauvegarde
     * @param {Object} data - Raw form data
     * @returns {Object} Données transformées
     */
    prepareDataBeforeSave(data) {
        return data;  // Default: pas de transformation
    }

    /**
     * Géocodage de l'adresse — à override dans les subclasses qui en ont besoin
     */
    async geocodeEstablishment(prepared) {
        // Default: pas de géocodage
    }

    // ============================================
    // 🎬 LIFECYCLE
    // ============================================

    async open(item = null) {
        this.currentData = item || {};
        this.isEdit = !!item;
         this.isCreating = !item;
        this.existingPhotoId = item?.photo_id || null;
        this.currentNewPhotoId = null;

        console.log(`🎭 ${this.constructor.name} - ${this.isEdit ? 'Édition' : 'Création'}`);

        const html = this.getHTML();
        this.show(html);

        if (this.allowPhotoUpload && this.existingPhotoId) {
        await this.loadExistingPhoto();
        }

        this.setupFormValidation();
        this.attachFormListener();
    }

    close() {
  if (!this.modalElement) return;  

  this.isOpen = false;

  // ✅ Nettoyer les données photo EN MÉMOIRE
  this.currentNewPhotoBlob = null;
  this.currentPhotoHash = null;
  this.currentNewPhotoId = null;

  // ✅ Révoquer les ObjectURLs
  if (this.previewObjectUrl) {
    URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
  }
  
  if (this.existingPhotoObjectUrl) {
    URL.revokeObjectURL(this.existingPhotoObjectUrl);
    this.existingPhotoObjectUrl = null;
  }

  setTimeout(() => {
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.classList.remove('show');
      const container = this.modalElement.querySelector('.modern-modal-container');
      if (container) container.classList.remove('show');

      setTimeout(() => {
        if (this.modalElement?.parentNode) {
          this.modalElement.remove();
        }
        this.modalElement = null;
        this.restoreBodyScroll();
      }, 300);
    }
  }, 50);

  if (this.photoManager) {
    this.photoManager = null;
  }

  if (this.handleEscape) {
    document.removeEventListener('keydown', this.handleEscape);
    this.handleEscape = null;
  }
}

    // ============================================
    // 🎨 HTML GENERATION
    // ============================================

    getHTML() {
        const fieldConfigs = this.getFormFieldsConfig();
        const fields = fieldConfigs.map(config => {
            if (config.type === 'custom') {
                return config.renderer ? config.renderer() : '';
            }
            if (config.type === 'social') {
                return this.createSocialField(config);
            }
            if (config.type === 'select') {
                return this.createSelectField(config);
            }
            if (config.type === 'textarea') {
                return this.createFormField({ ...config, type: 'textarea' });
            }
            return this.createFormField(config);
        }).join('');

        const content = `
            <form id="${this.modalId}-form" class="modern-form">
                ${fields}
            </form>
        `;

        return this.createMobileModal(content, {
            title: this.getTitle(),
            hasPhoto: true
        });
    }

    createMobileModal(content, { title = '', hasPhoto = true } = {}) {
        const photoSection = hasPhoto && this.allowPhotoUpload ? `
    <div class="banner-photo-container">
        <div id="${this.modalId}-banner-photo" class="banner-photo">
            <div class="banner-placeholder">
                <span class="placeholder-icon">${ActionIcons.photo}</span>
            </div>
        </div>
        <button type="button" class="banner-photo-btn" data-photo-upload>
            ${ActionIcons.photo}
        </button>
        <h2 class="banner-title">${this.escapeHtml(title)}</h2>
    </div>
` : hasPhoto ? `
    <div class="banner-photo-container">
        <h2 class="banner-title">${this.escapeHtml(title)}</h2>
    </div>
        ` : '';

        return `
            <div class="modern-modal-overlay">
                <div class="modern-modal-container">
                    <div class="modern-modal-content">
                        ${photoSection}
                        <div class="modern-form-content">
                            ${content}
                        </div>
                    </div>
                </div>
                <button class="modern-close-fab" data-close>
                    <span class="fab-icon">${ActionIcons.close}</span>
                </button>
                <button type="submit" form="${this.modalId}-form" class="modern-submit-mini" id="${this.modalId}-save">
                    <span class="fab-icon">${ActionIcons.save}</span>
                </button>
            </div>
        `;
    }

    // ============================================
    // 📝 CHAMPS
    // ============================================

    createFormField({ id, name, type = 'text', value = '', placeholder = '', required = false, defaultValue = '', datalist = '' }) {
        const fieldId = `${this.modalId}-${id}`;
        const fieldIcon = FormIcons[id] || FormIcons.description;
        const fieldValue = value || defaultValue || '';

        if (type === 'textarea') {
            return `
                <div class="modern-field-container" data-field="${name || id}">
                    <div class="modern-textarea-field">
                        <div class="field-icon">${fieldIcon}</div>
                        <textarea id="${fieldId}" name="${name || id}" class="modern-field-input"
                            placeholder="${placeholder}" ${required ? 'required' : ''}
                            rows="3">${fieldValue}</textarea>
                        <div class="field-validation" data-validation="${fieldId}">
                            <span class="validation-icon"></span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="modern-field-container" data-field="${name || id}">
                <div class="modern-icon-field">
                    <div class="field-icon">${fieldIcon}</div>
                    <input type="${type}" id="${fieldId}" name="${name || id}" 
                           class="modern-field-input" value="${fieldValue}" 
                           placeholder="${placeholder}" ${required ? 'required' : ''}
                           ${type === 'date' ? `min="${new Date().toISOString().split('T')[0]}"` : ''}
                           ${datalist ? `list="${fieldId}-list"` : ''}>
                    <div class="field-validation" data-validation="${fieldId}">
                        <span class="validation-icon"></span>
                    </div>
                </div>
                ${datalist ? `<datalist id="${fieldId}-list">${datalist}</datalist>` : ''}
            </div>
        `;
    }

    createSelectField({ id, name, options = [], value = '', placeholder = '', required = false }) {
        const fieldId = `${this.modalId}-${id}`;
        const fieldIcon = FormIcons[id] || FormIcons.type;

        return `
            <div class="modern-field-container" data-field="${name || id}">
                <div class="modern-select-field">
                    <div class="field-icon">${fieldIcon}</div>
                    <select id="${fieldId}" name="${name || id}" class="modern-field-input" ${required ? 'required' : ''}>
                        ${placeholder ? `<option value="">${placeholder}</option>` : ''}
                        ${options.map(opt => `
                            <option value="${opt.toLowerCase()}" ${value.toLowerCase() === opt.toLowerCase() ? 'selected' : ''}>
                                ${opt}
                            </option>
                        `).join('')}
                    </select>
                    <div class="field-validation" data-validation="${fieldId}">
                        <span class="validation-icon"></span>
                    </div>
                </div>
            </div>
        `;
    }

    createSocialField({ id, name, value = '', placeholder = '' }) {
        const fieldId = `${this.modalId}-${id}`;
        const socialIcon = SocialIcons[id] || '';

        return `
            <div class="modern-social-field" data-field="${name || id}">
                <span class="social-icon">${socialIcon}</span>
                <input type="url" id="${fieldId}" name="${name || id}" 
                       class="modern-social-input" value="${value}" 
                       placeholder="${placeholder}">
                <div class="field-validation" data-validation="${fieldId}">
                    <span class="validation-icon"></span>
                </div>
            </div>
        `;
    }

    // ============================================
    // ✅ VALIDATION
    // ============================================

    setupFormValidation() {
        const config = this.getValidationConfig();
        this.setupValidation(config);
    }

    setupValidation(fieldConfigs) {
        fieldConfigs.forEach(config => {
            const fieldId = `${this.modalId}-${config.id}`;
            const input = document.getElementById(fieldId);

            if (input) {
                input.addEventListener('input', () => this.validateField(config));
                input.addEventListener('blur', () => this.validateField(config));

                if (['nom', 'titre'].includes(config.id)) {
                    input.addEventListener('input', () => this.updateBannerTitle(input.value));
                }
            }
        });
    }

    validateField(config) {
        const fieldId = `${this.modalId}-${config.id}`;
        const input = document.getElementById(fieldId);
        const field = document.querySelector(`[data-field="${config.name || config.id}"]`);
        const validationEl = document.querySelector(`[data-validation="${fieldId}"]`);

        if (!input || !field || !validationEl) return true;

        let validation = { valid: true, message: '' };
        const value = input.value.trim();

        if (config.validation === 'optional' && !value) {
            field.classList.remove('field-error', 'field-valid');
            validationEl.querySelector('.validation-icon').innerHTML = '';
            return true;
        }

        switch (config.validation) {
            case 'required':
                validation = FormValidation.validateRequired(value, config.label || config.id);
                break;
            case 'email':
                validation = FormValidation.validateEmail(value);
                break;
            case 'url':
                validation = FormValidation.validateUrl(value);
                break;
            case 'phone':
                validation = FormValidation.validatePhone(value);
                break;
            case 'optional':
                validation = { valid: true, message: '' };
                break;
        }

        field.classList.toggle('field-error', !validation.valid);
        field.classList.toggle('field-valid', validation.valid && value);

        const validationIcon = validationEl.querySelector('.validation-icon');
        if (validation.valid && value) {
            validationIcon.innerHTML = ActionIcons.valid;
            validationIcon.style.color = '#10b981';
        } else if (!validation.valid) {
            validationIcon.innerHTML = ActionIcons.error;
            validationIcon.style.color = '#ef4444';
        } else {
            validationIcon.innerHTML = '';
        }

        return validation.valid;
    }

    updateBannerTitle(title) {
        const titleEl = this.modalElement?.querySelector('.banner-title');
        if (titleEl && title) {
            titleEl.textContent = this.escapeHtml(title);
        }
    }

    /**
 * ✅ VALIDATE FORM - À override dans les subclasses si besoin
 */
validateForm() {
  const config = this.getValidationConfig();
  let isValid = true;

  config.forEach(fieldConfig => {
    if (!this.validateField(fieldConfig)) {
      isValid = false;
    }
  });

  return isValid;
}


    // ============================================
    // 📸 PHOTO MANAGEMENT
    // ============================================

    setupPhotoUpload() {
    
    if (this.allowPhotoUpload === false) {
        console.log('📸 Photo upload désactivé pour ce modal');
        return;
    }

    const photoBtn = this.modalElement?.querySelector('[data-photo-upload]');
    if (!photoBtn) return;

    if (!this.photoManager) {
        this.photoManager = new PhotoManager({ bucket: this.photoBucket });
    }

  if (photoBtn.dataset.listenerAttached) return;
  photoBtn.dataset.listenerAttached = 'true';

  photoBtn.addEventListener('click', async () => {
  try {
    const { photoId, universal } = await this.photoManager.pickFile();

    const banner = document.getElementById(`${this.modalId}-banner-photo`);
    if (banner && universal instanceof Blob) {
      // 🟢 SIMPLIFIÉE: Juste stocker en mémoire
      const photoHash = await PhotoOrchestrator?.calculateHash(universal);
      const stablePhotoId = `${photoHash.substring(0, 12)}-${Date.now()}`;
      
      this.currentNewPhotoId = stablePhotoId;
      this.currentNewPhotoBlob = universal;
      this.currentPhotoHash = photoHash;
      
      console.log('✅ Photo stockée:', {
  photoId: this.currentNewPhotoId,
  hasBlob: !!this.currentNewPhotoBlob,
  hash: this.currentPhotoHash
});
      
      // Afficher preview
      const objectUrl = URL.createObjectURL(universal);
      this.previewObjectUrl = objectUrl;
      
      const img = new Image();
      img.onload = () => {
        banner.innerHTML = `<img src="${objectUrl}" class="banner-photo-img" alt="Photo">`;
        console.log('[PHOTO] Image affichée en preview');
      };
      img.onerror = () => {
        console.error('[PHOTO] Erreur chargement image');
        URL.revokeObjectURL(objectUrl);
        this.previewObjectUrl = null;
      };
      img.src = objectUrl;
    }
  } catch (error) {
    console.error('[PHOTO] Erreur sélection photo:', error);
    this.showNotification('Erreur lors de la sélection', 'error');
  }
});
}
    async loadExistingPhoto() {
  const banner = document.getElementById(`${this.modalId}-banner-photo`);
  if (!banner) return;

  let photoUrl = null;

  if (this.existingPhotoId) {
    try {
      // Recuperer le blob depuis IndexedDB v4
      const photoData = await IndexedDBManager.get('photos', this.existingPhotoId);
      
      if (photoData?.blob && photoData.blob instanceof Blob) {
        photoUrl = URL.createObjectURL(photoData.blob);
        this.existingPhotoObjectUrl = photoUrl;
        console.log('[PHOTO] ObjectURL photo existante creee');
      }
    } catch (error) {
      console.warn('[PHOTO] Photo non trouvee dans cache:', this.existingPhotoId);
    }
  }

  // Fallback Supabase si pas en cache local
  if (!photoUrl && this.currentData?.photo_url) {
    photoUrl = this.currentData.photo_url;
    console.log('[PHOTO] Fallback Supabase URL');
  }

  if (photoUrl) {
    const img = new Image();
    img.onload = () => {
      banner.innerHTML = `<img src="${photoUrl}" class="banner-photo-img" alt="Photo">`;
      console.log('[PHOTO] Photo existante chargee');
    };
    img.onerror = () => {
      console.warn('[PHOTO] Erreur chargement photo existante');
      if (photoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoUrl);
      }
    };
    img.src = photoUrl;
  }
}
    
    getPhotoTempId() {
    return this.currentNewPhotoId || null;
    }

    // ============================================
    // 💾 SAUVEGARDE
    // ============================================

    attachFormListener() {
        const form = document.getElementById(`${this.modalId}-form`);
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async handleSubmit(e) {
  e.preventDefault();

  if (this.isProcessing) {
    console.warn('⚠️ Already processing');
    return;
  }

  const isFormValid = this.validateForm();
  if (!isFormValid) {
    this.showNotification('Veuillez corriger les erreurs', 'error');
    return;
  }

  this.isProcessing = true;
  const saveBtn = document.getElementById(`${this.modalId}-save`);
  const originalIcon = saveBtn?.innerHTML;

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="fab-icon">⏳</span>`;
    }

    const rawData = {};
    const fieldConfigs = this.getFormFieldsConfig();
    
    fieldConfigs.forEach(config => {
      if (config.type === 'custom') return;
      const fieldId = `${this.modalId}-${config.id}`;
      const input = document.getElementById(fieldId);
      if (input) {
        rawData[config.name || config.id] = input.value || '';
      }
    });

    rawData.facebook_url = document.getElementById(`${this.modalId}-facebook_url`)?.value || '';
    rawData.instagram_url = document.getElementById(`${this.modalId}-instagram_url`)?.value || '';
    
    const establishmentInput = document.getElementById(`${this.modalId}-establishment`);
    if (establishmentInput) {
      rawData.establishment_id = establishmentInput.value;
    }

    const prepared = this.prepareDataBeforeSave(rawData);
    prepared.id = this.isEdit ? this.currentData.id : crypto.randomUUID();

    if (this.allowPhotoUpload && this.currentNewPhotoBlob) {
  try {
    const photoResult = await PhotoOrchestrator.attachPhotoToItem(
      this.currentNewPhotoBlob,
      prepared.id,
      this.getStoreName() === 'establishments' ? 'establishment' : 'event'
    );
    
    if (photoResult) {
      prepared.photo_hash = photoResult.photoHash;
      prepared.photo_id = photoResult.photoIdLocal;
      prepared.photo_url = null; // Sera mis à jour par upload arrière-plan

      // Upload non-bloquant — fonctionne online uniquement, sinon SyncEngine retry
      if (!photoResult.reused) {
        const storeName = this.getStoreName();
        const itemId = prepared.id;
        IndexedDBManager.getAll('photo_refs').then(allRefs => {
          const photoRef = allRefs.find(ref => ref.photo_hash === photoResult.photoHash);
          if (photoRef && photoRef.status === 'local') {
            PhotoOrchestrator.uploadPhoto(photoRef)
              .then(photoUrl => {
                if (photoUrl) {
                  IndexedDBManager.get(storeName, itemId).then(item => {
                    if (item) {
                      item.photo_url = photoUrl;
                      IndexedDBManager.put(storeName, item);
                      console.log('✅ Photo URL mise à jour en arrière-plan');
                    }
                  });
                }
              })
              .catch(err => console.warn('⚠️ Upload arrière-plan échoué:', err.message));
          }
        });
      }
    }
  } catch (photoErr) {
    console.warn('⚠️ Photo attachment failed, sauvegarde sans photo:', photoErr.message);
  }
    } else if (this.isEdit && !this.currentNewPhotoBlob) {
      prepared.photo_id = this.currentData.photo_id;
      prepared.photo_url = this.currentData.photo_url;
      prepared.photo_hash = this.currentData.photo_hash;
    }

    try {
      const needsGeocoding = !this.isEdit || (this.isEdit && prepared.adresse !== this.currentData.adresse);
      if (needsGeocoding) {
        await this.geocodeEstablishment(prepared);
      } else {
        prepared.latitude = this.currentData.latitude;
        prepared.longitude = this.currentData.longitude;
        prepared.adresse_complete = this.currentData.adresse_complete;
      }
    } catch (geoErr) {
      console.warn('🗺️ Geocoding échoué:', geoErr);
    }

    const isOnline = window.NetworkStatus?.isOnline?.();
    const user = this.getCurrentUser();
    prepared.status = user?.role === 'admin' ? (isOnline ? 'approved' : 'local') : 'pending';

    prepared.created_locally = true;
    prepared.created_at = this.isEdit ? this.currentData.created_at : new Date().toISOString();
    prepared.updated_at = new Date().toISOString();
    prepared.supabase_synced = false;
    prepared.source = 'local';

    await this.saveToIndexedDB(this.getStoreName(), prepared);

    if (window.TabCacheManager) {
      window.TabCacheManager.invalidate(this.getCacheTabName());
    }

    this.showNotification(this.getSuccessMessage(this.isEdit), 'success');

    await new Promise(resolve => requestAnimationFrame(resolve));

    this.close();

    await new Promise(resolve => requestAnimationFrame(resolve));

    if (this.isCreating) {
      if (window.AdminDashboardInstance?.activeTabInstance?.refreshView) {
        window.AdminDashboardInstance.activeTabInstance.refreshView();
      }
    } else {
      window.dispatchEvent(new CustomEvent('itemUpdated', {
        detail: { itemId: prepared.id, itemType: this.getStoreName() }
      }));
    }

    if (window.AdminDashboardInstance?.triggerSync) {
      window.AdminDashboardInstance.triggerSync().catch(err => 
        console.warn('Sync background error:', err)
      );
    }

  } catch (error) {
    console.error('💥 ERREUR:', error);
    this.showNotification(`Erreur: ${error.message}`, 'error');
  } finally {
    this.isProcessing = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalIcon;
    }
  }
}

    async saveToIndexedDB(table, data) {
  try {
    await IndexedDBManager.put(table, data);
    console.log(`✅ ${table} sauvegardé:`, data.id);
    return true;
  } catch (error) {
    console.error(`❌ Erreur sauvegarde ${table}:`, error);
    throw error;
  }
}

    async cleanupOldPhoto(oldPhotoId, oldPhotoUrl) {
  try {
    // Supprimer du cache IndexedDB v4
    if (oldPhotoId) {
      try {
        await IndexedDBManager.delete('photos', oldPhotoId);
        console.log('[PHOTO] Ancienne photo supprimee du cache v4');
      } catch (err) {
        console.warn('[PHOTO] Erreur delete cache v4:', err);
      }
    }

    // Supprimer de Supabase Storage
    if (oldPhotoUrl && window.PhotoService) {
      await window.PhotoService.deletePhotos(this.photoBucket, [oldPhotoUrl]);
      console.log('[PHOTO] Ancienne photo supprimee de Supabase');
    }
  } catch (error) {
    console.warn('[PHOTO] Erreur cleanup photo:', error);
  }
}
    
    // ============================================
    // 🎬 MODAL DISPLAY
    // ============================================

    show(html) {
        this.close();
        this.blockBodyScroll();

        const existingModals = document.querySelectorAll('.modern-modal-overlay');
        existingModals.forEach(m => m.remove());

        const wrapper = document.createElement('div');
        wrapper.style.visibility = 'hidden';
        wrapper.innerHTML = html;

        document.body.appendChild(wrapper);
        this.modalElement = wrapper.firstElementChild;

        wrapper.replaceWith(this.modalElement);

        requestAnimationFrame(() => {
            this.modalElement.classList.add('show');
            const container = this.modalElement.querySelector('.modern-modal-container');
            if (container) container.classList.add('show');
            this.setupPhotoUpload();
        });

        this.isOpen = true;
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modalElement) return;

        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) this.close();
        });

        const closeBtn = this.modalElement.querySelector('[data-close]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        this.handleEscape = (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        };
        document.addEventListener('keydown', this.handleEscape);
    }

    blockBodyScroll() {
        this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${this.scrollPosition}px`;
        document.documentElement.style.overflow = 'hidden';
    }

    restoreBodyScroll() {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        document.documentElement.style.overflow = '';

        if (this.scrollPosition !== undefined) {
            window.scrollTo(0, this.scrollPosition);
            this.scrollPosition = undefined;
        }
    }

    // ============================================
    // 🛠️ HELPERS
    // ============================================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        setTimeout(() => {
            if (window.BarzikToast) {
                window.BarzikToast.show(message, type);
            } else {
                console.log(`${type.toUpperCase()}: ${message}`);
            }
        }, 350);
    }

    getCurrentUser() {
        return Auth.getCurrentUser();
    }

    normalizeCity(city) {
        if (!city) return null;
        return city
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
}

export default BaseModal;