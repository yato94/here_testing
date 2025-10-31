class UI {
    constructor(scene3d, cargoManager, axleCalculator) {
        this.scene3d = scene3d;
        this.cargoManager = cargoManager;
        this.axleCalculator = axleCalculator;

        // Load saved vehicle type from localStorage, default to 'standard'
        const savedVehicleType = localStorage.getItem('lastVehicleType');
        this.currentVehicle = savedVehicleType || 'standard';

        this.unitCounts = {};
        this.unitParameters = {};
        this.currentConfigId = null;
        this.currentConfigName = null;

        // Maximum number of configurations to store in localStorage
        this.MAX_STORED_CONFIGS = 50;

        this.init();
    }
    
    init() {
        this.setupVehicleSelector();
        this.setupDimensionButtons();
        this.setupCargoUnits();
        this.setupControlButtons();
        this.setupViewControls();
        this.setupModalHandlers();
        this.setupMobileToggles();
        this.setupAxleSettingsModal();
        this.setupAxleInfoModal();
        this.setupSaveConfigModal();
        this.setupLoadConfigModal();
        this.setupGroupSelectionCallbacks();
        this.updateStatistics();
        
        // Initialize 3D axle load display from saved settings
        const savedShowAxleLoads = localStorage.getItem('showAxleLoadsOn3D');
        // Default to true (enabled) if no saved setting exists
        if (savedShowAxleLoads === null || savedShowAxleLoads === 'true') {
            this.scene3d.toggleAxleLoadDisplay(true);
        }
        
        // Store reference for global access
        window.uiInstance = this;
    }
    
    setupMobileToggles() {
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        const toggleLeft = document.getElementById('toggleLeftPanel');
        const toggleRight = document.getElementById('toggleRightPanel');
        
        // Check screen size and show/hide toggle buttons
        const checkScreenSize = () => {
            if (window.innerWidth <= 768) {
                toggleLeft.style.display = 'flex';
                leftPanel.classList.add('collapsed');
            } else {
                toggleLeft.style.display = 'none';
                leftPanel.classList.remove('collapsed');
            }
            
            if (window.innerWidth <= 1024) {
                toggleRight.style.display = 'flex';
                rightPanel.classList.add('collapsed');
            } else {
                toggleRight.style.display = 'none';
                rightPanel.classList.remove('collapsed');
            }
        };
        
        // Toggle left panel
        toggleLeft.addEventListener('click', () => {
            leftPanel.classList.toggle('collapsed');
            toggleLeft.innerHTML = leftPanel.classList.contains('collapsed') ? 
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        });
        
        // Toggle right panel
        toggleRight.addEventListener('click', () => {
            rightPanel.classList.toggle('collapsed');
            toggleRight.innerHTML = rightPanel.classList.contains('collapsed') ? 
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        });
        
        // Check on init and resize
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
    }
    
    setupVehicleSelector() {
        const vehicleSelect = document.getElementById('vehicleType');
        const customSelect = document.getElementById('vehicleSelect');
        const customSelectTrigger = customSelect.querySelector('.custom-select-trigger');
        const customOptions = customSelect.querySelector('.custom-options');
        const customDimensions = document.getElementById('customDimensions');
        const maxLoadInput = document.getElementById('maxLoadInput');
        
        // SOLO dimension sliders
        const soloDimensionSliders = document.getElementById('soloDimensionSliders');
        const soloLengthSlider = document.getElementById('soloLengthSlider');
        const soloHeightSlider = document.getElementById('soloHeightSlider');
        const soloLengthValue = document.getElementById('soloLengthValue');
        const soloHeightValue = document.getElementById('soloHeightValue');

        // Custom dimensions sliders
        const customLengthSlider = document.getElementById('customLengthSlider');
        const customWidthSlider = document.getElementById('customWidthSlider');
        const customHeightSlider = document.getElementById('customHeightSlider');
        const customLengthValue = document.getElementById('customLengthValue');
        const customWidthValue = document.getElementById('customWidthValue');
        const customHeightValue = document.getElementById('customHeightValue');

        // JUMBO dimension sliders
        const jumboDimensionSliders = document.getElementById('jumboDimensionSliders');
        const jumboSection1LengthSlider = document.getElementById('jumboSection1LengthSlider');
        const jumboSection1HeightSlider = document.getElementById('jumboSection1HeightSlider');
        const jumboSection2LengthSlider = document.getElementById('jumboSection2LengthSlider');
        const jumboSection2HeightSlider = document.getElementById('jumboSection2HeightSlider');
        const jumboSection1LengthValue = document.getElementById('jumboSection1LengthValue');
        const jumboSection1HeightValue = document.getElementById('jumboSection1HeightValue');
        const jumboSection2LengthValue = document.getElementById('jumboSection2LengthValue');
        const jumboSection2HeightValue = document.getElementById('jumboSection2HeightValue');
        
        // Setup max load input handler
        maxLoadInput.addEventListener('change', () => {
            const maxLoadTons = parseFloat(maxLoadInput.value) || 24;
            const maxLoadKg = Math.round(maxLoadTons * 1000);
            this.cargoManager.updateMaxLoad(maxLoadKg);
            this.updateStatistics();
        });
        
        // Auto-select all text on focus
        maxLoadInput.addEventListener('focus', () => {
            maxLoadInput.select();
        });
        
        // Setup custom dropdown
        customSelectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
            customOptions.classList.toggle('hidden');
        });
        
        // Handle option selection
        const options = customOptions.querySelectorAll('.custom-option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;
                const name = option.querySelector('.option-name').textContent;
                const dimensions = option.querySelector('.option-dimensions').textContent;
                
                // Update visible selection
                customSelectTrigger.querySelector('.option-name').textContent = name;
                customSelectTrigger.querySelector('.option-dimensions').textContent = dimensions;
                
                // Update all options selected state
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                // Close dropdown
                customSelect.classList.remove('open');
                customOptions.classList.add('hidden');
                
                // Update hidden select
                vehicleSelect.value = value;

                // Save selected vehicle type to localStorage
                localStorage.setItem('lastVehicleType', value);

                // Store previous vehicle type before updating
                const previousVehicleType = this.currentVehicle;

                if (value === 'custom') {
                    customDimensions.classList.remove('hidden');
                    soloDimensionSliders.classList.add('hidden');
                    jumboDimensionSliders.classList.add('hidden');

                    // Load saved Custom dimensions from localStorage
                    const savedDimensions = localStorage.getItem('customDimensions');
                    if (savedDimensions) {
                        const dims = JSON.parse(savedDimensions);
                        customLengthSlider.value = dims.length;
                        customWidthSlider.value = dims.width;
                        customHeightSlider.value = dims.height;
                        customLengthValue.textContent = `${dims.length.toFixed(2)}m`;
                        customWidthValue.textContent = `${dims.width.toFixed(2)}m`;
                        customHeightValue.textContent = `${dims.height.toFixed(2)}m`;
                    }

                    this.currentVehicle = value;
                    // Load custom vehicle immediately to hide axle panel and set up clean space
                    this.loadCustomVehicle();
                } else if (value === 'solo') {
                    customDimensions.classList.add('hidden');
                    soloDimensionSliders.classList.remove('hidden');
                    jumboDimensionSliders.classList.add('hidden');
                    
                    // Load saved SOLO dimensions from localStorage
                    const savedDimensions = localStorage.getItem('soloDimensions');
                    if (savedDimensions) {
                        const dims = JSON.parse(savedDimensions);
                        soloLengthSlider.value = dims.length;
                        soloHeightSlider.value = dims.height;
                        soloLengthValue.textContent = `${dims.length.toFixed(2)}m`;
                        soloHeightValue.textContent = `${dims.height.toFixed(1)}m`;
                    }
                    
                    // Pass previous vehicle type to loadVehicle
                    this.loadVehicle(value, previousVehicleType);
                    this.currentVehicle = value;
                    // Axle configuration is updated in loadVehicle via axleCalculator.setVehicle
                } else if (value === 'jumbo') {
                    customDimensions.classList.add('hidden');
                    soloDimensionSliders.classList.add('hidden');
                    jumboDimensionSliders.classList.remove('hidden');
                    
                    // Load saved JUMBO dimensions from localStorage
                    const savedDimensions = localStorage.getItem('jumboDimensions');
                    if (savedDimensions) {
                        try {
                            const dims = JSON.parse(savedDimensions);
                            // Validate structure before using
                            if (dims && dims.section1 && dims.section2 && 
                                typeof dims.section1.length === 'number' && 
                                typeof dims.section1.height === 'number' &&
                                typeof dims.section2.length === 'number' && 
                                typeof dims.section2.height === 'number') {
                                
                                jumboSection1LengthSlider.value = dims.section1.length;
                                jumboSection1HeightSlider.value = dims.section1.height;
                                jumboSection2LengthSlider.value = dims.section2.length;
                                jumboSection2HeightSlider.value = dims.section2.height;
                                jumboSection1LengthValue.textContent = `${dims.section1.length.toFixed(2)}m`;
                                jumboSection1HeightValue.textContent = `${dims.section1.height.toFixed(1)}m`;
                                jumboSection2LengthValue.textContent = `${dims.section2.length.toFixed(2)}m`;
                                jumboSection2HeightValue.textContent = `${dims.section2.height.toFixed(1)}m`;
                            }
                        } catch (e) {
                            console.log('Invalid JUMBO dimensions in localStorage, using defaults');
                        }
                    }
                    
                    // Pass previous vehicle type to loadVehicle
                    this.loadVehicle(value, previousVehicleType);
                    this.currentVehicle = value;
                } else {
                    customDimensions.classList.add('hidden');
                    soloDimensionSliders.classList.add('hidden');
                    jumboDimensionSliders.classList.add('hidden');
                    // Pass previous vehicle type to loadVehicle
                    this.loadVehicle(value, previousVehicleType);
                    this.currentVehicle = value;
                    // Axle configuration is updated in loadVehicle via axleCalculator.setVehicle
                }
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            customSelect.classList.remove('open');
            customOptions.classList.add('hidden');
        });

        // Setup Custom dimensions sliders
        if (customLengthSlider && customWidthSlider && customHeightSlider) {
            // Load saved dimensions if they exist
            const savedDimensions = localStorage.getItem('customDimensions');
            if (savedDimensions) {
                const dims = JSON.parse(savedDimensions);
                customLengthSlider.value = dims.length;
                customWidthSlider.value = dims.width;
                customHeightSlider.value = dims.height;
                customLengthValue.textContent = `${dims.length.toFixed(2)}m`;
                customWidthValue.textContent = `${dims.width.toFixed(2)}m`;
                customHeightValue.textContent = `${dims.height.toFixed(2)}m`;

                // Update dropdown display for Custom with saved dimensions
                const customOption = customSelect.querySelector('.custom-option[data-value="custom"]');
                if (customOption) {
                    const dimensionText = `${dims.length.toFixed(1)}m × ${dims.width.toFixed(2)}m × ${dims.height.toFixed(1)}m`;
                    customOption.querySelector('.option-dimensions').textContent = dimensionText;
                }
            }

            customLengthSlider.addEventListener('input', () => {
                const length = parseFloat(customLengthSlider.value);
                customLengthValue.textContent = `${length.toFixed(2)}m`;
                if (this.currentVehicle === 'custom') {
                    this.updateCustomDimensions(length, parseFloat(customWidthSlider.value), parseFloat(customHeightSlider.value));
                }
            });

            customWidthSlider.addEventListener('input', () => {
                const width = parseFloat(customWidthSlider.value);
                customWidthValue.textContent = `${width.toFixed(2)}m`;
                if (this.currentVehicle === 'custom') {
                    this.updateCustomDimensions(parseFloat(customLengthSlider.value), width, parseFloat(customHeightSlider.value));
                }
            });

            customHeightSlider.addEventListener('input', () => {
                const height = parseFloat(customHeightSlider.value);
                customHeightValue.textContent = `${height.toFixed(2)}m`;
                if (this.currentVehicle === 'custom') {
                    this.updateCustomDimensions(parseFloat(customLengthSlider.value), parseFloat(customWidthSlider.value), height);
                }
            });
        }

        // Setup SOLO dimension sliders
        if (soloLengthSlider && soloHeightSlider) {
            // Load saved dimensions if they exist
            const savedDimensions = localStorage.getItem('soloDimensions');
            if (savedDimensions) {
                const dims = JSON.parse(savedDimensions);
                soloLengthSlider.value = dims.length;
                soloHeightSlider.value = dims.height;
                soloLengthValue.textContent = `${dims.length.toFixed(2)}m`;
                soloHeightValue.textContent = `${dims.height.toFixed(1)}m`;
                
                // Update dropdown display for SOLO with saved dimensions
                const soloOption = customSelect.querySelector('.custom-option[data-value="solo"]');
                if (soloOption) {
                    const dimensionText = `${dims.length.toFixed(1)}m × 2.48m × ${dims.height.toFixed(1)}m`;
                    soloOption.querySelector('.option-dimensions').textContent = dimensionText;
                }
            }
            
            soloLengthSlider.addEventListener('input', () => {
                const length = parseFloat(soloLengthSlider.value);
                soloLengthValue.textContent = `${length.toFixed(2)}m`;
                if (this.currentVehicle === 'solo') {
                    this.updateSoloDimensions(length, parseFloat(soloHeightSlider.value));
                }
            });
            
            soloHeightSlider.addEventListener('input', () => {
                const height = parseFloat(soloHeightSlider.value);
                soloHeightValue.textContent = `${height.toFixed(1)}m`;
                if (this.currentVehicle === 'solo') {
                    this.updateSoloDimensions(parseFloat(soloLengthSlider.value), height);
                }
            });
            
            // JUMBO slider event listeners
            if (jumboSection1LengthSlider && jumboSection1HeightSlider && 
                jumboSection2LengthSlider && jumboSection2HeightSlider) {
                
                const updateJumboIfActive = () => {
                    if (this.currentVehicle === 'jumbo') {
                        this.updateJumboDimensions(
                            parseFloat(jumboSection1LengthSlider.value),
                            parseFloat(jumboSection1HeightSlider.value),
                            parseFloat(jumboSection2LengthSlider.value),
                            parseFloat(jumboSection2HeightSlider.value)
                        );
                    }
                };
                
                jumboSection1LengthSlider.addEventListener('input', () => {
                    const length = parseFloat(jumboSection1LengthSlider.value);
                    jumboSection1LengthValue.textContent = `${length.toFixed(2)}m`;
                    updateJumboIfActive();
                });
                
                jumboSection1HeightSlider.addEventListener('input', () => {
                    const height = parseFloat(jumboSection1HeightSlider.value);
                    jumboSection1HeightValue.textContent = `${height.toFixed(1)}m`;
                    updateJumboIfActive();
                });
                
                jumboSection2LengthSlider.addEventListener('input', () => {
                    const length = parseFloat(jumboSection2LengthSlider.value);
                    jumboSection2LengthValue.textContent = `${length.toFixed(2)}m`;
                    updateJumboIfActive();
                });
                
                jumboSection2HeightSlider.addEventListener('input', () => {
                    const height = parseFloat(jumboSection2HeightSlider.value);
                    jumboSection2HeightValue.textContent = `${height.toFixed(1)}m`;
                    updateJumboIfActive();
                });
            }
            
            // Load saved JUMBO dimensions on startup
            if (jumboSection1LengthSlider && jumboSection1HeightSlider && 
                jumboSection2LengthSlider && jumboSection2HeightSlider) {
                const savedJumboDimensions = localStorage.getItem('jumboDimensions');
                if (savedJumboDimensions) {
                    try {
                        const dims = JSON.parse(savedJumboDimensions);
                        // Validate structure
                        if (dims && dims.section1 && dims.section2 && 
                            typeof dims.section1.length === 'number' && 
                            typeof dims.section1.height === 'number' &&
                            typeof dims.section2.length === 'number' && 
                            typeof dims.section2.height === 'number') {
                            
                            jumboSection1LengthSlider.value = dims.section1.length;
                            jumboSection1HeightSlider.value = dims.section1.height;
                            jumboSection2LengthSlider.value = dims.section2.length;
                            jumboSection2HeightSlider.value = dims.section2.height;
                            jumboSection1LengthValue.textContent = `${dims.section1.length.toFixed(1)}m`;
                            jumboSection1HeightValue.textContent = `${dims.section1.height.toFixed(1)}m`;
                            jumboSection2LengthValue.textContent = `${dims.section2.length.toFixed(1)}m`;
                            jumboSection2HeightValue.textContent = `${dims.section2.height.toFixed(1)}m`;
                            
                            // Update dropdown display for JUMBO with saved dimensions
                            const jumboOption = customSelect.querySelector('.custom-option[data-value="jumbo"]');
                            if (jumboOption) {
                                const totalLength = dims.section1.length + dims.section2.length;
                                const maxHeight = Math.max(dims.section1.height, dims.section2.height);
                                const dimensionText = `${totalLength.toFixed(1)}m × 2.48m × ${maxHeight.toFixed(1)}m`;
                                jumboOption.querySelector('.option-dimensions').textContent = dimensionText;
                            }
                        }
                    } catch (e) {
                        console.log('Invalid JUMBO dimensions in localStorage, using defaults');
                    }
                }
            }
        }

        // Setup distance sliders for axle configuration
        const distanceSliders = [
            // Standard trailer
            { id: 'distFrontToKingpin', valueId: 'distFrontToKingpinValue', decimals: 2 },
            { id: 'distKingpinToTrailer', valueId: 'distKingpinToTrailerValue', decimals: 2 },
            { id: 'distFrontAxleToKingpin', valueId: 'distFrontAxleToKingpinValue', decimals: 2 },
            { id: 'distKingpinToDrive', valueId: 'distKingpinToDriveValue', decimals: 2 },
            // SOLO
            { id: 'distCargoStartToFront', valueId: 'distCargoStartToFrontValue', decimals: 2 },
            { id: 'distCargoStartToDrive', valueId: 'distCargoStartToDriveValue', decimals: 2 },
            // JUMBO
            { id: 'distSection1StartToFront', valueId: 'distSection1StartToFrontValue', decimals: 2 },
            { id: 'distSection1StartToDrive', valueId: 'distSection1StartToDriveValue', decimals: 2 },
            { id: 'distSection2StartToTrailerAxles', valueId: 'distSection2StartToTrailerAxlesValue', decimals: 2 }
        ];

        distanceSliders.forEach(sliderConfig => {
            const slider = document.getElementById(sliderConfig.id);
            const valueDisplay = document.getElementById(sliderConfig.valueId);

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const value = parseFloat(slider.value);
                    valueDisplay.textContent = `${value.toFixed(sliderConfig.decimals)}m`;

                    // Trigger axle calculation update
                    if (this.axleCalculator) {
                        this.updateAxleConfiguration();
                    }
                });
            }
        });

        // Initialize UI with saved vehicle type or default to 'standard'
        const savedVehicleType = this.currentVehicle; // Already loaded in constructor from localStorage

        // Find and select the appropriate option in dropdown
        const selectedOption = Array.from(options).find(opt => opt.dataset.value === savedVehicleType);
        if (selectedOption) {
            // Remove selection from all options first
            options.forEach(opt => opt.classList.remove('selected'));
            // Select the saved option
            selectedOption.classList.add('selected');

            // Update dropdown trigger display
            const name = selectedOption.querySelector('.option-name').textContent;
            const dimensions = selectedOption.querySelector('.option-dimensions').textContent;
            customSelectTrigger.querySelector('.option-name').textContent = name;
            customSelectTrigger.querySelector('.option-dimensions').textContent = dimensions;

            // Update hidden select
            vehicleSelect.value = savedVehicleType;

            // Show/hide appropriate dimension sliders
            if (savedVehicleType === 'custom') {
                customDimensions.classList.remove('hidden');
                soloDimensionSliders.classList.add('hidden');
                jumboDimensionSliders.classList.add('hidden');

                // Load saved Custom dimensions
                const savedDimensions = localStorage.getItem('customDimensions');
                if (savedDimensions) {
                    const dims = JSON.parse(savedDimensions);
                    customLengthSlider.value = dims.length;
                    customWidthSlider.value = dims.width;
                    customHeightSlider.value = dims.height;
                    customLengthValue.textContent = `${dims.length.toFixed(2)}m`;
                    customWidthValue.textContent = `${dims.width.toFixed(2)}m`;
                    customHeightValue.textContent = `${dims.height.toFixed(2)}m`;
                }
                this.loadCustomVehicle();
            } else if (savedVehicleType === 'solo') {
                customDimensions.classList.add('hidden');
                soloDimensionSliders.classList.remove('hidden');
                jumboDimensionSliders.classList.add('hidden');

                // Load saved SOLO dimensions
                const savedDimensions = localStorage.getItem('soloDimensions');
                if (savedDimensions) {
                    const dims = JSON.parse(savedDimensions);
                    soloLengthSlider.value = dims.length;
                    soloHeightSlider.value = dims.height;
                    soloLengthValue.textContent = `${dims.length.toFixed(2)}m`;
                    soloHeightValue.textContent = `${dims.height.toFixed(1)}m`;
                }
                this.loadVehicle(savedVehicleType);
            } else if (savedVehicleType === 'jumbo') {
                customDimensions.classList.add('hidden');
                soloDimensionSliders.classList.add('hidden');
                jumboDimensionSliders.classList.remove('hidden');

                // Load saved JUMBO dimensions
                const savedDimensions = localStorage.getItem('jumboDimensions');
                if (savedDimensions) {
                    try {
                        const dims = JSON.parse(savedDimensions);
                        if (dims && dims.section1 && dims.section2) {
                            jumboSection1LengthSlider.value = dims.section1.length;
                            jumboSection1HeightSlider.value = dims.section1.height;
                            jumboSection2LengthSlider.value = dims.section2.length;
                            jumboSection2HeightSlider.value = dims.section2.height;
                            jumboSection1LengthValue.textContent = `${dims.section1.length.toFixed(2)}m`;
                            jumboSection1HeightValue.textContent = `${dims.section1.height.toFixed(1)}m`;
                            jumboSection2LengthValue.textContent = `${dims.section2.length.toFixed(2)}m`;
                            jumboSection2HeightValue.textContent = `${dims.section2.height.toFixed(1)}m`;
                        }
                    } catch (e) {
                        console.log('Invalid JUMBO dimensions in localStorage, using defaults');
                    }
                }
                this.loadVehicle(savedVehicleType);
            } else {
                customDimensions.classList.add('hidden');
                soloDimensionSliders.classList.add('hidden');
                jumboDimensionSliders.classList.add('hidden');
                this.loadVehicle(savedVehicleType);
            }
        } else {
            // Fallback to default 'standard' if saved type not found
            options[0].classList.add('selected');
            this.currentVehicle = 'standard';
            this.loadVehicle('standard');
        }
    }
    
    loadVehicle(vehicleType, previousVehicleType = null) {
        let vehicle = CONFIG.vehicles[vehicleType];
        if (!vehicle) return;
        
        // If SOLO, check for saved dimensions
        if (vehicleType === 'solo') {
            const savedDimensions = localStorage.getItem('soloDimensions');
            if (savedDimensions) {
                const dims = JSON.parse(savedDimensions);
                // Create modified vehicle config with saved dimensions
                const rawRearAxlePosition = dims.length * (5.5 / 7.7);
                const rearAxlePosition = Math.round(rawRearAxlePosition * 10) / 10;
                
                vehicle = {
                    ...vehicle,
                    length: dims.length,
                    height: dims.height,
                    axles: {
                        ...vehicle.axles,
                        front: { ...vehicle.axles.front, position: -1.0 },
                        rear: { ...vehicle.axles.rear, position: rearAxlePosition }
                    }
                };
            }
        }
        
        // Check if we're switching from Coilmulde to non-Coilmulde
        const previousVehicle = previousVehicleType ? CONFIG.vehicles[previousVehicleType] : null;
        const switchingFromCoilmulde = previousVehicle && previousVehicle.hasGroove && !vehicle.hasGroove;
        
        // Remove all Steel Coils if switching to non-Coilmulde
        if (switchingFromCoilmulde) {
            const steelCoils = this.cargoManager.cargoItems.filter(item => item.isRoll);
            if (steelCoils.length > 0) {
                console.log(`Removing ${steelCoils.length} Steel Coils - not compatible with ${vehicle.name}`);
                steelCoils.forEach(coil => {
                    this.cargoManager.removeCargoUnit(coil.id);
                    // Update unit count
                    if (this.unitCounts['steel-coil']) {
                        this.unitCounts['steel-coil']--;
                        if (this.unitCounts['steel-coil'] <= 0) {
                            delete this.unitCounts['steel-coil'];
                        }
                    }
                });
                // Update UI to reflect removed Steel Coils
                this.updateLoadedUnitsList();
                this.updateStatistics();
                this.updateAxleIndicators();
                this.showNotification(i18n.t('steelCoilsRemovedCount').replace('{count}', steelCoils.length), 'warning');
            }
        }
        
        const containerDimensions = {
            length: vehicle.length,
            width: vehicle.width,
            height: vehicle.height
        };
        
        // Add SOLO flag if present
        if (vehicle.isSolo) {
            containerDimensions.isSolo = vehicle.isSolo;
        }
        
        // Store current vehicle config for modal
        this.currentVehicleConfig = vehicle;
        
        // Add JUMBO flag if present
        if (vehicle.isJumbo) {
            containerDimensions.isJumbo = vehicle.isJumbo;
        }
        
        // Add sections if it's a JUMBO
        if (vehicle.sections) {
            containerDimensions.sections = vehicle.sections;
        }
        
        // Add groove properties if it's a Coilmulde
        if (vehicle.hasGroove) {
            containerDimensions.hasGroove = vehicle.hasGroove;
            containerDimensions.grooveWidth = vehicle.grooveWidth;
            containerDimensions.grooveDepth = vehicle.grooveDepth;
            containerDimensions.grooveLength = vehicle.grooveLength;
            containerDimensions.grooveStartX = vehicle.grooveStartX;
        }
        
        // Update Steel Coil card based on vehicle type
        this.updateSteelCoilAvailability(vehicle.hasGroove);
        
        // First update axle configuration so it's available when creating container visualization
        this.axleCalculator.setVehicle(vehicle);
        
        this.cargoManager.setContainer(containerDimensions, vehicle.maxLoad);
        this.cargoManager.currentVehicleType = vehicleType;
        
        // For JUMBO, show actual cargo length without gap
        const displayLength = vehicle.isJumbo && vehicle.sections 
            ? vehicle.sections[0].length + vehicle.sections[1].length 
            : vehicle.length;
        
        document.getElementById('dimensionsInfo').textContent = `${displayLength} × ${vehicle.width} × ${vehicle.height} m`;
        const volume = vehicle.isJumbo && vehicle.sections
            ? (vehicle.sections[0].length * vehicle.sections[0].width * vehicle.sections[0].height + 
               vehicle.sections[1].length * vehicle.sections[1].width * vehicle.sections[1].height).toFixed(1)
            : (vehicle.length * vehicle.width * vehicle.height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        document.getElementById('maxLoadInput').value = (vehicle.maxLoad / 1000).toFixed(2);

        // Show axle load panel for standard vehicles
        const axleLoadPanel = document.querySelector('.axle-load-indicator');
        if (axleLoadPanel) {
            axleLoadPanel.style.display = '';
        }

        this.updateAxleIndicators();

        // Update 3D axle load visualization after vehicle change
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }

        // Auto arrange cargo if there are items
        if (this.cargoManager.cargoItems.length > 0) {
            this.autoArrangeCargo();
        }
    }

    updateSoloDimensions(length, height) {
        // Save SOLO dimensions to localStorage
        localStorage.setItem('soloDimensions', JSON.stringify({
            length: length,
            height: height
        }));
        
        // Update SOLO vehicle with new dimensions
        const vehicle = CONFIG.vehicles.solo;
        
        // Calculate proportional axle position adjustment
        // Original SOLO length is 7.7m with rear axle at 5.5m from cargo start
        // We need to maintain the proportion: rear axle should be at ~71.4% of cargo length
        const rawRearAxlePosition = length * (5.5 / 7.7); // Maintain same proportion
        // Round to nearest 0.1m
        const rearAxlePosition = Math.round(rawRearAxlePosition * 10) / 10;
        
        const updatedVehicle = {
            ...vehicle,
            length: length,
            height: height,
            axles: {
                ...vehicle.axles,
                front: { ...vehicle.axles.front, position: -1.0 }, // Front stays 1m before cargo
                rear: { ...vehicle.axles.rear, position: rearAxlePosition } // Adjust proportionally
            }
        };
        
        const containerDimensions = {
            length: length,
            width: vehicle.width,
            height: height,
            isSolo: true
        };
        
        // Update the scene and cargo manager
        this.cargoManager.setContainer(containerDimensions, vehicle.maxLoad);
        this.cargoManager.currentVehicleType = 'solo';
        
        // Update UI info
        document.getElementById('dimensionsInfo').textContent = `${length.toFixed(1)} × ${vehicle.width} × ${height.toFixed(1)} m`;
        const volume = (length * vehicle.width * height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        
        // Update dropdown display for SOLO
        const customSelect = document.getElementById('vehicleSelect');
        const customSelectTrigger = customSelect.querySelector('.custom-select-trigger');
        const soloOption = customSelect.querySelector('.custom-option[data-value="solo"]');
        
        if (soloOption) {
            const dimensionText = `${length.toFixed(1)}m × ${vehicle.width}m × ${height.toFixed(1)}m`;
            soloOption.querySelector('.option-dimensions').textContent = dimensionText;
            
            // If SOLO is currently selected, update the trigger display too
            if (this.currentVehicle === 'solo') {
                customSelectTrigger.querySelector('.option-dimensions').textContent = dimensionText;
            }
        }
        
        // Update axle configuration with new dimensions
        this.axleCalculator.setVehicle(updatedVehicle);
        console.log('Updated SOLO axle positions:', {
            length: length,
            rearAxlePosition: rearAxlePosition,
            distCargoStartToDrive: this.axleCalculator.axleConfig.distCargoStartToDrive
        });
        this.updateAxleIndicators();

        // Update 3D axle load visualization after SOLO dimensions change
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }

        // Auto arrange cargo if there are items
        if (this.cargoManager.cargoItems.length > 0) {
            this.autoArrangeCargo();
        }

        this.updateStatistics();
    }

    updateJumboDimensions(section1Length, section1Height, section2Length, section2Height) {
        // Save JUMBO dimensions to localStorage
        localStorage.setItem('jumboDimensions', JSON.stringify({
            section1: { length: section1Length, height: section1Height },
            section2: { length: section2Length, height: section2Height }
        }));
        
        // Update JUMBO vehicle with new dimensions
        const vehicle = CONFIG.vehicles.jumbo;
        
        // Calculate proportional axle position adjustments
        // For truck section (similar to SOLO)
        const truckRearAxlePosition = Math.round((section1Length * (5.5 / 7.7)) * 10) / 10;
        // For trailer section
        const trailerAxlePosition = Math.round((section2Length * (5.5 / 7.7)) * 10) / 10;
        
        const updatedVehicle = {
            ...vehicle,
            sections: [
                { length: section1Length, width: vehicle.width, height: section1Height },
                { length: section2Length, width: vehicle.width, height: section2Height }
            ],
            length: section1Length + 0.5 + section2Length, // 0.5m gap between sections
            height: Math.max(section1Height, section2Height), // Use max height for overall
            axles: {
                ...vehicle.axles,
                front: { ...vehicle.axles.front, position: -1.0 }, // Front stays 1m before section 1
                rear: { ...vehicle.axles.rear, position: truckRearAxlePosition }, // Adjust proportionally
                trailer: { ...vehicle.axles.trailer, position: trailerAxlePosition } // Adjust proportionally
            }
        };
        
        const containerDimensions = {
            length: updatedVehicle.length,
            width: vehicle.width,
            height: updatedVehicle.height,
            isJumbo: true,
            sections: updatedVehicle.sections
        };
        
        // Update the scene and cargo manager
        this.cargoManager.setContainer(containerDimensions, vehicle.maxLoad);
        this.cargoManager.currentVehicleType = 'jumbo';
        
        // Update UI info
        const totalLength = section1Length + section2Length; // Without gap
        document.getElementById('dimensionsInfo').textContent = `${totalLength.toFixed(1)} × ${vehicle.width} × ${updatedVehicle.height.toFixed(1)} m`;
        const volume = (section1Length * vehicle.width * section1Height + section2Length * vehicle.width * section2Height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        
        // Update dropdown display for JUMBO
        const customSelect = document.getElementById('vehicleSelect');
        const customSelectTrigger = customSelect.querySelector('.custom-select-trigger');
        const jumboOption = customSelect.querySelector('.custom-option[data-value="jumbo"]');
        
        if (jumboOption) {
            const dimensionText = `${totalLength.toFixed(1)}m × ${vehicle.width}m × ${updatedVehicle.height.toFixed(1)}m`;
            jumboOption.querySelector('.option-dimensions').textContent = dimensionText;
            
            // If JUMBO is currently selected, update the trigger display too
            if (this.currentVehicle === 'jumbo') {
                customSelectTrigger.querySelector('.option-dimensions').textContent = dimensionText;
            }
        }
        
        // Update axle configuration with new dimensions
        this.axleCalculator.setVehicle(updatedVehicle);
        console.log('Updated JUMBO axle positions:', {
            section1Length: section1Length,
            section2Length: section2Length,
            truckRearAxlePosition: truckRearAxlePosition,
            trailerAxlePosition: trailerAxlePosition
        });
        this.updateAxleIndicators();

        // Update 3D axle load visualization after JUMBO dimensions change
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }

        // Auto arrange cargo if there are items
        if (this.cargoManager.cargoItems.length > 0) {
            this.autoArrangeCargo();
        }

        this.updateStatistics();
    }

    updateCustomDimensions(length, width, height) {
        // Save Custom dimensions to localStorage
        localStorage.setItem('customDimensions', JSON.stringify({
            length: length,
            width: width,
            height: height
        }));

        const customVehicle = {
            name: 'Custom Dimensions',
            length: length,
            width: width,
            height: height,
            maxLoad: 24000,
            isCustomSpace: true
        };

        const containerDimensions = {
            length: length,
            width: width,
            height: height,
            isCustomSpace: true
        };

        // Update the scene and cargo manager
        this.cargoManager.setContainer(containerDimensions, customVehicle.maxLoad);
        this.cargoManager.currentVehicleType = 'custom';

        // Update UI info
        document.getElementById('dimensionsInfo').textContent = `${length.toFixed(2)} × ${width.toFixed(2)} × ${height.toFixed(2)} m`;
        const volume = (length * width * height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;

        // Update dropdown display for Custom
        const customSelect = document.getElementById('vehicleSelect');
        const customSelectTrigger = customSelect.querySelector('.custom-select-trigger');
        const customOption = customSelect.querySelector('.custom-option[data-value="custom"]');

        if (customOption) {
            const dimensionText = `${length.toFixed(1)}m × ${width.toFixed(2)}m × ${height.toFixed(1)}m`;
            customOption.querySelector('.option-dimensions').textContent = dimensionText;

            // If Custom is currently selected, update the trigger display too
            if (this.currentVehicle === 'custom') {
                customSelectTrigger.querySelector('.option-dimensions').textContent = dimensionText;
            }
        }

        // Store current vehicle config for modal
        this.currentVehicleConfig = customVehicle;

        this.updateStatistics();
    }

    loadCustomVehicle() {
        const length = parseFloat(document.getElementById('customLengthSlider').value);
        const width = parseFloat(document.getElementById('customWidthSlider').value);
        const height = parseFloat(document.getElementById('customHeightSlider').value);

        const customVehicle = {
            name: 'Custom Dimensions',
            length: length,
            width: width,
            height: height,
            maxLoad: 24000,
            isCustomSpace: true  // Flag to indicate this is a pure cargo space without truck/axles
        };

        // Store current vehicle config for modal
        this.currentVehicleConfig = customVehicle;

        // Update Steel Coil availability (custom vehicles don't have groove)
        this.updateSteelCoilAvailability(false);

        // Hide axle load panel for custom space
        const axleLoadPanel = document.querySelector('.axle-load-indicator');
        if (axleLoadPanel) {
            axleLoadPanel.style.display = 'none';
        }

        // Remove 3D axle load visualization if exists
        this.scene3d.removeAxleLoadVisualization();

        this.cargoManager.setContainer(
            { length: length, width: width, height: height, isCustomSpace: true },
            customVehicle.maxLoad
        );
        this.cargoManager.currentVehicleType = 'custom';

        document.getElementById('dimensionsInfo').textContent = `${length} × ${width} × ${height} m`;
        const volume = (length * width * height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        document.getElementById('maxLoadInput').value = (customVehicle.maxLoad / 1000).toFixed(2);

        // Auto arrange cargo if there are items
        if (this.cargoManager.cargoItems.length > 0) {
            this.autoArrangeCargo();
        }
    }
    
    updateSteelCoilAvailability(hasGroove) {
        const steelCoilCard = document.querySelector('.unit-preset-card[data-type="steel-coil"]');
        if (!steelCoilCard) return;
        
        const unitsContainer = document.querySelector('.cargo-units');
        if (!unitsContainer) return;
        
        if (hasGroove) {
            // Enable Steel Coil card
            steelCoilCard.classList.remove('disabled');
            steelCoilCard.removeAttribute('data-message');
            
            // Move Steel Coil card to the top of the list
            if (steelCoilCard.parentElement === unitsContainer) {
                // Remove the card from its current position
                steelCoilCard.remove();
                // Insert it as the first child of the container
                unitsContainer.insertBefore(steelCoilCard, unitsContainer.firstChild);
            }
        } else {
            // Disable Steel Coil card with message
            steelCoilCard.classList.add('disabled');
            steelCoilCard.setAttribute('data-message', 'Change trailer to Coilmulde type to add Steel Coils');
            
            // Move Steel Coil card back to its original position (after BigEuroPalet, before custom)
            if (steelCoilCard.parentElement === unitsContainer) {
                const bigEuroPallet = document.querySelector('.unit-preset-card[data-type="big-euro-pallet"]');
                const customBox = document.querySelector('.unit-preset-card[data-type="custom-box"]');
                
                // Remove the card from its current position
                steelCoilCard.remove();
                
                // Insert it between BigEuroPalet and Custom Box
                if (customBox) {
                    unitsContainer.insertBefore(steelCoilCard, customBox);
                } else if (bigEuroPallet && bigEuroPallet.nextSibling) {
                    unitsContainer.insertBefore(steelCoilCard, bigEuroPallet.nextSibling);
                } else {
                    // If neither found, just append at the end
                    unitsContainer.appendChild(steelCoilCard);
                }
            }
        }
    }

    setupDimensionButtons() {
        // Select all slider increment/decrement buttons
        const sliderButtons = document.querySelectorAll('.slider-btn');

        sliderButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Get the slider ID from data-slider attribute
                const sliderId = button.dataset.slider;
                const slider = document.getElementById(sliderId);

                if (!slider) return;

                // Get current value and step
                const currentValue = parseFloat(slider.value);
                const step = parseFloat(slider.step) || 0.05;
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);

                // Determine if this is increment (+) or decrement (-) button
                const isIncrement = button.textContent.trim() === '+';

                // Calculate new value
                let newValue = isIncrement ? currentValue + step : currentValue - step;

                // Clamp to min/max bounds
                newValue = Math.max(min, Math.min(max, newValue));

                // Round to avoid floating point precision issues
                newValue = Math.round(newValue * 100) / 100;

                // Update slider value
                slider.value = newValue;

                // Trigger 'input' event to activate existing handlers
                slider.dispatchEvent(new Event('input'));
            });
        });
    }

    setupCargoUnits() {
        const presetCards = document.querySelectorAll('.unit-preset-card');
        
        presetCards.forEach(card => {
            const unitType = card.dataset.type;
            
            // Initialize unit count
            this.unitCounts[unitType] = 0;
            
            // Auto-select text on focus for all input fields in the card
            const allInputs = card.querySelectorAll('input[type="number"], input[type="text"]');
            allInputs.forEach(input => {
                input.addEventListener('focus', (e) => {
                    e.target.select();
                });
                input.addEventListener('click', (e) => {
                    e.target.select();
                });
            });
            
            // Setup orientation switch for Roll
            if (unitType === 'roll') {
                const orientationToggleBtn = card.querySelector('.orientation-toggle-btn');
                const orientationSwitch = card.querySelector('.orientation-switch');
                
                if (orientationToggleBtn) {
                    orientationToggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Toggle orientation
                        const currentOrientation = orientationToggleBtn.dataset.orientation;
                        const newOrientation = currentOrientation === 'vertical' ? 'horizontal' : 'vertical';
                        
                        // Update button
                        orientationToggleBtn.dataset.orientation = newOrientation;
                        orientationToggleBtn.textContent = newOrientation === 'vertical' ? `⬆ ${i18n.t('vertical')}` : `➡ ${i18n.t('horizontal')}`;
                        
                        // Update hidden switch data attribute
                        if (orientationSwitch) {
                            orientationSwitch.dataset.orientation = newOrientation;
                        }
                    });
                }
            }
            
            // Setup weight mode switch
            const weightModeSwitch = card.querySelector('.weight-mode-switch');
            const weightLabelText = card.querySelector('.weight-label-text');
            
            if (weightModeSwitch && weightLabelText) {
                weightModeSwitch.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isActive = !weightModeSwitch.classList.contains('active');
                    const mode = isActive ? 'total' : 'single';
                    
                    // Update all switches in all forms
                    document.querySelectorAll('.weight-mode-switch').forEach(switchEl => {
                        if (isActive) {
                            switchEl.classList.add('active');
                        } else {
                            switchEl.classList.remove('active');
                        }
                        switchEl.dataset.mode = mode;
                    });
                    
                    // Update all labels in all forms
                    document.querySelectorAll('.weight-label-text').forEach(labelEl => {
                        labelEl.textContent = isActive ? i18n.t('totalWeightAllUnits') : i18n.t('weightPerUnit');
                    });
                });
            }
            
            // Setup weight kg/ton synchronization and max stack weight calculation
            const weightKgInput = card.querySelector('.unit-preset-weight-kg');
            const weightTInput = card.querySelector('.unit-preset-weight-t');
            const stackInput = card.querySelector('.unit-preset-stack');
            const maxWeightInput = card.querySelector('.unit-preset-max-weight');
            
            if (weightKgInput && weightTInput) {
                // Prevent decimal input in kg field
                weightKgInput.addEventListener('keydown', (e) => {
                    // Allow backspace, delete, tab, escape, enter, arrows
                    if ([8, 9, 27, 13, 37, 38, 39, 40, 46].indexOf(e.keyCode) !== -1 ||
                        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                        (e.keyCode === 65 && e.ctrlKey === true) ||
                        (e.keyCode === 67 && e.ctrlKey === true) ||
                        (e.keyCode === 86 && e.ctrlKey === true) ||
                        (e.keyCode === 88 && e.ctrlKey === true)) {
                        return;
                    }
                    // Block decimal point and comma
                    if (e.key === '.' || e.key === ',') {
                        e.preventDefault();
                        return;
                    }
                    // Ensure it's a number
                    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                        e.preventDefault();
                    }
                });
                
                weightKgInput.addEventListener('input', (e) => {
                    // Remove any non-numeric characters
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    const kg = parseInt(value) || 0;
                    
                    if (e.target.value !== value) {
                        e.target.value = value;
                    }
                    
                    weightTInput.value = (kg / 1000).toFixed(2);
                    
                    // Auto-calculate max stack weight
                    if (stackInput && maxWeightInput) {
                        const stackCount = parseInt(stackInput.value) || 0;
                        maxWeightInput.value = Math.round(kg * stackCount);
                    }
                });
                
                // Limit tons field to 2 decimal places
                weightTInput.addEventListener('keydown', (e) => {
                    const value = e.target.value;
                    const cursorPos = e.target.selectionStart;
                    
                    // Allow control keys
                    if ([8, 9, 27, 13, 37, 38, 39, 40, 46].indexOf(e.keyCode) !== -1 ||
                        (e.keyCode === 65 && e.ctrlKey === true) ||
                        (e.keyCode === 67 && e.ctrlKey === true) ||
                        (e.keyCode === 86 && e.ctrlKey === true) ||
                        (e.keyCode === 88 && e.ctrlKey === true)) {
                        return;
                    }
                    
                    // Check if there's already a decimal point
                    const decimalIndex = value.indexOf('.');
                    if (decimalIndex !== -1) {
                        const decimalsAfter = value.substring(decimalIndex + 1);
                        // If we have 2 decimals and cursor is after decimal point, block input
                        if (decimalsAfter.length >= 2 && cursorPos > decimalIndex && e.keyCode >= 48 && e.keyCode <= 57) {
                            e.preventDefault();
                            return;
                        }
                    }
                });
                
                weightTInput.addEventListener('input', (e) => {
                    let value = e.target.value;
                    
                    // Limit to 2 decimal places
                    const decimalIndex = value.indexOf('.');
                    if (decimalIndex !== -1) {
                        const decimals = value.substring(decimalIndex + 1);
                        if (decimals.length > 2) {
                            value = value.substring(0, decimalIndex + 3);
                            e.target.value = value;
                        }
                    }
                    
                    const tons = parseFloat(value) || 0;
                    const kg = Math.round(tons * 1000);
                    weightKgInput.value = kg;
                    
                    // Auto-calculate max stack weight
                    if (stackInput && maxWeightInput) {
                        const stackCount = parseInt(stackInput.value) || 0;
                        maxWeightInput.value = Math.round(kg * stackCount);
                    }
                });
            }
            
            // Update max weight when stack count changes
            if (stackInput && maxWeightInput && weightKgInput) {
                stackInput.addEventListener('input', (e) => {
                    const stackCount = parseInt(e.target.value) || 0;
                    const kg = parseInt(weightKgInput.value) || 0;
                    maxWeightInput.value = Math.round(kg * stackCount);
                });
            }
            
            // Setup custom dimensions for custom-box
            if (unitType === 'custom-box') {
                const lengthInput = card.querySelector('.unit-preset-length');
                const widthInput = card.querySelector('.unit-preset-width');
                const heightInput = card.querySelector('.unit-preset-height');
                
                [lengthInput, widthInput, heightInput].forEach(input => {
                    if (input) {
                        input.addEventListener('input', () => {
                            // Validate dimensions when changed
                            const l = parseFloat(lengthInput.value);
                            const w = parseFloat(widthInput.value);
                            const h = parseFloat(heightInput.value);
                            
                            // Enable/disable add buttons based on valid dimensions
                            const addButtons = card.querySelectorAll('.btn-preset-add');
                            const hasValidDims = l > 0 && w > 0 && h > 0;
                            addButtons.forEach(btn => {
                                btn.disabled = !hasValidDims;
                            });
                        });
                    }
                });
            }
            
            // Setup method selection texts
            const methodTexts = card.querySelectorAll('.method-text');
            methodTexts.forEach(text => {
                text.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    text.classList.toggle('active');
                });
            });
            
            // Setup add buttons with different amounts
            const addButtons = card.querySelectorAll('.btn-preset-add');
            addButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const amount = parseInt(btn.dataset.amount) || 1;
                    
                    // Get all parameters from the preset card
                    const params = this.getPresetParameters(card, amount);
                    
                    // Validate dimensions - for all types, not just custom-box
                    if (!params.dimensions || params.dimensions.length <= 0 || params.dimensions.width <= 0 || params.dimensions.height <= 0) {
                        this.showNotification(i18n.t('enterValidDimensions'), 'error');
                        return;
                    }
                    
                    // Add specified amount of units
                    let addedCount = 0;
                    let newGroupId = null;
                    for (let i = 0; i < amount; i++) {
                        const cargo = this.addCargoUnitWithParams(unitType, params);
                        if (cargo) {
                            addedCount++;
                            if (!newGroupId && cargo.groupId) {
                                newGroupId = cargo.groupId;
                            }
                            this.unitCounts[unitType] = (this.unitCounts[unitType] || 0) + 1;
                        }
                    }
                    
                    if (addedCount > 0) {
                        // Auto-arrange only the new group if total items <= 50 for performance
                        const result = (this.cargoManager.cargoItems.length <= 50 && newGroupId) 
                            ? this.cargoManager.autoArrangeGroup(newGroupId)
                            : this.cargoManager.autoArrange();
                        
                        if (result && !result.success) {
                            // Some items didn't fit or exceeded weight limit
                            const messages = [];
                            if (result.unpackedCount > 0) {
                                messages.push(`${result.unpackedCount} units did not fit in the space`);
                            }
                            if (result.exceedingWeightCount > 0) {
                                messages.push(`${result.exceedingWeightCount} units exceeded weight limit`);
                            }
                            if (messages.length > 0) {
                                this.showNotification(`${messages.join(` ${i18n.t('and')} `)} - ${i18n.t('placedOutside')}`, 'warning');
                            }
                            
                            // Update unit counts after removal
                            this.unitCounts = {};
                            this.cargoManager.cargoItems.forEach(item => {
                                this.unitCounts[item.type] = (this.unitCounts[item.type] || 0) + 1;
                            });
                        } else if (this.cargoManager.cargoItems.length > 50) {
                            // For performance, show message for manual arrangement when many items
                            this.showNotification(i18n.t('forLargeNumberUseArrange'), 'info');
                        }
                        
                        this.updateLoadedUnitsList();
                        this.updateStatistics();
                        this.updateAxleIndicators();
                        // Update 3D axle load visualization after auto-arrange
                        if (this.scene3d.showAxleLoads) {
                            this.scene3d.updateAxleLoadVisualization();
                        }
                    }
                });
            });
            
            // Setup custom add button
            const customAddBtn = card.querySelector('.btn-preset-add-custom');
            const customAddInput = card.querySelector('.custom-add-input');
            
            if (customAddBtn && customAddInput) {
                // Function to add units
                const addUnits = () => {
                    const amount = parseInt(customAddInput.value) || 1;
                    
                    // Get all parameters from the preset card
                    const params = this.getPresetParameters(card, amount);
                    
                    // Validate dimensions - for all types, not just custom-box
                    if (!params.dimensions || params.dimensions.length <= 0 || params.dimensions.width <= 0 || params.dimensions.height <= 0) {
                        this.showNotification(i18n.t('enterValidDimensions'), 'error');
                        return;
                    }
                    
                    // Add specified amount of units
                    let addedCount = 0;
                    let newGroupId = null;
                    for (let i = 0; i < amount; i++) {
                        const cargo = this.addCargoUnitWithParams(unitType, params);
                        if (cargo) {
                            addedCount++;
                            if (!newGroupId && cargo.groupId) {
                                newGroupId = cargo.groupId;
                            }
                            this.unitCounts[unitType] = (this.unitCounts[unitType] || 0) + 1;
                        }
                    }
                    
                    if (addedCount > 0) {
                        // Auto-arrange only the new group if total items <= 50 for performance
                        const result = (this.cargoManager.cargoItems.length <= 50 && newGroupId) 
                            ? this.cargoManager.autoArrangeGroup(newGroupId)
                            : this.cargoManager.autoArrange();
                        
                        if (result && !result.success) {
                            // Some items didn't fit or exceeded weight limit
                            const messages = [];
                            if (result.unpackedCount > 0) {
                                messages.push(`${result.unpackedCount} units did not fit in the space`);
                            }
                            if (result.exceedingWeightCount > 0) {
                                messages.push(`${result.exceedingWeightCount} units exceeded weight limit`);
                            }
                            if (messages.length > 0) {
                                this.showNotification(`${messages.join(` ${i18n.t('and')} `)} - ${i18n.t('placedOutside')}`, 'warning');
                            }
                            
                            // Update unit counts after removal
                            this.unitCounts = {};
                            this.cargoManager.cargoItems.forEach(item => {
                                this.unitCounts[item.type] = (this.unitCounts[item.type] || 0) + 1;
                            });
                        } else if (this.cargoManager.cargoItems.length > 50) {
                            // For performance, show message for manual arrangement when many items
                            this.showNotification(i18n.t('forLargeNumberUseArrange'), 'info');
                        }
                        
                        this.updateLoadedUnitsList();
                        this.updateStatistics();
                        this.updateAxleIndicators();
                        // Update 3D axle load visualization after auto-arrange
                        if (this.scene3d.showAxleLoads) {
                            this.scene3d.updateAxleLoadVisualization();
                        }
                    }
                    
                    // Clear input after adding
                    customAddInput.value = '';
                };
                
                // Prevent input click from triggering button
                customAddInput.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                // Handle Enter key in input
                customAddInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        addUnits();
                    }
                });
                
                // Handle button click
                customAddBtn.addEventListener('click', (e) => {
                    // If clicking on input, don't trigger add
                    if (e.target === customAddInput) {
                        return;
                    }
                    
                    e.stopPropagation();
                    addUnits();
                });
            }
        });
        
        // Also keep support for old unit cards if any exist
        this.setupLegacyCargoUnits();
    }
    
    getPresetParameters(card, amount = 1) {
        const unitType = card.dataset.type;
        const nameInput = card.querySelector('.unit-preset-name');
        const weightInput = card.querySelector('.unit-preset-weight-kg');
        const stackInput = card.querySelector('.unit-preset-stack');
        const maxWeightInput = card.querySelector('.unit-preset-max-weight');
        
        // Check weight mode switch
        const weightModeSwitch = card.querySelector('.weight-mode-switch');
        const isWeightTotal = weightModeSwitch && weightModeSwitch.classList.contains('active');
        
        // Calculate weight per unit based on mode
        let weightPerUnit = parseFloat(weightInput?.value || 100);
        if (isWeightTotal && amount > 1) {
            // If weight mode is "total", divide by amount to get weight per unit
            weightPerUnit = weightPerUnit / amount;
        }
        
        // Handle Roll type with diameter and height
        if (unitType === 'roll') {
            // For Roll, use the same classes but they represent diameter and height
            const diameterInput = card.querySelector('.unit-preset-length[data-dimension="diameter"], .unit-preset-diameter');
            const rollHeightInput = card.querySelector('.unit-preset-width[data-dimension="height"], .unit-preset-roll-height');
            
            // Get orientation
            const orientationSwitch = card.querySelector('.orientation-switch');
            const isVertical = !orientationSwitch || orientationSwitch.dataset.orientation === 'vertical';
            
            let dimensions = null;
            if (diameterInput && rollHeightInput) {
                const diameter = parseFloat(diameterInput.value);
                const height = parseFloat(rollHeightInput.value);
                if (diameter > 0 && height > 0) {
                    if (isVertical) {
                        // Vertical orientation - diameter as base, height as height
                        dimensions = {
                            length: diameter / 100,  // Store diameter as length
                            width: diameter / 100,   // Store diameter as width
                            height: height / 100     // Store height
                        };
                    } else {
                        // Horizontal orientation - height as length, diameter as width/height
                        dimensions = {
                            length: height / 100,    // Length along X axis
                            width: diameter / 100,   // Width (diameter)
                            height: diameter / 100   // Height (diameter)
                        };
                    }
                }
            }
            
            // Get loading and unloading methods
            const loadingMethods = [];
            card.querySelectorAll('.method-text[data-type="loading"].active').forEach(text => {
                loadingMethods.push(text.dataset.method);
            });
            const unloadingMethods = [];
            card.querySelectorAll('.method-text[data-type="unloading"].active').forEach(text => {
                unloadingMethods.push(text.dataset.method);
            });
            
            return {
                name: nameInput ? nameInput.value : 'Roll',
                weight: weightPerUnit,
                maxStack: parseInt(stackInput?.value || 0),
                maxStackWeight: parseFloat(maxWeightInput?.value || 0),
                loadingMethods: loadingMethods.length > 0 ? loadingMethods : ['rear', 'side', 'top'],
                unloadingMethods: unloadingMethods.length > 0 ? unloadingMethods : ['rear', 'side', 'top'],
                dimensions: dimensions,
                isVerticalRoll: isVertical,  // Flag for orientation
                isHorizontalRoll: !isVertical  // Flag for horizontal orientation
            };
        }
        
        // Regular handling for other types
        const lengthInput = card.querySelector('.unit-preset-length');
        const widthInput = card.querySelector('.unit-preset-width');
        const heightInput = card.querySelector('.unit-preset-height');
        
        // Get loading and unloading methods
        const loadingMethods = [];
        card.querySelectorAll('.method-text[data-type="loading"].active').forEach(text => {
            loadingMethods.push(text.dataset.method);
        });
        const unloadingMethods = [];
        card.querySelectorAll('.method-text[data-type="unloading"].active').forEach(text => {
            unloadingMethods.push(text.dataset.method);
        });
        
        // ZAWSZE pobieraj wymiary z pól input, nie tylko dla custom-box
        let dimensions = null;
        if (lengthInput && widthInput && heightInput) {
            const l = parseFloat(lengthInput.value);
            const w = parseFloat(widthInput.value);
            const h = parseFloat(heightInput.value);
            if (l > 0 && w > 0 && h > 0) {
                dimensions = { 
                    length: l / 100,  // Convert cm to meters
                    width: w / 100, 
                    height: h / 100 
                };
            }
        }
        
        return {
            name: nameInput ? nameInput.value : CONFIG.cargoUnits[unitType]?.name || 'Custom',
            weight: weightPerUnit,
            maxStack: parseInt(stackInput?.value || 3),
            maxStackWeight: parseFloat(maxWeightInput?.value || 2000),
            loadingMethods: loadingMethods.length > 0 ? loadingMethods : ['rear', 'side', 'top'],
            unloadingMethods: unloadingMethods.length > 0 ? unloadingMethods : ['rear', 'side', 'top'],
            dimensions: dimensions,  // Zawsze przekazuj wymiary z pól input
            // Pass through additional properties from config for special units like Steel Coil
            isRoll: CONFIG.cargoUnits[unitType]?.isRoll,
            fixedDiameter: CONFIG.cargoUnits[unitType]?.fixedDiameter
        };
    }
    
    addCargoUnitWithParams(unitType, params) {
        // Create a unique identifier for grouping based on all parameters INCLUDING dimensions
        let dimensionKey = '';
        if (params.dimensions) {
            dimensionKey = `_${params.dimensions.length}_${params.dimensions.width}_${params.dimensions.height}`;
        }
        // Add orientation to groupKey for rolls
        let orientationKey = '';
        if (unitType === 'roll' && params.isVerticalRoll !== undefined) {
            orientationKey = `_${params.isVerticalRoll ? 'vertical' : 'horizontal'}`;
        }
        const groupKey = `${unitType}_${params.name}_${params.weight}_${params.maxStack}_${params.maxStackWeight}_${params.loadingMethods.join(',')}_${params.unloadingMethods.join(',')}${dimensionKey}${orientationKey}`;
        
        // Pass all parameters including name to the cargo manager
        const cargo = this.cargoManager.addCargoUnit(unitType, {
            ...params,
            groupKey: groupKey
        });
        
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
        return cargo;
    }
    
    setupLegacyCargoUnits() {
        // Support for old unit cards if they still exist
        const unitCards = document.querySelectorAll('.unit-card');
        
        unitCards.forEach(card => {
            const unitType = card.dataset.type;
            const header = card.querySelector('.unit-header');
            const addBtn = card.querySelector('.btn-add-unit');
            const removeBtn = card.querySelector('.btn-remove-unit');
            const countSpan = card.querySelector('.unit-count');
            
            if (!this.unitCounts[unitType]) {
                this.unitCounts[unitType] = 0;
            }
            
            // Toggle card expansion on header click
            if (header) {
                header.addEventListener('click', (e) => {
                    if (!e.target.closest('.unit-controls')) {
                        card.classList.toggle('expanded');
                    }
                });
            }
            
            // Legacy add/remove button handlers...
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Legacy handler code...
                });
            }
            
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Legacy handler code...
                });
            }
        });
    }
    
    
    addCargoUnit(unitType) {
        const params = this.unitParameters[unitType] || {
            weight: 100,
            maxStack: 3,
            maxStackWeight: 2000,
            loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
            priority: 5
        };
        const cargo = this.cargoManager.addCargoUnit(unitType, params);
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
        return cargo;
    }
    
    setupControlButtons() {
        document.getElementById('autoArrange').addEventListener('click', () => {
            this.autoArrangeCargo();
        });
        
        document.getElementById('clearSpace').addEventListener('click', () => {
            // Clear all cargo data
            this.cargoManager.cargoItems = [];
            this.cargoManager.totalWeight = 0;
            this.cargoManager.colorIndex = 0;
            this.cargoManager.selectedGroupId = null;
            this.scene3d.clearAllCargo();

            // Force axle calculator to recalculate with empty cargo
            this.axleCalculator.updateCargo([]);

            // Update UI
            this.updateLoadedUnitsList();
            this.updateStatistics();
            this.updateAxleIndicators();

            // Reset unit counts in left panel
            document.querySelectorAll('.unit-count').forEach(countSpan => {
                countSpan.textContent = '0';
            });

            // Update 3D axle load visualization
            if (this.scene3d.showAxleLoads) {
                this.scene3d.updateAxleLoadVisualization();
            }
        });
        
        document.getElementById('exportPNG').addEventListener('click', () => {
            this.exportToPDF();
        });
        
        document.getElementById('saveConfig').addEventListener('click', () => {
            this.saveConfiguration();
        });
        
        document.getElementById('loadConfig').addEventListener('click', () => {
            this.loadConfiguration();
        });
        
        document.getElementById('exportPDF2').addEventListener('click', () => {
            this.exportToPDF();
        });
        
        // Config name input
        const configNameInput = document.getElementById('currentConfigName');
        if (configNameInput) {
            // Check name on input
            configNameInput.addEventListener('input', (e) => {
                const name = e.target.value.trim();
                this.checkConfigNameExists(name);
            });
            
            // Handle Enter key - save config
            configNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.quickSave();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    configNameInput.blur();
                }
            });
            
            // Focus behavior - select all text
            configNameInput.addEventListener('focus', (e) => {
                e.target.select();
            });
            
            // Blur behavior - restore current name if empty
            configNameInput.addEventListener('blur', (e) => {
                if (!e.target.value.trim() && this.currentConfigName) {
                    e.target.value = this.currentConfigName;
                    this.checkConfigNameExists(this.currentConfigName);
                }
            });
        }
        
        // Quick save button
        const quickSaveBtn = document.getElementById('quickSaveBtn');
        if (quickSaveBtn) {
            quickSaveBtn.addEventListener('click', () => {
                this.quickSave();
            });
        }
        
        // Quick save and download button
        const quickSaveDownloadBtn = document.getElementById('quickSaveDownloadBtn');
        if (quickSaveDownloadBtn) {
            quickSaveDownloadBtn.addEventListener('click', () => {
                this.quickSaveAndDownload();
            });
        }
    }
    
    setupViewControls() {
        const viewButtons = document.querySelectorAll('.view-btn');
        
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.scene3d.setView(btn.dataset.view);
            });
        });
        
        viewButtons[0].classList.add('active');
    }
    
    setupModalHandlers() {
        window.closeCustomUnitModal = () => {
            document.getElementById('customUnitModal').classList.add('hidden');
        };
        
        window.addCustomUnit = () => {
            const name = document.getElementById('customUnitName').value || 'Własna jednostka';
            const length = parseFloat(document.getElementById('customUnitLength').value) / 100;
            const width = parseFloat(document.getElementById('customUnitWidth').value) / 100;
            const height = parseFloat(document.getElementById('customUnitHeight').value) / 100;
            
            const customUnit = {
                name: name,
                length: length,
                width: width,
                height: height,
                defaultWeight: 100,
                maxStack: 3,
                loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
                color: 0x4B0082
            };
            
            const cargo = this.cargoManager.addCargoUnit('custom', {
                ...customUnit,
                weight: customUnit.defaultWeight,
                maxStack: customUnit.maxStack,
                loadingMethods: ['rear', 'side', 'top'],
                unloadingMethods: ['rear', 'side', 'top']
            });
            this.updateLoadedUnitsList();
            this.updateStatistics();
            
            document.getElementById('customUnitModal').classList.add('hidden');
        };
    }
    
    showCustomUnitModal() {
        document.getElementById('customUnitModal').classList.remove('hidden');
    }
    
    autoArrangeCargo() {
        const result = this.cargoManager.autoArrange();
        
        if (!result) {
            this.showNotification(i18n.t('cannotArrangeCargo'), 'error');
            return;
        }
        
        this.updateStatistics();
        this.updateAxleIndicators();
        this.updateLoadedUnitsList();
        
        // Update 3D axle load visualization after auto-arrange
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }
        
        if (result.success) {
            this.showNotification(i18n.t('cargoArrangedAutomatically'), 'success');
        } else {
            const messages = [];
            if (result.unpackedCount > 0) {
                messages.push(`${result.unpackedCount} units did not fit`);
            }
            if (result.exceedingWeightCount > 0) {
                messages.push(`${result.exceedingWeightCount} units exceeded weight limit`);
            }
            if (messages.length > 0) {
                this.showNotification(i18n.t('warningPlacedOutside').replace('{items}', messages.join(` ${i18n.t('and')} `)), 'warning');
            }
            // Update unit counts after removal
            this.unitCounts = {};
            this.cargoManager.cargoItems.forEach(item => {
                if (!this.unitCounts[item.type]) {
                    this.unitCounts[item.type] = 0;
                }
                this.unitCounts[item.type]++;
            });
            // Update UI counts
            document.querySelectorAll('.unit-card').forEach(card => {
                const type = card.dataset.type;
                const countSpan = card.querySelector('.unit-count');
                if (countSpan) {
                    countSpan.textContent = this.unitCounts[type] || 0;
                }
                const removeBtn = card.querySelector('.btn-remove-unit');
                if (removeBtn) {
                    removeBtn.disabled = !this.unitCounts[type] || this.unitCounts[type] === 0;
                }
            });
        }
    }
    
    formatAccessMethods(methods) {
        if (!methods || methods.length === 0) return 'None';
        const methodNames = {
            'rear': 'Back',
            'side': 'Side',
            'top': 'Top'
        };
        return methods.map(m => methodNames[m] || m).join(', ');
    }
    
    createDimensionInputs(group) {
        const sample = group.sample;
        const groupId = group.groupId;
        
        if (sample.type === 'steel-coil') {
            // Steel Coil: only length is editable (diameter fixed at 180cm)
            return `<input type="number" class="dimension-input-compact edit-dimension-length" 
                           value="${Math.round(sample.length * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="length"
                           min="50" max="1360" step="1"
                           maxlength="4"
                           title="Length (cm)" />×180×180 <span class="dimension-unit-small">cm</span>`;
        } else if (sample.type === 'roll' && !sample.fixedDiameter) {
            // Roll: diameter and height are editable
            return `<input type="number" class="dimension-input-compact edit-dimension-diameter" 
                           value="${Math.round((sample.diameter || sample.width) * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="diameter"
                           min="10" max="1360" step="1"
                           maxlength="4"
                           title="Średnica (cm)" />×<input type="number" class="dimension-input-compact edit-dimension-height" 
                           value="${Math.round(sample.height * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="height"
                           min="10" max="300" step="1"
                           maxlength="3"
                           title="Height (cm)" /> <span class="dimension-unit-small">cm</span>`;
        } else {
            // Regular units: all dimensions editable - keep original display format
            return `<input type="number" class="dimension-input-compact edit-dimension-length" 
                           value="${Math.round(sample.length * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="length"
                           min="1" max="1360" step="1"
                           maxlength="4"
                           title="Length (cm)" />×<input type="number" class="dimension-input-compact edit-dimension-width" 
                           value="${Math.round(sample.width * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="width"
                           min="1" max="1360" step="1"
                           maxlength="4"
                           title="Width (cm)" />×<input type="number" class="dimension-input-compact edit-dimension-height" 
                           value="${Math.round(sample.height * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="height"
                           min="1" max="300" step="1"
                           maxlength="3"
                           title="Height (cm)" /> <span class="dimension-unit-small">cm</span>`;
        }
    }
    
    formatAccessMethodsWithColor(methods, groupId = null, type = null) {
        const allMethods = ['rear', 'side', 'top'];
        const methodNames = {
            'rear': i18n.t('back'),
            'side': i18n.t('side'),
            'top': i18n.t('top')
        };

        return allMethods.map(m => {
            const isActive = methods && methods.includes(m);
            const className = isActive ? 'active' : '';
            const dataAttrs = groupId ? `data-group-id="${groupId}" data-method="${m}" data-type="${type}"` : '';
            const editClass = groupId ? 'editable-method' : '';
            return `<span class="method-text ${className} ${editClass}" ${dataAttrs}>${methodNames[m]}</span>`;
        }).join('');
    }
    
    updateLoadedUnitsList() {
        const container = document.getElementById('loadedUnits');
        
        // Remove old event listeners to prevent duplicates
        const newContainer = container.cloneNode(false);
        container.parentNode.replaceChild(newContainer, container);
        const freshContainer = document.getElementById('loadedUnits');
        
        // Group items by groupId (respecting separate groups)
        const groupedItems = {};
        this.cargoManager.cargoItems.forEach(item => {
            // Use groupId for grouping
            const key = item.groupId;
            
            if (!groupedItems[key]) {
                groupedItems[key] = {
                    groupId: key,
                    items: [],
                    sample: item, // Store first item as sample for display
                    color: item.color // Store group color
                };
            }
            groupedItems[key].items.push(item);
        });
        
        // Sort groups by first item's orderIndex to maintain order
        const sortedGroups = Object.values(groupedItems).sort((a, b) => {
            const minOrderA = Math.min(...a.items.map(item => item.orderIndex));
            const minOrderB = Math.min(...b.items.map(item => item.orderIndex));
            return minOrderA - minOrderB;
        });
        
        // Create placeholder element for visual feedback
        this.dragPlaceholder = document.createElement('div');
        this.dragPlaceholder.className = 'drag-placeholder';
        this.dragPlaceholder.style.display = 'none';
        
        // Store sorted groups for drag and drop
        this.sortedGroups = sortedGroups;
        
        // Add container level listeners
        freshContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
        freshContainer.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Display grouped items
        sortedGroups.forEach((group, index) => {
            const element = document.createElement('div');
            element.className = 'loaded-unit-group';
            element.draggable = true;
            element.dataset.groupId = group.groupId;
            element.dataset.groupIndex = index;
            
            // Add selected class if this group is selected
            if (this.cargoManager.isGroupSelected(group.groupId)) {
                element.classList.add('selected-group');
            }
            
            // Count items inside and outside the container
            const itemsInside = group.items.filter(item => !item.isOutside).length;
            const itemsOutside = group.items.filter(item => item.isOutside).length;
            
            // Calculate metrics only for items inside the container
            const itemsInsideList = group.items.filter(item => !item.isOutside);
            const totalWeight = itemsInsideList.reduce((sum, item) => sum + item.weight, 0);
            const unitVolume = group.sample.length * group.sample.width * group.sample.height;
            const totalVolume = unitVolume * itemsInsideList.length;
            
            // Calculate floor area (M²) and LDM for ground units only (inside container)
            const trailerHeight = this.cargoManager.containerDimensions?.trailerHeight || 1.2;
            const groundItems = group.items.filter(item => {
                // Skip items outside container
                if (item.isOutside) return false;
                
                // Check if item has position and is on ground level (trailer floor or coil well)
                // Item is on ground if its bottom is at trailer height
                // Steel Coils in coil well are 0.3m lower due to the groove
                let expectedGroundY = trailerHeight + item.height/2;
                
                // Steel Coils in Coilmulde are placed in the groove which is 0.3m deep
                if (item.type === 'steel-coil' && this.cargoManager.containerDimensions?.hasGroove) {
                    expectedGroundY = trailerHeight - 0.3 + item.height/2;
                }
                
                return item.position && Math.abs(item.position.y - expectedGroundY) < 0.1;
            });
            // Calculate floor area - handle both regular items and cylinders (Steel Coil, Roll)
            let floorArea;
            
            if (group.sample.type === 'steel-coil' || (group.sample.type === 'roll' && !group.sample.isHorizontal)) {
                // For cylinders use circular area
                // Steel Coil stores diameter as width, Roll has diameter property
                const diameter = group.sample.diameter || group.sample.width || 1.8;
                const radius = diameter / 2;
                floorArea = groundItems.length * Math.PI * radius * radius;
            } else if (group.sample.type === 'roll' && group.sample.isHorizontal) {
                // Horizontal roll uses rectangular footprint
                floorArea = groundItems.length * (group.sample.diameter || 0.8) * (group.sample.rollHeight || 1.2);
            } else {
                // Regular rectangular items
                floorArea = groundItems.length * group.sample.length * group.sample.width;
            }
            
            // Calculate LDM - Loading Meter
            const containerWidth = this.cargoManager.containerDimensions ? 
                Math.floor(this.cargoManager.containerDimensions.width * 10) / 10 : 2.4; // Default 2.4m if no container
            const ldm = groundItems.reduce((sum, item) => {
                if (item.type === 'steel-coil' || (item.type === 'roll' && !item.isHorizontal)) {
                    // For cylinders, use circular area (π × r²) divided by container width
                    // Steel Coil stores diameter as width, Roll has diameter property
                    const diameter = item.diameter || item.width || 1.8;
                    const radius = diameter / 2;
                    return sum + (Math.PI * radius * radius) / containerWidth;
                } else if (item.type === 'roll' && item.isHorizontal) {
                    // Horizontal roll
                    return sum + ((item.diameter || 0.8) * (item.rollHeight || 1.2)) / containerWidth;
                } else {
                    // Regular items
                    return sum + (item.length * item.width) / containerWidth;
                }
            }, 0);
            
            // Create color indicator
            const colorStyle = group.color ? `style="background-color: ${group.color};"` : '';
            
            element.innerHTML = `
                <div class="unit-box">
                    <div class="unit-box-header">
                        <span class="unit-order-number">${index + 1}</span>
                        <span class="unit-color-dot" ${colorStyle}></span>
                        <span class="unit-quantity-badge">× ${itemsInside}${itemsOutside > 0 ? ` <span style="font-size: 0.9em;">(+${itemsOutside} ${i18n.t('outside')})</span>` : ''}</span>
                        <input type="text" class="unit-title-input edit-name" value="${group.sample.name}" data-group-id="${group.groupId}" title="${i18n.t('groups')}" />
                        <div class="unit-quantity-controls">
                            <button class="unit-btn-remove" data-group-id="${group.groupId}" title="${i18n.t('removeUnit')}">−</button>
                            <button class="unit-btn-add" data-group-id="${group.groupId}" title="${i18n.t('units')}">+</button>
                            <button class="unit-btn-delete-all" data-group-id="${group.groupId}" title="${i18n.t('deleteEntireGroup')}">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="unit-box-content">
                        <div class="unit-grid">
                            <div class="unit-item">
                                <div class="unit-item-label">${i18n.t('dimensions')}</div>
                                <div class="unit-dimensions-editable">
                                    ${this.createDimensionInputs(group)}
                                </div>
                                <div class="unit-item-sublabel">
                                    ${group.sample.type === 'roll' && !group.sample.fixedDiameter ?
                                        `<button class="orientation-toggle-btn" data-group-id="${group.groupId}" style="background: none; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px;">
                                            ${group.sample.isVerticalRoll ? `⬆ ${i18n.t('vertical')}` : `➡ ${i18n.t('horizontal')}`}
                                        </button>` :
                                        (group.sample.type === 'steel-coil' ? `(${i18n.t('length')} × ${i18n.t('height')} × ${i18n.t('height')})` : `(${i18n.t('length')} / ${i18n.t('width')} / ${i18n.t('height')})`)}
                                </div>
                            </div>
                            <div class="unit-item">
                                <div class="unit-item-label">${i18n.t('weightPerUnitShort')}</div>
                                <input type="text" class="unit-editable-input edit-weight" value="${parseFloat(group.sample.weight.toFixed(2))} kg" data-group-id="${group.groupId}" />
                            </div>
                            <div class="unit-item">
                                <div class="unit-item-label">
                                    ${i18n.t('stacking')}
                                    <span class="help-icon">
                                        ?
                                        <span class="tooltip">
                                            ${i18n.t('stackingHelp')}
                                        </span>
                                    </span>
                                </div>
                                <div class="stacking-inputs-container">
                                    <input type="text" class="stacking-input-small edit-stack" value="${group.sample.maxStack}" data-group-id="${group.groupId}" title="${i18n.t('units')}" ${group.sample.type === 'steel-coil' ? 'disabled readonly style="background-color: #f3f4f6; cursor: not-allowed;"' : ''} />
                                    <span class="stacking-separator">/</span>
                                    <input type="text" class="stacking-input-small edit-max-weight auto-resize-input" value="${(group.sample.maxStackWeight || 0).toString().replace(/[^\d.]/g, '')}kg" data-group-id="${group.groupId}" maxlength="6" title="${i18n.t('weight')}" ${group.sample.type === 'steel-coil' ? 'disabled readonly style="background-color: #f3f4f6; cursor: not-allowed;"' : ''} />
                                </div>
                            </div>
                            <div class="unit-item">
                                <div class="unit-access-container">
                                    <div class="access-group">
                                        <div class="access-label">${i18n.t('loading')}</div>
                                        <div class="access-methods">${this.formatAccessMethodsWithColor(group.sample.loadingMethods, group.groupId, 'loading')}</div>
                                    </div>
                                    <div class="access-group">
                                        <div class="access-label">${i18n.t('unloading')}</div>
                                        <div class="access-methods">${this.formatAccessMethodsWithColor(group.sample.unloadingMethods, group.groupId, 'unloading')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="unit-box-footer">
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${totalWeight} kg</div>
                            <div class="unit-footer-label">${i18n.t('totalWeight')}</div>
                        </div>
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${totalVolume.toFixed(2)} m³</div>
                            <div class="unit-footer-label">${i18n.t('volume').toUpperCase()}</div>
                        </div>
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${floorArea.toFixed(2)} m²</div>
                            <div class="unit-footer-label">${i18n.t('floorArea')}</div>
                        </div>
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${ldm.toFixed(2)}</div>
                            <div class="unit-footer-label">${i18n.t('ldm')}</div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add edit event listeners
            const nameInput = element.querySelector('.edit-name');
            const weightInput = element.querySelector('.edit-weight');
            const stackInput = element.querySelector('.edit-stack');
            const maxWeightInput = element.querySelector('.edit-max-weight');
            const addBtn = element.querySelector('.unit-btn-add');
            const removeBtn = element.querySelector('.unit-btn-remove');
            const deleteAllBtn = element.querySelector('.unit-btn-delete-all');
            
            // Add dimension input listeners
            const dimensionInputs = element.querySelectorAll('.edit-dimension-length, .edit-dimension-width, .edit-dimension-height, .edit-dimension-diameter');
            
            // Disable remove button if only one item in group
            if (group.items.length <= 1) {
                removeBtn.disabled = true;
            }
            
            // Handle add button
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addItemToGroup(group.groupId);
            });
            
            // Handle remove button
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (group.items.length > 1) {
                    this.removeItemFromGroup(group.groupId);
                }
            });
            
            // Handle delete all button
            deleteAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteEntireGroup(group.groupId);
            });
            
            // Handle orientation toggle button for Roll
            const orientationBtn = element.querySelector('.orientation-toggle-btn');
            if (orientationBtn) {
                orientationBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleGroupOrientation(group.groupId);
                });
            }
            
            // Auto-select text on focus for all editable inputs  
            [nameInput, weightInput, stackInput, maxWeightInput, ...dimensionInputs].forEach(input => {
                input.addEventListener('focus', (e) => {
                    e.target.select();
                });
                
                input.addEventListener('click', (e) => {
                    e.target.select();
                });
            });
            
            // Handle dimension inputs
            dimensionInputs.forEach(input => {
                // Function to auto-resize input width based on content
                const autoResize = () => {
                    const length = input.value.length;
                    const maxLength = input.getAttribute('maxlength') || '4';
                    const maxChars = parseInt(maxLength);
                    const width = Math.max(2, Math.min(maxChars, length)) + 'ch';
                    input.style.width = width;
                };
                
                // Auto-resize on input and initially
                input.addEventListener('input', (e) => {
                    // Limit based on maxlength attribute
                    const maxLength = e.target.getAttribute('maxlength') || '4';
                    const maxChars = parseInt(maxLength);
                    if (e.target.value.length > maxChars) {
                        e.target.value = e.target.value.slice(0, maxChars);
                    }
                    autoResize();
                });
                
                // Initial resize
                autoResize();
                
                const handleDimensionChange = () => {
                    const groupId = input.dataset.groupId;
                    const dimension = input.dataset.dimension;
                    const valueInCm = parseFloat(input.value) || 0;
                    const valueInM = valueInCm / 100;
                    
                    // Validate input based on dimension type
                    let maxValue = 1360; // Default for length/width/diameter
                    if (dimension === 'height') {
                        maxValue = 300;
                    }
                    
                    if (valueInCm < 1 || valueInCm > maxValue) {
                        const maxText = dimension === 'height' ? '300cm' : '1360cm';
                        this.showNotification(i18n.t('dimensionMustBeBetween').replace('{dimension}', dimension === 'height' ? i18n.t('Height') : i18n.t('Dimension')).replace('{max}', maxText), 'error');
                        return;
                    }
                    
                    // Update dimensions for this group
                    this.updateGroupDimensions(groupId, dimension, valueInM);
                };
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        input.blur();
                    }
                });
                
                input.addEventListener('blur', handleDimensionChange);
                input.addEventListener('change', handleDimensionChange);
            });
            
            // Handle name input - only apply "Bez nazwy" when user confirms (blur)
            nameInput.addEventListener('input', (e) => {
                // Just update the parameter without forcing "Bez nazwy"
                const newName = e.target.value.trim();
                if (newName) {
                    this.updateGroupParameter(group.groupId, 'name', newName);
                }
            });
            
            nameInput.addEventListener('blur', (e) => {
                // Apply "Bez nazwy" only when user leaves the field empty
                const newName = e.target.value.trim() || 'Bez nazwy';
                this.updateGroupParameter(group.groupId, 'name', newName);
                e.target.value = newName;
            });
            
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    // Confirm the change and blur the field
                    const newName = e.target.value.trim() || 'Bez nazwy';
                    this.updateGroupParameter(group.groupId, 'name', newName);
                    e.target.value = newName;
                    e.target.blur();
                }
            });
            
            // Handle weight input with kg suffix
            weightInput.addEventListener('input', (e) => {
                const value = e.target.value.replace(/[^\d.]/g, ''); // Remove non-numeric chars except dot
                const newWeight = parseFloat(value) || 0;
                this.updateGroupParameter(group.groupId, 'weight', newWeight);
                // Update display to show new weight with kg
                e.target.value = newWeight + ' kg';
                // Update footer total weight
                const totalWeight = group.items.length * newWeight;
                element.querySelector('.unit-box-footer .unit-footer-value').textContent = totalWeight + ' kg';
                
                // Auto-update max stack weight when unit weight changes
                const stackCount = parseInt(stackInput.value) || 0;
                if (stackCount > 0) {
                    const autoMaxWeight = Math.round(newWeight * stackCount);
                    maxWeightInput.value = autoMaxWeight + 'kg';
                    this.updateGroupParameter(group.groupId, 'maxStackWeight', autoMaxWeight);
                    autoResizeMaxWeight();
                }
            });
            
            // Handle stack count input
            stackInput.addEventListener('input', (e) => {
                // Steel Coil cannot be stacked
                if (group.sample.type === 'steel-coil') {
                    e.target.value = 0;
                    return;
                }
                
                const value = e.target.value.replace(/[^\d]/g, ''); // Only digits
                const newStack = parseInt(value) || 0;
                this.updateGroupParameter(group.groupId, 'maxStack', newStack);
                e.target.value = newStack;
                
                // Auto-calculate max stack weight: stack count × unit weight
                const unitWeight = group.sample.weight || 0;
                const autoMaxWeight = Math.round(unitWeight * newStack);
                
                // Update the max weight input field
                maxWeightInput.value = autoMaxWeight + 'kg';
                
                // Update the parameter in the system
                this.updateGroupParameter(group.groupId, 'maxStackWeight', autoMaxWeight);
                
                // Auto-resize the input
                autoResizeMaxWeight();
            });
            
            // Setup auto-resize for max weight input
            const autoResizeMaxWeight = () => {
                const numericValue = maxWeightInput.value.replace(/[^\d.]/g, '');
                const displayValue = numericValue + 'kg';
                const width = Math.max(6, displayValue.length + 2) + 'ch'; // +2 for extra space for 'kg'
                maxWeightInput.style.width = width;
            };
            
            // Initial resize
            autoResizeMaxWeight();
            
            // Handle max weight input with kg suffix
            maxWeightInput.addEventListener('input', (e) => {
                // Steel Coil cannot be stacked
                if (group.sample.type === 'steel-coil') {
                    e.target.value = '0kg';
                    return;
                }
                
                const value = e.target.value.replace(/[^\d.]/g, ''); // Remove non-numeric chars except dot
                const newMaxWeight = parseFloat(value) || 0;
                this.updateGroupParameter(group.groupId, 'maxStackWeight', newMaxWeight);
                e.target.value = newMaxWeight + 'kg';
                autoResizeMaxWeight();
            });
            
            
            // Handle clicking on editable methods
            element.querySelectorAll('.editable-method').forEach(methodText => {
                methodText.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const method = methodText.dataset.method;
                    const type = methodText.dataset.type;
                    const groupId = methodText.dataset.groupId;
                    
                    // Toggle the active state
                    methodText.classList.toggle('active');
                    
                    // Get current methods for this type
                    const groupedItems = {};
                    this.cargoManager.cargoItems.forEach(item => {
                        const key = item.groupId;
                        if (!groupedItems[key]) {
                            groupedItems[key] = {
                                groupId: key,
                                items: [],
                                sample: item
                            };
                        }
                        groupedItems[key].items.push(item);
                    });
                    const group = Object.values(groupedItems).find(g => g.groupId === parseInt(groupId));
                    if (group) {
                        const methodsKey = type === 'loading' ? 'loadingMethods' : 'unloadingMethods';
                        let currentMethods = group.sample[methodsKey] || [];
                        
                        if (methodText.classList.contains('active')) {
                            // Add method if not present
                            if (!currentMethods.includes(method)) {
                                currentMethods.push(method);
                            }
                        } else {
                            // Remove method
                            currentMethods = currentMethods.filter(m => m !== method);
                        }
                        
                        // Update the group
                        this.updateGroupParameter(groupId, methodsKey, currentMethods);
                    }
                });
            });
            
            // Prevent dragging when clicking on inputs or buttons
            element.querySelectorAll('input, button, .editable-method').forEach(input => {
                input.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    element.draggable = false;
                });
                input.addEventListener('mouseup', () => {
                    element.draggable = true;
                });
            });
            
            // Add drag and drop event listeners (only dragstart and dragend on elements)
            element.addEventListener('dragstart', (e) => {
                // Don't start drag if clicking on inputs or buttons
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                    e.preventDefault();
                    return;
                }
                this.handleDragStart(e, group);
            });
            element.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            // Remove click handler for group selection - groups can only be selected via context menu
            
            freshContainer.appendChild(element);
        });
    }
    
    updateGroupDimensions(groupId, dimension, newValue) {
        // Find the group - handle both string and number groupId
        const groupItems = this.cargoManager.cargoItems.filter(item => 
            item.groupId === groupId || item.groupId === parseInt(groupId) || item.groupId === groupId.toString()
        );
        if (groupItems.length === 0) return;
        
        const firstItem = groupItems[0];
        const oldDimensions = {
            length: firstItem.length,
            width: firstItem.width,
            height: firstItem.height
        };
        
        // Create new dimensions object
        const newDimensions = { ...oldDimensions };
        
        // Handle different dimension types
        if (dimension === 'length') {
            newDimensions.length = newValue;
        } else if (dimension === 'width') {
            newDimensions.width = newValue;
        } else if (dimension === 'height') {
            newDimensions.height = newValue;
        } else if (dimension === 'diameter') {
            // For rolls, diameter affects both width and height depending on orientation
            if (firstItem.type === 'roll') {
                if (firstItem.isVerticalRoll) {
                    // Vertical roll: diameter is width and length
                    newDimensions.width = newValue;
                    newDimensions.length = newValue;
                } else {
                    // Horizontal roll: diameter is height and width
                    newDimensions.width = newValue;
                    newDimensions.height = newValue;
                }
                // Update diameter property
                groupItems.forEach(item => {
                    item.diameter = newValue;
                });
            }
        }
        
        // Check if dimensions actually changed
        if (newDimensions.length === oldDimensions.length && 
            newDimensions.width === oldDimensions.width && 
            newDimensions.height === oldDimensions.height) {
            return;
        }
        
        // Update all items in the group
        groupItems.forEach(item => {
            item.length = newDimensions.length;
            item.width = newDimensions.width;
            item.height = newDimensions.height;
            
            // Update groupKey to include new dimensions (needed for future group comparisons)
            const loadingStr = item.loadingMethods ? item.loadingMethods.join(',') : 'rear,side,top';
            const unloadingStr = item.unloadingMethods ? item.unloadingMethods.join(',') : 'rear,side,top';
            item.groupKey = `${item.type}_${item.name}_${item.weight}_${item.maxStack}_${item.maxStackWeight}_${loadingStr}_${unloadingStr}_${newDimensions.length}_${newDimensions.width}_${newDimensions.height}`;
            
            // Remove old mesh from scene
            if (item.mesh) {
                this.scene3d.removeCargo(item.mesh);
                item.mesh = null;
                item.position = null;
            }
            
            // Mark as not outside (will be re-evaluated during auto-arrange)
            item.isOutside = false;
        });
        
        // Trigger auto-arrangement
        const result = this.cargoManager.autoArrange();
        
        // Update UI
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
        
        // Update 3D axle load visualization after auto-arrange
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }
        
        // Show notification about the change
        if (result && !result.success) {
            const messages = [];
            if (result.unpackedCount > 0) {
                messages.push(`${result.unpackedCount} units did not fit in the space`);
            }
            if (result.exceedingWeightCount > 0) {
                messages.push(`${result.exceedingWeightCount} units exceed weight limit`);
            }
            this.showNotification(messages.join(', '), 'warning');
        } else {
            this.showNotification(i18n.t('groupDimensionsUpdated'), 'success');
        }
    }
    
    updateGroupParameter(groupId, parameter, value) {
        // Store old weights to calculate difference
        let weightDifference = 0;
        let needsStackingCheck = false;
        
        // Update all items in the group
        this.cargoManager.cargoItems.forEach(item => {
            if (item.groupId === groupId) {
                // Calculate weight difference if weight is being changed
                if (parameter === 'weight') {
                    weightDifference += value - item.weight;
                    needsStackingCheck = true; // Weight change might affect stacking
                }
                
                // Check if we need stacking validation
                if (parameter === 'maxStack' || parameter === 'maxStackWeight') {
                    needsStackingCheck = true;
                }
                
                item[parameter] = value;
                
                // Update mesh userData if it exists
                if (item.mesh) {
                    item.mesh.userData[parameter] = value;
                }
            }
        });
        
        // Update total weight if weight was changed
        if (parameter === 'weight') {
            this.cargoManager.totalWeight += weightDifference;
        }
        
        // Check stacking limits and rearrange if needed
        if (needsStackingCheck) {
            // Clear all cargo meshes and re-arrange completely
            this.scene3d.clearAllCargo();
            this.cargoManager.autoArrange();
        }
        
        // Update statistics and visualization
        this.updateStatistics();
        this.updateAxleIndicators();
        // Don't call updateLoadedUnitsList to avoid infinite loop
    }

    addItemToGroup(groupId) {
        // Find first item in group to use as template
        const templateItem = this.cargoManager.cargoItems.find(item => item.groupId === groupId);
        if (!templateItem) return;
        
        // Create new item by copying ALL properties from template
        const newItem = {
            ...templateItem,  // Copy all properties including isRoll, diameter, etc.
            id: Date.now() + Math.random(),  // Generate new unique ID
            orderIndex: Math.max(...this.cargoManager.cargoItems.map(i => i.orderIndex || 0)) + 1,
            addedTime: Date.now(),
            mesh: null,  // Reset mesh
            position: null,  // Reset position
            isOutside: false  // Reset outside status
        };
        
        // Add directly to cargoItems without creating new group
        this.cargoManager.cargoItems.push(newItem);
        this.cargoManager.totalWeight += newItem.weight;
        
        // Auto-arrange only this group if total items <= 50
        const result = (this.cargoManager.cargoItems.length <= 50 && groupId) 
            ? this.cargoManager.autoArrangeGroup(groupId)
            : this.cargoManager.autoArrange();
        
        // Update all UI elements immediately
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
        
        // Update unit count in left panel
        const unitCard = document.querySelector(`.unit-card[data-type="${templateItem.type}"]`);
        if (unitCard) {
            const countSpan = unitCard.querySelector('.unit-count');
            if (countSpan) {
                const currentCount = parseInt(countSpan.textContent) || 0;
                countSpan.textContent = currentCount + 1;
            }
            
            // Update unitCounts
            if (!this.unitCounts[templateItem.type]) {
                this.unitCounts[templateItem.type] = 0;
            }
            this.unitCounts[templateItem.type]++;
        }
    }
    
    removeItemFromGroup(groupId) {
        // Find all items in group
        const groupItems = this.cargoManager.cargoItems.filter(item => item.groupId === groupId);
        if (groupItems.length <= 1) return; // Don't remove last item
        
        // Remove last item from group
        const itemToRemove = groupItems[groupItems.length - 1];
        const itemType = itemToRemove.type;
        
        // Remove mesh from 3D scene
        if (itemToRemove.mesh) {
            this.scene3d.removeCargo(itemToRemove.mesh);
            itemToRemove.mesh = null;
        }
        
        // Remove from cargoManager
        const index = this.cargoManager.cargoItems.indexOf(itemToRemove);
        if (index > -1) {
            this.cargoManager.cargoItems.splice(index, 1);
            
            // Update total weight immediately
            this.cargoManager.totalWeight -= itemToRemove.weight;
            
            // No auto-arrange when removing items - keep other items in place
            
            // Update all UI elements immediately
            this.updateLoadedUnitsList();
            this.updateStatistics();
            this.updateAxleIndicators();
            
            // Update unit count in left panel
            const unitCard = document.querySelector(`.unit-card[data-type="${itemType}"]`);
            if (unitCard) {
                const countSpan = unitCard.querySelector('.unit-count');
                if (countSpan) {
                    const currentCount = parseInt(countSpan.textContent) || 0;
                    countSpan.textContent = Math.max(0, currentCount - 1);
                }
                
                // Update unitCounts
                if (this.unitCounts[itemType]) {
                    this.unitCounts[itemType] = Math.max(0, this.unitCounts[itemType] - 1);
                }
                
                // Update remove button state
                const removeBtn = unitCard.querySelector('.btn-remove-unit');
                if (removeBtn) {
                    removeBtn.disabled = this.unitCounts[itemType] === 0;
                }
            }
        }
    }
    
    toggleGroupOrientation(groupId) {
        // Find all items in the group and toggle their orientation
        const groupItems = this.cargoManager.cargoItems.filter(item => item.groupId === groupId);
        
        if (groupItems.length === 0) return;
        
        // Toggle orientation for all rolls in the group
        groupItems.forEach(item => {
            if (item.type === 'roll' && !item.fixedDiameter) {
                const wasVertical = item.isVerticalRoll;
                item.isVerticalRoll = !wasVertical;
                item.isHorizontalRoll = wasVertical;
                
                // Swap dimensions based on new orientation
                if (wasVertical) {
                    // Going from vertical to horizontal
                    const originalDiameter = item.width;
                    const originalHeight = item.height;
                    
                    item.length = originalHeight;
                    item.width = originalDiameter;
                    item.height = originalDiameter;
                } else {
                    // Going from horizontal to vertical
                    const originalLength = item.length;
                    const originalDiameter = item.width;
                    
                    item.length = originalDiameter;
                    item.width = originalDiameter;
                    item.height = originalLength;
                }
                
                // Update groupKey
                const loadingStr = (item.loadingMethods || ['rear', 'side', 'top']).join(',');
                const unloadingStr = (item.unloadingMethods || ['rear', 'side', 'top']).join(',');
                const orientationStr = item.isVerticalRoll ? 'vertical' : 'horizontal';
                item.groupKey = `roll_${item.name}_${item.weight}_${item.maxStack}_${item.maxStackWeight}_${loadingStr}_${unloadingStr}_${item.length}_${item.width}_${item.height}_${orientationStr}`;
            }
        });
        
        // Rearrange all units
        this.cargoManager.autoArrange();
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
    }
    
    deleteEntireGroup(groupId) {
        // Find all items in group
        const groupItems = this.cargoManager.cargoItems.filter(item => item.groupId === groupId);
        if (groupItems.length === 0) return;
        
        // Calculate total weight to remove
        const totalWeightToRemove = groupItems.reduce((sum, item) => sum + item.weight, 0);
        
        // Remove all items from cargoManager
        this.cargoManager.cargoItems = this.cargoManager.cargoItems.filter(item => item.groupId !== groupId);
        
        // Update total weight
        this.cargoManager.totalWeight -= totalWeightToRemove;
        
        // Clear all cargo meshes
        this.scene3d.clearAllCargo();
        
        // Auto-arrange remaining items if any
        if (this.cargoManager.cargoItems.length > 0) {
            this.cargoManager.autoArrange();
        }
        
        // Update all UI elements
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
        
        // Update unit counts in left panel
        const itemTypes = [...new Set(groupItems.map(item => item.type))];
        itemTypes.forEach(itemType => {
            const removedCount = groupItems.filter(item => item.type === itemType).length;
            
            const unitCard = document.querySelector(`.unit-card[data-type="${itemType}"]`);
            if (unitCard) {
                const countSpan = unitCard.querySelector('.unit-count');
                if (countSpan) {
                    const currentCount = parseInt(countSpan.textContent) || 0;
                    countSpan.textContent = Math.max(0, currentCount - removedCount);
                }
                
                // Update unitCounts
                if (this.unitCounts[itemType]) {
                    this.unitCounts[itemType] = Math.max(0, this.unitCounts[itemType] - removedCount);
                }
                
                // Update remove button state
                const removeBtn = unitCard.querySelector('.btn-remove-unit');
                if (removeBtn) {
                    removeBtn.disabled = this.unitCounts[itemType] === 0;
                }
            }
        });
    }
    
    checkAndFixStacking() {
        const tolerance = 0.1;
        
        // Group items by stacking position (X,Z)
        const stacks = {};
        this.cargoManager.cargoItems.forEach(item => {
            if (!item.position) return;
            const key = `${item.position.x.toFixed(1)}_${item.position.z.toFixed(1)}`;
            if (!stacks[key]) stacks[key] = [];
            stacks[key].push(item);
        });
        
        // Check each stack
        Object.values(stacks).forEach(stack => {
            if (stack.length <= 1) return;
            
            // Sort by Y position (bottom to top)
            stack.sort((a, b) => a.position.y - b.position.y);
            
            let needsUnstacking = false;
            let unstackFromIndex = stack.length;
            
            // Check each item in stack from bottom up
            for (let i = 0; i < stack.length; i++) {
                const item = stack[i];
                const maxStack = item.maxStack !== undefined ? item.maxStack : 3;
                const maxStackWeight = item.maxStackWeight !== undefined ? item.maxStackWeight : Infinity;
                
                // Count and weigh items above this one
                let itemsAbove = 0;
                let weightAbove = 0;
                for (let j = i + 1; j < stack.length; j++) {
                    itemsAbove++;
                    weightAbove += stack[j].weight;
                }
                
                // Check if limits are exceeded
                if (itemsAbove > maxStack || weightAbove > maxStackWeight) {
                    needsUnstacking = true;
                    unstackFromIndex = Math.min(unstackFromIndex, i + maxStack + 1);
                    
                    // If weight is the issue, find where to cut
                    if (weightAbove > maxStackWeight) {
                        let accumulatedWeight = 0;
                        for (let j = i + 1; j < stack.length; j++) {
                            accumulatedWeight += stack[j].weight;
                            if (accumulatedWeight > maxStackWeight) {
                                unstackFromIndex = Math.min(unstackFromIndex, j);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Unstack items that exceed limits
            if (needsUnstacking && unstackFromIndex < stack.length) {
                // Items to unstack
                const itemsToMove = stack.slice(unstackFromIndex);
                
                // Find new positions for unstacked items
                itemsToMove.forEach((item, index) => {
                    // Try to place next to the stack
                    const baseItem = stack[0];
                    const trailerHeight = this.cargoManager.containerDimensions?.trailerHeight || 1.2;
                    const newX = baseItem.position.x + baseItem.length + item.length / 2 + 0.1;
                    const newY = item.height / 2 + trailerHeight; // Floor level at trailer height
                    const newZ = baseItem.position.z;
                    
                    // Check if new position is valid
                    if (newX + item.length / 2 <= this.cargoManager.containerDimensions.length / 2) {
                        item.position.x = newX;
                        item.position.y = newY;
                        item.position.z = newZ;
                        
                        if (item.mesh) {
                            item.mesh.position.set(newX, newY, newZ);
                        }
                    }
                });
            }
        });
    }
    
    handleDragStart(e, group) {
        this.draggedGroup = group;
        this.draggedElement = e.currentTarget;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
        
        // Set placeholder
        this.dragPlaceholder.style.height = e.currentTarget.offsetHeight + 'px';
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!this.draggedElement) return;
        
        const container = document.getElementById('loadedUnits');
        const afterElement = this.getDragAfterElement(container, e.clientY);
        
        if (this.dragPlaceholder.style.display !== 'block') {
            this.dragPlaceholder.style.display = 'block';
        }
        
        if (afterElement == null) {
            container.appendChild(this.dragPlaceholder);
        } else {
            container.insertBefore(this.dragPlaceholder, afterElement);
        }
    }
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.loaded-unit-group:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!this.draggedGroup || !this.dragPlaceholder) return;
        
        // Get all elements including placeholder
        const container = document.getElementById('loadedUnits');
        const allElements = [...container.children];
        const placeholderIndex = allElements.indexOf(this.dragPlaceholder);
        
        if (placeholderIndex === -1) return;
        
        // Get the new order of groupIds
        const newOrder = [];
        allElements.forEach((element, index) => {
            if (element === this.dragPlaceholder) {
                newOrder.push(this.draggedGroup.groupId);
            } else if (element.classList.contains('loaded-unit-group') && !element.classList.contains('dragging')) {
                newOrder.push(parseInt(element.dataset.groupId));
            }
        });
        
        // Reorder items based on new order
        this.applyNewOrder(newOrder);
    }
    
    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.loaded-unit-group').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        // Hide and remove placeholder
        if (this.dragPlaceholder) {
            this.dragPlaceholder.style.display = 'none';
            if (this.dragPlaceholder.parentNode) {
                this.dragPlaceholder.parentNode.removeChild(this.dragPlaceholder);
            }
        }
        
        this.draggedGroup = null;
        this.draggedElement = null;
    }
    
    applyNewOrder(newGroupIdOrder) {
        // Group items by groupId
        const groups = {};
        this.cargoManager.cargoItems.forEach(item => {
            if (!groups[item.groupId]) {
                groups[item.groupId] = [];
            }
            groups[item.groupId].push(item);
        });
        
        // Update orderIndex based on new order
        let orderCounter = 0;
        newGroupIdOrder.forEach(groupId => {
            if (groups[groupId]) {
                groups[groupId].forEach(item => {
                    item.orderIndex = orderCounter++;
                });
            }
        });
        
        // Trigger auto-arrange to reflect new order
        if (this.cargoManager.cargoItems.length <= 50) {
            this.cargoManager.autoArrange();
            this.updateLoadedUnitsList();
            this.updateStatistics();
        } else {
            this.updateLoadedUnitsList();
        }
    }
    
    updateStatistics() {
        const stats = this.cargoManager.getStatistics();
        
        // Count unique groups
        const groups = {};
        this.cargoManager.cargoItems.forEach(item => {
            if (!item.isOutside && item.groupId) {
                groups[item.groupId] = true;
            }
        });
        const groupCount = Object.keys(groups).length;
        
        // Update compact statistics in bottom section
        const statItems = document.querySelectorAll('.stat-item-compact .stat-value');
        if (statItems.length >= 5) {
            statItems[0].textContent = `${stats.volumeUsage.toFixed(1)}%`;
            statItems[1].textContent = `${stats.weightUsage.toFixed(1)}%`;
            // Show weight in format: loaded / max capacity
            statItems[2].textContent = `${stats.insideWeight} / ${stats.maxLoad} kg`;
            // Show units count
            if (stats.outsideItems > 0) {
                statItems[3].textContent = `${stats.placedItems} (+${stats.outsideItems} poza)`;
            } else {
                statItems[3].textContent = `${stats.totalItems}`;
            }
            // Show groups count
            statItems[4].textContent = `${groupCount}`;
        }
    }
    
    updateAxleIndicators() {
        // Skip for custom space (no axles)
        if (this.currentVehicleConfig?.isCustomSpace) {
            return;
        }

        this.axleCalculator.updateCargo(this.cargoManager.cargoItems);
        const axleLoads = this.axleCalculator.calculateAxleLoads();

        if (!axleLoads) return;
        
        const frontAxleElement = document.querySelector('.front-axle');
        const rearAxleElement = document.querySelector('.rear-axle');
        const trailerAxleElement = document.querySelector('.trailer-axle');
        const trailerAxleItem = document.querySelector('.axle-item:nth-child(4)');
        
        // Handle JUMBO structure (frontAxle, driveAxles, trailerAxles) vs standard (front, drive, trailer)
        const isJumbo = axleLoads.isJumbo || false;
        const front = isJumbo ? axleLoads.frontAxle : axleLoads.front;
        const drive = isJumbo ? axleLoads.driveAxles : axleLoads.drive;
        const trailer = isJumbo ? axleLoads.trailerAxles : axleLoads.trailer;
        
        // Front axle (truck)
        frontAxleElement.style.width = `${Math.min(front.percentage, 100)}%`;
        frontAxleElement.classList.remove('warning', 'danger');
        if (front.status === 'warning' || front.warning) {
            frontAxleElement.classList.add('warning');
        } else if (front.status === 'danger' || front.overloaded) {
            frontAxleElement.classList.add('danger');
        }
        
        // Drive axles (truck drive axles)
        rearAxleElement.style.width = `${Math.min(drive.percentage, 100)}%`;
        rearAxleElement.classList.remove('warning', 'danger');
        if (drive.status === 'warning' || drive.warning) {
            rearAxleElement.classList.add('warning');
        } else if (drive.status === 'danger' || drive.overloaded) {
            rearAxleElement.classList.add('danger');
        }
        
        // Check if SOLO (no trailer axles)
        const isSolo = axleLoads.isSolo || false;
        
        if (isSolo) {
            // Hide trailer axle display for SOLO
            trailerAxleItem.style.display = 'none';
        } else {
            // Show trailer axle display
            trailerAxleItem.style.display = '';
            
            // Trailer axles
            trailerAxleElement.style.width = `${Math.min(trailer.percentage, 100)}%`;
            trailerAxleElement.classList.remove('warning', 'danger');
            if (trailer.status === 'warning' || trailer.warning) {
                trailerAxleElement.classList.add('warning');
            } else if (trailer.status === 'danger' || trailer.overloaded) {
                trailerAxleElement.classList.add('danger');
            }
            
            document.querySelector('.axle-item:nth-child(4) .axle-value').textContent = 
                `${trailer.load} / ${trailer.max || trailer.percentage} kg`;
        }
        
        // Update text values
        document.querySelector('.axle-item:nth-child(2) .axle-value').textContent = 
            `${front.load} / ${front.max || front.percentage} kg`;
        
        // Drive axle with percentage info
        const driveValueText = `${drive.load} / ${drive.max || drive.percentage} kg`;
        const drivePercentText = drive.percentageOfTotal ? 
            ` (${drive.percentageOfTotal.toFixed(1)}%)` : '';
        document.querySelector('.axle-item:nth-child(3) .axle-value').textContent = 
            driveValueText + drivePercentText;
        
        // Add warning class if below minimum
        const driveItem = document.querySelector('.axle-item:nth-child(3)');
        if (drive.warning || drive.belowMinimum) {
            driveItem.classList.add('warning-min');
            // Show warning tooltip or message
            driveItem.title = drive.warning || 'Drive axle load below minimum';
        } else {
            driveItem.classList.remove('warning-min');
            driveItem.title = '';
        }
    }

    async loadLogoAsDataURL(logoPath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Enable CORS
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = function() {
                reject(new Error('Failed to load logo'));
            };
            img.src = logoPath;
        });
    }

    async exportToPDF() {
        try {
            // Show loading indicator
            this.showNotification(i18n.t('generatingPDF'), 'info');

            // Update axle load indicators to ensure current data is displayed
            this.updateAxleIndicators();

            // Get cargo groups for annotations
            const cargoGroups = this.getCargoGroups();

            // Check if custom space (no truck/axles)
            const isCustomSpace = this.currentVehicleConfig?.isCustomSpace || this.currentVehicle === 'custom';

            // Load logo as data URL
            const logoDataURL = await this.loadLogoAsDataURL(CONFIG.LOGO_URL);

            // Get multiple views from 3D scene with annotations (including side view for page 3, unless custom space)
            const views = await this.scene3d.getMultipleViews(cargoGroups, !isCustomSpace);
            
            // Initialize jsPDF (landscape A4) with compression enabled
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true  // Enable PDF compression
            });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Get plan name - use current config name or generate default
            const planName = this.currentConfigName || this.generateDefaultName();
            
            // Page 1: Perspective View
            // Add plan name at the top
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            pdf.text(planName, pageWidth / 2, 8, { align: 'center' });
            
            // Add view title below plan name
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'normal');
            pdf.text('Load Plan - Perspective View', pageWidth / 2, 14, { align: 'center' });
            
            // Add logo on the left
            if (logoDataURL) {
                const logoWidth = 25; // mm
                const logoHeight = logoWidth / 3.39; // Aspect ratio 1351x398
                pdf.addImage(logoDataURL, 'PNG', 5, 5, logoWidth, logoHeight);
            }

            // Add watermark text next to logo
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'italic');
            pdf.setTextColor(100, 100, 100);
            pdf.text('Planned and generated on', 32, 7, { align: 'left' });
            pdf.text('Transport-Nomad.com', 32, 11, { align: 'left' });

            // Add date
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(0, 0, 0);
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const time = now.toLocaleTimeString('en-US');
            const date = `${day}/${month}/${year} ${time}`;
            pdf.text(`Date: ${date}`, pageWidth - 5, 8, { align: 'right' });
            
            // Calculate full page image dimensions with minimal margins
            const sideMargin = 3; // Minimal side margin
            const topMargin = 20; // Space for plan name, title and date
            const bottomMargin = 3; // Minimal bottom margin
            const availableWidth = pageWidth - (sideMargin * 2);
            const availableHeight = pageHeight - topMargin - bottomMargin; // Maximum height available
            
            // Fill entire available width and height
            const imgWidth = availableWidth;
            const imgHeight = availableHeight;
            
            // Position image to fill the page
            const xPos = sideMargin;
            const yPos = topMargin;
            
            // Find perspective view
            const perspectiveView = views.find(v => v.name === 'default');
            
            if (perspectiveView) {
                // Add border around image
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.5);
                pdf.rect(xPos - 1, yPos - 1, imgWidth + 2, imgHeight + 2);
                
                // Add perspective view image with JPEG format and FAST compression
                pdf.addImage(perspectiveView.image, 'JPEG', xPos, yPos, imgWidth, imgHeight, undefined, 'FAST');
            }
            
            // Page 2: Top View
            pdf.addPage();
            // Add plan name at the top
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            pdf.text(planName, pageWidth / 2, 8, { align: 'center' });
            
            // Add view title below plan name
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'normal');
            pdf.text('Load Plan - Top View', pageWidth / 2, 14, { align: 'center' });
            
            // Add logo on the left
            if (logoDataURL) {
                const logoWidth = 25; // mm
                const logoHeight = logoWidth / 3.39; // Aspect ratio 1351x398
                pdf.addImage(logoDataURL, 'PNG', 5, 5, logoWidth, logoHeight);
            }

            // Add watermark text next to logo
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'italic');
            pdf.setTextColor(100, 100, 100);
            pdf.text('Planned and generated on', 32, 7, { align: 'left' });
            pdf.text('Transport-Nomad.com', 32, 11, { align: 'left' });

            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(0, 0, 0);

            // Find top view
            const topView = views.find(v => v.name === 'top');
            
            if (topView) {
                // Add border around image
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.5);
                pdf.rect(xPos - 1, yPos - 1, imgWidth + 2, imgHeight + 2);
                
                // Add top view image with JPEG format and FAST compression
                pdf.addImage(topView.image, 'JPEG', xPos, yPos, imgWidth, imgHeight, undefined, 'FAST');
            }

            // Page 3: Vehicle Summary & Axle Configuration (skip for custom space)
            if (!isCustomSpace) {
                pdf.addPage();
                // Add plan name at the top
                pdf.setFontSize(14);
                pdf.setFont(undefined, 'bold');
                pdf.text(planName, pageWidth / 2, 8, { align: 'center' });

                // Add summary title below plan name
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'normal');
                pdf.text('Vehicle Configuration & Load Summary', pageWidth / 2, 14, { align: 'center' });

                // Add logo on the left
                if (logoDataURL) {
                    const logoWidth = 25; // mm
                    const logoHeight = logoWidth / 3.39; // Aspect ratio 1351x398
                    pdf.addImage(logoDataURL, 'PNG', 5, 5, logoWidth, logoHeight);
                }

                // Add watermark text next to logo
                pdf.setFontSize(9);
                pdf.setFont(undefined, 'italic');
                pdf.setTextColor(100, 100, 100);
                pdf.text('Planned and generated on', 32, 7, { align: 'left' });
                pdf.text('Transport-Nomad.com', 32, 11, { align: 'left' });

                pdf.setFont(undefined, 'normal');
                pdf.setTextColor(0, 0, 0);

                let yPosition = 25;

                // Vehicle Specifications Section
                this.addVehicleSpecificationsSection(pdf, yPosition);
                yPosition = 90; // Fixed position after specifications

                // Side view with axle loads (bottom half of the page)
                const sideView = views.find(v => v.name === 'side');
                if (sideView) {
                    // Add section title
                    pdf.setFontSize(11);
                    pdf.setFont(undefined, 'bold');
                    pdf.setTextColor(41, 98, 255);
                    pdf.text('Load Distribution & Axle Loads', 15, yPosition);
                    yPosition += 5;

                    // Add disclaimer about axle load calculations
                    pdf.setFontSize(8);
                    pdf.setFont(undefined, 'italic');
                    pdf.setTextColor(100, 116, 139);
                    const disclaimerText = 'Note: Axle load calculations are based on empty weights and distances between reference points which may vary depending on truck and trailer manufacturers. Always verify that the empty weights and distances match those used in the settings.';
                    const splitDisclaimer = pdf.splitTextToSize(disclaimerText, pageWidth - 30);
                    pdf.text(splitDisclaimer, 15, yPosition);
                    yPosition += splitDisclaimer.length * 3 + 2;

                    // Add side view image with axle load visualization
                    // Full width of the page - the side view has 3:1 ratio for wide display
                    const xPos = 15;
                    const imgWidth = pageWidth - 30; // Full width minus margins
                    // The side view export is 3000x1000px (3:1 ratio)
                    const imgHeight = imgWidth / 3; // Maintain 3:1 ratio

                    const imgYPos = yPosition;

                    // Add subtle background for the visualization
                    pdf.setFillColor(248, 250, 252);
                    pdf.roundedRect(xPos - 2, imgYPos - 2, imgWidth + 4, imgHeight + 4, 3, 3, 'F');

                    // Add border
                    pdf.setDrawColor(226, 232, 240);
                    pdf.setLineWidth(0.5);
                    pdf.roundedRect(xPos - 2, imgYPos - 2, imgWidth + 4, imgHeight + 4, 3, 3, 'S');

                    // Add side view image with JPEG format and FAST compression
                    pdf.addImage(sideView.image, 'JPEG', xPos, imgYPos, imgWidth, imgHeight, undefined, 'FAST');
                }
            }

            // Pages 4+ (or 3+ for custom space): Individual cargo group views
            if (cargoGroups.length > 0) {
                for (let index = 0; index < cargoGroups.length; index++) {
                    const group = cargoGroups[index];
                    
                    // Add new page for this group
                    pdf.addPage();
                    
                    // Add plan name at the top
                    pdf.setFontSize(14);
                    pdf.setFont(undefined, 'bold');
                    pdf.text(planName, pageWidth / 2, 8, { align: 'center' });
                    
                    // Add group title
                    pdf.setFontSize(12);
                    pdf.setFont(undefined, 'normal');
                    const groupTitle = `Group ${index + 1}: ${group.name || 'Unnamed'} (× ${group.count})`;
                    pdf.text(groupTitle, pageWidth / 2, 14, { align: 'center' });
                    
                    // Add logo on the left
                    if (logoDataURL) {
                        const logoWidth = 25; // mm
                        const logoHeight = logoWidth / 3.39; // Aspect ratio 1351x398
                        pdf.addImage(logoDataURL, 'PNG', 5, 5, logoWidth, logoHeight);
                    }

                    // Add watermark text next to logo
                    pdf.setFontSize(9);
                    pdf.setFont(undefined, 'italic');
                    pdf.setTextColor(100, 100, 100);
                    pdf.text('Planned and generated on', 32, 7, { align: 'left' });
                    pdf.text('Transport-Nomad.com', 32, 11, { align: 'left' });

                    pdf.setFont(undefined, 'normal');
                    pdf.setTextColor(0, 0, 0);

                    // Capture group view with transparency for other units
                    const groupId = group.items && group.items.length > 0 ? group.items[0].groupId : null;
                    
                    if (groupId !== null && groupId !== undefined) {
                        const groupViewDataURL = await this.scene3d.captureGroupView(groupId, cargoGroups);
                        
                        if (groupViewDataURL) {
                            // Calculate image position and size
                            const imgWidth = pageWidth - 30;
                            const imgHeight = imgWidth / 1.5; // 3:2 aspect ratio
                            const xPos = 15;
                            const yPos = 25;
                            
                            // Add subtle background
                            pdf.setFillColor(248, 250, 252);
                            pdf.roundedRect(xPos - 2, yPos - 2, imgWidth + 4, imgHeight + 4, 3, 3, 'F');
                            
                            // Add border
                            pdf.setDrawColor(226, 232, 240);
                            pdf.setLineWidth(0.5);
                            pdf.roundedRect(xPos - 2, yPos - 2, imgWidth + 4, imgHeight + 4, 3, 3, 'S');
                            
                            // Add group view image with JPEG format and FAST compression
                            pdf.addImage(groupViewDataURL, 'JPEG', xPos, yPos, imgWidth, imgHeight, undefined, 'FAST');
                        }
                    }
                }
            }
            
            // Save PDF
            const filename = `load_plan_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            this.showNotification(i18n.t('pdfGenerated'), 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showNotification(i18n.t('errorGeneratingPDF'), 'error');
        }
    }
    
    getCargoGroups() {
        const groups = {};
        
        // Group cargo items by groupId
        this.cargoManager.cargoItems.forEach(item => {
            if (item.isOutside) return; // Skip items outside container
            
            const groupId = item.groupId || 'default';
            if (!groups[groupId]) {
                // Format dimensions based on unit type
                let dimensions;
                if (item.isRoll || item.type === 'steel-coil') {
                    // For cylindrical units
                    const diameter = item.diameter || Math.max(item.width, item.length);
                    const height = item.height;
                    dimensions = `Ø${diameter.toFixed(2)}×${height.toFixed(2)}m`;
                } else {
                    dimensions = `${item.length.toFixed(2)}×${item.width.toFixed(2)}×${item.height.toFixed(2)}m`;
                }
                
                groups[groupId] = {
                    name: item.name || item.type,
                    count: 0,
                    unitWeight: item.weight,
                    totalWeight: 0,
                    dimensions: dimensions,
                    maxStack: item.maxStack || 0,
                    maxStackWeight: item.maxStackWeight || 0,
                    color: item.color || null,
                    items: []
                };
            }
            groups[groupId].count++;
            groups[groupId].totalWeight += item.weight;
            groups[groupId].items.push(item);
        });
        
        // Convert to array and sort by count
        return Object.values(groups).sort((a, b) => b.count - a.count);
    }
    
    hexToRgb(hex) {
        // Convert hex color to RGB
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    }
    
    addVehicleSpecificationsSection(pdf, startY) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        
        // Get vehicle information
        const vehicleDropdown = document.querySelector('.custom-select-trigger .option-name');
        const vehicleName = vehicleDropdown ? vehicleDropdown.textContent : 'Unknown';
        const dimensionsInfo = document.getElementById('dimensionsInfo')?.textContent || 'No data';
        const maxLoadInput = document.getElementById('maxLoadInput');
        const maxLoad = maxLoadInput ? parseFloat(maxLoadInput.value) * 1000 : 0; // Convert to kg
        
        // Get axle configuration from localStorage
        const vehicleType = this.cargoManager.currentVehicleType || 'standard';
        const settingsKey = `axleSettings_${vehicleType}`;
        const axleSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        
        // Determine vehicle type characteristics
        const isSolo = this.cargoManager.containerDimensions?.isSolo || false;
        const isJumbo = this.cargoManager.containerDimensions?.isJumbo || false;
        
        // Get current axle loads
        this.axleCalculator.updateCargo(this.cargoManager.cargoItems);
        const axleLoads = this.axleCalculator.calculateAxleLoads();
        
        // Create two-column layout
        const col1X = 15;
        const col2X = pageWidth / 2 + 5;
        let yPos = startY;
        
        // Section 1: Vehicle Specifications (left column)
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(41, 98, 255);
        pdf.text('Vehicle Specifications', col1X, yPos);
        yPos += 8;
        
        // Background for specifications
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(col1X - 2, yPos - 4, pageWidth/2 - 15, 35, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 116, 139); // Gray labels
        
        // Vehicle type
        pdf.text('Vehicle Type:', col1X + 2, yPos);
        pdf.setTextColor(30, 41, 59); // Dark values
        pdf.setFont(undefined, 'bold');
        pdf.text(vehicleName, col1X + 35, yPos);
        
        // Dimensions
        yPos += 6;
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Cargo Space:', col1X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont(undefined, 'bold');
        pdf.text(dimensionsInfo, col1X + 35, yPos);
        
        // Maximum cargo weight
        yPos += 6;
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Max Cargo Weight:', col1X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${maxLoad.toLocaleString()} kg`, col1X + 35, yPos);
        
        // Number of axles
        yPos += 6;
        const tractorAxles = axleSettings.tractorAxles || 1;
        const trailerAxles = axleSettings.trailerAxles || (isSolo ? 0 : (isJumbo ? 2 : 3));
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Axle Configuration:', col1X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont(undefined, 'bold');
        if (isSolo) {
            pdf.text(`Front: 1, Drive: ${tractorAxles}`, col1X + 35, yPos);
        } else if (isJumbo) {
            pdf.text(`Front: 1, Drive: ${tractorAxles}, Trailer: ${trailerAxles}`, col1X + 35, yPos);
        } else {
            pdf.text(`Front: 1, Drive: ${tractorAxles}, Trailer: ${trailerAxles}`, col1X + 35, yPos);
        }
        
        // We still need to calculate empty weights for the axle details section
        const emptyFront = axleSettings.emptyFrontAxle || 5800;
        const emptyDrive = axleSettings.emptyDriveAxles || 3600;
        const emptyTrailer = axleSettings.emptyTrailerAxles || (isSolo ? 0 : (isJumbo ? 4200 : 5200));
        
        // Section 2: Axle Configuration Details (right column)
        yPos = startY;
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(41, 98, 255);
        pdf.text('Axle Load Limits & Distances', col2X, yPos);
        yPos += 8;
        
        // Background for axle details
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(col2X - 2, yPos - 4, pageWidth/2 - 15, 55, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        
        // Front axle
        pdf.setTextColor(100, 116, 139);
        pdf.text('Front Axle:', col2X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        const maxFront = axleSettings.maxFrontAxle || 10000;
        const loadedFront = axleLoads ? (isJumbo ? axleLoads.frontAxle?.load : axleLoads.front?.load) || 0 : 0;
        pdf.setFontSize(8);
        pdf.text(`Max: ${maxFront.toLocaleString()} kg | Empty: ${emptyFront.toLocaleString()} kg | Loaded: ${loadedFront.toLocaleString()} kg`, col2X + 35, yPos);
        pdf.setFontSize(9);
        
        // Drive axles
        yPos += 6;
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Drive Axle${tractorAxles > 1 ? 's' : ''}:`, col2X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        const maxDrive = axleSettings.maxDriveAxles || (tractorAxles === 2 ? 18000 : 11500);
        const loadedDrive = axleLoads ? (isJumbo ? axleLoads.driveAxles?.load : axleLoads.drive?.load) || 0 : 0;
        pdf.setFontSize(8);
        pdf.text(`Max: ${maxDrive.toLocaleString()} kg | Empty: ${emptyDrive.toLocaleString()} kg | Loaded: ${loadedDrive.toLocaleString()} kg`, col2X + 35, yPos);
        pdf.setFontSize(9);
        
        // Trailer axles (if applicable)
        if (!isSolo) {
            yPos += 6;
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Trailer Axle${trailerAxles > 1 ? 's' : ''}:`, col2X + 2, yPos);
            pdf.setTextColor(30, 41, 59);
            const maxTrailer = axleSettings.maxTrailerAxles || 
                (trailerAxles === 1 ? 10000 : trailerAxles === 2 ? 18000 : 24000);
            const loadedTrailer = axleLoads ? (isJumbo ? axleLoads.trailerAxles?.load : axleLoads.trailer?.load) || 0 : 0;
            pdf.setFontSize(8);
            pdf.text(`Max: ${maxTrailer.toLocaleString()} kg | Empty: ${emptyTrailer.toLocaleString()} kg | Loaded: ${loadedTrailer.toLocaleString()} kg`, col2X + 35, yPos);
            pdf.setFontSize(9);
        }
        
        // Distance information
        yPos += 6;
        pdf.setTextColor(100, 116, 139);
        pdf.text('Axle Distances:', col2X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(8);
        
        if (isSolo) {
            const distToFront = axleSettings.distCargoStartToFront || 1.0;
            const distToDrive = axleSettings.distCargoStartToDrive || 5.5;
            pdf.text(`Front: ${distToFront.toFixed(1)}m before container, Drive: ${distToDrive.toFixed(1)}m from container start`, 
                     col2X + 35, yPos);
        } else if (isJumbo) {
            const distToFront = axleSettings.distSection1StartToFront || 1.0;
            const distToDrive = axleSettings.distSection1StartToDrive || 5.5;
            const distToTrailer = axleSettings.distSection2StartToTrailerAxles || 5.5;
            pdf.text(`Front: ${distToFront.toFixed(1)}m, Drive: ${distToDrive.toFixed(1)}m, Trailer: ${distToTrailer.toFixed(1)}m`, 
                     col2X + 35, yPos);
        } else {
            const distFrontToKingpin = axleSettings.distFrontToKingpin || 1.7;
            const distKingpinToTrailer = axleSettings.distKingpinToTrailer || 7.7;
            const distFrontAxleToKingpin = axleSettings.distFrontAxleToKingpin || 3.1;
            const distKingpinToDrive = axleSettings.distKingpinToDrive || 0.5;
            // Calculate distTrailerToEnd from container length
            const containerLength = this.cargoManager.containerDimensions?.length || 13.62;
            const distTrailerToEnd = containerLength - distFrontToKingpin - distKingpinToTrailer;
            yPos += 4;
            pdf.text(`Kingpin: ${distFrontToKingpin.toFixed(1)}m from container front`, col2X + 35, yPos);
            yPos += 4;
            pdf.text(`Front axle: ${distFrontAxleToKingpin.toFixed(1)}m before kingpin`, col2X + 35, yPos);
            yPos += 4;
            pdf.text(`Drive axle: ${distKingpinToDrive.toFixed(1)}m behind kingpin`, col2X + 35, yPos);
            yPos += 4;
            pdf.text(`Trailer axles: ${distKingpinToTrailer.toFixed(1)}m from kingpin`, col2X + 35, yPos);
            yPos += 4;
            pdf.text(`Trailer axles: ${distTrailerToEnd.toFixed(1)}m from container rear`, col2X + 35, yPos);
        }
        
        // Minimum drive axle load
        yPos += 6;
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Min Drive Load:', col2X + 2, yPos);
        pdf.setTextColor(30, 41, 59);
        const minDriveLoad = axleSettings.minDriveAxleLoad || 25;
        pdf.text(`${minDriveLoad}% of total weight`, col2X + 35, yPos);
    }
    
    saveConfiguration() {
        const modal = document.getElementById('saveConfigModal');
        const nameInput = document.getElementById('configNameInput');
        const preview = document.getElementById('configPreview');
        const existingList = document.getElementById('existingConfigsList');
        const noExisting = document.getElementById('noExistingConfigs');
        
        // Generate default name and set it
        const defaultName = this.generateDefaultName();
        nameInput.value = defaultName;
        
        // Generate preview
        const stats = this.cargoManager.getStatistics();
        const vehicleName = CONFIG.vehicles[this.currentVehicle]?.name || 'Custom Dimensions';
        
        preview.innerHTML = `
            <div><strong>Cargo Space:</strong> ${vehicleName}</div>
            <div><strong>Number of Units:</strong> ${stats.totalItems} ${stats.outsideItems > 0 ? `(+${stats.outsideItems} outside)` : ''}</div>
            <div><strong>Total Weight:</strong> ${stats.totalWeight} kg</div>
            <div><strong>Space Usage:</strong> ${stats.volumeUsage.toFixed(1)}%</div>
            <div><strong>Load Capacity Usage:</strong> ${stats.weightUsage.toFixed(1)}%</div>
        `;
        
        // Load existing configurations for selection
        const configs = this.getStoredConfigurations();
        if (configs.length > 0) {
            existingList.style.display = 'block';
            noExisting.style.display = 'none';
            
            existingList.innerHTML = configs.map(config => {
                const date = new Date(config.date);
                const dateStr = date.toLocaleDateString('pl-PL');
                const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
                const isCurrentConfig = config.id === this.currentConfigId;
                
                return `
                    <div class="existing-config-item ${isCurrentConfig ? 'current-config' : ''}" data-config-id="${config.id}" data-config-name="${config.name}">
                        <div class="config-main-info">
                            <div class="config-name">${config.name} ${isCurrentConfig ? '<span class="current-badge">(Aktualny)</span>' : ''}</div>
                            <div class="config-meta">${dateStr} ${timeStr}</div>
                        </div>
                        <div class="config-details">
                            ${config.vehicleType ? `<span class="config-vehicle">${CONFIG.vehicles[config.vehicleType]?.name || config.vehicleType}</span>` : ''}
                            ${config.stats?.insideWeight ? `<span class="config-weight">${config.stats.insideWeight} kg</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            existingList.style.display = 'none';
            noExisting.style.display = 'block';
        }
        
        // Reset selected config
        this.selectedConfigToOverwrite = null;
        this.selectedConfigOriginalName = null;
        document.getElementById('saveConfigText').textContent = 'Save as new';
        document.getElementById('saveDownloadConfigText').textContent = 'Save and download';
        const saveButtonsGroup = document.querySelector('.save-buttons-group');
        const overwriteButtonsGroup = document.querySelector('.overwrite-buttons-group');
        if (saveButtonsGroup && overwriteButtonsGroup) {
            saveButtonsGroup.style.display = 'flex';
            overwriteButtonsGroup.style.display = 'none';
        }
        
        // Show modal
        modal.style.display = 'block';
        
        // Select all text in input for easy replacement
        setTimeout(() => {
            nameInput.select();
            nameInput.focus();
        }, 100);
    }
    
    confirmSave(configName, overwriteId = null, downloadFile = true) {
        const config = this.cargoManager.exportConfiguration();
        config.vehicleType = this.currentVehicle;
        
        // Save to localStorage with optional overwrite
        const savedId = this.saveToLocalStorage(configName, config, overwriteId);
        
        // Download file only if requested
        if (downloadFile) {
            const json = JSON.stringify(config, null, 2);
            const blob = new Blob([json], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            
            const filename = `${configName.replace(/[^a-z0-9_\-]/gi, '_')}.transportnomad`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
        }
        
        // Hide modal
        document.getElementById('saveConfigModal').style.display = 'none';
        
        // Show notification
        if (savedId) {
            let message;
            if (overwriteId && downloadFile) {
                message = 'Configuration overwritten and downloaded';
            } else if (overwriteId) {
                message = 'Configuration overwritten in browser memory';
            } else if (downloadFile) {
                message = 'Configuration saved to file and browser memory';
            } else {
                message = 'Configuration saved in browser memory';
            }
            this.showNotification(message, 'success');
        } else {
            this.showNotification(downloadFile ? i18n.t('configSavedToFile') : i18n.t('saveError'), 'error');
        }
    }
    
    loadConfiguration() {
        const modal = document.getElementById('loadConfigModal');
        
        // Load and display saved configurations
        this.refreshSavedConfigsList();
        
        // Show modal
        modal.style.display = 'block';
    }
    
    refreshSavedConfigsList() {
        const listContainer = document.getElementById('savedConfigsList');
        const noConfigsMsg = document.getElementById('noConfigsMessage');
        const configs = this.getStoredConfigurations();
        
        if (configs.length === 0) {
            listContainer.style.display = 'none';
            noConfigsMsg.style.display = 'block';
            return;
        }
        
        listContainer.style.display = 'block';
        noConfigsMsg.style.display = 'none';
        
        // Build HTML for configs
        listContainer.innerHTML = configs.map(config => {
            const date = new Date(config.date);
            const dateStr = date.toLocaleDateString('pl-PL');
            const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            const vehicleName = CONFIG.vehicles[config.vehicleType]?.name || 'Custom';
            
            // Show groups summary or use stats
            const groupsInfo = config.groupsSummary || 
                (config.stats.totalItems > 0 ? `${config.stats.totalItems} units` : 'No cargo');
            
            return `
                <div class="config-item" data-config-id="${config.id}">
                    <div class="config-item-info" onclick="window.uiInstance.loadStoredConfiguration('${config.id}')">
                        <div class="config-item-name">${config.name}</div>
                        <div class="config-item-details">
                            <span class="config-item-detail" style="font-weight: 500;">${vehicleName}</span>
                            <span class="config-item-detail">${config.stats.totalWeight} kg</span>
                            <span class="config-item-detail">${dateStr} ${timeStr}</span>
                        </div>
                        <div class="config-item-groups" style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                            ${groupsInfo}
                        </div>
                    </div>
                    <div class="config-item-actions">
                        <button class="config-delete-btn" onclick="event.stopPropagation(); window.uiInstance.deleteAndRefresh('${config.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    loadStoredConfiguration(configId) {
        const configs = this.getStoredConfigurations();
        const config = configs.find(c => c.id === configId);
        
        if (config) {
            this.applyConfiguration(config.data);
            
            // Update current config tracking
            this.currentConfigId = config.id;
            this.currentConfigName = config.name;
            this.updateCurrentConfigDisplay();
            
            document.getElementById('loadConfigModal').style.display = 'none';
            this.showNotification(i18n.t('configurationLoaded'), 'success');
        }
    }
    
    deleteAndRefresh(configId) {
        if (confirm(i18n.t('confirmDelete'))) {
            this.deleteStoredConfiguration(configId);
            this.refreshSavedConfigsList();
        }
    }
    
    loadFromFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                this.applyConfiguration(config);
                
                // Extract config name from filename
                const configName = file.name.replace(/\.(transportnomad|json)$/, '');
                
                // Check if config with same name exists in localStorage
                const existingConfigs = this.getStoredConfigurations();
                const existingConfig = existingConfigs.find(c => c.name === configName);
                
                // Save to localStorage (will overwrite if exists)
                const savedId = this.saveToLocalStorage(
                    configName, 
                    config, 
                    existingConfig ? existingConfig.id : null
                );
                
                // Update current config tracking
                this.currentConfigId = savedId;
                this.currentConfigName = configName;
                this.updateCurrentConfigDisplay();
                
                document.getElementById('loadConfigModal').style.display = 'none';
                
                if (existingConfig) {
                    this.showNotification(i18n.t('configLoadedFromFile'), 'success');
                } else {
                    this.showNotification(i18n.t('configLoadedFromFileSaved'), 'success');
                }
            } catch (error) {
                console.error('Error loading configuration:', error);
                this.showNotification(i18n.t('errorLoadingConfiguration'), 'error');
            }
        };
        reader.readAsText(file);
    }
    
    applyConfiguration(config) {
        try {
            // THEN: Change vehicle type BEFORE importing configuration
            const vehicleType = config.vehicleType || 'custom';
            const customSelect = document.getElementById('vehicleSelect');
            const customDimensions = document.getElementById('customDimensions');
            const soloDimensionSliders = document.getElementById('soloDimensionSliders');
            const jumboDimensionSliders = document.getElementById('jumboDimensionSliders');
            
            // Always update dropdown visual for all vehicle types
            const option = customSelect.querySelector(`.custom-option[data-value="${vehicleType}"]`);
            if (option) {
                const name = option.querySelector('.option-name').textContent;
                const dimensions = option.querySelector('.option-dimensions').textContent;
                
                customSelect.querySelector('.custom-select-trigger .option-name').textContent = name;
                customSelect.querySelector('.custom-select-trigger .option-dimensions').textContent = dimensions;
                
                // Update all options selected state
                customSelect.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            } else {
                console.warn(`Vehicle type option not found: ${vehicleType}`);
            }
            
            // Show/hide appropriate dimension controls based on vehicle type
            if (vehicleType === 'solo') {
                customDimensions.classList.add('hidden');
                soloDimensionSliders.classList.remove('hidden');
                jumboDimensionSliders.classList.add('hidden');
                
                // Update SOLO sliders if container dimensions are saved
                if (config.container) {
                    const soloLengthSlider = document.getElementById('soloLengthSlider');
                    const soloHeightSlider = document.getElementById('soloHeightSlider');
                    const soloLengthValue = document.getElementById('soloLengthValue');
                    const soloHeightValue = document.getElementById('soloHeightValue');
                    
                    if (soloLengthSlider && config.container.length) {
                        soloLengthSlider.value = config.container.length;
                        soloLengthValue.textContent = `${config.container.length.toFixed(2)}m`;
                    }
                    if (soloHeightSlider && config.container.height) {
                        soloHeightSlider.value = config.container.height;
                        soloHeightValue.textContent = `${config.container.height.toFixed(1)}m`;
                    }
                }
                
                // Store current vehicle before changing
                const previousVehicle = this.currentVehicle;
                
                // Load the vehicle (this sets up the container)
                this.loadVehicle(vehicleType, previousVehicle);
                this.currentVehicle = vehicleType;
            } else if (vehicleType === 'jumbo') {
                customDimensions.classList.add('hidden');
                soloDimensionSliders.classList.add('hidden');
                jumboDimensionSliders.classList.remove('hidden');
                
                // Update JUMBO sliders if sections are saved
                if (config.container && config.container.sections) {
                    const jumboSection1LengthSlider = document.getElementById('jumboSection1LengthSlider');
                    const jumboSection1HeightSlider = document.getElementById('jumboSection1HeightSlider');
                    const jumboSection2LengthSlider = document.getElementById('jumboSection2LengthSlider');
                    const jumboSection2HeightSlider = document.getElementById('jumboSection2HeightSlider');
                    const jumboSection1LengthValue = document.getElementById('jumboSection1LengthValue');
                    const jumboSection1HeightValue = document.getElementById('jumboSection1HeightValue');
                    const jumboSection2LengthValue = document.getElementById('jumboSection2LengthValue');
                    const jumboSection2HeightValue = document.getElementById('jumboSection2HeightValue');
                    
                    if (jumboSection1LengthSlider && config.container.sections[0]) {
                        jumboSection1LengthSlider.value = config.container.sections[0].length;
                        jumboSection1LengthValue.textContent = `${config.container.sections[0].length.toFixed(2)}m`;
                        jumboSection1HeightSlider.value = config.container.sections[0].height;
                        jumboSection1HeightValue.textContent = `${config.container.sections[0].height.toFixed(1)}m`;
                    }
                    if (jumboSection2LengthSlider && config.container.sections[1]) {
                        jumboSection2LengthSlider.value = config.container.sections[1].length;
                        jumboSection2LengthValue.textContent = `${config.container.sections[1].length.toFixed(2)}m`;
                        jumboSection2HeightSlider.value = config.container.sections[1].height;
                        jumboSection2HeightValue.textContent = `${config.container.sections[1].height.toFixed(1)}m`;
                    }
                }
                
                // Store current vehicle before changing
                const previousVehicle = this.currentVehicle;
                
                // Load the vehicle (this sets up the container)
                this.loadVehicle(vehicleType, previousVehicle);
                this.currentVehicle = vehicleType;
            } else if (vehicleType === 'custom') {
                // Show custom dimensions controls
                customDimensions.classList.remove('hidden');
                soloDimensionSliders.classList.add('hidden');
                jumboDimensionSliders.classList.add('hidden');

                // Update custom dimension sliders
                if (config.container) {
                    const customLengthSlider = document.getElementById('customLengthSlider');
                    const customWidthSlider = document.getElementById('customWidthSlider');
                    const customHeightSlider = document.getElementById('customHeightSlider');
                    const customLengthValue = document.getElementById('customLengthValue');
                    const customWidthValue = document.getElementById('customWidthValue');
                    const customHeightValue = document.getElementById('customHeightValue');

                    if (customLengthSlider && config.container.length) {
                        customLengthSlider.value = config.container.length;
                        customLengthValue.textContent = `${config.container.length.toFixed(2)}m`;
                    }
                    if (customWidthSlider && config.container.width) {
                        customWidthSlider.value = config.container.width;
                        customWidthValue.textContent = `${config.container.width.toFixed(2)}m`;
                    }
                    if (customHeightSlider && config.container.height) {
                        customHeightSlider.value = config.container.height;
                        customHeightValue.textContent = `${config.container.height.toFixed(2)}m`;
                    }
                }

                // Use loadCustomVehicle to properly set up custom space (with isCustomSpace flag and hidden axle panel)
                this.loadCustomVehicle();
                this.currentVehicle = 'custom';
            } else {
                // Standard vehicles (standard, mega, coilmulde, containers etc.) - hide all dimension controls
                customDimensions.classList.add('hidden');
                soloDimensionSliders.classList.add('hidden');
                jumboDimensionSliders.classList.add('hidden');
                
                // Store current vehicle before changing
                const previousVehicle = this.currentVehicle;
                
                // Load the vehicle (this sets up the container)
                this.loadVehicle(vehicleType, previousVehicle);
                this.currentVehicle = vehicleType;
            }
            
            // THEN: Import the cargo items (now the correct container is set)
            const result = this.cargoManager.importConfiguration(config);
            
            this.updateLoadedUnitsList();
            this.updateStatistics();
            this.updateAxleIndicators();
            // Update 3D axle load visualization if enabled
            if (this.scene3d.showAxleLoads) {
                this.scene3d.updateAxleLoadVisualization();
            }
        } catch (error) {
            console.error('Error applying configuration:', error);
            this.showNotification(i18n.t('errorLoadingConfiguration'), 'error');
        }
    }
    
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;

        // Append to scene-container instead of body
        const sceneContainer = document.querySelector('.scene-container');
        if (sceneContainer) {
            sceneContainer.appendChild(notification);
        } else {
            document.body.appendChild(notification);
        }

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    setupAxleSettingsModal() {
        const modal = document.getElementById('axleSettingsModal');
        const openBtn = document.getElementById('axleSettingsBtn');
        const closeBtn = document.getElementById('closeAxleSettings');
        const saveBtn = document.getElementById('saveAxleSettings');
        const resetBtn = document.getElementById('resetAxleSettings');
        
        // Open modal
        openBtn.addEventListener('click', () => {
            this.loadAxleSettings();
            this.updateAxleModalForVehicleType();
            modal.style.display = 'block';
        });
        
        // Close modal
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Save settings
        saveBtn.addEventListener('click', () => {
            this.saveAxleSettings();
            modal.style.display = 'none';
            this.showNotification(i18n.t('axleSettingsSaved'), 'success');
        });
        
        // Reset to defaults
        resetBtn.addEventListener('click', () => {
            this.axleCalculator.axleConfig.resetToDefaults();
            this.loadAxleSettings();
            this.showNotification(i18n.t('defaultSettingsRestored'), 'info');
        });
    }

    setupAxleInfoModal() {
        const modal = document.getElementById('axleInfoModal');
        const openBtn = document.getElementById('axleInfoBtn');
        const openBtnModal = document.getElementById('axleInfoBtnModal');
        const closeBtn = document.getElementById('closeAxleInfo');

        // Check if elements exist
        if (!modal || !openBtn || !openBtnModal || !closeBtn) {
            console.error('Axle Info Modal elements not found:', {
                modal: !!modal,
                openBtn: !!openBtn,
                openBtnModal: !!openBtnModal,
                closeBtn: !!closeBtn
            });
            return;
        }

        // Open modal
        const openModal = () => {
            modal.style.display = 'block';
        };

        openBtn.addEventListener('click', openModal);
        openBtnModal.addEventListener('click', openModal);

        // Close modal
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.addEventListener('click', closeModal);

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    loadAxleSettings() {
        const config = this.axleCalculator.axleConfig;
        const isSolo = this.currentVehicleConfig?.isSolo || false;
        const isJumbo = this.currentVehicleConfig?.isJumbo || false;
        
        // Set radio buttons
        document.querySelector(`input[name="tractorAxles"][value="${config.tractorAxles}"]`).checked = true;
        if (!isSolo && config.trailerAxles) {
            document.querySelector(`input[name="trailerAxles"][value="${config.trailerAxles}"]`).checked = true;
        }
        
        // Set distances based on vehicle type
        if (isSolo) {
            // SOLO distances
            if (document.getElementById('distCargoStartToFront')) {
                const value = config.distCargoStartToFront || 1.0;
                document.getElementById('distCargoStartToFront').value = value;
                const display = document.getElementById('distCargoStartToFrontValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
            if (document.getElementById('distCargoStartToDrive')) {
                const value = config.distCargoStartToDrive || 5.5;
                document.getElementById('distCargoStartToDrive').value = value;
                const display = document.getElementById('distCargoStartToDriveValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
        } else if (isJumbo) {
            // JUMBO distances (truck + trailer)
            if (document.getElementById('distSection1StartToFront')) {
                const value = config.distSection1StartToFront || 1.0;
                document.getElementById('distSection1StartToFront').value = value;
                const display = document.getElementById('distSection1StartToFrontValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
            if (document.getElementById('distSection1StartToDrive')) {
                const value = config.distSection1StartToDrive || 5.5;
                document.getElementById('distSection1StartToDrive').value = value;
                const display = document.getElementById('distSection1StartToDriveValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
            if (document.getElementById('distSection2StartToTrailerAxles')) {
                const value = config.distSection2StartToTrailerAxles || 5.5;
                document.getElementById('distSection2StartToTrailerAxles').value = value;
                const display = document.getElementById('distSection2StartToTrailerAxlesValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
        } else {
            // Trailer distances
            if (document.getElementById('distFrontToKingpin')) {
                const value = config.distFrontToKingpin || 1.7;
                document.getElementById('distFrontToKingpin').value = value;
                const display = document.getElementById('distFrontToKingpinValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
            if (document.getElementById('distKingpinToTrailer')) {
                const value = config.distKingpinToTrailer || 7.7;
                document.getElementById('distKingpinToTrailer').value = value;
                const display = document.getElementById('distKingpinToTrailerValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
            if (document.getElementById('distFrontAxleToKingpin')) {
                const value = config.distFrontAxleToKingpin || 3.1;
                document.getElementById('distFrontAxleToKingpin').value = value;
                const display = document.getElementById('distFrontAxleToKingpinValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
            if (document.getElementById('distKingpinToDrive')) {
                const value = config.distKingpinToDrive || 0.5;
                document.getElementById('distKingpinToDrive').value = value;
                const display = document.getElementById('distKingpinToDriveValue');
                if (display) display.textContent = `${parseFloat(value).toFixed(2)}m`;
            }
        }
        
        // Set empty weights
        document.getElementById('emptyFrontAxle').value = config.emptyFrontAxle;
        document.getElementById('emptyDriveAxles').value = config.emptyDriveAxles;
        if (!isSolo) {
            document.getElementById('emptyTrailerAxles').value = config.emptyTrailerAxles || 5200;
        }
        
        // Set max loads
        document.getElementById('maxFrontAxle').value = config.maxFrontAxle;
        document.getElementById('maxDriveAxles').value = config.maxDriveAxles;
        if (!isSolo) {
            document.getElementById('maxTrailerAxles').value = config.maxTrailerAxles || 24000;
        }
        
        // Set minimum drive axle load
        document.getElementById('minDriveAxleLoad').value = config.minDriveAxleLoad || 25;
        
        // Load 3D axle loads display setting
        const showAxleLoadsCheckbox = document.getElementById('showAxleLoadsOn3D');
        if (showAxleLoadsCheckbox) {
            // Load from localStorage, default to true if no saved setting
            const savedSetting = localStorage.getItem('showAxleLoadsOn3D');
            showAxleLoadsCheckbox.checked = savedSetting === null || savedSetting === 'true';
        }
    }
    
    saveAxleSettings() {
        const isSolo = this.currentVehicleConfig?.isSolo || false;
        const isJumbo = this.currentVehicleConfig?.isJumbo || false;
        
        const config = {
            // Get axle counts
            tractorAxles: parseInt(document.querySelector('input[name="tractorAxles"]:checked').value),
        };
        
        if (isSolo) {
            // SOLO-specific settings
            config.distCargoStartToFront = parseFloat(document.getElementById('distCargoStartToFront').value);
            config.distCargoStartToDrive = parseFloat(document.getElementById('distCargoStartToDrive').value);
        } else if (isJumbo) {
            // JUMBO-specific settings (truck + trailer)
            config.trailerAxles = parseInt(document.querySelector('input[name="trailerAxles"]:checked').value);
            config.distSection1StartToFront = parseFloat(document.getElementById('distSection1StartToFront').value);
            config.distSection1StartToDrive = parseFloat(document.getElementById('distSection1StartToDrive').value);
            config.distSection2StartToTrailerAxles = parseFloat(document.getElementById('distSection2StartToTrailerAxles').value);
            config.emptyTrailerAxles = parseFloat(document.getElementById('emptyTrailerAxles').value);
            config.maxTrailerAxles = parseFloat(document.getElementById('maxTrailerAxles').value);
        } else {
            // Trailer settings
            config.trailerAxles = parseInt(document.querySelector('input[name="trailerAxles"]:checked').value);
            config.distFrontToKingpin = parseFloat(document.getElementById('distFrontToKingpin').value);
            config.distKingpinToTrailer = parseFloat(document.getElementById('distKingpinToTrailer').value);
            config.distFrontAxleToKingpin = parseFloat(document.getElementById('distFrontAxleToKingpin').value);
            config.distKingpinToDrive = parseFloat(document.getElementById('distKingpinToDrive').value);
            config.emptyTrailerAxles = parseFloat(document.getElementById('emptyTrailerAxles').value);
            config.maxTrailerAxles = parseFloat(document.getElementById('maxTrailerAxles').value);
        }
        
        // Common settings
        config.emptyFrontAxle = parseFloat(document.getElementById('emptyFrontAxle').value);
        config.emptyDriveAxles = parseFloat(document.getElementById('emptyDriveAxles').value);
        config.maxFrontAxle = parseFloat(document.getElementById('maxFrontAxle').value);
        config.maxDriveAxles = parseFloat(document.getElementById('maxDriveAxles').value);
        config.minDriveAxleLoad = parseFloat(document.getElementById('minDriveAxleLoad').value);
        
        // Update axle calculator configuration
        this.axleCalculator.updateAxleConfiguration(config);
        
        // Update axle indicators
        this.updateAxleIndicators();

        // Save and apply 3D axle loads display setting
        const showAxleLoadsCheckbox = document.getElementById('showAxleLoadsOn3D');
        if (showAxleLoadsCheckbox) {
            const showAxleLoads = showAxleLoadsCheckbox.checked;
            localStorage.setItem('showAxleLoadsOn3D', showAxleLoads);
            // Toggle 3D axle load display
            this.scene3d.toggleAxleLoadDisplay(showAxleLoads);
        }

        // Update 3D visualization
        this.scene3d.updateAxleVisualization(config);

        // Update 3D axle load labels (positions and values)
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }
    }

    updateAxleConfiguration() {
        // Read current values from distance sliders and update axle calculator
        const isSolo = this.currentVehicleConfig?.isSolo || false;
        const isJumbo = this.currentVehicleConfig?.isJumbo || false;

        const config = {
            // Get axle counts
            tractorAxles: parseInt(document.querySelector('input[name="tractorAxles"]:checked')?.value || 1)
        };

        if (isSolo) {
            // SOLO settings
            config.distCargoStartToFront = parseFloat(document.getElementById('distCargoStartToFront').value);
            config.distCargoStartToDrive = parseFloat(document.getElementById('distCargoStartToDrive').value);
        } else if (isJumbo) {
            // JUMBO settings
            config.trailerAxles = parseInt(document.querySelector('input[name="trailerAxles"]:checked')?.value || 2);
            config.distSection1StartToFront = parseFloat(document.getElementById('distSection1StartToFront').value);
            config.distSection1StartToDrive = parseFloat(document.getElementById('distSection1StartToDrive').value);
            config.distSection2StartToTrailerAxles = parseFloat(document.getElementById('distSection2StartToTrailerAxles').value);
        } else {
            // Standard trailer settings
            config.trailerAxles = parseInt(document.querySelector('input[name="trailerAxles"]:checked')?.value || 3);
            config.distFrontToKingpin = parseFloat(document.getElementById('distFrontToKingpin').value);
            config.distKingpinToTrailer = parseFloat(document.getElementById('distKingpinToTrailer').value);
            config.distFrontAxleToKingpin = parseFloat(document.getElementById('distFrontAxleToKingpin').value);
            config.distKingpinToDrive = parseFloat(document.getElementById('distKingpinToDrive').value);
        }

        // Update axle calculator configuration
        this.axleCalculator.updateAxleConfiguration(config);

        // Update axle indicators
        this.updateAxleIndicators();

        // Update 3D visualization
        this.scene3d.updateAxleVisualization(config);

        // Update 3D axle load labels (positions and values)
        if (this.scene3d.showAxleLoads) {
            this.scene3d.updateAxleLoadVisualization();
        }
    }

    // Removed - group selection is now only available via context menu (RMB)
    // handleGroupClick(event, group) { ... }

    setupGroupSelectionCallbacks() {
        // Set up callback for group selection changes
        this.cargoManager.onGroupSelectionChanged = (groupId) => {
            this.onGroupSelectionChanged(groupId);
        };
    }
    
    setupSaveConfigModal() {
        const modal = document.getElementById('saveConfigModal');
        const closeBtn = document.getElementById('closeSaveConfig');
        const cancelBtn = document.getElementById('cancelSaveConfig');
        const confirmBtn = document.getElementById('confirmSaveConfig');
        const confirmDownloadBtn = document.getElementById('confirmSaveDownloadConfig');
        const overwriteBtn = document.getElementById('overwriteSaveConfig');
        const overwriteDownloadBtn = document.getElementById('overwriteSaveDownloadConfig');
        const nameInput = document.getElementById('configNameInput');
        const existingList = document.getElementById('existingConfigsList');
        const saveButtonsGroup = document.querySelector('.save-buttons-group');
        const overwriteButtonsGroup = document.querySelector('.overwrite-buttons-group');
        
        // Variable to track selected config to overwrite
        this.selectedConfigToOverwrite = null;
        this.selectedConfigOriginalName = null;
        
        // Close modal handlers
        closeBtn.onclick = () => modal.style.display = 'none';
        cancelBtn.onclick = () => modal.style.display = 'none';
        
        // Confirm save (new config) - only to localStorage
        confirmBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (name) {
                // Always ensure unique name when saving as new
                const uniqueName = this.ensureUniqueConfigName(name);
                this.confirmSave(uniqueName, null, false); // false = no download
            }
        };
        
        // Confirm save with download (new config)
        if (confirmDownloadBtn) {
            confirmDownloadBtn.onclick = () => {
                const name = nameInput.value.trim();
                if (name) {
                    // Always ensure unique name when saving as new
                    const uniqueName = this.ensureUniqueConfigName(name);
                    this.confirmSave(uniqueName, null, true); // true = download
                }
            };
        }
        
        // Overwrite existing config - only to localStorage
        if (overwriteBtn) {
            overwriteBtn.onclick = () => {
                // Use original name when overwriting
                if (this.selectedConfigOriginalName && this.selectedConfigToOverwrite) {
                    this.confirmSave(this.selectedConfigOriginalName, this.selectedConfigToOverwrite, false); // false = no download
                }
            };
        }
        
        // Overwrite existing config with download
        if (overwriteDownloadBtn) {
            overwriteDownloadBtn.onclick = () => {
                // Use original name when overwriting
                if (this.selectedConfigOriginalName && this.selectedConfigToOverwrite) {
                    this.confirmSave(this.selectedConfigOriginalName, this.selectedConfigToOverwrite, true); // true = download
                }
            };
        }
        
        // Handle clicking on existing config items
        existingList.addEventListener('click', (e) => {
            const item = e.target.closest('.existing-config-item');
            if (item) {
                // Remove previous selection
                existingList.querySelectorAll('.existing-config-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Select clicked item
                item.classList.add('selected');
                this.selectedConfigToOverwrite = item.dataset.configId;
                this.selectedConfigOriginalName = item.dataset.configName;
                
                // Update input with selected config name - add suffix for new save
                const originalName = item.dataset.configName;
                nameInput.value = this.generateUniqueConfigName(originalName);
                
                // Show/hide appropriate buttons
                document.getElementById('saveConfigText').textContent = 'Save as new';
                document.getElementById('saveDownloadConfigText').textContent = 'Save as new and download';
                if (saveButtonsGroup && overwriteButtonsGroup) {
                    saveButtonsGroup.style.display = 'none';
                    overwriteButtonsGroup.style.display = 'flex';
                }
            }
        });
        
        // Enter to save, Escape to cancel
        nameInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedConfigToOverwrite && overwriteBtn) {
                    overwriteBtn.click();
                } else {
                    confirmBtn.click();
                }
            } else if (e.key === 'Escape') {
                modal.style.display = 'none';
            }
        };
        
        // Reset selection when typing in input
        nameInput.oninput = () => {
            existingList.querySelectorAll('.existing-config-item').forEach(el => {
                el.classList.remove('selected');
            });
            this.selectedConfigToOverwrite = null;
            this.selectedConfigOriginalName = null;
            document.getElementById('saveConfigText').textContent = 'Save as new';
            document.getElementById('saveDownloadConfigText').textContent = 'Save and download';
            if (saveButtonsGroup && overwriteButtonsGroup) {
                saveButtonsGroup.style.display = 'flex';
                overwriteButtonsGroup.style.display = 'none';
            }
        };
        
        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    setupLoadConfigModal() {
        const modal = document.getElementById('loadConfigModal');
        const closeBtn = document.getElementById('closeLoadConfig');
        const fileInput = document.getElementById('configFileInput');
        const browseBtn = document.getElementById('browseFileBtn');
        const dropZone = document.getElementById('fileDropZone');
        const searchInput = document.getElementById('configSearch');
        
        // Close modal
        closeBtn.onclick = () => modal.style.display = 'none';
        
        // File upload handlers
        browseBtn.onclick = (e) => {
            e.stopPropagation();  // Prevent event bubbling to dropZone
            fileInput.click();
        };
        
        fileInput.onchange = (e) => {
            if (e.target.files[0]) {
                this.loadFromFile(e.target.files[0]);
                // Reset the input value to allow selecting the same file again
                e.target.value = '';
            }
        };
        
        // Drag and drop - click on drop zone (but not on button)
        dropZone.onclick = (e) => {
            // Only trigger if clicking directly on dropZone, not on child elements like button
            if (e.target === dropZone || e.target.closest('.upload-icon') || e.target.tagName === 'H3' || (e.target.tagName === 'P' && !e.target.querySelector('button'))) {
                fileInput.click();
            }
        };
        
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        };
        
        dropZone.ondragleave = () => {
            dropZone.classList.remove('dragover');
        };
        
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.transportnomad') || file.name.endsWith('.json')) {
                    this.loadFromFile(file);
                } else {
                    this.showNotification(i18n.t('invalidFileFormat'), 'error');
                }
            }
        };
        
        // Search functionality
        searchInput.oninput = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const configItems = document.querySelectorAll('.config-item');
            
            configItems.forEach(item => {
                const name = item.querySelector('.config-item-name').textContent.toLowerCase();
                const details = item.querySelector('.config-item-details').textContent.toLowerCase();
                
                if (name.includes(searchTerm) || details.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        };
        
        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // LocalStorage Configuration Manager
    getStoredConfigurations() {
        try {
            const stored = localStorage.getItem('transportnomad_configurations');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error reading stored configurations:', e);
        }
        return [];
    }
    
    saveToLocalStorage(configName, configData, overwriteId = null) {
        try {
            let configs = this.getStoredConfigurations();
            
            // Get groups summary for display
            const groups = {};
            const groupCounts = {};
            this.cargoManager.cargoItems.forEach(item => {
                if (!groups[item.groupId]) {
                    groups[item.groupId] = item.name || item.type;
                    groupCounts[item.groupId] = 0;
                }
                groupCounts[item.groupId]++;
            });
            
            // Create groups summary string for display
            const groupsList = Object.keys(groups).map(groupId => 
                `${groups[groupId]} x${groupCounts[groupId]}`
            ).join(', ');
            
            const configWithMeta = {
                id: overwriteId || Date.now().toString(),
                name: configName,
                date: new Date().toISOString(),
                vehicleType: this.currentVehicle,
                stats: this.cargoManager.getStatistics(),
                groupsSummary: groupsList || 'No cargo',
                data: configData
            };
            
            if (overwriteId) {
                // Find and update existing config
                const existingIndex = configs.findIndex(c => c.id === overwriteId);
                if (existingIndex !== -1) {
                    // Replace existing config
                    configs[existingIndex] = configWithMeta;
                    
                    // Move to beginning if not already there
                    if (existingIndex !== 0) {
                        const updatedConfig = configs.splice(existingIndex, 1)[0];
                        configs.unshift(updatedConfig);
                    }
                } else {
                    // If ID not found, add as new
                    configs.unshift(configWithMeta);
                }
            } else {
                // Add new config to beginning of array
                configs.unshift(configWithMeta);
            }
            
            // Keep only last configurations (FIFO - oldest removed first)
            if (configs.length > this.MAX_STORED_CONFIGS) {
                configs = configs.slice(0, this.MAX_STORED_CONFIGS);
            }
            
            // Update current config tracking
            this.currentConfigId = configWithMeta.id;
            this.currentConfigName = configName;
            
            localStorage.setItem('transportnomad_configurations', JSON.stringify(configs));
            
            // Update UI to show current config
            this.updateCurrentConfigDisplay();
            
            return configWithMeta.id;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    }
    
    deleteStoredConfiguration(configId) {
        try {
            let configs = this.getStoredConfigurations();
            configs = configs.filter(c => c.id !== configId);
            localStorage.setItem('transportnomad_configurations', JSON.stringify(configs));
            
            // If deleting current config, clear tracking
            if (this.currentConfigId === configId) {
                this.currentConfigId = null;
                this.currentConfigName = null;
                this.updateCurrentConfigDisplay();
            }
            
            return true;
        } catch (e) {
            console.error('Error deleting configuration:', e);
            return false;
        }
    }
    
    updateCurrentConfigDisplay() {
        const display = document.getElementById('currentConfigDisplay');
        const nameInput = document.getElementById('currentConfigName');
        
        if (this.currentConfigName) {
            nameInput.value = this.currentConfigName;
        } else {
            // Generate default name if no config is loaded
            nameInput.value = '';
            nameInput.placeholder = this.generateDefaultName();
        }
        
        // Always show the display
        display.style.display = 'flex';
        
        // Check if name exists and update button styles
        this.checkConfigNameExists(nameInput.value || nameInput.placeholder);
    }
    
    quickSave() {
        const nameInput = document.getElementById('currentConfigName');
        let configName = nameInput.value.trim();
        const userTypedName = configName !== ''; // Check if user explicitly typed a name
        
        // If no name provided, generate default name
        if (!configName) {
            configName = this.generateDefaultName();
        }
        
        const config = this.cargoManager.exportConfiguration();
        
        // Check if config with this name exists
        const existingConfig = this.getStoredConfigurations().find(c => c.name === configName);
        
        // Handle name conflicts
        let finalName = configName;
        let overwriteId = null;
        
        if (existingConfig) {
            if (userTypedName) {
                // User explicitly typed an existing name - allow overwrite
                overwriteId = existingConfig.id;
            } else {
                // Auto-generated name conflict - make it unique
                finalName = this.ensureUniqueConfigName(configName);
            }
        } else if (this.currentConfigId && configName === this.currentConfigName) {
            // Saving current config with same name
            overwriteId = this.currentConfigId;
        }
        
        const savedId = this.saveToLocalStorage(finalName, config, overwriteId);
        
        if (savedId) {
            // Update current config tracking
            this.currentConfigId = savedId;
            this.currentConfigName = finalName;
            nameInput.value = finalName;
            
            const message = overwriteId ? 'Configuration overwritten' : 'Configuration saved';
            this.showNotification(i18n.t('configSavedInMemory').replace('{message}', message), 'success');
            this.checkConfigNameExists(finalName);
        } else {
            this.showNotification(i18n.t('configurationSaveError'), 'error');
        }
    }
    
    quickSaveAndDownload() {
        const nameInput = document.getElementById('currentConfigName');
        let configName = nameInput.value.trim();
        const userTypedName = configName !== ''; // Check if user explicitly typed a name
        
        // If no name provided, generate default name
        if (!configName) {
            configName = this.generateDefaultName();
        }
        
        const config = this.cargoManager.exportConfiguration();
        
        // Check if config with this name exists
        const existingConfig = this.getStoredConfigurations().find(c => c.name === configName);
        
        // Handle name conflicts
        let finalName = configName;
        let overwriteId = null;
        
        if (existingConfig) {
            if (userTypedName) {
                // User explicitly typed an existing name - allow overwrite
                overwriteId = existingConfig.id;
            } else {
                // Auto-generated name conflict - make it unique
                finalName = this.ensureUniqueConfigName(configName);
            }
        } else if (this.currentConfigId && configName === this.currentConfigName) {
            // Saving current config with same name
            overwriteId = this.currentConfigId;
        }
        
        const savedId = this.saveToLocalStorage(finalName, config, overwriteId);
        
        if (savedId) {
            // Update current config tracking
            this.currentConfigId = savedId;
            this.currentConfigName = finalName;
            nameInput.value = finalName;
            
            // Also download the file
            const json = JSON.stringify(config, null, 2);
            const blob = new Blob([json], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            
            const filename = `${finalName.replace(/[^a-z0-9_\-]/gi, '_')}.transportnomad`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            
            const message = overwriteId ? 'Configuration overwritten and downloaded' : 'Configuration saved and downloaded';
            this.showNotification(message, 'success');
            this.checkConfigNameExists(finalName);
        } else {
            this.showNotification(i18n.t('configurationSaveError'), 'error');
        }
    }
    
    generateUniqueConfigName(baseName) {
        const configs = this.getStoredConfigurations();
        const existingNames = configs.map(c => c.name);
        
        // If base name doesn't exist, suggest with (kopia)
        if (!existingNames.includes(baseName)) {
            return baseName + ' (kopia)';
        }
        
        // Find a unique suffix number
        let counter = 2;
        let newName = `${baseName} (kopia)`;
        
        while (existingNames.includes(newName)) {
            newName = `${baseName} (kopia ${counter})`;
            counter++;
        }
        
        return newName;
    }
    
    ensureUniqueConfigName(name) {
        const configs = this.getStoredConfigurations();
        const existingNames = configs.map(c => c.name);
        
        // If name is already unique, return it
        if (!existingNames.includes(name)) {
            return name;
        }
        
        // First try adding "(kopia)"
        let uniqueName = `${name} (kopia)`;
        if (!existingNames.includes(uniqueName)) {
            return uniqueName;
        }
        
        // If "(kopia)" exists, add numbers
        let counter = 2;
        uniqueName = `${name} (kopia ${counter})`;
        
        while (existingNames.includes(uniqueName)) {
            counter++;
            uniqueName = `${name} (kopia ${counter})`;
        }
        
        return uniqueName;
    }
    
    checkConfigNameExists(name) {
        if (!name || !name.trim()) {
            // Disable buttons if no name
            document.getElementById('quickSaveBtn').disabled = true;
            document.getElementById('quickSaveDownloadBtn').disabled = true;
            return false;
        }
        
        // Enable buttons
        document.getElementById('quickSaveBtn').disabled = false;
        document.getElementById('quickSaveDownloadBtn').disabled = false;
        
        // Check if name exists
        const exists = this.getStoredConfigurations().some(c => c.name === name);
        
        // Update button styles based on whether config exists
        const saveBtn = document.getElementById('quickSaveBtn');
        const saveDownloadBtn = document.getElementById('quickSaveDownloadBtn');
        
        if (exists) {
            // Orange color for overwrite
            saveBtn.classList.add('btn-overwrite');
            saveDownloadBtn.classList.add('btn-overwrite');
            saveBtn.title = 'Overwrite in memory';
            saveDownloadBtn.title = 'Overwrite and download';
        } else {
            // Normal colors
            saveBtn.classList.remove('btn-overwrite');
            saveDownloadBtn.classList.remove('btn-overwrite');
            saveBtn.title = 'Save to memory';
            saveDownloadBtn.title = 'Save and download';
        }
        
        return exists;
    }
    
    generateDefaultName() {
        const vehicleName = CONFIG.vehicles[this.currentVehicle]?.name || 'Custom';
        const stats = this.cargoManager.getStatistics();
        
        // Get all cargo groups with counts
        const groups = {};
        const groupCounts = {};
        this.cargoManager.cargoItems.forEach(item => {
            if (!groups[item.groupId]) {
                groups[item.groupId] = item.name || item.type;
                groupCounts[item.groupId] = 0;
            }
            groupCounts[item.groupId]++;
        });
        
        // Create group summary string
        let groupsSummary = '';
        Object.keys(groups).forEach((groupId, index) => {
            if (index < 3) { // Limit to first 3 groups to avoid too long names
                const name = groups[groupId].substring(0, 5);
                const count = groupCounts[groupId];
                groupsSummary += `_${name}x${count}`;
            }
        });
        
        // If more than 3 groups, add info
        if (Object.keys(groups).length > 3) {
            groupsSummary += '_etc';
        }
        
        // Format date and time
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
        
        // Build name components
        const components = [
            vehicleName.replace(/ /g, ''),
            groupsSummary,
            stats.totalWeight > 0 ? `_${stats.totalWeight}kg` : '',
            `_${dateStr}_${timeStr}`
        ];
        
        let fullName = components.join('');
        
        // Truncate if too long
        if (fullName.length > 230) {
            fullName = fullName.substring(0, 230);
        }
        
        return fullName;
    }
    
    onGroupSelectionChanged(selectedGroupId) {
        // Update UI to reflect group selection state
        this.updateLoadedUnitsList();
    }
    
    updateAxleModalForVehicleType() {
        const isSolo = this.currentVehicleConfig?.isSolo || false;
        const isJumbo = this.currentVehicleConfig?.isJumbo || false;
        
        // Get all elements to show/hide
        const trailerAxlesGroup = document.getElementById('trailerAxlesGroup');
        const trailerDistances = document.querySelectorAll('.trailer-distance');
        const soloDistances = document.querySelectorAll('.solo-distance');
        const jumboDistances = document.querySelectorAll('.jumbo-distance');
        const trailerWeights = document.querySelectorAll('.trailer-weight');
        
        // Get trailer axle radio buttons
        const trailerAxle3Option = document.querySelector('input[name="trailerAxles"][value="3"]');
        const trailerAxle3Label = trailerAxle3Option ? trailerAxle3Option.parentElement : null;
        
        if (isSolo) {
            // Hide trailer-specific and JUMBO-specific elements
            if (trailerAxlesGroup) trailerAxlesGroup.style.display = 'none';
            trailerDistances.forEach(el => el.style.display = 'none');
            trailerWeights.forEach(el => el.style.display = 'none');
            jumboDistances.forEach(el => el.style.display = 'none');
            // Show SOLO-specific elements
            soloDistances.forEach(el => el.style.display = '');
        } else if (isJumbo) {
            // Show trailer axles group for JUMBO (has trailer section)
            if (trailerAxlesGroup) trailerAxlesGroup.style.display = '';
            trailerWeights.forEach(el => el.style.display = '');
            
            // Hide 3-axle option for JUMBO (max 2 axles)
            if (trailerAxle3Label) trailerAxle3Label.style.display = 'none';
            
            // If 3 axles was selected, switch to 2 axles
            if (trailerAxle3Option && trailerAxle3Option.checked) {
                const trailerAxle2Option = document.querySelector('input[name="trailerAxles"][value="2"]');
                if (trailerAxle2Option) trailerAxle2Option.checked = true;
            }
            
            // Hide standard trailer and SOLO elements
            trailerDistances.forEach(el => el.style.display = 'none');
            soloDistances.forEach(el => el.style.display = 'none');
            // Show JUMBO-specific elements
            jumboDistances.forEach(el => el.style.display = '');
        } else {
            // Show trailer-specific elements
            if (trailerAxlesGroup) trailerAxlesGroup.style.display = '';
            trailerDistances.forEach(el => el.style.display = '');
            trailerWeights.forEach(el => el.style.display = '');
            
            // Show 3-axle option for standard trailers
            if (trailerAxle3Label) trailerAxle3Label.style.display = '';
            
            // Hide SOLO and JUMBO-specific elements
            soloDistances.forEach(el => el.style.display = 'none');
            jumboDistances.forEach(el => el.style.display = 'none');
        }
    }
}