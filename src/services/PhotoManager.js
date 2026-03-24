/**
 * 📷 PHOTO MANAGER V3 - Service pur optimisation images
 * Redimensionne 600x600, compresse en JPEG/WebP
 * NE stocke PAS - c'est PhotoOrchestrator qui s'en charge
 */

export class PhotoManager {
  constructor({ bucket = 'default-photos' } = {}) {
    this.bucket = bucket;
    this.options = {
      size: {
        width: 600,
        height: 600,
        quality: 0.75
      },
      preferWebP: this.isWebPSupported(),
      fallbackFormat: 'image/jpeg',
      fallbackQuality: 0.85,
      maxFileSize: 5 * 1024 * 1024,  // 5MB
      maxDimensions: { width: 5000, height: 5000 },
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    };
  }

  static webPSupported = null;

  isWebPSupported() {
    if (PhotoManager.webPSupported !== null) {
      return PhotoManager.webPSupported;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    PhotoManager.webPSupported = canvas.toDataURL('image/webp').indexOf('webp') > -1;
    return PhotoManager.webPSupported;
  }

  async pickFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          reject(new Error('Aucun fichier sélectionné'));
          return;
        }

        try {
          const result = await this.processFile(file);
          resolve({
            photoId: result.photoId,
            universal: result.universal
          });
        } catch (error) {
          reject(error);
        }
      };

      input.click();
    });
  }

  /**
   * Traiter et optimiser le fichier image
   * Retourne { photoId, universal: blob optimisé }
   */
  async processFile(file) {
    // Validation
    if (!this.options.allowedTypes.includes(file.type)) {
      throw new Error('Format non supporté. Utilisez JPG, PNG ou WebP.');
    }

    if (file.size > this.options.maxFileSize) {
      throw new Error('Image trop volumineuse (max 5MB)');
    }

    console.log('📷 Traitement image:', file.name, (file.size / 1024).toFixed(0) + 'KB');

    const img = await this.loadImage(file);

    // Vérifier résolution
    if (img.width > this.options.maxDimensions.width || img.height > this.options.maxDimensions.height) {
      throw new Error(`Image trop grande (max ${this.options.maxDimensions.width}×${this.options.maxDimensions.height}px). Votre image: ${img.width}×${img.height}px`);
    }

    const blob = await this.generateOptimizedVersion(img);
    const photoId = this.generatePhotoId();

    console.log('✅ Image optimisée:', photoId.substring(0, 8),
      'size:', (blob.size / 1024).toFixed(0) + 'KB');

    // ✅ JUSTE retourner le blob
    // ✅ PhotoOrchestrator s'occupe du stockage + hash
    return {
      photoId,
      universal: blob
    };
  }

  /**
   * Générer UUID avec fallback pour navigateurs anciens
   */
  generatePhotoId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback: crypto.getRandomValues()
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      arr[6] = (arr[6] & 0x0f) | 0x40;
      arr[8] = (arr[8] & 0x3f) | 0x80;
      return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Last resort: timestamp + random
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async generateOptimizedVersion(img) {
    try {
      console.log(`📷 Optimisation commencée: ${img.width}×${img.height}px`);

      const canvas = this.createSquareCanvas(img, this.options.size);
      if (!canvas) {
        throw new Error('Canvas non créé');
      }

      const blob = await this.canvasToBlob(canvas, this.options.size.quality);

      console.log(`✅ Optimisation réussie: ${this.options.size.width}×${this.options.size.height}px, ${(blob.size / 1024).toFixed(0)}KB`);

      return blob;

    } catch (error) {
      console.error('❌ Erreur optimisation image:', error.message, error.stack);
      throw new Error(`Impossible d'optimiser l'image: ${error.message}`);
    }
  }

  async canvasToBlob(canvas, quality) {
    if (!canvas) {
      throw new Error('Canvas invalide');
    }

    // Tenter WebP
    if (this.options.preferWebP) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('toBlob timeout')), 10000);

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeoutId);

            if (!blob) {
              console.warn('⚠️ WebP blob null, fallback JPEG');
              canvas.toBlob(
                (jpegBlob) => {
                  if (jpegBlob) {
                    console.log('✅ Blob JPEG:', (jpegBlob.size / 1024).toFixed(0) + 'KB');
                    resolve(jpegBlob);
                  } else {
                    reject(new Error('Blob JPEG null'));
                  }
                },
                this.options.fallbackFormat,
                this.options.fallbackQuality
              );
              return;
            }

            if (blob.type.includes('webp')) {
              console.log('✅ Blob WebP:', (blob.size / 1024).toFixed(0) + 'KB');
              resolve(blob);
            } else {
              console.warn('⚠️ WebP non supporté, fallback JPEG');
              canvas.toBlob(
                (jpegBlob) => {
                  if (jpegBlob) {
                    console.log('✅ Blob JPEG:', (jpegBlob.size / 1024).toFixed(0) + 'KB');
                    resolve(jpegBlob);
                  } else {
                    reject(new Error('Blob JPEG null'));
                  }
                },
                this.options.fallbackFormat,
                this.options.fallbackQuality
              );
            }
          },
          'image/webp',
          quality
        );
      });
    }

    // Fallback direct JPEG
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('toBlob timeout')), 10000);

      canvas.toBlob(
        (blob) => {
          clearTimeout(timeoutId);

          if (blob) {
            console.log('✅ Blob JPEG:', (blob.size / 1024).toFixed(0) + 'KB');
            resolve(blob);
          } else {
            reject(new Error('Blob JPEG null'));
          }
        },
        this.options.fallbackFormat,
        this.options.fallbackQuality
      );
    });
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          if (img.width < 100 || img.height < 100) {
            reject(new Error('Image trop petite (min 100x100px)'));
            return;
          }
          resolve(img);
        };

        img.onerror = () => reject(new Error('Image corrompue'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Redimensionne image en carré 600x600, centré
   * @param {Image} img - Image element
   * @param {Object} size - { width, height }
   * @returns {HTMLCanvasElement} Canvas redimensionné
   */
  createSquareCanvas(img, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible d\'obtenir le contexte canvas');
    }

    // Calculer dimension carré et position centrée
    const sourceSize = Math.min(img.width, img.height);
    const offsetX = (img.width - sourceSize) / 2;
    const offsetY = (img.height - sourceSize) / 2;

    console.log(`📷 Redimensionnement: ${img.width}×${img.height} → ${size.width}×${size.height}`);

    // Dessiner l'image centrée et redimensionnée
    ctx.drawImage(
      img,
      offsetX, offsetY, sourceSize, sourceSize,  // Source: carré centré
      0, 0, size.width, size.height              // Destination: canvas entier
    );

    return canvas;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.PhotoManager = PhotoManager;
}

export default PhotoManager;