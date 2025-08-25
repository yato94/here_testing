class UI {
    constructor(scene3d, cargoManager, axleCalculator) {
        this.scene3d = scene3d;
        this.cargoManager = cargoManager;
        this.axleCalculator = axleCalculator;
        this.currentVehicle = 'standard';
        this.unitCounts = {};
        this.unitParameters = {};
        
        this.init();
    }
    
    init() {
        this.setupVehicleSelector();
        this.setupCargoUnits();
        this.setupControlButtons();
        this.setupViewControls();
        this.setupModalHandlers();
        this.updateStatistics();
    }
    
    setupVehicleSelector() {
        const vehicleSelect = document.getElementById('vehicleType');
        const customSelect = document.getElementById('vehicleSelect');
        const customSelectTrigger = customSelect.querySelector('.custom-select-trigger');
        const customOptions = customSelect.querySelector('.custom-options');
        const customDimensions = document.getElementById('customDimensions');
        
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
                
                // Store previous vehicle type before updating
                const previousVehicleType = this.currentVehicle;
                
                if (value === 'custom') {
                    customDimensions.classList.remove('hidden');
                    this.currentVehicle = value;
                } else {
                    customDimensions.classList.add('hidden');
                    // Pass previous vehicle type to loadVehicle
                    this.loadVehicle(value, previousVehicleType);
                    this.currentVehicle = value;
                }
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            customSelect.classList.remove('open');
            customOptions.classList.add('hidden');
        });
        
        const customInputs = customDimensions.querySelectorAll('input');
        customInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (this.currentVehicle === 'custom') {
                    this.loadCustomVehicle();
                }
            });
        });
        
        // Set initial selection
        options[0].classList.add('selected');
        this.currentVehicle = 'standard';
        this.loadVehicle('standard');
    }
    
    loadVehicle(vehicleType, previousVehicleType = null) {
        const vehicle = CONFIG.vehicles[vehicleType];
        if (!vehicle) return;
        
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
                this.showNotification(`${steelCoils.length} Steel Coils zostały usunięte - wymagana przestrzeń typu Coilmulde`, 'warning');
            }
        }
        
        const containerDimensions = {
            length: vehicle.length,
            width: vehicle.width,
            height: vehicle.height
        };
        
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
        
        this.cargoManager.setContainer(containerDimensions, vehicle.maxLoad);
        
        this.axleCalculator.setVehicle(vehicle);
        
        document.getElementById('dimensionsInfo').textContent = `${vehicle.length} × ${vehicle.width} × ${vehicle.height} m`;
        const volume = (vehicle.length * vehicle.width * vehicle.height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        document.getElementById('maxLoad').textContent = `${vehicle.maxLoad / 1000} ton`;
        
        this.updateAxleIndicators();
        
        // Auto arrange cargo if there are items
        if (this.cargoManager.cargoItems.length > 0) {
            this.autoArrangeCargo();
        }
    }
    
    loadCustomVehicle() {
        const length = parseFloat(document.getElementById('customLength').value);
        const width = parseFloat(document.getElementById('customWidth').value);
        const height = parseFloat(document.getElementById('customHeight').value);
        
        const customVehicle = {
            name: 'Własne wymiary',
            length: length,
            width: width,
            height: height,
            maxLoad: 24000,
            axles: {
                front: { position: length * 0.1, maxLoad: 7500 },
                rear: { position: length * 0.85, maxLoad: 23000 }
            }
        };
        
        // Update Steel Coil availability (custom vehicles don't have groove)
        this.updateSteelCoilAvailability(false);
        
        this.cargoManager.setContainer(
            { length: length, width: width, height: height },
            customVehicle.maxLoad
        );
        
        this.axleCalculator.setVehicle(customVehicle);
        
        document.getElementById('dimensionsInfo').textContent = `${length} × ${width} × ${height} m`;
        const volume = (length * width * height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        document.getElementById('maxLoad').textContent = `${customVehicle.maxLoad / 1000} ton`;
        
        this.updateAxleIndicators();
        
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
            
            // Setup weight kg/ton synchronization and max stack weight calculation
            const weightKgInput = card.querySelector('.unit-preset-weight-kg');
            const weightTInput = card.querySelector('.unit-preset-weight-t');
            const stackInput = card.querySelector('.unit-preset-stack');
            const maxWeightInput = card.querySelector('.unit-preset-max-weight');
            
            if (weightKgInput && weightTInput) {
                weightKgInput.addEventListener('input', (e) => {
                    const kg = parseFloat(e.target.value) || 0;
                    weightTInput.value = (kg / 1000).toFixed(3);
                    
                    // Auto-calculate max stack weight
                    if (stackInput && maxWeightInput) {
                        const stackCount = parseInt(stackInput.value) || 0;
                        maxWeightInput.value = (kg * stackCount).toFixed(0);
                    }
                });
                
                weightTInput.addEventListener('input', (e) => {
                    const tons = parseFloat(e.target.value) || 0;
                    const kg = tons * 1000;
                    weightKgInput.value = kg.toFixed(1);
                    
                    // Auto-calculate max stack weight
                    if (stackInput && maxWeightInput) {
                        const stackCount = parseInt(stackInput.value) || 0;
                        maxWeightInput.value = (kg * stackCount).toFixed(0);
                    }
                });
            }
            
            // Update max weight when stack count changes
            if (stackInput && maxWeightInput && weightKgInput) {
                stackInput.addEventListener('input', (e) => {
                    const stackCount = parseInt(e.target.value) || 0;
                    const kg = parseFloat(weightKgInput.value) || 0;
                    maxWeightInput.value = (kg * stackCount).toFixed(0);
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
                    const params = this.getPresetParameters(card);
                    
                    // Validate dimensions - for all types, not just custom-box
                    if (!params.dimensions || params.dimensions.length <= 0 || params.dimensions.width <= 0 || params.dimensions.height <= 0) {
                        this.showNotification('Wprowadź prawidłowe wymiary', 'error');
                        return;
                    }
                    
                    // Add specified amount of units
                    let addedCount = 0;
                    for (let i = 0; i < amount; i++) {
                        const cargo = this.addCargoUnitWithParams(unitType, params);
                        if (cargo) {
                            addedCount++;
                            this.unitCounts[unitType] = (this.unitCounts[unitType] || 0) + 1;
                        }
                    }
                    
                    if (addedCount > 0) {
                        // Always try to arrange to check if items fit
                        const result = this.cargoManager.autoArrange();
                        
                        if (result && !result.success && result.unpackedCount > 0) {
                            // Some items didn't fit and were removed
                            this.showNotification(`${result.unpackedCount} jednostek nie zmieściło się i zostało usuniętych`, 'error');
                            
                            // Update unit counts after removal
                            this.unitCounts = {};
                            this.cargoManager.cargoItems.forEach(item => {
                                this.unitCounts[item.type] = (this.unitCounts[item.type] || 0) + 1;
                            });
                        } else if (this.cargoManager.cargoItems.length > 50) {
                            // For performance, show message for manual arrangement when many items
                            this.showNotification('Dla dużej liczby jednostek użyj "Automatyczne rozmieszczenie"', 'info');
                        }
                        
                        this.updateLoadedUnitsList();
                        this.updateStatistics();
                        this.updateAxleIndicators();
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
                    const params = this.getPresetParameters(card);
                    
                    // Validate dimensions - for all types, not just custom-box
                    if (!params.dimensions || params.dimensions.length <= 0 || params.dimensions.width <= 0 || params.dimensions.height <= 0) {
                        this.showNotification('Wprowadź prawidłowe wymiary', 'error');
                        return;
                    }
                    
                    // Add specified amount of units
                    let addedCount = 0;
                    for (let i = 0; i < amount; i++) {
                        const cargo = this.addCargoUnitWithParams(unitType, params);
                        if (cargo) {
                            addedCount++;
                            this.unitCounts[unitType] = (this.unitCounts[unitType] || 0) + 1;
                        }
                    }
                    
                    if (addedCount > 0) {
                        // Always try to arrange to check if items fit
                        const result = this.cargoManager.autoArrange();
                        
                        if (result && !result.success && result.unpackedCount > 0) {
                            // Some items didn't fit and were removed
                            this.showNotification(`${result.unpackedCount} jednostek nie zmieściło się i zostało usuniętych`, 'error');
                            
                            // Update unit counts after removal
                            this.unitCounts = {};
                            this.cargoManager.cargoItems.forEach(item => {
                                this.unitCounts[item.type] = (this.unitCounts[item.type] || 0) + 1;
                            });
                        } else if (this.cargoManager.cargoItems.length > 50) {
                            // For performance, show message for manual arrangement when many items
                            this.showNotification('Dla dużej liczby jednostek użyj "Automatyczne rozmieszczenie"', 'info');
                        }
                        
                        this.updateLoadedUnitsList();
                        this.updateStatistics();
                        this.updateAxleIndicators();
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
    
    getPresetParameters(card) {
        const unitType = card.dataset.type;
        const nameInput = card.querySelector('.unit-preset-name');
        const weightInput = card.querySelector('.unit-preset-weight-kg');
        const stackInput = card.querySelector('.unit-preset-stack');
        const maxWeightInput = card.querySelector('.unit-preset-max-weight');
        
        // Handle Roll type with diameter and height
        if (unitType === 'roll') {
            // For Roll, use the same classes but they represent diameter and height
            const diameterInput = card.querySelector('.unit-preset-length[data-dimension="diameter"], .unit-preset-diameter');
            const rollHeightInput = card.querySelector('.unit-preset-width[data-dimension="height"], .unit-preset-roll-height');
            
            let dimensions = null;
            if (diameterInput && rollHeightInput) {
                const diameter = parseFloat(diameterInput.value);
                const height = parseFloat(rollHeightInput.value);
                if (diameter > 0 && height > 0) {
                    dimensions = {
                        length: diameter / 100,  // Store diameter as length
                        width: diameter / 100,   // Store diameter as width
                        height: height / 100     // Store height
                    };
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
                weight: parseFloat(weightInput?.value || 500),
                maxStack: parseInt(stackInput?.value || 0),
                maxStackWeight: parseFloat(maxWeightInput?.value || 0),
                loadingMethods: loadingMethods.length > 0 ? loadingMethods : ['rear', 'side', 'top'],
                unloadingMethods: unloadingMethods.length > 0 ? unloadingMethods : ['rear', 'side', 'top'],
                dimensions: dimensions,
                isVerticalRoll: true  // Flag for vertical orientation
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
            weight: parseFloat(weightInput?.value || 100),
            maxStack: parseInt(stackInput?.value || 3),
            maxStackWeight: parseFloat(maxWeightInput?.value || 2000),
            loadingMethods: loadingMethods.length > 0 ? loadingMethods : ['rear', 'side', 'top'],
            unloadingMethods: unloadingMethods.length > 0 ? unloadingMethods : ['rear', 'side', 'top'],
            dimensions: dimensions  // Zawsze przekazuj wymiary z pól input
        };
    }
    
    addCargoUnitWithParams(unitType, params) {
        // Create a unique identifier for grouping based on all parameters INCLUDING dimensions
        let dimensionKey = '';
        if (params.dimensions) {
            dimensionKey = `_${params.dimensions.length}_${params.dimensions.width}_${params.dimensions.height}`;
        }
        const groupKey = `${unitType}_${params.name}_${params.weight}_${params.maxStack}_${params.maxStackWeight}_${params.loadingMethods.join(',')}_${params.unloadingMethods.join(',')}${dimensionKey}`;
        
        // Pass all parameters including name to the cargo manager
        const cargo = this.cargoManager.addCargoUnit(unitType, {
            ...params,
            groupKey: groupKey
        });
        
        this.updateLoadedUnitsList();
        this.updateStatistics();
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
        return cargo;
    }
    
    setupControlButtons() {
        document.getElementById('autoArrange').addEventListener('click', () => {
            this.autoArrangeCargo();
        });
        
        document.getElementById('clearSpace').addEventListener('click', () => {
            this.clearAllCargo();
        });
        
        document.getElementById('exportPNG').addEventListener('click', () => {
            this.exportToPNG();
        });
        
        document.getElementById('saveConfig').addEventListener('click', () => {
            this.saveConfiguration();
        });
        
        document.getElementById('loadConfig').addEventListener('click', () => {
            this.loadConfiguration();
        });
        
        document.getElementById('generateReport').addEventListener('click', () => {
            this.generateReport();
        });
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
            this.showNotification('Nie można rozmieścić ładunku', 'error');
            return;
        }
        
        this.updateStatistics();
        this.updateAxleIndicators();
        this.updateLoadedUnitsList();
        
        if (result.success) {
            this.showNotification('Ładunek rozmieszczony automatycznie', 'success');
        } else {
            this.showNotification(`Uwaga! ${result.unpackedCount} jednostek nie zmieściło się i zostało usuniętych`, 'warning');
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
    
    clearAllCargo() {
        this.cargoManager.clearAllCargo();
        this.updateLoadedUnitsList();
        this.updateStatistics();
        this.updateAxleIndicators();
    }
    
    formatAccessMethods(methods) {
        if (!methods || methods.length === 0) return 'Brak';
        const methodNames = {
            'rear': 'Tył',
            'side': 'Bok',
            'top': 'Góra'
        };
        return methods.map(m => methodNames[m] || m).join(', ');
    }
    
    formatAccessMethodsWithColor(methods, groupId = null, type = null) {
        const allMethods = ['rear', 'side', 'top'];
        const methodNames = {
            'rear': 'Back',
            'side': 'Side',
            'top': 'Top'
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
            
            const totalWeight = group.items.reduce((sum, item) => sum + item.weight, 0);
            const unitVolume = group.sample.length * group.sample.width * group.sample.height;
            const totalVolume = unitVolume * group.items.length;
            
            // Create color indicator
            const colorStyle = group.color ? `style="background-color: ${group.color};"` : '';
            
            element.innerHTML = `
                <div class="unit-box">
                    <div class="unit-box-header">
                        <span class="unit-order-number">${index + 1}</span>
                        <span class="unit-color-dot" ${colorStyle}></span>
                        <span class="unit-quantity-badge">× ${group.items.length}</span>
                        <span class="unit-title">${group.sample.name}</span>
                        <div class="unit-quantity-controls">
                            <button class="unit-btn-remove" data-group-id="${group.groupId}" title="Usuń jednostkę">−</button>
                            <button class="unit-btn-add" data-group-id="${group.groupId}" title="Dodaj jednostkę">+</button>
                            <button class="unit-btn-delete-all" data-group-id="${group.groupId}" title="Usuń całą grupę">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="unit-box-content">
                        <div class="unit-grid">
                            <div class="unit-item">
                                <div class="unit-item-label">Wymiary</div>
                                <div class="unit-item-value">${(group.sample.length * 100).toFixed(0)}×${(group.sample.width * 100).toFixed(0)}×${(group.sample.height * 100).toFixed(0)} cm</div>
                                <div class="unit-item-sublabel">(dł. / szer. / wys.)</div>
                            </div>
                            <div class="unit-item">
                                <div class="unit-item-label">Waga jedn.</div>
                                <input type="text" class="unit-editable-input edit-weight" value="${group.sample.weight} kg" data-group-id="${group.groupId}" />
                            </div>
                            <div class="unit-item">
                                <div class="unit-item-label">
                                    Piętrowanie
                                    <span class="help-icon">
                                        ?
                                        <span class="tooltip">
                                            Maksymalna ilość przesyłek którą można położyć na daną jednostkę oraz maksymalna łączna waga którą można położyć na daną jednostkę
                                        </span>
                                    </span>
                                </div>
                                <div class="stacking-inputs-container">
                                    <input type="text" class="stacking-input-small edit-stack" value="${group.sample.maxStack}" data-group-id="${group.groupId}" title="Ilość warstw" />
                                    <span class="stacking-separator">/</span>
                                    <input type="text" class="stacking-input-small edit-max-weight" value="${group.sample.maxStackWeight || 0}kg" data-group-id="${group.groupId}" title="Max waga na górze" />
                                </div>
                            </div>
                            <div class="unit-item">
                                <div class="unit-access-container">
                                    <div class="access-group">
                                        <div class="access-label">Loading</div>
                                        <div class="access-methods">${this.formatAccessMethodsWithColor(group.sample.loadingMethods, group.groupId, 'loading')}</div>
                                    </div>
                                    <div class="access-group">
                                        <div class="access-label">Unloading</div>
                                        <div class="access-methods">${this.formatAccessMethodsWithColor(group.sample.unloadingMethods, group.groupId, 'unloading')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="unit-box-footer">
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${totalWeight} kg</div>
                            <div class="unit-footer-label">ŁĄCZNA WAGA</div>
                        </div>
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${totalVolume.toFixed(3)} m³</div>
                            <div class="unit-footer-label">OBJĘTOŚĆ</div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add edit event listeners
            const weightInput = element.querySelector('.edit-weight');
            const stackInput = element.querySelector('.edit-stack');
            const maxWeightInput = element.querySelector('.edit-max-weight');
            const addBtn = element.querySelector('.unit-btn-add');
            const removeBtn = element.querySelector('.unit-btn-remove');
            const deleteAllBtn = element.querySelector('.unit-btn-delete-all');
            
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
            
            // Auto-select text on focus for all editable inputs
            [weightInput, stackInput, maxWeightInput].forEach(input => {
                input.addEventListener('focus', (e) => {
                    e.target.select();
                });
                
                input.addEventListener('click', (e) => {
                    e.target.select();
                });
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
            });
            
            // Handle stack count input
            stackInput.addEventListener('input', (e) => {
                const value = e.target.value.replace(/[^\d]/g, ''); // Only digits
                const newStack = parseInt(value) || 0;
                this.updateGroupParameter(group.groupId, 'maxStack', newStack);
                e.target.value = newStack;
            });
            
            // Handle max weight input with kg suffix
            maxWeightInput.addEventListener('input', (e) => {
                const value = e.target.value.replace(/[^\d.]/g, ''); // Remove non-numeric chars except dot
                const newMaxWeight = parseFloat(value) || 0;
                this.updateGroupParameter(group.groupId, 'maxStackWeight', newMaxWeight);
                e.target.value = newMaxWeight + 'kg';
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
            
            freshContainer.appendChild(element);
        });
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
        
        // Check stacking limits and unstack if needed
        if (needsStackingCheck) {
            this.checkAndFixStacking();
        }
        
        // Update statistics and visualization
        this.updateStatistics();
        this.updateAxleIndicators();
        // Don't call updateLoadedUnitsList to avoid infinite loop
        
        // Update center of gravity
        this.cargoManager.updateCenterOfGravity();
    }
    
    addItemToGroup(groupId) {
        // Find first item in group to use as template
        const templateItem = this.cargoManager.cargoItems.find(item => item.groupId === groupId);
        if (!templateItem) return;
        
        // Create new item with same properties AND SAME COLOR (no new group)
        const newItem = {
            type: templateItem.type,
            name: templateItem.name,
            length: templateItem.length,
            width: templateItem.width,
            height: templateItem.height,
            weight: templateItem.weight,
            maxStack: templateItem.maxStack,
            maxStackWeight: templateItem.maxStackWeight || 0,
            loadingMethods: templateItem.loadingMethods || ['rear', 'side', 'top'],
            unloadingMethods: templateItem.unloadingMethods || ['rear', 'side', 'top'],
            color: templateItem.color, // Keep same color
            groupId: groupId, // Keep same groupId
            orderIndex: Math.max(...this.cargoManager.cargoItems.map(i => i.orderIndex || 0)) + 1,
            addedTime: Date.now()
        };
        
        // Add directly to cargoItems without creating new group
        this.cargoManager.cargoItems.push(newItem);
        this.cargoManager.totalWeight += newItem.weight;
        
        // Force complete re-arrangement
        // Clear all cargo meshes first
        this.scene3d.clearAllCargo();
        
        // Now auto-arrange all items including the new one
        const result = this.cargoManager.autoArrange();
        
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
        
        // Remove from cargoManager
        const index = this.cargoManager.cargoItems.indexOf(itemToRemove);
        if (index > -1) {
            this.cargoManager.cargoItems.splice(index, 1);
            
            // Update total weight immediately
            this.cargoManager.totalWeight -= itemToRemove.weight;
            
            // Force complete re-arrangement
            // Clear all cargo meshes first
            this.scene3d.clearAllCargo();
            
            // Now auto-arrange remaining items
            const result = this.cargoManager.autoArrange();
            
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
                    const newX = baseItem.position.x + baseItem.length + item.length / 2 + 0.1;
                    const newY = item.height / 2;
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
        
        // Update compact statistics in bottom section
        const statItems = document.querySelectorAll('.stat-item-compact .stat-value');
        if (statItems.length >= 4) {
            statItems[0].textContent = `${stats.volumeUsage.toFixed(1)}%`;
            statItems[1].textContent = `${stats.weightUsage.toFixed(1)}%`;
            statItems[2].textContent = `${stats.totalWeight} kg`;
            statItems[3].textContent = stats.totalItems;
        }
        
        // Update center of gravity
        const cogElement = document.querySelector('.stat-item-compact.full-width .stat-value-small');
        if (cogElement) {
            if (stats.centerOfGravity) {
                const cog = stats.centerOfGravity;
                cogElement.textContent = `X: ${cog.x.toFixed(2)}m Y: ${cog.y.toFixed(2)}m Z: ${cog.z.toFixed(2)}m`;
            } else {
                cogElement.textContent = 'X: 0m Y: 0m Z: 0m';
            }
        }
    }
    
    updateAxleIndicators() {
        this.axleCalculator.updateCargo(this.cargoManager.cargoItems);
        const axleLoads = this.axleCalculator.calculateAxleLoads();
        
        if (!axleLoads) return;
        
        const frontAxleElement = document.querySelector('.front-axle');
        const rearAxleElement = document.querySelector('.rear-axle');
        
        frontAxleElement.style.width = `${Math.min(axleLoads.front.percentage, 100)}%`;
        frontAxleElement.classList.remove('warning', 'danger');
        if (axleLoads.front.status === 'warning') {
            frontAxleElement.classList.add('warning');
        } else if (axleLoads.front.status === 'danger') {
            frontAxleElement.classList.add('danger');
        }
        
        rearAxleElement.style.width = `${Math.min(axleLoads.rear.percentage, 100)}%`;
        rearAxleElement.classList.remove('warning', 'danger');
        if (axleLoads.rear.status === 'warning') {
            rearAxleElement.classList.add('warning');
        } else if (axleLoads.rear.status === 'danger') {
            rearAxleElement.classList.add('danger');
        }
        
        document.querySelector('.axle-item:nth-child(2) .axle-value').textContent = 
            `${axleLoads.front.load} / ${axleLoads.front.max} kg`;
        
        document.querySelector('.axle-item:nth-child(3) .axle-value').textContent = 
            `${axleLoads.rear.load} / ${axleLoads.rear.max} kg`;
    }
    
    async exportToPNG() {
        const blob = await this.scene3d.exportToPNG();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `planer-ladunku-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Wyeksportowano do PNG', 'success');
    }
    
    saveConfiguration() {
        const config = this.cargoManager.exportConfiguration();
        const json = JSON.stringify(config, null, 2);
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `konfiguracja-ladunku-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        localStorage.setItem('lastCargoConfiguration', json);
        this.showNotification('Konfiguracja zapisana', 'success');
    }
    
    loadConfiguration() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    this.cargoManager.importConfiguration(config);
                    this.updateLoadedUnitsList();
                    this.updateStatistics();
                    this.updateAxleIndicators();
                    this.showNotification('Konfiguracja wczytana', 'success');
                } catch (error) {
                    this.showNotification('Błąd wczytywania konfiguracji', 'error');
                }
            };
            reader.readAsText(file);
        });
        
        input.click();
    }
    
    generateReport() {
        const stats = this.cargoManager.getStatistics();
        const axleLoads = this.axleCalculator.calculateAxleLoads();
        const config = this.cargoManager.exportConfiguration();
        
        let report = `RAPORT ZAŁADUNKU\n`;
        report += `Data: ${new Date().toLocaleString('pl-PL')}\n\n`;
        
        report += `PRZESTRZEŃ ŁADUNKOWA:\n`;
        report += `- Typ: ${CONFIG.vehicles[this.currentVehicle]?.name || 'Własne wymiary'}\n`;
        report += `- Wymiary: ${config.container.length}m x ${config.container.width}m x ${config.container.height}m\n`;
        report += `- Max. ładowność: ${config.maxLoad / 1000} ton\n\n`;
        
        report += `STATYSTYKI:\n`;
        report += `- Liczba jednostek: ${stats.totalItems}\n`;
        report += `- Całkowita waga: ${stats.totalWeight} kg\n`;
        report += `- Wykorzystanie przestrzeni: ${stats.volumeUsage.toFixed(1)}%\n`;
        report += `- Wykorzystanie ładowności: ${stats.weightUsage.toFixed(1)}%\n\n`;
        
        if (axleLoads) {
            report += `OBCIĄŻENIE OSI:\n`;
            report += `- Oś przednia: ${axleLoads.front.load} / ${axleLoads.front.max} kg (${axleLoads.front.percentage.toFixed(1)}%)\n`;
            report += `- Osie tylne: ${axleLoads.rear.load} / ${axleLoads.rear.max} kg (${axleLoads.rear.percentage.toFixed(1)}%)\n\n`;
        }
        
        report += `LISTA ŁADUNKÓW:\n`;
        config.cargoItems.forEach((item, index) => {
            report += `${index + 1}. ${item.name}\n`;
            report += `   - Wymiary: ${item.dimensions.length}m x ${item.dimensions.width}m x ${item.dimensions.height}m\n`;
            report += `   - Waga: ${item.weight} kg\n`;
            if (item.position) {
                report += `   - Pozycja: X=${item.position.x.toFixed(2)}, Y=${item.position.y.toFixed(2)}, Z=${item.position.z.toFixed(2)}\n`;
            }
        });
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `raport-zaladunku-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Raport wygenerowany', 'success');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}