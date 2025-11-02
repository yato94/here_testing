/**
 * i18n (internationalization) module for TransportNomad Load Planner
 * Handles automatic language detection and translation management
 */

const i18n = {
    currentLanguage: 'en',
    translations: {},
    supportedLanguages: ['en', 'pl', 'bg', 'cs', 'da', 'de', 'es', 'et', 'fi', 'fr', 'hr', 'hu', 'it', 'lt', 'lv', 'nl', 'no', 'ro', 'pt', 'sk', 'sq', 'sr', 'sv'], // Supported languages

    /**
     * Detect browser language
     * @returns {string} Two-letter language code (e.g., 'pl', 'en')
     */
    detectLanguage() {
        const browserLang = navigator.language.substring(0, 2).toLowerCase();

        // Check if browser language is supported
        if (this.supportedLanguages.includes(browserLang)) {
            return browserLang;
        }

        // Default to English if browser language is not supported
        return 'en';
    },

    /**
     * Load language file (JSON)
     * @param {string} lang - Two-letter language code
     * @returns {Promise<void>}
     */
    async loadLanguage(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);

            if (!response.ok) {
                throw new Error(`Failed to load language file: ${lang}.json`);
            }

            this.translations = await response.json();
            this.currentLanguage = lang;

            console.log(`Language loaded: ${lang}`);
        } catch (error) {
            console.error(`Error loading language ${lang}:`, error);

            // Fallback to English if requested language fails to load
            if (lang !== 'en') {
                console.log('Falling back to English...');
                const fallbackResponse = await fetch('locales/en.json');
                this.translations = await fallbackResponse.json();
                this.currentLanguage = 'en';
            }
        }
    },

    /**
     * Get translation by key
     * @param {string} key - Translation key
     * @returns {string} Translated text or key if translation not found
     */
    t(key) {
        const translation = this.translations[key];

        if (translation === undefined) {
            console.warn(`Translation missing for key: "${key}"`);
            return key;
        }

        return translation;
    },

    /**
     * Get date locale string for the current language
     * @returns {string} Locale string (e.g., 'en-US', 'pl-PL', 'de-DE')
     */
    getDateLocale() {
        const localeMap = {
            'en': 'en-US',
            'pl': 'pl-PL',
            'bg': 'bg-BG',
            'cs': 'cs-CZ',
            'da': 'da-DK',
            'de': 'de-DE',
            'es': 'es-ES',
            'et': 'et-EE',
            'fi': 'fi-FI',
            'fr': 'fr-FR',
            'hr': 'hr-HR',
            'hu': 'hu-HU',
            'it': 'it-IT',
            'lt': 'lt-LT',
            'lv': 'lv-LV',
            'nl': 'nl-NL',
            'no': 'no-NO',
            'ro': 'ro-RO',
            'pt': 'pt-PT',
            'sk': 'sk-SK',
            'sq': 'sq-AL',
            'sr': 'sr-RS',
            'sv': 'sv-SE'
        };

        return localeMap[this.currentLanguage] || 'en-US';
    },

    /**
     * Update all page elements with data-i18n attributes
     */
    updatePageLanguage() {
        // IMPORTANT: Process method-text elements FIRST before general data-i18n
        // This prevents them from being processed twice
        document.querySelectorAll('.method-text[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
            // Mark as processed to skip in general pass
            el.setAttribute('data-i18n-processed', 'true');
        });

        // Update elements with data-i18n-prefix (like orientation toggle button)
        document.querySelectorAll('[data-i18n-prefix]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const prefix = el.getAttribute('data-i18n-prefix');
            el.textContent = prefix + this.t(key);
            // Mark as processed
            el.setAttribute('data-i18n-processed', 'true');
        });

        // Update all elements with data-i18n attribute (textContent)
        // Skip already processed elements
        document.querySelectorAll('[data-i18n]:not([data-i18n-processed])').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Update all elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update all elements with data-i18n-title attribute
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLanguage;
    },

    /**
     * Initialize i18n system
     * Detects language, loads translations, and updates the page
     * @returns {Promise<void>}
     */
    async init() {
        const lang = this.detectLanguage();
        await this.loadLanguage(lang);
        this.updatePageLanguage();
    }
};
