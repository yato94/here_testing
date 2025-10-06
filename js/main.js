document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first - detect language and load translations
    await i18n.init();

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
        // Remember the ID of the hovered object before rotation (if any)
        const hoveredId = scene3d.hoveredObject?.userData?.id;
        const hoveredGroupId = scene3d.hoveredObject?.userData?.groupId;

        cargoManager.rotateGroup(groupId, angle);
        ui.updateLoadedUnitsList();
        ui.updateStatistics();
        ui.updateAxleIndicators();
        // Update 3D axle load visualization if enabled
        if (scene3d.showAxleLoads) {
            scene3d.updateAxleLoadVisualization();
        }

        // If a unit from the rotated group was hovered, update dimension labels with new mesh
        if (hoveredId && hoveredGroupId === groupId) {
            // Find the new mesh with the same ID (after rotation, meshes are recreated)
            const newMesh = scene3d.cargoMeshes.find(m => m.userData.id === hoveredId);
            if (newMesh) {
                // Update hoveredObject to point to the new mesh
                scene3d.hoveredObject = newMesh;
                // Recreate dimension labels with updated dimensions
                scene3d.createDimensionLabels(newMesh);
                // Update ruler if unit is inside container
                if (!scene3d.isPositionOutsideContainer(newMesh.position)) {
                    scene3d.showRulerForCargo(newMesh);
                }
            }
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
            content: "${i18n.t('selectedGroup')}";
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
            console.log('Found saved configuration');
        } catch (error) {
            console.log('No saved configuration');
        }
    }
    
    console.log('3D Load Planner - Ready');
});