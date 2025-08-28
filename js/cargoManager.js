class CargoManager {
    constructor(scene3d) {
        this.scene3d = scene3d;
        this.containerDimensions = null;
        this.cargoItems = [];
        this.packer = null;
        this.totalWeight = 0;
        this.maxLoad = 24000;
        this.colorIndex = 0; // Track color index for golden ratio
    }
    
    setContainer(dimensions, maxLoad) {
        this.containerDimensions = dimensions;
        this.maxLoad = maxLoad;
        
        // Check if JUMBO with sections
        if (dimensions.sections && dimensions.sections.length > 0) {
            // Create separate packers for each section
            this.packers = [];
            this.sections = dimensions.sections;
            
            dimensions.sections.forEach(section => {
                this.packers.push(new BinPacking3D(
                    section.length,
                    section.width,
                    section.height
                ));
            });
        } else {
            // Single packer for regular containers
            this.packer = new BinPacking3D(
                dimensions.length,
                dimensions.width,
                dimensions.height,
                dimensions  // Pass full container data for groove info
            );
            this.packers = null;
            this.sections = null;
        }
        
        this.scene3d.createContainer(dimensions);
    }
    
    addCargoUnit(unitType, customParams = {}) {
        const unitConfig = CONFIG.cargoUnits[unitType] || customParams;
        
        // For custom units, use provided dimensions
        let dimensions;
        if (customParams.dimensions) {
            dimensions = customParams.dimensions;
        } else if (unitConfig.length !== undefined) {
            dimensions = {
                length: unitConfig.length,
                width: unitConfig.width,
                height: unitConfig.height
            };
        } else {
            return null;
        }
        
        // Generate unique color using golden ratio for maximum visual distinction
        const generateGroupColor = () => {
            // Golden angle in degrees (360 / φ²)
            const goldenAngle = 137.5077640500378;
            
            // Calculate hue using golden angle for even distribution
            // Start from 30 to avoid red (0) which is used for center of gravity
            const baseHue = 30 + (this.colorIndex * goldenAngle);
            const hue = baseHue % 360;
            
            // Skip hues too close to red (0±30) and gray (around 0 saturation)
            let finalHue = hue;
            if (hue < 30 || hue > 330) {
                finalHue = 30 + hue; // Shift away from red
            }
            
            // High lightness for bright colors (65-70%)
            const lightness = 65 + (this.colorIndex % 2) * 5; // Alternate between 65% and 70%
            
            // Good saturation for vivid but not overwhelming colors (75-85%)
            const saturation = 75 + (this.colorIndex % 3) * 5; // Cycle through 75%, 80%, 85%
            
            this.colorIndex++;
            
            return `hsl(${finalHue}, ${saturation}%, ${lightness}%)`;
        };
        
        // Check if this is part of a continuous group
        const lastItem = this.cargoItems[this.cargoItems.length - 1];
        
        // Use groupKey if provided, otherwise check all parameters
        const loadingStr = customParams.loadingMethods ? customParams.loadingMethods.join(',') : (unitConfig.loadingMethods || ['rear', 'side', 'top']).join(',');
        const unloadingStr = customParams.unloadingMethods ? customParams.unloadingMethods.join(',') : (unitConfig.unloadingMethods || ['rear', 'side', 'top']).join(',');
        const groupKey = customParams.groupKey || `${unitType}_${customParams.name}_${customParams.weight}_${customParams.maxStack}_${customParams.maxStackWeight}_${loadingStr}_${unloadingStr}`;
        
        const isSameGroup = lastItem && 
                           (customParams.groupKey ? lastItem.groupKey === groupKey :
                           (lastItem.type === unitType && 
                           lastItem.name === (customParams.name || unitConfig.name) &&
                           lastItem.weight === (customParams.weight || unitConfig.defaultWeight) &&
                           lastItem.maxStack === (customParams.maxStack !== undefined ? customParams.maxStack : unitConfig.maxStack) &&
                           lastItem.maxStackWeight === (customParams.maxStackWeight !== undefined ? customParams.maxStackWeight : unitConfig.maxStackWeight) &&
                           JSON.stringify(lastItem.loadingMethods) === JSON.stringify(customParams.loadingMethods || unitConfig.loadingMethods || ['rear', 'side', 'top']) &&
                           JSON.stringify(lastItem.unloadingMethods) === JSON.stringify(customParams.unloadingMethods || unitConfig.unloadingMethods || ['rear', 'side', 'top']) &&
                           lastItem.length === dimensions.length &&
                           lastItem.width === dimensions.width &&
                           lastItem.height === dimensions.height));
        
        // Generate silver/metallic color for steel coils only
        const isRoll = customParams.isRoll || unitConfig.isRoll || false;
        const isVerticalRoll = customParams.isVerticalRoll || unitConfig.isVerticalRoll || false;
        const fixedDiameter = unitConfig.fixedDiameter || false;
        
        let itemColor;
        if (isRoll && fixedDiameter) {
            // Use fixed silver color for steel coils only (they have fixedDiameter flag)
            itemColor = 0xd9d9d9; // Light silver/gray color
        } else {
            // Regular rolls and other items use group colors
            itemColor = isSameGroup ? lastItem.color : generateGroupColor();
        }
        
        const cargoItem = {
            id: Date.now() + Math.random(),
            type: unitType,
            name: customParams.name || unitConfig.name || 'Custom',
            length: dimensions.length,
            width: dimensions.width,
            height: dimensions.height,
            weight: customParams.weight || unitConfig.defaultWeight || 100,
            maxStack: customParams.maxStack !== undefined ? customParams.maxStack : (unitConfig.maxStack ?? 3),
            maxStackWeight: customParams.maxStackWeight !== undefined ? customParams.maxStackWeight : (unitConfig.maxStackWeight ?? 2000),
            loadingMethods: customParams.loadingMethods || unitConfig.loadingMethods || ['rear', 'side', 'top'],
            unloadingMethods: customParams.unloadingMethods || unitConfig.unloadingMethods || ['rear', 'side', 'top'],
            orderIndex: this.cargoItems.length,  // Kolejność dodania
            groupId: isSameGroup ? lastItem.groupId : Date.now(), // Group ID for continuous additions
            groupKey: groupKey, // Store groupKey for future comparisons
            color: itemColor, // Use grayscale for steel coils, group color for others
            isRoll: isRoll, // Add isRoll property
            isVerticalRoll: customParams.isVerticalRoll || unitConfig.isVerticalRoll || false, // Add vertical roll flag
            diameter: isRoll ? dimensions.width : undefined, // Add diameter for rolls (same as width)
            fixedDiameter: unitConfig.fixedDiameter || false, // Add fixed diameter flag for steel coils
            position: null,
            mesh: null
        };
        
        this.cargoItems.push(cargoItem);
        this.totalWeight += cargoItem.weight;
        
        return cargoItem;
    }
    
    removeCargoUnit(cargoId) {
        const index = this.cargoItems.findIndex(item => item.id === cargoId);
        if (index > -1) {
            const cargo = this.cargoItems[index];
            if (cargo.mesh) {
                this.scene3d.removeCargo(cargo.mesh);
            }
            this.totalWeight -= cargo.weight;
            this.cargoItems.splice(index, 1);
        }
    }
    
    removeCargoItem(cargoData) {
        // Find the cargo item by matching position and properties
        const index = this.cargoItems.findIndex(item => 
            item.position && cargoData.position &&
            Math.abs(item.position.x - cargoData.position.x) < 0.01 &&
            Math.abs(item.position.y - cargoData.position.y) < 0.01 &&
            Math.abs(item.position.z - cargoData.position.z) < 0.01
        );
        
        if (index > -1) {
            const cargo = this.cargoItems[index];
            this.totalWeight -= cargo.weight;
            this.cargoItems.splice(index, 1);
            
            // Re-validate and reposition remaining items if needed
            if (this.cargoItems.length > 0 && this.cargoItems.length <= 50) {
                setTimeout(() => {
                    this.autoArrange();
                    // Update UI after rearranging
                    if (this.onCargoRearranged) {
                        this.onCargoRearranged();
                    }
                }, 100);
            }
        }
    }
    
    clearAllCargo() {
        this.scene3d.clearAllCargo();
        this.cargoItems = [];
        this.totalWeight = 0;
        this.colorIndex = 0; // Reset color index
    }
    
    autoArrange() {
        if (!this.containerDimensions || this.cargoItems.length === 0) {
            return false;
        }
        
        this.scene3d.clearAllCargo();
        
        // Get trailer height
        const trailerHeight = this.containerDimensions.trailerHeight || 1.1;
        
        // Group items by groupId (continuous additions of same type)
        const groups = {};
        this.cargoItems.forEach(item => {
            const key = item.groupId; // Use groupId instead of type-based key
            if (!groups[key]) {
                groups[key] = {
                    items: [],
                    sample: item,
                    weight: item.weight,
                    minOrderIndex: item.orderIndex,  // Track earliest order
                    color: item.color // Preserve group color
                };
            }
            groups[key].items.push(item);
            // Update min order index if this item is earlier
            if (item.orderIndex < groups[key].minOrderIndex) {
                groups[key].minOrderIndex = item.orderIndex;
            }
        });
        
        // Sort groups: by order first (FIFO), then by weight for stability
        const sortedGroups = Object.values(groups).sort((a, b) => {
            // Always prioritize order of addition (FIFO)
            const orderDiff = a.minOrderIndex - b.minOrderIndex;
            if (orderDiff !== 0) {
                return orderDiff;
            }
            // Only if added at exactly the same time, sort by weight
            return b.weight - a.weight;
        });
        
        // Create stacks from groups
        const stacks = [];
        sortedGroups.forEach(group => {
            const maxStack = group.sample.maxStack !== undefined ? group.sample.maxStack : 1;
            const maxStackWeight = group.sample.maxStackWeight !== undefined ? group.sample.maxStackWeight : Infinity;
            
            // maxStack means how many units can be placed ON TOP of this unit
            // So total stack height = 1 (base) + maxStack (units on top)
            const maxTotalHeight = 1 + maxStack;
            
            // Get container height to check if stack fits
            const containerHeight = this.containerDimensions.height;
            const unitHeight = group.sample.height;
            const unitWeight = group.sample.weight;
            
            // If maxStack is 0, only single units (no stacking on top)
            if (maxStack === 0) {
                group.items.forEach(item => {
                    stacks.push({
                        items: [item],
                        sample: group.sample,
                        stackHeight: 1
                    });
                });
            } else {
                // Normal stacking logic with height and weight check
                let currentStack = [];
                let weightAboveBottom = 0; // Weight on top of the bottom unit
                
                group.items.forEach(item => {
                    // Check maxStack limit, container height AND weight limit
                    const potentialStackHeight = (currentStack.length + 1) * unitHeight;
                    // Weight above bottom = all units except the first one
                    const potentialWeightAbove = currentStack.length > 0 ? weightAboveBottom + unitWeight : 0;
                    const canAddToStack = currentStack.length < maxTotalHeight && 
                                         potentialStackHeight <= containerHeight &&
                                         potentialWeightAbove <= maxStackWeight;
                    
                    if (canAddToStack) {
                        currentStack.push(item);
                        if (currentStack.length > 1) {
                            weightAboveBottom += unitWeight;
                        }
                    } else {
                        // Start new stack
                        if (currentStack.length > 0) {
                            stacks.push({
                                items: currentStack,
                                sample: group.sample,
                                stackHeight: currentStack.length
                            });
                        }
                        currentStack = [item];
                        weightAboveBottom = 0; // Reset weight for new stack
                    }
                });
                
                // Add remaining items as last stack
                if (currentStack.length > 0) {
                    stacks.push({
                        items: currentStack,
                        sample: group.sample,
                        stackHeight: currentStack.length
                    });
                }
            }
        });
        
        // Prepare items for packing (treating each stack as single unit)
        const itemsToPlace = stacks;
        
        // Handle JUMBO with sections
        if (this.packers && this.sections) {
            // Reset packers
            this.packers.forEach(packer => packer.reset());
            
            const itemsForPacking = itemsToPlace.map(stack => ({
                width: stack.sample.length,
                depth: stack.sample.width,
                height: stack.sample.height * stack.stackHeight, // Stack height
                weight: stack.sample.weight * stack.stackHeight, // Total weight
                userData: stack,
                maxStack: stack.sample.maxStack, // Pass maxStack info
                maxStackWeight: stack.sample.maxStackWeight, // Pass maxStackWeight info
                isRoll: stack.sample.isRoll, // Pass isRoll info for steel coils
                isVerticalRoll: stack.sample.isVerticalRoll, // Pass isVerticalRoll info for rolls
                diameter: stack.sample.diameter, // Pass diameter for rolls
                fixedDiameter: stack.sample.fixedDiameter // Pass fixedDiameter for steel coils
            }));
            
            const gap = 0.5; // 50cm gap between sections
            let xOffset = -this.containerDimensions.length / 2;
            let remainingItems = [...itemsForPacking];
            
            // Pack items into sections sequentially
            this.sections.forEach((section, sectionIndex) => {
                if (remainingItems.length === 0) return;
                
                if (sectionIndex > 0) xOffset += gap;
                
                const result = this.packers[sectionIndex].packItems(remainingItems);
                
                result.packed.forEach(packedItem => {
                    const stack = packedItem.userData;
                    const baseX = xOffset + packedItem.position.x;
                    const baseY = packedItem.position.y;
                    const baseZ = packedItem.position.z - (section.width / 2);
                    
                    // Place each item in the stack
                    stack.items.forEach((item, index) => {
                        // Adjust position based on rotation
                        const itemLength = packedItem.rotated ? stack.sample.width : stack.sample.length;
                        const itemWidth = packedItem.rotated ? stack.sample.length : stack.sample.width;
                        
                        item.position = {
                            x: baseX + (itemLength / 2),
                            y: trailerHeight + baseY + (index * stack.sample.height) + (stack.sample.height / 2),
                            z: baseZ + (itemWidth / 2)
                        };
                        
                        const meshData = {
                            ...item,
                            x: item.position.x,
                            y: item.position.y,
                            z: item.position.z,
                            length: itemLength,
                            width: itemWidth,
                            height: stack.sample.height
                        };
                        
                        item.mesh = this.scene3d.addCargo(meshData);
                    });
                });
                
                // Update remaining items for next section
                remainingItems = result.unpacked;
                xOffset += section.length;
            });
            
            // Check for unpacked items in JUMBO
            if (remainingItems.length > 0) {
                let totalUnpacked = 0;
                remainingItems.forEach(unpackedStack => {
                    totalUnpacked += unpackedStack.userData.items.length;
                    // Remove unpacked items from cargoItems and update total weight
                    unpackedStack.userData.items.forEach(item => {
                        const index = this.cargoItems.indexOf(item);
                        if (index > -1) {
                            this.totalWeight -= item.weight;
                            this.cargoItems.splice(index, 1);
                        }
                    });
                });
                
                this.updateCenterOfGravity();
                return { success: false, unpackedCount: totalUnpacked };
            }
        } else {
            // Regular single container packing
            this.packer = new BinPacking3D(
                this.containerDimensions.length,
                this.containerDimensions.width,
                this.containerDimensions.height,
                this.containerDimensions  // Pass full container data for groove info
            );
            
            const itemsForPacking = itemsToPlace.map(stack => ({
                width: stack.sample.length,
                depth: stack.sample.width,
                height: stack.sample.height * stack.stackHeight, // Stack height
                weight: stack.sample.weight * stack.stackHeight, // Total weight
                userData: stack,
                maxStack: stack.sample.maxStack, // Pass maxStack info
                maxStackWeight: stack.sample.maxStackWeight, // Pass maxStackWeight info
                isRoll: stack.sample.isRoll, // Pass isRoll info for steel coils
                isVerticalRoll: stack.sample.isVerticalRoll, // Pass isVerticalRoll info for rolls
                diameter: stack.sample.diameter, // Pass diameter for rolls
                fixedDiameter: stack.sample.fixedDiameter // Pass fixedDiameter for steel coils
            }));
            
            const result = this.packer.packItems(itemsForPacking);
            
            // Track unpacked items
            let totalUnpacked = 0;
            result.unpacked.forEach(unpackedStack => {
                totalUnpacked += unpackedStack.userData.items.length;
            });
            
            result.packed.forEach(packedItem => {
                const stack = packedItem.userData;
                
                // Transform position from bin coordinates (0,0 at container start) to scene coordinates (0,0 at container center)
                const baseX = packedItem.position.x - (this.containerDimensions.length / 2);
                const baseY = packedItem.position.y;
                // Only steel coils (with fixedDiameter) have special Z positioning for groove
                const baseZ = (stack.sample.isRoll && stack.sample.fixedDiameter) ? packedItem.position.z : 
                            packedItem.position.z - (this.containerDimensions.width / 2);
                
                // Place each item in the stack
                stack.items.forEach((item, index) => {
                    // Adjust position based on rotation
                    const itemLength = packedItem.rotated ? stack.sample.width : stack.sample.length;
                    const itemWidth = packedItem.rotated ? stack.sample.length : stack.sample.width;
                    
                    item.position = {
                        x: baseX + (itemLength / 2),
                        y: trailerHeight + baseY + (index * stack.sample.height) + (stack.sample.height / 2),
                        z: baseZ + ((stack.sample.isRoll && stack.sample.fixedDiameter) ? 0 : itemWidth / 2)
                    };
                    
                    const meshData = {
                        ...item,
                        x: item.position.x,
                        y: item.position.y,
                        z: item.position.z,
                        length: itemLength,
                        width: itemWidth,
                        height: stack.sample.height
                    };
                    
                    item.mesh = this.scene3d.addCargo(meshData);
                });
            });
            
            // Return info about unpacked items
            if (totalUnpacked > 0) {
                // Remove unpacked items from cargoItems and update total weight
                result.unpacked.forEach(unpackedStack => {
                    unpackedStack.userData.items.forEach(item => {
                        const index = this.cargoItems.indexOf(item);
                        if (index > -1) {
                            this.totalWeight -= item.weight;
                            this.cargoItems.splice(index, 1);
                        }
                    });
                });
                
                this.updateCenterOfGravity();
                return { success: false, unpackedCount: totalUnpacked };
            }
        }
        
        this.updateCenterOfGravity();
        return { success: true, unpackedCount: 0 };
    }
    
    manualPlaceCargo(cargoItem, position) {
        if (cargoItem.mesh) {
            this.scene3d.removeCargo(cargoItem.mesh);
        }
        
        cargoItem.position = position;
        
        const meshData = {
            ...cargoItem,
            x: position.x,
            y: position.y,
            z: position.z
        };
        
        cargoItem.mesh = this.scene3d.addCargo(meshData);
        this.updateCenterOfGravity();
    }
    
    calculateCenterOfGravity() {
        if (this.cargoItems.length === 0) {
            return null;
        }
        
        let totalWeightedX = 0;
        let totalWeightedY = 0;
        let totalWeightedZ = 0;
        let totalWeight = 0;
        
        this.cargoItems.forEach(item => {
            if (item.position) {
                totalWeightedX += item.position.x * item.weight;
                totalWeightedY += item.position.y * item.weight;
                totalWeightedZ += item.position.z * item.weight;
                totalWeight += item.weight;
            }
        });
        
        if (totalWeight === 0) return null;
        
        return {
            x: totalWeightedX / totalWeight,
            y: totalWeightedY / totalWeight,
            z: totalWeightedZ / totalWeight
        };
    }
    
    updateCenterOfGravity() {
        const centerOfGravity = this.calculateCenterOfGravity();
        this.scene3d.updateCenterOfGravity(centerOfGravity);
        return centerOfGravity;
    }
    
    getStatistics() {
        const placedItems = this.cargoItems.filter(item => item.position !== null);
        
        let usedVolume = 0;
        placedItems.forEach(item => {
            usedVolume += item.length * item.width * item.height;
        });
        
        const containerVolume = this.containerDimensions ? 
            this.containerDimensions.length * this.containerDimensions.width * this.containerDimensions.height : 1;
        
        return {
            totalItems: this.cargoItems.length,
            placedItems: placedItems.length,
            totalWeight: this.totalWeight,
            maxLoad: this.maxLoad,
            weightUsage: (this.totalWeight / this.maxLoad) * 100,
            volumeUsage: (usedVolume / containerVolume) * 100,
            centerOfGravity: this.calculateCenterOfGravity()
        };
    }
    
    exportConfiguration() {
        return {
            container: this.containerDimensions,
            maxLoad: this.maxLoad,
            cargoItems: this.cargoItems.map(item => ({
                type: item.type,
                name: item.name,
                dimensions: {
                    length: item.length,
                    width: item.width,
                    height: item.height
                },
                weight: item.weight,
                position: item.position
            })),
            statistics: this.getStatistics()
        };
    }
    
    importConfiguration(config) {
        this.clearAllCargo();
        
        if (config.container) {
            this.setContainer(config.container, config.maxLoad);
        }
        
        if (config.cargoItems) {
            config.cargoItems.forEach(item => {
                const cargoItem = this.addCargoUnit(item.type, {
                    weight: item.weight
                });
                
                if (item.position) {
                    this.manualPlaceCargo(cargoItem, item.position);
                }
            });
        }
        
        this.updateCenterOfGravity();
    }
    
    updateCargoPositions(movedCargo) {
        // Update positions of moved cargo items
        movedCargo.forEach(cargoData => {
            const item = this.cargoItems.find(c => c.id === cargoData.id);
            if (item && cargoData.position) {
                item.position = cargoData.position;
            }
        });
        
        // Update center of gravity after movement
        this.updateCenterOfGravity();
    }
}