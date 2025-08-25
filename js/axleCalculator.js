class AxleCalculator {
    constructor() {
        this.vehicleConfig = null;
        this.cargoItems = [];
    }
    
    setVehicle(vehicleConfig) {
        this.vehicleConfig = vehicleConfig;
    }
    
    updateCargo(cargoItems) {
        this.cargoItems = cargoItems;
    }
    
    calculateAxleLoads() {
        if (!this.vehicleConfig || !this.vehicleConfig.axles) {
            return null;
        }
        
        const frontAxlePos = this.vehicleConfig.axles.front.position;
        const rearAxlePos = this.vehicleConfig.axles.rear.position;
        const totalLength = this.vehicleConfig.length;
        
        const vehicleWeight = 7000;
        const vehicleCenterX = 0;
        
        let totalCargoWeight = 0;
        let totalMomentFront = 0;
        let totalMomentRear = 0;
        
        this.cargoItems.forEach(item => {
            if (item.position) {
                const cargoX = item.position.x + (totalLength / 2);
                
                const distanceToFront = Math.abs(cargoX - frontAxlePos);
                const distanceToRear = Math.abs(cargoX - rearAxlePos);
                const axleDistance = rearAxlePos - frontAxlePos;
                
                const rearLoad = (item.weight * distanceToFront) / axleDistance;
                const frontLoad = (item.weight * distanceToRear) / axleDistance;
                
                if (cargoX <= frontAxlePos) {
                    totalMomentFront += item.weight;
                } else if (cargoX >= rearAxlePos) {
                    totalMomentRear += item.weight;
                } else {
                    totalMomentFront += frontLoad;
                    totalMomentRear += rearLoad;
                }
                
                totalCargoWeight += item.weight;
            }
        });
        
        const vehicleFrontLoad = vehicleWeight * 0.3;
        const vehicleRearLoad = vehicleWeight * 0.7;
        
        const frontAxleLoad = vehicleFrontLoad + totalMomentFront;
        const rearAxleLoad = vehicleRearLoad + totalMomentRear;
        
        const frontAxleMax = this.vehicleConfig.axles.front.maxLoad;
        const rearAxleMax = this.vehicleConfig.axles.rear.maxLoad;
        
        return {
            front: {
                load: Math.round(frontAxleLoad),
                max: frontAxleMax,
                percentage: (frontAxleLoad / frontAxleMax) * 100,
                status: this.getLoadStatus(frontAxleLoad, frontAxleMax)
            },
            rear: {
                load: Math.round(rearAxleLoad),
                max: rearAxleMax,
                percentage: (rearAxleLoad / rearAxleMax) * 100,
                status: this.getLoadStatus(rearAxleLoad, rearAxleMax)
            },
            total: {
                weight: Math.round(vehicleWeight + totalCargoWeight),
                cargoWeight: Math.round(totalCargoWeight),
                vehicleWeight: vehicleWeight
            }
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