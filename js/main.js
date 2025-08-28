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
        ui.updateStatistics();
        ui.updateAxleIndicators();
    };
    
    // Connect cargo removal callback
    scene3d.onCargoRemoved = (removedCargo) => {
        cargoManager.removeCargoItem(removedCargo);
        ui.updateLoadedUnitsList();
        ui.updateStatistics();
        ui.updateAxleIndicators();
    };
    
    // Connect cargo rearranged callback
    cargoManager.onCargoRearranged = () => {
        ui.updateLoadedUnitsList();
        ui.updateStatistics();
        ui.updateAxleIndicators();
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