document.addEventListener('DOMContentLoaded', () => {
    const scene3d = new Scene3D('threejs-container');
    const cargoManager = new CargoManager(scene3d);
    const axleCalculator = new AxleCalculator();
    
    // Make axleCalculator globally available for scene3d
    window.axleCalculator = axleCalculator;
    
    const ui = new UI(scene3d, cargoManager, axleCalculator);
    
    // Connect drag & drop callback
    scene3d.onCargoMoved = (movedCargo) => {
        cargoManager.updateCargoPositions(movedCargo);
        ui.updateLoadedUnitsList(); // Update list to show units outside
        ui.updateStatistics();
        ui.updateAxleIndicators();
        // Update 3D axle load visualization if enabled
        if (scene3d.showAxleLoads) {
            scene3d.updateAxleLoadVisualization();
        }
    };
    
    // Connect dynamic axle update during dragging
    scene3d.onAxleUpdateNeeded = (tempUpdatedCargo) => {
        if (tempUpdatedCargo) {
            // Temporarily update positions for dragged items
            cargoManager.updateCargoPositions(tempUpdatedCargo);
        }
        ui.updateAxleIndicators();
        // Update 3D axle load visualization if enabled
        if (scene3d.showAxleLoads) {
            scene3d.updateAxleLoadVisualization();
        }
    };
    
    // Connect cargo removal callback
    scene3d.onCargoRemoved = (removedCargo) => {
        cargoManager.removeCargoItem(removedCargo);
        ui.updateLoadedUnitsList();
        ui.updateStatistics();
        ui.updateAxleIndicators();
        // Update 3D axle load visualization if enabled
        if (scene3d.showAxleLoads) {
            scene3d.updateAxleLoadVisualization();
        }
    };
    
    // Connect cargo rearranged callback
    cargoManager.onCargoRearranged = () => {
        ui.updateLoadedUnitsList();
        ui.updateStatistics();
        ui.updateAxleIndicators();
        // Update 3D axle load visualization if enabled
        if (scene3d.showAxleLoads) {
            scene3d.updateAxleLoadVisualization();
        }
    };
    
    // Connect group selection/deselection callbacks
    scene3d.onGroupSelectionRequested = (groupId) => {
        cargoManager.selectGroup(groupId);
    };
    
    scene3d.onGroupDeselectionRequested = () => {
        cargoManager.deselectGroup();
    };
    
    // Connect group rotation callback
    scene3d.onGroupRotationRequested = (groupId, angle) => {
        cargoManager.rotateGroup(groupId, angle);
        ui.updateLoadedUnitsList();
        ui.updateStatistics();
        ui.updateAxleIndicators();
        // Update 3D axle load visualization if enabled
        if (scene3d.showAxleLoads) {
            scene3d.updateAxleLoadVisualization();
        }
    };
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        /* Group selection styles */
        .loaded-unit-group.selected-group {
            background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
            border: 2px solid #10b981;
            border-radius: 8px;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
            transform: translateX(4px);
            position: relative;
        }
        
        .loaded-unit-group.selected-group::before {
            content: "✓ ZAZNACZONA GRUPA";
            position: absolute;
            top: -8px;
            left: 12px;
            background: #10b981;
            color: white;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 12px;
            letter-spacing: 0.5px;
        }
        
        .loaded-unit-group.selected-group:hover {
            transform: translateX(6px);
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.4);
        }
        
        /* Smooth transitions */
        .loaded-unit-group {
            transition: all 0.2s ease;
        }
    `;
    document.head.appendChild(style);
    
    const savedConfig = localStorage.getItem('lastCargoConfiguration');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            console.log('Znaleziono zapisaną konfigurację');
        } catch (error) {
            console.log('Brak zapisanej konfiguracji');
        }
    }
    
    console.log('Planer Ładunków 3D - Gotowy');
});