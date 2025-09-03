// Configuration for axle settings
class AxleConfiguration {
    constructor() {
        this.currentVehicle = 'standard';
        // Load saved settings or use defaults
        this.loadSettings();
    }
    
    setVehicle(vehicleType) {
        this.currentVehicle = vehicleType;
        this.loadSettings();
    }
    
    loadSettings() {
        const settingsKey = `axleSettings_${this.currentVehicle}`;
        const saved = localStorage.getItem(settingsKey);
        if (saved) {
            const settings = JSON.parse(saved);
            Object.assign(this, settings);
        } else {
            // Default settings
            this.tractorAxles = 1; // Number of drive axles (default: 1)
            this.trailerAxles = 3; // Number of trailer axles (default: 3)
            
            // Distances (in meters)
            this.distFrontToKingpin = 1.7; // Front of trailer to kingpin
            this.distKingpinToTrailer = 7.7; // Kingpin to center of trailer axle group
            this.distTrailerToEnd = 4.2; // Center of trailer axles to end
            this.distFrontAxleToKingpin = 3.1; // Front axle to kingpin
            this.distKingpinToDrive = 0.5; // Kingpin to center of drive axles
            
            // Empty weights (in kg)
            this.emptyFrontAxle = 5800;
            this.emptyDriveAxles = 3600;
            this.emptyTrailerAxles = 5200;
            
            // Maximum loads (in kg)
            this.maxFrontAxle = 7500;
            this.maxDriveAxles = 11500;
            this.maxTrailerAxles = 24000;
            
            // Minimum drive axle load (in %)
            this.minDriveAxleLoad = 25;
        }
    }
    
    saveSettings() {
        const settings = {
            tractorAxles: this.tractorAxles,
            trailerAxles: this.trailerAxles,
            distFrontToKingpin: this.distFrontToKingpin,
            distKingpinToTrailer: this.distKingpinToTrailer,
            distTrailerToEnd: this.distTrailerToEnd,
            distFrontAxleToKingpin: this.distFrontAxleToKingpin,
            distKingpinToDrive: this.distKingpinToDrive,
            emptyFrontAxle: this.emptyFrontAxle,
            emptyDriveAxles: this.emptyDriveAxles,
            emptyTrailerAxles: this.emptyTrailerAxles,
            maxFrontAxle: this.maxFrontAxle,
            maxDriveAxles: this.maxDriveAxles,
            maxTrailerAxles: this.maxTrailerAxles,
            minDriveAxleLoad: this.minDriveAxleLoad
        };
        const settingsKey = `axleSettings_${this.currentVehicle}`;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    }
    
    resetToDefaults() {
        const settingsKey = `axleSettings_${this.currentVehicle}`;
        localStorage.removeItem(settingsKey);
        this.loadSettings();
    }
    
    // Get individual axle positions for multi-axle groups
    getDriveAxlePositions() {
        const positions = [];
        const centerPos = this.distFrontToKingpin + this.distKingpinToDrive;
        
        if (this.tractorAxles === 1) {
            positions.push(centerPos);
        } else if (this.tractorAxles === 2) {
            // Standard spacing for tandem axles: 1.35m
            positions.push(centerPos - 0.675);
            positions.push(centerPos + 0.675);
        }
        
        return positions;
    }
    
    getTrailerAxlePositions() {
        const positions = [];
        const centerPos = this.distFrontToKingpin + this.distKingpinToTrailer;
        
        if (this.trailerAxles === 1) {
            positions.push(centerPos);
        } else if (this.trailerAxles === 2) {
            // Standard spacing for tandem: 1.31m
            positions.push(centerPos - 0.655);
            positions.push(centerPos + 0.655);
        } else if (this.trailerAxles === 3) {
            // Standard spacing for tridem: 1.31m between axles
            positions.push(centerPos - 1.31);
            positions.push(centerPos);
            positions.push(centerPos + 1.31);
        }
        
        return positions;
    }
}

class AxleCalculator {
    constructor() {
        this.vehicleConfig = null;
        this.cargoItems = [];
        this.axleConfig = new AxleConfiguration();
    }
    
    setVehicle(vehicleConfig) {
        this.vehicleConfig = vehicleConfig;
        // Also update the axle configuration's current vehicle
        if (vehicleConfig && vehicleConfig.name) {
            // Extract vehicle type from config name or use the passed vehicle type
            const vehicleType = this.getVehicleTypeFromConfig(vehicleConfig);
            this.axleConfig.setVehicle(vehicleType);
        }
    }
    
    getVehicleTypeFromConfig(vehicleConfig) {
        // Map vehicle names to types used in localStorage keys
        const nameToType = {
            'Naczepa standardowa': 'standard',
            'Mega trailer': 'mega',
            'JUMBO': 'jumbo',
            'Kontener 20\'': 'container20',
            'Kontener 40\'': 'container40',
            'Kontener 40\' HC': 'container40hc',
            'Coilmulde Standard': 'coilmuldeStandard',
            'Coilmulde Mega': 'coilmuldeMega',
            'Własne wymiary': 'custom'
        };
        return nameToType[vehicleConfig.name] || 'custom';
    }
    
    updateCargo(cargoItems) {
        this.cargoItems = cargoItems;
    }
    
    updateAxleConfiguration(config) {
        Object.assign(this.axleConfig, config);
        this.axleConfig.saveSettings();
    }
    
    calculateAxleLoads() {
        if (!this.vehicleConfig) {
            return null;
        }
        
        // Use configuration from axleConfig
        const kingPin = this.axleConfig.distFrontToKingpin;
        const trailerAxleCenter = this.axleConfig.distFrontToKingpin + this.axleConfig.distKingpinToTrailer;
        const frontAxle = this.axleConfig.distFrontToKingpin - this.axleConfig.distFrontAxleToKingpin;
        const driveAxleCenter = this.axleConfig.distFrontToKingpin + this.axleConfig.distKingpinToDrive;
        
        // Empty weights in kg
        const frontAxleEmptyWeight = this.axleConfig.emptyFrontAxle;
        const driveAxlesEmptyWeight = this.axleConfig.emptyDriveAxles;
        const trailerAxlesEmptyWeight = this.axleConfig.emptyTrailerAxles;
        
        // Total cargo weight
        let totalCargoWeight = 0;
        let totalCargoMoment = 0; // Moment around kingpin
        
        // Calculate moments of cargo around the kingpin (which is at 0,0 in our coordinate system)
        this.cargoItems.forEach(item => {
            // Skip items that are outside the container
            if (item.position && !item.isOutside) {
                // Position X is relative to container center, need to convert to position from kingpin
                const cargoXFromKingPin = item.position.x + (this.vehicleConfig.length / 2) - kingPin;
                totalCargoWeight += item.weight;
                totalCargoMoment += item.weight * cargoXFromKingPin;
            }
        });
        
        // Calculate center of gravity of cargo from kingpin
        const cargoCenterFromKingPin = totalCargoWeight > 0 ? totalCargoMoment / totalCargoWeight : 0;
        
        // Apply equilibrium of moments around kingpin to find trailer axle load from cargo
        // Trailer axle group center is at position relative to kingpin
        const trailerAxleFromKingPin = trailerAxleCenter - kingPin;
        const trailerAxlesCargoLoad = totalCargoWeight > 0 ? 
            (totalCargoMoment / trailerAxleFromKingPin) : 0;
        
        // The remaining cargo load goes through kingpin to truck
        const kingPinLoad = totalCargoWeight - trailerAxlesCargoLoad;
        
        // Now distribute kingpin load between truck axle groups using moments
        // Front axle is before kingpin
        const frontToKingPin = this.axleConfig.distFrontAxleToKingpin;
        const driveToKingPin = this.axleConfig.distKingpinToDrive;
        const truckAxleBase = frontToKingPin + driveToKingPin;
        
        // Distribute kingpin load using lever principle
        const frontAxleCargoLoad = kingPinLoad * (driveToKingPin / truckAxleBase);
        const driveAxlesCargoLoad = kingPinLoad * (frontToKingPin / truckAxleBase);
        
        // Final axle loads = empty weights + cargo loads
        const frontAxleTotal = frontAxleEmptyWeight + frontAxleCargoLoad;
        const driveAxlesTotal = driveAxlesEmptyWeight + driveAxlesCargoLoad;
        const trailerAxlesTotal = trailerAxlesEmptyWeight + trailerAxlesCargoLoad;
        
        // Get maximum loads from configuration
        const frontAxleMax = this.axleConfig.maxFrontAxle;
        const driveAxlesMax = this.axleConfig.maxDriveAxles;
        const trailerAxlesMax = this.axleConfig.maxTrailerAxles;
        
        // Check minimum drive axle load requirement
        const totalVehicleWeight = frontAxleTotal + driveAxlesTotal + trailerAxlesTotal;
        const driveAxlePercentage = (driveAxlesTotal / totalVehicleWeight) * 100;
        const minDrivePercentage = this.axleConfig.minDriveAxleLoad || 25;
        let driveAxleWarning = null;
        
        if (driveAxlePercentage < minDrivePercentage) {
            driveAxleWarning = `Uwaga: Obciążenie osi napędowej (${driveAxlePercentage.toFixed(1)}%) jest poniżej minimum (${minDrivePercentage}%)`;
        }
        
        return {
            front: {
                load: Math.round(frontAxleTotal),
                max: frontAxleMax,
                percentage: (frontAxleTotal / frontAxleMax) * 100,
                status: this.getLoadStatus(frontAxleTotal, frontAxleMax),
                emptyLoad: frontAxleEmptyWeight,
                cargoLoad: Math.round(frontAxleCargoLoad),
                axleCount: 1 // Front axle is always single
            },
            drive: {
                load: Math.round(driveAxlesTotal),
                max: driveAxlesMax,
                percentage: (driveAxlesTotal / driveAxlesMax) * 100,
                percentageOfTotal: driveAxlePercentage,
                minPercentage: minDrivePercentage,
                status: this.getLoadStatus(driveAxlesTotal, driveAxlesMax),
                warning: driveAxleWarning,
                emptyLoad: driveAxlesEmptyWeight,
                cargoLoad: Math.round(driveAxlesCargoLoad),
                axleCount: this.axleConfig.tractorAxles
            },
            trailer: {
                load: Math.round(trailerAxlesTotal),
                max: trailerAxlesMax,
                percentage: (trailerAxlesTotal / trailerAxlesMax) * 100,
                status: this.getLoadStatus(trailerAxlesTotal, trailerAxlesMax),
                emptyLoad: trailerAxlesEmptyWeight,
                cargoLoad: Math.round(trailerAxlesCargoLoad),
                axleCount: this.axleConfig.trailerAxles
            },
            total: {
                weight: Math.round(frontAxleEmptyWeight + driveAxlesEmptyWeight + trailerAxlesEmptyWeight + totalCargoWeight),
                cargoWeight: Math.round(totalCargoWeight),
                vehicleWeight: frontAxleEmptyWeight + driveAxlesEmptyWeight + trailerAxlesEmptyWeight
            },
            kingPinLoad: Math.round(kingPinLoad),
            cargoCenterFromKingPin: cargoCenterFromKingPin.toFixed(2),
            config: this.axleConfig // Include configuration for reference
        };
    }
    
    getLoadStatus(load, max) {
        const percentage = (load / max) * 100;
        
        if (percentage > 100) {
            return 'danger';
        } else if (percentage > 90) {
            return 'warning';
        } else {
            return 'normal';
        }
    }
    
    optimizeLoadDistribution(cargoItems) {
        if (!this.vehicleConfig || cargoItems.length === 0) {
            return cargoItems;
        }
        
        const frontAxlePos = this.vehicleConfig.axles.front.position;
        const rearAxlePos = this.vehicleConfig.axles.rear.position;
        const optimalCenter = (frontAxlePos + rearAxlePos) / 2;
        
        const heavyItems = cargoItems.filter(item => item.weight > 500);
        const mediumItems = cargoItems.filter(item => item.weight >= 100 && item.weight <= 500);
        const lightItems = cargoItems.filter(item => item.weight < 100);
        
        const optimizedOrder = [];
        
        let currentFrontLoad = 0;
        let currentRearLoad = 0;
        const maxFrontLoad = this.vehicleConfig.axles.front.maxLoad * 0.9;
        const maxRearLoad = this.vehicleConfig.axles.rear.maxLoad * 0.9;
        
        heavyItems.forEach(item => {
            if (currentRearLoad < maxRearLoad) {
                item.suggestedX = optimalCenter + 1;
                currentRearLoad += item.weight * 0.6;
                currentFrontLoad += item.weight * 0.4;
            } else {
                item.suggestedX = optimalCenter - 1;
                currentFrontLoad += item.weight * 0.6;
                currentRearLoad += item.weight * 0.4;
            }
            optimizedOrder.push(item);
        });
        
        mediumItems.forEach(item => {
            if (currentFrontLoad < currentRearLoad) {
                item.suggestedX = optimalCenter - 0.5;
                currentFrontLoad += item.weight * 0.55;
                currentRearLoad += item.weight * 0.45;
            } else {
                item.suggestedX = optimalCenter + 0.5;
                currentRearLoad += item.weight * 0.55;
                currentFrontLoad += item.weight * 0.45;
            }
            optimizedOrder.push(item);
        });
        
        lightItems.forEach(item => {
            item.suggestedX = optimalCenter;
            currentFrontLoad += item.weight * 0.5;
            currentRearLoad += item.weight * 0.5;
            optimizedOrder.push(item);
        });
        
        return optimizedOrder;
    }
    
    validateStability(centerOfGravity) {
        if (!centerOfGravity || !this.vehicleConfig) {
            return { stable: true, warnings: [] };
        }
        
        const warnings = [];
        let stable = true;
        
        const maxHeightRatio = 0.6;
        const heightRatio = centerOfGravity.y / this.vehicleConfig.height;
        if (heightRatio > maxHeightRatio) {
            warnings.push('Środek ciężkości jest zbyt wysoko - ryzyko wywrócenia');
            stable = false;
        }
        
        const maxLateralOffset = this.vehicleConfig.width * 0.2;
        if (Math.abs(centerOfGravity.z) > maxLateralOffset) {
            warnings.push('Środek ciężkości jest przesunięty na bok - nierównomierne obciążenie');
            stable = false;
        }
        
        const idealLongitudinalCenter = 0;
        const maxLongitudinalOffset = this.vehicleConfig.length * 0.15;
        if (Math.abs(centerOfGravity.x - idealLongitudinalCenter) > maxLongitudinalOffset) {
            warnings.push('Środek ciężkości jest zbyt przesunięty wzdłuż pojazdu');
            stable = false;
        }
        
        return { stable, warnings };
    }
}