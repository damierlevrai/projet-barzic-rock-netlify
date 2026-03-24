/**
 * 🎨 BARZIK TOAST - Système de notifications
 * 
 * FEATURES :
 * ✅ 4 types : success, error, warning, info
 * ✅ Auto-dismiss configurable
 * ✅ Empilage multiple
 * ✅ Animations fluides
 * ✅ Mobile-first
 * ✅ Accessible (ARIA)
 * ✅ File d'attente
 * 
 * USAGE :
 * BarzikToast.show('Message', 'success')
 * BarzikToast.show('Erreur', 'error', { duration: 5000 })
 * BarzikToast.success('Sauvegardé !')
 * BarzikToast.error('Échec')
 */

class BarzikToast {
    constructor() {
        this.toasts = [];
        this.container = null;
        this.maxToasts = 3;
        this.defaultDuration = 4000;
        this.queue = [];
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        // Créer conteneur
        this.container = document.createElement('div');
        this.container.id = 'barzik-toast-container';
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Notifications');
        this.container.setAttribute('aria-live', 'polite');
        
        // Injecter CSS
        this.injectStyles();
        
        // Ajouter au DOM
        if (document.body) {
            document.body.appendChild(this.container);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(this.container);
            });
        }
        
        console.log('🎨 BarzikToast initialisé');
    }

    injectStyles() {
        if (document.getElementById('barzik-toast-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'barzik-toast-styles';
        styles.textContent = `
            /* 🎨 BARZIK TOAST STYLES */
            
            #barzik-toast-container {
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 400px;
                pointer-events: none;
            }
            
            .barzik-toast {
                pointer-events: all;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%);
                border: 2px solid #667eea;
                border-radius: 12px;
                padding: 16px 20px;
                box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3),
                            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                min-width: 300px;
                max-width: 100%;
                backdrop-filter: blur(10px);
                position: relative;
                overflow: hidden;
                transform: translateX(calc(100% + 40px));
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            .barzik-toast.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .barzik-toast.hide {
                transform: translateX(calc(100% + 40px));
                opacity: 0;
            }
            
            /* Progress bar */
            .barzik-toast::before {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                width: 100%;
                transform-origin: left;
                animation: toastProgress var(--duration) linear forwards;
            }
            
            @keyframes toastProgress {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
            
            /* Icon */
            .barzik-toast-icon {
                font-size: 24px;
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                animation: toastIconBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            @keyframes toastIconBounce {
                0% { transform: scale(0) rotate(-180deg); }
                50% { transform: scale(1.2) rotate(10deg); }
                100% { transform: scale(1) rotate(0deg); }
            }
            
            /* Content */
            .barzik-toast-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-width: 0;
            }
            
            .barzik-toast-title {
                font-weight: 600;
                font-size: 15px;
                color: #ffffff;
                margin: 0;
                line-height: 1.4;
            }
            
            .barzik-toast-message {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.8);
                margin: 0;
                line-height: 1.5;
                word-wrap: break-word;
            }
            
            /* Close button */
            .barzik-toast-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                cursor: pointer;
                padding: 4px;
                font-size: 18px;
                line-height: 1;
                flex-shrink: 0;
                border-radius: 4px;
                transition: all 0.2s;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .barzik-toast-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                transform: scale(1.1);
            }
            
            /* Types */
            .barzik-toast.success {
                border-color: #10b981;
                box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3),
                            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            }
            
            .barzik-toast.success::before {
                background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            }
            
            .barzik-toast.success .barzik-toast-icon {
                background: rgba(16, 185, 129, 0.2);
                color: #10b981;
            }
            
            .barzik-toast.error {
                border-color: #ef4444;
                box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3),
                            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            }
            
            .barzik-toast.error::before {
                background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
            }
            
            .barzik-toast.error .barzik-toast-icon {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }
            
            .barzik-toast.warning {
                border-color: #f59e0b;
                box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3),
                            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            }
            
            .barzik-toast.warning::before {
                background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
            }
            
            .barzik-toast.warning .barzik-toast-icon {
                background: rgba(245, 158, 11, 0.2);
                color: #f59e0b;
            }
            
            .barzik-toast.info {
                border-color: #3b82f6;
                box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3),
                            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            }
            
            .barzik-toast.info::before {
                background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
            }
            
            .barzik-toast.info .barzik-toast-icon {
                background: rgba(59, 130, 246, 0.2);
                color: #3b82f6;
            }
            
            /* Mobile */
            @media (max-width: 768px) {
                #barzik-toast-container {
                    top: auto;
                    bottom: 20px;
                    left: 10px;
                    right: 10px;
                    max-width: none;
                }
                
                .barzik-toast {
                    min-width: auto;
                    transform: translateY(calc(100% + 40px));
                }
                
                .barzik-toast.show {
                    transform: translateY(0);
                }
                
                .barzik-toast.hide {
                    transform: translateY(calc(100% + 40px));
                }
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: light) {
                .barzik-toast {
                    background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
                    border-color: #667eea;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1),
                                0 0 0 1px rgba(0, 0, 0, 0.05) inset;
                }
                
                .barzik-toast-title {
                    color: #1f2937;
                }
                
                .barzik-toast-message {
                    color: #6b7280;
                }
                
                .barzik-toast-close {
                    color: #9ca3af;
                }
                
                .barzik-toast-close:hover {
                    color: #1f2937;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    /**
     * Affiche une notification
     * @param {string} message - Message principal
     * @param {string} type - success | error | warning | info
     * @param {Object} options - { title, duration, persistent }
     */
    show(message, type = 'info', options = {}) {
        const config = {
            message,
            type,
            title: options.title || this.getDefaultTitle(type),
            duration: options.duration ?? this.defaultDuration,
            persistent: options.persistent || false
        };
        
        // Si trop de toasts, ajouter à la queue
        if (this.toasts.length >= this.maxToasts) {
            this.queue.push(config);
            return;
        }
        
        this.createToast(config);
    }

    createToast(config) {
        const toast = document.createElement('div');
        toast.className = `barzik-toast ${config.type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.style.setProperty('--duration', `${config.duration}ms`);
        
        const icon = this.getIcon(config.type);
        
        toast.innerHTML = `
            <div class="barzik-toast-icon">${icon}</div>
            <div class="barzik-toast-content">
                ${config.title ? `<div class="barzik-toast-title">${this.escapeHtml(config.title)}</div>` : ''}
                <div class="barzik-toast-message">${this.escapeHtml(config.message)}</div>
            </div>
            <button class="barzik-toast-close" aria-label="Fermer la notification">×</button>
        `;
        
        // Close button
        const closeBtn = toast.querySelector('.barzik-toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));
        
        // Ajouter au container
        this.container.appendChild(toast);
        this.toasts.push(toast);
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto-dismiss
        if (!config.persistent) {
            toast.timeout = setTimeout(() => {
                this.dismiss(toast);
            }, config.duration);
        }
        
        // Click sur toast pour dismiss (optionnel)
        toast.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                this.dismiss(toast);
            }
        });
        
        console.log(`🎨 Toast ${config.type}:`, config.message);
    }

    dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        
        // Clear timeout
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }
        
        // Animation de sortie
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // Retirer du DOM après animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            
            // Retirer de la liste
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
            
            // Traiter la queue
            this.processQueue();
        }, 400);
    }

    processQueue() {
        if (this.queue.length > 0 && this.toasts.length < this.maxToasts) {
            const next = this.queue.shift();
            this.createToast(next);
        }
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    getDefaultTitle(type) {
        const titles = {
            success: 'Succès',
            error: 'Erreur',
            warning: 'Attention',
            info: 'Information'
        };
        return titles[type] || titles.info;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Méthodes raccourcies
    success(message, options = {}) {
        this.show(message, 'success', options);
    }

    error(message, options = {}) {
        this.show(message, 'error', { ...options, duration: options.duration || 6000 });
    }

    warning(message, options = {}) {
        this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        this.show(message, 'info', options);
    }

    // Clear tous les toasts
    clearAll() {
        this.toasts.forEach(toast => this.dismiss(toast));
        this.queue = [];
    }
}

// Instance globale
const BarzikToastInstance = new BarzikToast();

// Export global
if (typeof window !== 'undefined') {
    window.BarzikToast = BarzikToastInstance;
}

export default BarzikToastInstance;