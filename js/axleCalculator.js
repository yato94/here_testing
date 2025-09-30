// Configuration for axle settings
class AxleConfiguration {
    constructor() {
        this.currentVehicle = 'standard';
        // Load saved settings or use defaults
        this.loadSettings();
    }

    // Helper method to clamp distance values to valid ranges
    clampDistance(value, min, max, defaultValue) {
        const num = parseFloat(value);
        if (isNaN(num)) return defaultValue;
        return Math.max(min, Math.min(max, num));
    }

    // Define valid ranges for all distance parameters
    getValidRanges() {
        return {
            // Standard trailer
            distFrontToKingpin: { min: 1.0, max: 2.15, default: 1.7 },
            distKingpinToTrailer: { min: 6.5, max: 9.0, default: 7.7 },
            distFrontAxleToKingpin: { min: 2.5, max: 4.0, default: 3.1 },
            distKingpinToDrive: { min: 0.2, max: 1.5, default: 0.5 },
            // SOLO
            distCargoStartToFront: { min: 0.5, max: 2.5, default: 1.0 },
            distCargoStartToDrive: { min: 3.0, max: 7.5, default: 5.5 },
            // JUMBO
            distSection1StartToFront: { min: 0.5, max: 2.5, default: 1.0 },
            distSection1StartToDrive: { min: 3.0, max: 7.5, default: 5.5 },
            distSection2StartToTrailerAxles: { min: 3.0, max: 7.5, default: 5.5 }
        };
    }

    setVehicle(vehicleType, vehicleConfig = null) {
        this.currentVehicle = vehicleType;
        this.vehicleConfig = vehicleConfig;
        this.loadSettings();

        const ranges = this.getValidRanges();

        // If vehicleConfig has axle positions, update them AFTER loadSettings (for SOLO dynamic sizing)
        if (vehicleConfig?.axles?.rear?.position !== undefined && vehicleConfig?.isSolo) {
            const range = ranges.distCargoStartToDrive;
            this.distCargoStartToDrive = this.clampDistance(
                vehicleConfig.axles.rear.position,
                range.min,
                range.max,
                range.default
            );
        }

        // If vehicleConfig has axle positions, update them AFTER loadSettings (for JUMBO dynamic sizing)
        if (vehicleConfig?.isJumbo && vehicleConfig?.axles) {
            if (vehicleConfig.axles.rear?.position !== undefined) {
                const range = ranges.distSection1StartToDrive;
                this.distSection1StartToDrive = this.clampDistance(
                    vehicleConfig.axles.rear.position,
                    range.min,
                    range.max,
                    range.default
                );
            }
            if (vehicleConfig.axles.trailer?.position !== undefined) {
                const range = ranges.distSection2StartToTrailerAxles;
                this.distSection2StartToTrailerAxles = this.clampDistance(
                    vehicleConfig.axles.trailer.position,
                    range.min,
                    range.max,
                    range.default
                );
            }
        }
    }
    
    loadSettings() {
        const settingsKey = `axleSettings_${this.currentVehicle}`;
        const saved = localStorage.getItem(settingsKey);
        const ranges = this.getValidRanges();

        if (saved) {
            const settings = JSON.parse(saved);

            // Validate and clamp all distance values
            for (const [key, value] of Object.entries(settings)) {
                if (ranges[key]) {
                    // This is a distance parameter - validate it
                    const range = ranges[key];
                    this[key] = this.clampDistance(value, range.min, range.max, range.default);
                } else {
                    // Not a distance parameter - assign directly
                    this[key] = value;
                }
            }
        } else {
            // Check if this is a SOLO or JUMBO vehicle
            const isSolo = this.vehicleConfig?.isSolo || false;
            const isJumbo = this.vehicleConfig?.isJumbo || false;
            
            if (isSolo) {
                // SOLO-specific defaults
                this.tractorAxles = 1; // Number of drive axles (default: 1)
                this.trailerAxles = 0; // No trailer axles for SOLO
                
                // Distances for SOLO (in meters)
                this.distCargoStartToFront = 1.0; // From cargo start to front axle (default 1.0m)
                this.distCargoStartToDrive = 5.5; // From cargo start to drive axles center (default 5.5m)
                
                // Empty weights (in kg)
                this.emptyFrontAxle = 5800;
                this.emptyDriveAxles = 3600;
                
                // Maximum loads (in kg)
                this.maxFrontAxle = 10000;
                this.maxDriveAxles = 11500; // Single drive axle for SOLO
                
                // Minimum drive axle load (in %)
                this.minDriveAxleLoad = 25;
            } else if (isJumbo) {
                // JUMBO-specific defaults (truck + trailer configuration)
                this.tractorAxles = 1; // Number of drive axles (default: 1)
                this.trailerAxles = 2; // Number of trailer axles for JUMBO trailer section (default: 2)
                
                // Distances for JUMBO (in meters)
                // Truck section (similar to SOLO)
                this.distSection1StartToFront = 1.0; // From section 1 start to front axle
                this.distSection1StartToDrive = 5.5; // From section 1 start to drive axles
                // Trailer section
                this.distSection2StartToTrailerAxles = 5.5; // From section 2 start to trailer axles center
                
                // Empty weights (in kg)
                this.emptyFrontAxle = 5800;
                this.emptyDriveAxles = 3600;
                this.emptyTrailerAxles = 4200;
                
                // Maximum loads (in kg)
                this.maxFrontAxle = 10000;
                this.maxDriveAxles = 11500; // Default single drive axle
                this.maxTrailerAxles = 18000; // Default 2 trailer axles for JUMBO
                
                // Minimum drive axle load (in %)
                this.minDriveAxleLoad = 25;
            } else {
                // Default settings for trailer vehicles
                this.tractorAxles = 1; // Number of drive axles (default: 1)
                this.trailerAxles = 3; // Number of trailer axles (default: 3)
                
                // Distances (in meters)
                this.distFrontToKingpin = 1.7; // Front of trailer to kingpin
                this.distKingpinToTrailer = 7.7; // Kingpin to center of trailer axle group
                this.distFrontAxleToKingpin = 3.1; // Front axle to kingpin
                this.distKingpinToDrive = 0.5; // Kingpin to center of drive axles
                
                // Empty weights (in kg)
                this.emptyFrontAxle = 5800;
                this.emptyDriveAxles = 3600;
                this.emptyTrailerAxles = 5200;
                
                // Maximum loads (in kg)
                this.maxFrontAxle = 10000;
                this.maxDriveAxles = 11500; // Default single drive axle
                this.maxTrailerAxles = 24000; // Default 3 trailer axles
                
                // Minimum drive axle load (in %)
                this.minDriveAxleLoad = 25;
            }
        }
    }
    
    saveSettings() {
        const isSolo = this.vehicleConfig?.isSolo || false;
        const isJumbo = this.vehicleConfig?.isJumbo || false;
        
        let settings;
        if (isSolo) {
            settings = {
                tractorAxles: this.tractorAxles,
                distCargoStartToFront: this.distCargoStartToFront,
                distCargoStartToDrive: this.distCargoStartToDrive,
                emptyFrontAxle: this.emptyFrontAxle,
                emptyDriveAxles: this.emptyDriveAxles,
                maxFrontAxle: this.maxFrontAxle,
                maxDriveAxles: this.maxDriveAxles,
                minDriveAxleLoad: this.minDriveAxleLoad
            };
        } else if (isJumbo) {
            settings = {
                tractorAxles: this.tractorAxles,
                trailerAxles: this.trailerAxles,
                distSection1StartToFront: this.distSection1StartToFront,
                distSection1StartToDrive: this.distSection1StartToDrive,
                distSection2StartToTrailerAxles: this.distSection2StartToTrailerAxles,
                emptyFrontAxle: this.emptyFrontAxle,
                emptyDriveAxles: this.emptyDriveAxles,
                emptyTrailerAxles: this.emptyTrailerAxles,
                maxFrontAxle: this.maxFrontAxle,
                maxDriveAxles: this.maxDriveAxles,
                maxTrailerAxles: this.maxTrailerAxles,
                minDriveAxleLoad: this.minDriveAxleLoad
            };
        } else {
            settings = {
                tractorAxles: this.tractorAxles,
                trailerAxles: this.trailerAxles,
                distFrontToKingpin: this.distFrontToKingpin,
                distKingpinToTrailer: this.distKingpinToTrailer,
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
        }
        const settingsKey = `axleSettings_${this.currentVehicle}`;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    }
    
    resetToDefaults() {
        const settingsKey = `axleSettings_${this.currentVehicle}`;
        localStorage.removeItem(settingsKey);
        this.loadSettings();
    }

    // Calculate distance from trailer axles to container end
    // This value is derived from: containerLength - distFrontToKingpin - distKingpinToTrailer
    getDistTrailerToEnd() {
        if (!this.vehicleConfig) {
            return 4.2; // Default fallback
        }

        const isSolo = this.vehicleConfig?.isSolo || false;
        const isJumbo = this.vehicleConfig?.isJumbo || false;

        // Only applicable for standard trailer vehicles
        if (isSolo || isJumbo) {
            return null; // Not applicable for SOLO or JUMBO
        }

        const containerLength = this.vehicleConfig.length || 13.62;
        return containerLength - this.distFrontToKingpin - this.distKingpinToTrailer;
    }

    // Get individual axle positions for multi-axle groups
    getDriveAxlePositions() {
        const positions = [];
        const isSolo = this.vehicleConfig?.isSolo || false;
        const isJumbo = this.vehicleConfig?.isJumbo || false;
        
        let centerPos;
        if (isSolo) {
            // For SOLO: use distance from cargo start
            centerPos = this.distCargoStartToDrive;
        } else if (isJumbo) {
            // For JUMBO: use distance from section 1 start (truck section)
            centerPos = this.distSection1StartToDrive;
        } else {
            // For trailer vehicles: use kingpin-based position
            centerPos = this.distFrontToKingpin + this.distKingpinToDrive;
        }
        
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
        const isSolo = this.vehicleConfig?.isSolo || false;
        const isJumbo = this.vehicleConfig?.isJumbo || false;
        
        // SOLO vehicles don't have trailer axles
        if (isSolo) {
            return [];
        }
        
        const positions = [];
        let centerPos;
        
        if (isJumbo) {
            // For JUMBO: trailer axles are in section 2
            // Position from section 2 start + gap (0.5m) + section 1 length
            const section1Length = this.vehicleConfig?.sections?.[0]?.length || 7.7;
            centerPos = section1Length + 0.5 + this.distSection2StartToTrailerAxles;
        } else {
            // For standard trailer vehicles
            centerPos = this.distFrontToKingpin + this.distKingpinToTrailer;
        }
        
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
        // Update max loads based on initial axle counts
        this.updateMaxLoadsBasedOnAxles();
    }
    
    setVehicle(vehicleConfig) {
        this.vehicleConfig = vehicleConfig;
        // Also update the axle configuration's current vehicle
        if (vehicleConfig && vehicleConfig.name) {
            // Extract vehicle type from config name or use the passed vehicle type
            const vehicleType = this.getVehicleTypeFromConfig(vehicleConfig);
            this.axleConfig.setVehicle(vehicleType, vehicleConfig);
        }
    }
    
    getVehicleTypeFromConfig(vehicleConfig) {
        // Map vehicle names to types used in localStorage keys
        const nameToType = {
            'Standard': 'standard',
            'MEGA': 'mega',
            'Frigo': 'frigo',
            'JUMBO': 'jumbo',
            'Kontener 20\'': 'container20',
            'Kontener 40\'': 'container40',
            'Kontener 40\' HC': 'container40hc',
            'Coilmulde Standard': 'coilmuldeStandard',
            'Coilmulde Mega': 'coilmuldeMega',
            'SOLO': 'solo',
            'Własne wymiary': 'custom'
        };
        return nameToType[vehicleConfig.name] || 'custom';
    }
    
    updateCargo(cargoItems) {
        this.cargoItems = cargoItems;
    }
    
    updateAxleConfiguration(config) {
        Object.assign(this.axleConfig, config);
        
        // Update max loads based on axle counts
        this.updateMaxLoadsBasedOnAxles();
        
        this.axleConfig.saveSettings();
    }
    
    updateMaxLoadsBasedOnAxles() {
        // Use either this.axleConfig (when called from updateAxleConfiguration) or this (when called from constructor)
        const config = this.axleConfig || this;
        
        // Update max front axle load (always 10000 kg)
        config.maxFrontAxle = 10000;
        
        // Update max drive axles load based on count
        if (config.tractorAxles === 1) {
            config.maxDriveAxles = 11500; // 11.5 tons for single drive axle
        } else if (config.tractorAxles === 2) {
            config.maxDriveAxles = 19000; // 19 tons for tandem drive axles
        }
        
        // Update max trailer axles load based on count (if not SOLO)
        if (config.trailerAxles === 1) {
            config.maxTrailerAxles = 10000; // 10 tons for single trailer axle
        } else if (config.trailerAxles === 2) {
            config.maxTrailerAxles = 18000; // 18 tons for tandem trailer axles
        } else if (config.trailerAxles === 3) {
            config.maxTrailerAxles = 24000; // 24 tons for tridem trailer axles
        }
        
        // If using this.axleConfig, also update this object
        if (this.axleConfig) {
            this.maxFrontAxle = config.maxFrontAxle;
            this.maxDriveAxles = config.maxDriveAxles;
            if (config.maxTrailerAxles !== undefined) {
                this.maxTrailerAxles = config.maxTrailerAxles;
            }
        }
    }
    
    calculateAxleLoads() {
        if (!this.vehicleConfig) {
            return null;
        }
        
        // Check vehicle type
        const isSolo = this.vehicleConfig.isSolo || false;
        const isJumbo = this.vehicleConfig.isJumbo || false;
        
        if (isSolo) {
            // SOLO vehicle calculations
            return this.calculateSoloAxleLoads();
        } else if (isJumbo) {
            // JUMBO vehicle calculations (truck + trailer)
            return this.calculateJumboAxleLoads();
        } else {
            // Standard trailer calculations
            return this.calculateTrailerAxleLoads();
        }
    }
    
    calculateSoloAxleLoads() {
        // Use configuration from axleConfig for SOLO
        const cargoStartToFront = this.axleConfig.distCargoStartToFront;
        const cargoStartToDrive = this.axleConfig.distCargoStartToDrive;
        
        // Empty weights in kg
        const frontAxleEmptyWeight = this.axleConfig.emptyFrontAxle;
        const driveAxlesEmptyWeight = this.axleConfig.emptyDriveAxles;
        
        // Total cargo weight
        let totalCargoWeight = 0;
        let totalCargoMoment = 0; // Moment around front axle
        
        // Calculate moments of cargo around FRONT axle (easier for physics)
        this.cargoItems.forEach(item => {
            // Skip items that are outside the container
            if (item.position && !item.isOutside) {
                // Position X is relative to container center, convert to position from cargo start
                const cargoXFromStart = item.position.x + (this.vehicleConfig.length / 2);
                // Calculate distance from FRONT axle (front axle is before cargo start)
                const cargoXFromFront = cargoXFromStart + cargoStartToFront; // cargoStartToFront is distance before cargo
                totalCargoWeight += item.weight;
                totalCargoMoment += item.weight * cargoXFromFront;
            }
        });
        
        // Wheelbase between front and drive axles
        const wheelbase = cargoStartToDrive + cargoStartToFront; // Both positive distances
        
        // Physics: Equilibrium of moments around front axle
        // Sum of moments: F_drive × wheelbase = totalCargoMoment
        // Sum of forces: F_front + F_drive = totalCargoWeight
        
        const driveAxlesCargoLoad = totalCargoWeight > 0 ? 
            (totalCargoMoment / wheelbase) : 0;
        const frontAxleCargoLoad = totalCargoWeight - driveAxlesCargoLoad;
        
        // Final axle loads = empty weights + cargo loads
        const frontAxleTotal = frontAxleEmptyWeight + frontAxleCargoLoad;
        const driveAxlesTotal = driveAxlesEmptyWeight + driveAxlesCargoLoad;
        
        // Get maximum loads from configuration
        const frontAxleMax = this.axleConfig.maxFrontAxle;
        const driveAxlesMax = this.axleConfig.maxDriveAxles;
        
        // Check minimum drive axle load requirement
        const totalVehicleWeight = frontAxleTotal + driveAxlesTotal;
        const driveAxlePercentage = (driveAxlesTotal / totalVehicleWeight) * 100;
        const minDrivePercentage = this.axleConfig.minDriveAxleLoad || 25;
        let driveAxleWarning = null;
        
        if (driveAxlePercentage < minDrivePercentage) {
            driveAxleWarning = `Uwaga: Obciążenie osi napędowej (${driveAxlePercentage.toFixed(1)}%) jest poniżej minimum (${minDrivePercentage}%)`;
        }
        
        // Calculate center of gravity of cargo from front axle for reference
        const cargoCenterFromFront = totalCargoWeight > 0 ? totalCargoMoment / totalCargoWeight : 0;
        
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
            total: {
                weight: Math.round(frontAxleEmptyWeight + driveAxlesEmptyWeight + totalCargoWeight),
                cargoWeight: Math.round(totalCargoWeight),
                vehicleWeight: frontAxleEmptyWeight + driveAxlesEmptyWeight
            },
            isSolo: true,
            cargoCenterFromFront: cargoCenterFromFront.toFixed(2),
            config: this.axleConfig // Include configuration for reference
        };
    }
    
    calculateJumboAxleLoads() {
        // JUMBO consists of two independent sections: truck (section 1) and trailer (section 2)
        // Each section carries its own cargo independently
        
        const sections = this.vehicleConfig.sections || [];
        const section1Length = sections[0]?.length || 7.7;
        const section2Length = sections[1]?.length || 7.7;
        const gap = 0.5; // 50cm gap between sections
        
        
        // Axle positions from configuration
        const section1StartToFront = this.axleConfig.distSection1StartToFront;
        const section1StartToDrive = this.axleConfig.distSection1StartToDrive;
        const section2StartToTrailerAxles = this.axleConfig.distSection2StartToTrailerAxles;
        
        // Empty weights
        const emptyFrontAxle = this.axleConfig.emptyFrontAxle;
        const emptyDriveAxles = this.axleConfig.emptyDriveAxles;
        const emptyTrailerAxles = this.axleConfig.emptyTrailerAxles;
        
        // Maximum loads
        const maxFrontAxle = this.axleConfig.maxFrontAxle;
        const maxDriveAxles = this.axleConfig.maxDriveAxles;
        const maxTrailerAxles = this.axleConfig.maxTrailerAxles;
        
        // Separate cargo items by section
        const section1Items = [];
        const section2Items = [];
        
        this.cargoItems.forEach(item => {
            if (!item || !item.position) return;
            
            const itemCenterX = item.position.x;
            // JUMBO total length includes gap, so positions are relative to total center
            const totalLength = section1Length + gap + section2Length;
            const section1Start = -totalLength / 2;
            const section1End = section1Start + section1Length;
            const section2Start = section1End + gap;
            const section2End = section2Start + section2Length;
            
            if (itemCenterX >= section1Start && itemCenterX <= section1End) {
                section1Items.push(item);
            } else if (itemCenterX >= section2Start && itemCenterX <= section2End) {
                section2Items.push(item);
            }
        });
        
        
        // Calculate Section 1 (Truck) loads - similar to SOLO
        let frontAxleLoad = emptyFrontAxle;
        let driveAxleLoad = emptyDriveAxles;
        let section1CargoWeight = 0;
        let section1CargoMomentFromFront = 0;
        
        section1Items.forEach(item => {
            const weight = item.weight || 0;
            section1CargoWeight += weight;
            
            // Position relative to section 1 start
            const totalLength = section1Length + gap + section2Length;
            const section1Start = -totalLength / 2;
            const relativeX = item.position.x - section1Start; // Distance from section 1 start
            const distanceFromFront = relativeX + section1StartToFront;
            section1CargoMomentFromFront += weight * distanceFromFront;
        });
        
        // Section 1 load distribution (two-point support)
        if (section1CargoWeight > 0) {
            const wheelbase = section1StartToFront + section1StartToDrive;
            const driveMoment = section1CargoMomentFromFront;
            const driveCargoLoad = driveMoment / wheelbase;
            const frontCargoLoad = section1CargoWeight - driveCargoLoad;
            
            driveAxleLoad += driveCargoLoad;
            frontAxleLoad += frontCargoLoad;
        }
        
        // Calculate Section 2 (Trailer) loads - independent calculation
        let trailerAxleLoad = emptyTrailerAxles;
        let section2CargoWeight = 0;
        
        section2Items.forEach(item => {
            const weight = item.weight || 0;
            section2CargoWeight += weight;
        });
        
        // Section 2 load distribution - all weight on trailer axles
        trailerAxleLoad += section2CargoWeight;
        
        
        // Calculate load percentages
        const frontAxlePercentage = (frontAxleLoad / maxFrontAxle) * 100;
        const driveAxlePercentage = (driveAxleLoad / maxDriveAxles) * 100;
        const trailerAxlePercentage = (trailerAxleLoad / maxTrailerAxles) * 100;
        
        // Calculate minimum drive axle load requirement
        const totalMass = frontAxleLoad + driveAxleLoad + trailerAxleLoad;
        const minDriveLoad = totalMass * (this.axleConfig.minDriveAxleLoad / 100);
        const driveLoadSatisfied = driveAxleLoad >= minDriveLoad;
        
        // Calculate cargo center positions for each section
        let section1CargoCenterFromFront = section1Length / 2 + section1StartToFront;
        if (section1CargoWeight > 0) {
            section1CargoCenterFromFront = section1CargoMomentFromFront / section1CargoWeight;
        }
        
        let section2CargoCenterFromStart = section2Length / 2;
        if (section2CargoWeight > 0) {
            let section2MomentFromStart = 0;
            section2Items.forEach(item => {
                const totalLength = section1Length + gap + section2Length;
                const section2Start = -totalLength / 2 + section1Length + gap;
                const relativeX = item.position.x - section2Start; // Distance from section 2 start
                section2MomentFromStart += (item.weight || 0) * relativeX;
            });
            section2CargoCenterFromStart = section2MomentFromStart / section2CargoWeight;
        }
        
        return {
            frontAxle: {
                load: frontAxleLoad.toFixed(0),
                percentage: frontAxlePercentage.toFixed(1),
                max: maxFrontAxle,
                overloaded: frontAxlePercentage > 100,
                warning: frontAxlePercentage > 90
            },
            driveAxles: {
                load: driveAxleLoad.toFixed(0),
                percentage: driveAxlePercentage.toFixed(1),
                max: maxDriveAxles,
                overloaded: driveAxlePercentage > 100,
                warning: driveAxlePercentage > 90 || !driveLoadSatisfied,
                belowMinimum: !driveLoadSatisfied,
                minimumRequired: minDriveLoad.toFixed(0)
            },
            trailerAxles: {
                load: trailerAxleLoad.toFixed(0),
                percentage: trailerAxlePercentage.toFixed(1),
                max: maxTrailerAxles,
                overloaded: trailerAxlePercentage > 100,
                warning: trailerAxlePercentage > 90
            },
            totalLoad: (frontAxleLoad + driveAxleLoad + trailerAxleLoad).toFixed(0),
            cargoWeight: (section1CargoWeight + section2CargoWeight).toFixed(0),
            emptyWeight: (emptyFrontAxle + emptyDriveAxles + emptyTrailerAxles).toFixed(0),
            isJumbo: true,
            section1CargoCenterFromFront: section1CargoCenterFromFront.toFixed(2),
            section2CargoCenterFromStart: section2CargoCenterFromStart.toFixed(2),
            section1CargoWeight: section1CargoWeight.toFixed(0),
            section2CargoWeight: section2CargoWeight.toFixed(0),
            config: this.axleConfig // Include configuration for reference
        };
    }
    
    calculateTrailerAxleLoads() {
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
}