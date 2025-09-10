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
        this.setupMobileToggles();
        this.setupAxleSettingsModal();
        this.setupGroupSelectionCallbacks();
        this.updateStatistics();
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
                
                // Store previous vehicle type before updating
                const previousVehicleType = this.currentVehicle;
                
                if (value === 'custom') {
                    customDimensions.classList.remove('hidden');
                    this.currentVehicle = value;
                    // Axle configuration will be updated in loadCustomVehicle
                } else {
                    customDimensions.classList.add('hidden');
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
        
        // First update axle configuration so it's available when creating container visualization
        this.axleCalculator.setVehicle(vehicle);
        
        this.cargoManager.setContainer(containerDimensions, vehicle.maxLoad);
        
        document.getElementById('dimensionsInfo').textContent = `${vehicle.length} × ${vehicle.width} × ${vehicle.height} m`;
        const volume = (vehicle.length * vehicle.width * vehicle.height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        document.getElementById('maxLoadInput').value = (vehicle.maxLoad / 1000).toFixed(2);
        
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
                rear: { position: length * 0.85, maxLoad: 24000 }
            }
        };
        
        // Update Steel Coil availability (custom vehicles don't have groove)
        this.updateSteelCoilAvailability(false);
        
        // First update axle configuration so it's available when creating container visualization
        this.axleCalculator.setVehicle(customVehicle);
        
        this.cargoManager.setContainer(
            { length: length, width: width, height: height },
            customVehicle.maxLoad
        );
        
        document.getElementById('dimensionsInfo').textContent = `${length} × ${width} × ${height} m`;
        const volume = (length * width * height).toFixed(1);
        document.getElementById('volumeInfo').textContent = `${volume} m³`;
        document.getElementById('maxLoadInput').value = (customVehicle.maxLoad / 1000).toFixed(2);
        
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
                        orientationToggleBtn.textContent = newOrientation === 'vertical' ? '⬆ Pionowo' : '➡ Poziomo';
                        
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
                        labelEl.textContent = isActive ? 'Waga wszystkich jednostek razem' : 'Waga jednej jednostki';
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
                        this.showNotification('Wprowadź prawidłowe wymiary', 'error');
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
                                messages.push(`${result.unpackedCount} jednostek nie zmieściło się w przestrzeni`);
                            }
                            if (result.exceedingWeightCount > 0) {
                                messages.push(`${result.exceedingWeightCount} jednostek przekroczyło limit wagowy`);
                            }
                            if (messages.length > 0) {
                                this.showNotification(`${messages.join(' i ')} - umieszczono poza przestrzenią`, 'warning');
                            }
                            
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
                    const params = this.getPresetParameters(card, amount);
                    
                    // Validate dimensions - for all types, not just custom-box
                    if (!params.dimensions || params.dimensions.length <= 0 || params.dimensions.width <= 0 || params.dimensions.height <= 0) {
                        this.showNotification('Wprowadź prawidłowe wymiary', 'error');
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
                                messages.push(`${result.unpackedCount} jednostek nie zmieściło się w przestrzeni`);
                            }
                            if (result.exceedingWeightCount > 0) {
                                messages.push(`${result.exceedingWeightCount} jednostek przekroczyło limit wagowy`);
                            }
                            if (messages.length > 0) {
                                this.showNotification(`${messages.join(' i ')} - umieszczono poza przestrzenią`, 'warning');
                            }
                            
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
            const messages = [];
            if (result.unpackedCount > 0) {
                messages.push(`${result.unpackedCount} jednostek nie zmieściło się`);
            }
            if (result.exceedingWeightCount > 0) {
                messages.push(`${result.exceedingWeightCount} jednostek przekroczyło limit wagowy`);
            }
            if (messages.length > 0) {
                this.showNotification(`Uwaga! ${messages.join(' i ')} - umieszczono poza przestrzenią ładunkową`, 'warning');
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
                           title="Długość (cm)" />×180×180 <span class="dimension-unit-small">cm</span>`;
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
                           title="Wysokość (cm)" /> <span class="dimension-unit-small">cm</span>`;
        } else {
            // Regular units: all dimensions editable - keep original display format
            return `<input type="number" class="dimension-input-compact edit-dimension-length" 
                           value="${Math.round(sample.length * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="length"
                           min="1" max="1360" step="1"
                           maxlength="4"
                           title="Długość (cm)" />×<input type="number" class="dimension-input-compact edit-dimension-width" 
                           value="${Math.round(sample.width * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="width"
                           min="1" max="1360" step="1"
                           maxlength="4"
                           title="Szerokość (cm)" />×<input type="number" class="dimension-input-compact edit-dimension-height" 
                           value="${Math.round(sample.height * 100)}" 
                           data-group-id="${groupId}" 
                           data-dimension="height"
                           min="1" max="300" step="1"
                           maxlength="3"
                           title="Wysokość (cm)" /> <span class="dimension-unit-small">cm</span>`;
        }
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
                        <span class="unit-quantity-badge">× ${itemsInside}${itemsOutside > 0 ? ` <span style="color: #ef4444; font-size: 0.9em;">(+${itemsOutside} poza)</span>` : ''}</span>
                        <input type="text" class="unit-title-input edit-name" value="${group.sample.name}" data-group-id="${group.groupId}" title="Nazwa grupy" />
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
                                <div class="unit-dimensions-editable">
                                    ${this.createDimensionInputs(group)}
                                </div>
                                <div class="unit-item-sublabel">
                                    ${group.sample.type === 'roll' && !group.sample.fixedDiameter ? 
                                        `<button class="orientation-toggle-btn" data-group-id="${group.groupId}" style="background: none; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px;">
                                            ${group.sample.isVerticalRoll ? '⬆ Pionowo' : '➡ Poziomo'}
                                        </button>` : 
                                        (group.sample.type === 'steel-coil' ? '(dł. × śred. × śred.)' : '(dł. / szer. / wys.)')}
                                </div>
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
                                    <input type="text" class="stacking-input-small edit-max-weight auto-resize-input" value="${(group.sample.maxStackWeight || 0).toString().replace(/[^\d.]/g, '')}kg" data-group-id="${group.groupId}" maxlength="6" title="Max waga na górze" />
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
                            <div class="unit-footer-value">${totalVolume.toFixed(2)} m³</div>
                            <div class="unit-footer-label">OBJĘTOŚĆ</div>
                        </div>
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${floorArea.toFixed(2)} m²</div>
                            <div class="unit-footer-label">POWIERZCHNIA</div>
                        </div>
                        <div class="unit-footer-item">
                            <div class="unit-footer-value">${ldm.toFixed(2)}</div>
                            <div class="unit-footer-label">LDM</div>
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
                        this.showNotification(`${dimension === 'height' ? 'Wysokość' : 'Wymiar'} musi być między 1cm a ${maxText}`, 'error');
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
        
        // Show notification about the change
        if (result && !result.success) {
            const messages = [];
            if (result.unpackedCount > 0) {
                messages.push(`${result.unpackedCount} jednostek nie zmieściło się w przestrzeni`);
            }
            if (result.exceedingWeightCount > 0) {
                messages.push(`${result.exceedingWeightCount} jednostek przekracza limit wagi`);
            }
            this.showNotification(messages.join(', '), 'warning');
        } else {
            this.showNotification(`Wymiary grupy zostały zaktualizowane`, 'success');
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
        
        // Update compact statistics in bottom section
        const statItems = document.querySelectorAll('.stat-item-compact .stat-value');
        if (statItems.length >= 4) {
            statItems[0].textContent = `${stats.volumeUsage.toFixed(1)}%`;
            statItems[1].textContent = `${stats.weightUsage.toFixed(1)}%`;
            // Show weight of items inside the container only
            statItems[2].textContent = `${stats.insideWeight} kg`;
            // Show total items with indication if some are outside
            statItems[3].textContent = stats.outsideItems > 0 ? 
                `${stats.placedItems} (+${stats.outsideItems} poza)` : 
                stats.totalItems;
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
        const trailerAxleElement = document.querySelector('.trailer-axle');
        
        // Front axle (truck)
        frontAxleElement.style.width = `${Math.min(axleLoads.front.percentage, 100)}%`;
        frontAxleElement.classList.remove('warning', 'danger');
        if (axleLoads.front.status === 'warning') {
            frontAxleElement.classList.add('warning');
        } else if (axleLoads.front.status === 'danger') {
            frontAxleElement.classList.add('danger');
        }
        
        // Drive axles (truck drive axles)
        rearAxleElement.style.width = `${Math.min(axleLoads.drive.percentage, 100)}%`;
        rearAxleElement.classList.remove('warning', 'danger');
        if (axleLoads.drive.status === 'warning') {
            rearAxleElement.classList.add('warning');
        } else if (axleLoads.drive.status === 'danger') {
            rearAxleElement.classList.add('danger');
        }
        
        // Trailer axles
        trailerAxleElement.style.width = `${Math.min(axleLoads.trailer.percentage, 100)}%`;
        trailerAxleElement.classList.remove('warning', 'danger');
        if (axleLoads.trailer.status === 'warning') {
            trailerAxleElement.classList.add('warning');
        } else if (axleLoads.trailer.status === 'danger') {
            trailerAxleElement.classList.add('danger');
        }
        
        // Update text values
        document.querySelector('.axle-item:nth-child(2) .axle-value').textContent = 
            `${axleLoads.front.load} / ${axleLoads.front.max} kg`;
        
        // Drive axle with percentage info
        const driveValueText = `${axleLoads.drive.load} / ${axleLoads.drive.max} kg`;
        const drivePercentText = axleLoads.drive.percentageOfTotal ? 
            ` (${axleLoads.drive.percentageOfTotal.toFixed(1)}%)` : '';
        document.querySelector('.axle-item:nth-child(3) .axle-value').textContent = 
            driveValueText + drivePercentText;
        
        // Add warning class if below minimum
        const driveItem = document.querySelector('.axle-item:nth-child(3)');
        if (axleLoads.drive.warning) {
            driveItem.classList.add('warning-min');
            // Show warning tooltip or message
            driveItem.title = axleLoads.drive.warning;
        } else {
            driveItem.classList.remove('warning-min');
            driveItem.title = '';
        }
        
        document.querySelector('.axle-item:nth-child(4) .axle-value').textContent = 
            `${axleLoads.trailer.load} / ${axleLoads.trailer.max} kg`;
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
        report += `- Wykorzystanie ładowności: ${stats.weightUsage.toFixed(1)}%\n`;
        if (stats.outsideItems > 0) {
            report += `- Jednostki poza przestrzenią: ${stats.outsideItems}\n`;
        }
        report += `\n`;
        
        if (axleLoads) {
            report += `OBCIĄŻENIE OSI:\n`;
            report += `- Oś przednia (ciągnik): ${axleLoads.front.load} / ${axleLoads.front.max} kg (${axleLoads.front.percentage.toFixed(1)}%)\n`;
            report += `- Osie napędowe (ciągnik): ${axleLoads.drive.load} / ${axleLoads.drive.max} kg (${axleLoads.drive.percentage.toFixed(1)}%)\n`;
            report += `- Osie naczepy: ${axleLoads.trailer.load} / ${axleLoads.trailer.max} kg (${axleLoads.trailer.percentage.toFixed(1)}%)\n\n`;
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
    
    setupAxleSettingsModal() {
        const modal = document.getElementById('axleSettingsModal');
        const openBtn = document.getElementById('axleSettingsBtn');
        const closeBtn = document.getElementById('closeAxleSettings');
        const saveBtn = document.getElementById('saveAxleSettings');
        const resetBtn = document.getElementById('resetAxleSettings');
        
        // Open modal
        openBtn.addEventListener('click', () => {
            this.loadAxleSettings();
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
            this.showNotification('Ustawienia osi zapisane', 'success');
        });
        
        // Reset to defaults
        resetBtn.addEventListener('click', () => {
            this.axleCalculator.axleConfig.resetToDefaults();
            this.loadAxleSettings();
            this.showNotification('Przywrócono domyślne ustawienia', 'info');
        });
    }
    
    loadAxleSettings() {
        const config = this.axleCalculator.axleConfig;
        
        // Set radio buttons
        document.querySelector(`input[name="tractorAxles"][value="${config.tractorAxles}"]`).checked = true;
        document.querySelector(`input[name="trailerAxles"][value="${config.trailerAxles}"]`).checked = true;
        
        // Set distances
        document.getElementById('distFrontToKingpin').value = config.distFrontToKingpin;
        document.getElementById('distKingpinToTrailer').value = config.distKingpinToTrailer;
        document.getElementById('distTrailerToEnd').value = config.distTrailerToEnd;
        document.getElementById('distFrontAxleToKingpin').value = config.distFrontAxleToKingpin;
        document.getElementById('distKingpinToDrive').value = config.distKingpinToDrive;
        
        // Set empty weights
        document.getElementById('emptyFrontAxle').value = config.emptyFrontAxle;
        document.getElementById('emptyDriveAxles').value = config.emptyDriveAxles;
        document.getElementById('emptyTrailerAxles').value = config.emptyTrailerAxles;
        
        // Set max loads
        document.getElementById('maxFrontAxle').value = config.maxFrontAxle;
        document.getElementById('maxDriveAxles').value = config.maxDriveAxles;
        document.getElementById('maxTrailerAxles').value = config.maxTrailerAxles;
        
        // Set minimum drive axle load
        document.getElementById('minDriveAxleLoad').value = config.minDriveAxleLoad || 25;
    }
    
    saveAxleSettings() {
        const config = {
            // Get axle counts
            tractorAxles: parseInt(document.querySelector('input[name="tractorAxles"]:checked').value),
            trailerAxles: parseInt(document.querySelector('input[name="trailerAxles"]:checked').value),
            
            // Get distances
            distFrontToKingpin: parseFloat(document.getElementById('distFrontToKingpin').value),
            distKingpinToTrailer: parseFloat(document.getElementById('distKingpinToTrailer').value),
            distTrailerToEnd: parseFloat(document.getElementById('distTrailerToEnd').value),
            distFrontAxleToKingpin: parseFloat(document.getElementById('distFrontAxleToKingpin').value),
            distKingpinToDrive: parseFloat(document.getElementById('distKingpinToDrive').value),
            
            // Get empty weights
            emptyFrontAxle: parseFloat(document.getElementById('emptyFrontAxle').value),
            emptyDriveAxles: parseFloat(document.getElementById('emptyDriveAxles').value),
            emptyTrailerAxles: parseFloat(document.getElementById('emptyTrailerAxles').value),
            
            // Get max loads
            maxFrontAxle: parseFloat(document.getElementById('maxFrontAxle').value),
            maxDriveAxles: parseFloat(document.getElementById('maxDriveAxles').value),
            maxTrailerAxles: parseFloat(document.getElementById('maxTrailerAxles').value),
            
            // Get minimum drive axle load
            minDriveAxleLoad: parseFloat(document.getElementById('minDriveAxleLoad').value)
        };
        
        // Update axle calculator configuration
        this.axleCalculator.updateAxleConfiguration(config);
        
        // Update axle indicators
        this.updateAxleIndicators();
        
        // Update 3D visualization
        this.scene3d.updateAxleVisualization(config);
    }
    
    // Removed - group selection is now only available via context menu (RMB)
    // handleGroupClick(event, group) { ... }
    
    setupGroupSelectionCallbacks() {
        // Set up callback for group selection changes
        this.cargoManager.onGroupSelectionChanged = (groupId) => {
            this.onGroupSelectionChanged(groupId);
        };
    }
    
    onGroupSelectionChanged(selectedGroupId) {
        // Update UI to reflect group selection state
        this.updateLoadedUnitsList();
    }
}