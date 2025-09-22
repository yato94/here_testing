class CargoManager {
    constructor(scene3d) {
        this.scene3d = scene3d;
        this.containerDimensions = null;
        this.cargoItems = [];
        this.packer = null;
        this.totalWeight = 0;
        this.maxLoad = 24000;
        this.colorIndex = 0; // Track color index for golden ratio
        this.selectedGroupId = null; // Track selected group for group operations
        this.onGroupSelectionChanged = null; // Callback for UI synchronization
    }
    
    updateMaxLoad(maxLoad) {
        this.maxLoad = maxLoad;
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
            isVerticalRoll: customParams.isVerticalRoll !== undefined ? customParams.isVerticalRoll : (unitConfig.isVerticalRoll || false), // Add vertical roll flag
            isHorizontalRoll: customParams.isHorizontalRoll || false, // Add horizontal roll flag
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
            
            // No auto-arrange when removing items - keep other items in place
            // Just update UI
            if (this.onCargoRearranged) {
                this.onCargoRearranged();
            }
        }
    }
    
    clearAllCargo() {
        this.scene3d.clearAllCargo();
        this.cargoItems = [];
        this.totalWeight = 0;
        this.colorIndex = 0; // Reset color index
    }
    
    autoArrangeGroup(groupId) {
        // Arrange only specific group, keeping other groups in place
        if (!this.containerDimensions || this.cargoItems.length === 0) {
            return false;
        }
        
        // Get items from the specific group
        const groupItems = this.cargoItems.filter(item => item.groupId === groupId);
        if (groupItems.length === 0) {
            return false;
        }
        
        // Calculate current weight of items already in container (not outside)
        let currentWeight = 0;
        this.cargoItems.forEach(item => {
            if (item.groupId !== groupId && !item.isOutside) {
                currentWeight += item.weight;
            }
        });
        
        // Check if new group would exceed weight limit
        const groupWeight = groupItems.reduce((sum, item) => sum + item.weight, 0);
        
        // Separate items that fit within weight limit
        const itemsWithinLimit = [];
        const itemsExceedingLimit = [];
        
        groupItems.forEach(item => {
            if (currentWeight + item.weight <= this.maxLoad) {
                itemsWithinLimit.push(item);
                currentWeight += item.weight;
            } else {
                itemsExceedingLimit.push(item);
            }
        });
        
        // Get items from other groups that are already placed
        const otherGroupItems = this.cargoItems.filter(item => item.groupId !== groupId && item.mesh && item.position);
        
        // Clear only the group items from the scene
        groupItems.forEach(item => {
            if (item.mesh) {
                this.scene3d.removeCargo(item.mesh);
                item.mesh = null;
                item.position = null;
            }
        });
        
        // Create occupied spaces from other group items
        const occupiedSpaces = otherGroupItems.map(item => {
            // Some items might have been rotated, need to get actual dimensions from mesh or use original
            const itemLength = item.mesh && item.mesh.userData.length ? item.mesh.userData.length : item.length;
            const itemWidth = item.mesh && item.mesh.userData.width ? item.mesh.userData.width : item.width;
            const itemHeight = item.mesh && item.mesh.userData.height ? item.mesh.userData.height : item.height;
            
            // Convert from scene coordinates (center at 0,0,0) to bin packing coordinates (origin at corner)
            // Scene: x ranges from -length/2 to +length/2
            // Bin packing: x ranges from 0 to length
            const binX = item.position.x + (this.containerDimensions.length / 2) - (itemLength / 2);
            const binY = item.position.y - this.containerDimensions.trailerHeight - (itemHeight / 2);
            const binZ = item.position.z + (this.containerDimensions.width / 2) - (itemWidth / 2);
            
            return {
                x: binX,
                y: binY,
                z: binZ,
                width: itemLength,
                depth: itemWidth,
                height: itemHeight,
                isRoll: item.isRoll || false,
                isVerticalRoll: item.isVerticalRoll || false,
                isHorizontalRoll: item.isHorizontalRoll || false
            };
        });
        
        // Arrange only items within weight limit
        let result = { success: true, unpackedCount: 0 };
        if (itemsWithinLimit.length > 0) {
            result = this._arrangeGroupItems(itemsWithinLimit, occupiedSpaces);
        }
        
        // Place items exceeding weight limit outside
        if (itemsExceedingLimit.length > 0) {
            const trailerHeight = this.containerDimensions.trailerHeight || 1.2;
            itemsExceedingLimit.forEach((item, index) => {
                // Temporarily place at origin inside container
                item.position = {
                    x: 0,
                    y: trailerHeight + item.height / 2 + index * item.height,
                    z: 0
                };
                
                const meshData = {
                    ...item,
                    x: item.position.x,
                    y: item.position.y,
                    z: item.position.z
                };
                
                item.mesh = this.scene3d.addCargo(meshData);
                this.scene3d.moveOutsideContainer(item.mesh);
                item.isOutside = true;
            });
            
            result.exceedingWeightCount = itemsExceedingLimit.length;
            if (result.success && itemsExceedingLimit.length > 0) {
                result.success = false;
            }
        }
        
        // Arrange only the new group using remaining space
        return result;
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
        
        // Check weight limit and separate items that exceed it
        let currentTotalWeight = 0;
        const itemsWithinLimit = [];
        const itemsExceedingLimit = [];
        
        stacks.forEach(stack => {
            const stackWeight = stack.sample.weight * stack.stackHeight;
            if (currentTotalWeight + stackWeight <= this.maxLoad) {
                itemsWithinLimit.push(stack);
                currentTotalWeight += stackWeight;
            } else {
                itemsExceedingLimit.push(stack);
            }
        });
        
        // Prepare items for packing (treating each stack as single unit)
        const itemsToPlace = itemsWithinLimit;
        
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
                isHorizontalRoll: stack.sample.isHorizontalRoll, // Pass isHorizontalRoll info for rolls
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
                        
                        // Mark item as inside the container
                        item.isOutside = false;
                        
                        const meshData = {
                            ...item,
                            x: item.position.x,
                            y: item.position.y,
                            z: item.position.z,
                            // Only override dimensions for non-roll items
                            ...(item.type !== 'roll' && item.type !== 'steel-coil' ? {
                                length: itemLength,
                                width: itemWidth,
                                height: stack.sample.height
                            } : {})
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
                
                // First place all items inside container temporarily to create meshes
                remainingItems.forEach(unpackedStack => {
                    totalUnpacked += unpackedStack.userData.items.length;
                    
                    unpackedStack.userData.items.forEach((item, index) => {
                        // Temporarily place at origin inside container
                        item.position = {
                            x: 0,
                            y: trailerHeight + item.height / 2 + index * item.height,
                            z: 0
                        };
                        
                        const meshData = {
                            ...item,
                            x: item.position.x,
                            y: item.position.y,
                            z: item.position.z
                        };
                        
                        item.mesh = this.scene3d.addCargo(meshData);
                    });
                });
                
                // Now move all unpacked items outside using the existing moveOutsideContainer method
                remainingItems.forEach(unpackedStack => {
                    unpackedStack.userData.items.forEach((item) => {
                        if (item.mesh) {
                            this.scene3d.moveOutsideContainer(item.mesh);
                            item.isOutside = true;
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
                isHorizontalRoll: stack.sample.isHorizontalRoll, // Pass isHorizontalRoll info for rolls
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
                    
                    // Mark item as inside the container
                    item.isOutside = false;
                    
                    const meshData = {
                        ...item,
                        x: item.position.x,
                        y: item.position.y,
                        z: item.position.z,
                        // Only override dimensions for non-roll items
                        ...(item.type !== 'roll' && item.type !== 'steel-coil' ? {
                            length: itemLength,
                            width: itemWidth,
                            height: stack.sample.height
                        } : {})
                    };
                    
                    item.mesh = this.scene3d.addCargo(meshData);
                });
            });
            
            // Return info about unpacked items
            if (totalUnpacked > 0) {
                // First place all items inside container temporarily to create meshes
                result.unpacked.forEach(unpackedStack => {
                    unpackedStack.userData.items.forEach((item, index) => {
                        // Temporarily place at origin inside container
                        item.position = {
                            x: 0,
                            y: trailerHeight + item.height / 2 + index * item.height,
                            z: 0
                        };
                        
                        const meshData = {
                            ...item,
                            x: item.position.x,
                            y: item.position.y,
                            z: item.position.z
                        };
                        
                        item.mesh = this.scene3d.addCargo(meshData);
                    });
                });
                
                // Now move all unpacked items outside using the existing moveOutsideContainer method
                result.unpacked.forEach(unpackedStack => {
                    unpackedStack.userData.items.forEach((item) => {
                        if (item.mesh) {
                            this.scene3d.moveOutsideContainer(item.mesh);
                            item.isOutside = true;
                        }
                    });
                });
                
                // Handle items exceeding weight limit
                itemsExceedingLimit.forEach(stack => {
                    stack.items.forEach((item, index) => {
                        // Temporarily place at origin inside container
                        item.position = {
                            x: 0,
                            y: trailerHeight + item.height / 2 + index * item.height,
                            z: 0
                        };
                        
                        const meshData = {
                            ...item,
                            x: item.position.x,
                            y: item.position.y,
                            z: item.position.z
                        };
                        
                        item.mesh = this.scene3d.addCargo(meshData);
                        this.scene3d.moveOutsideContainer(item.mesh);
                        item.isOutside = true;
                    });
                });
                
                const totalExceeded = itemsExceedingLimit.reduce((sum, stack) => sum + stack.items.length, 0);
                this.updateCenterOfGravity();
                return { success: false, unpackedCount: totalUnpacked, exceedingWeightCount: totalExceeded };
            }
        }
        
        // Handle items exceeding weight limit - place them outside
        itemsExceedingLimit.forEach(stack => {
            stack.items.forEach((item, index) => {
                // Temporarily place at origin inside container
                item.position = {
                    x: 0,
                    y: trailerHeight + item.height / 2 + index * item.height,
                    z: 0
                };
                
                const meshData = {
                    ...item,
                    x: item.position.x,
                    y: item.position.y,
                    z: item.position.z
                };
                
                item.mesh = this.scene3d.addCargo(meshData);
                this.scene3d.moveOutsideContainer(item.mesh);
                item.isOutside = true;
            });
        });
        
        const totalExceeded = itemsExceedingLimit.reduce((sum, stack) => sum + stack.items.length, 0);
        this.updateCenterOfGravity();
        
        if (totalExceeded > 0) {
            return { success: true, unpackedCount: 0, exceedingWeightCount: totalExceeded };
        }
        return { success: true, unpackedCount: 0 };
    }
    
    _arrangeGroupItems(groupItems, occupiedSpaces = []) {
        if (groupItems.length === 0) {
            return false;
        }
        
        const trailerHeight = this.containerDimensions.trailerHeight || 1.1;
        
        // Create stack from group items
        const firstItem = groupItems[0];
        
        // Ensure all items have dimensions
        if (!firstItem.length || !firstItem.width || !firstItem.height) {
            console.error('Group items missing dimensions:', firstItem);
            return false;
        }
        
        const maxStack = firstItem.maxStack !== undefined ? firstItem.maxStack : 1;
        const maxStackWeight = firstItem.maxStackWeight !== undefined ? firstItem.maxStackWeight : Infinity;
        const maxTotalHeight = 1 + maxStack;
        const containerHeight = this.containerDimensions.height;
        const unitHeight = firstItem.height;
        const unitWeight = firstItem.weight;
        
        const stacks = [];
        
        // If maxStack is 0, only single units
        if (maxStack === 0) {
            groupItems.forEach(item => {
                stacks.push({
                    items: [item],
                    sample: firstItem,
                    stackHeight: 1
                });
            });
        } else {
            // Normal stacking logic
            let currentStack = [];
            let weightAboveBottom = 0;
            
            groupItems.forEach(item => {
                const potentialStackHeight = (currentStack.length + 1) * unitHeight;
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
                    if (currentStack.length > 0) {
                        stacks.push({
                            items: currentStack,
                            sample: firstItem,
                            stackHeight: currentStack.length
                        });
                    }
                    currentStack = [item];
                    weightAboveBottom = 0;
                }
            });
            
            if (currentStack.length > 0) {
                stacks.push({
                    items: currentStack,
                    sample: firstItem,
                    stackHeight: currentStack.length
                });
            }
        }
        
        // Prepare items for packing
        const itemsForPacking = stacks.map(stack => ({
            width: stack.sample.length,
            depth: stack.sample.width,
            height: stack.sample.height * stack.stackHeight,
            weight: stack.sample.weight * stack.stackHeight,
            userData: stack,
            maxStack: stack.sample.maxStack,
            maxStackWeight: stack.sample.maxStackWeight,
            isRoll: stack.sample.isRoll,
            isVerticalRoll: stack.sample.isVerticalRoll,
            isHorizontalRoll: stack.sample.isHorizontalRoll,
            diameter: stack.sample.diameter,
            fixedDiameter: stack.sample.fixedDiameter
        }));
        
        let result;
        
        // Handle JUMBO with sections
        if (this.packers && this.sections) {
            // Create temporary packers for each section with occupied spaces
            const tempPackers = [];
            this.sections.forEach(section => {
                const tempPacker = new BinPacking3D(
                    section.length,
                    section.width,
                    section.height
                );
                tempPackers.push(tempPacker);
            });
            
            // Convert occupied spaces to section-relative coordinates
            const gap = 0.5; // 50cm gap between sections
            let xOffset = -this.containerDimensions.length / 2;
            const sectionOccupiedSpaces = [];
            
            this.sections.forEach((section, sectionIndex) => {
                if (sectionIndex > 0) xOffset += gap;
                const sectionStart = xOffset;
                const sectionEnd = xOffset + section.length;
                
                // Filter occupied spaces for this section
                const spacesInSection = occupiedSpaces.filter(space => {
                    const spaceStart = space.x;
                    const spaceEnd = space.x + space.width;
                    // Check if space overlaps with this section
                    return spaceStart < sectionEnd && spaceEnd > sectionStart;
                }).map(space => {
                    // Convert to section-local coordinates
                    return {
                        x: space.x - sectionStart,
                        y: space.y,
                        z: space.z + (section.width / 2), // Adjust for section coordinate system
                        width: space.width,
                        depth: space.depth,
                        height: space.height,
                        isRoll: space.isRoll || false,
                        isVerticalRoll: space.isVerticalRoll || false,
                        isHorizontalRoll: space.isHorizontalRoll || false
                    };
                });
                
                sectionOccupiedSpaces.push(spacesInSection);
                tempPackers[sectionIndex].setOccupiedSpaces(spacesInSection);
                
                xOffset += section.length;
            });
            
            // Pack items into sections sequentially
            xOffset = -this.containerDimensions.length / 2;
            let remainingItems = [...itemsForPacking];
            const allPacked = [];
            const allUnpacked = [];
            
            this.sections.forEach((section, sectionIndex) => {
                if (remainingItems.length === 0) return;
                
                if (sectionIndex > 0) xOffset += gap;
                
                const sectionResult = tempPackers[sectionIndex].packItems(remainingItems, true);
                
                // Calculate section boundaries for gap validation
                const sectionStartX = xOffset;
                const sectionEndX = xOffset + section.length;
                
                // Transform packed items to global coordinates and validate they don't overlap gap
                const validPackedItems = [];
                const invalidPackedItems = [];
                
                sectionResult.packed.forEach(packedItem => {
                    const stack = packedItem.userData;
                    const baseX = xOffset + packedItem.position.x;
                    const itemLength = packedItem.rotated ? stack.sample.width : stack.sample.length;
                    
                    // Check if item would overlap with gap area or exceed section bounds
                    const itemStartX = baseX;
                    const itemEndX = baseX + itemLength;
                    
                    // For section 0, ensure item doesn't extend into gap
                    // For section 1, ensure item starts after gap
                    const isValidPosition = (itemStartX >= sectionStartX && itemEndX <= sectionEndX);
                    
                    if (!isValidPosition) {
                        // Item would overlap gap or exceed section bounds - mark as unpacked
                        invalidPackedItems.push(packedItem);
                    } else {
                        validPackedItems.push(packedItem);
                        
                        const baseY = packedItem.position.y;
                        const baseZ = packedItem.position.z - (section.width / 2);
                        
                        // Place each item in the stack
                        stack.items.forEach((item, index) => {
                            // Adjust position based on rotation
                            const itemWidth = packedItem.rotated ? stack.sample.length : stack.sample.width;
                            
                            item.position = {
                                x: baseX + (itemLength / 2),
                                y: trailerHeight + baseY + (index * stack.sample.height) + (stack.sample.height / 2),
                                z: baseZ + (itemWidth / 2)
                            };
                            
                            // Mark item as inside the container
                            item.isOutside = false;
                            
                            const meshData = {
                                ...item,
                                x: item.position.x,
                                y: item.position.y,
                                z: item.position.z,
                                // Only override dimensions for non-roll items
                                ...(item.type !== 'roll' && item.type !== 'steel-coil' ? {
                                    length: itemLength,
                                    width: itemWidth,
                                    height: stack.sample.height
                                } : {})
                            };
                            
                            item.mesh = this.scene3d.addCargo(meshData);
                        });
                    }
                });
                
                allPacked.push(...validPackedItems);
                
                // Add invalid items back to unpacked list as itemsForPacking format
                const invalidItemsForPacking = invalidPackedItems.map(packed => ({
                    width: packed.width,
                    depth: packed.depth,
                    height: packed.height,
                    weight: packed.weight,
                    userData: packed.userData,
                    maxStack: packed.maxStack,
                    maxStackWeight: packed.maxStackWeight,
                    isRoll: packed.isRoll,
                    isVerticalRoll: packed.isVerticalRoll,
                    isHorizontalRoll: packed.isHorizontalRoll,
                    diameter: packed.diameter,
                    fixedDiameter: packed.fixedDiameter
                }));
                
                // Update remaining items for next section (include invalid items)
                remainingItems = [...sectionResult.unpacked, ...invalidItemsForPacking];
                xOffset += section.length;
            });
            
            // Any remaining items are unpacked
            allUnpacked.push(...remainingItems);
            
            result = {
                packed: allPacked,
                unpacked: allUnpacked
            };
        } else {
            // Regular single container packing
            const tempPacker = new BinPacking3D(
                this.containerDimensions.length,
                this.containerDimensions.width,
                this.containerDimensions.height,
                this.containerDimensions
            );
            
            // Mark occupied spaces BEFORE packing
            tempPacker.setOccupiedSpaces(occupiedSpaces);
            
            result = tempPacker.packItems(itemsForPacking, true); // Skip reset to preserve occupied spaces
            
            // Place packed items
            result.packed.forEach(packedItem => {
                const stack = packedItem.userData;
                const baseX = packedItem.position.x - (this.containerDimensions.length / 2);
                const baseY = packedItem.position.y;
                const baseZ = (stack.sample.isRoll && stack.sample.fixedDiameter) ? packedItem.position.z : 
                            packedItem.position.z - (this.containerDimensions.width / 2);
                
                stack.items.forEach((item, index) => {
                    // Use actual item dimensions (which may have been rotated) instead of stack.sample
                    const itemLength = packedItem.rotated ? item.width : item.length;
                    const itemWidth = packedItem.rotated ? item.length : item.width;
                    
                    item.position = {
                        x: baseX + (itemLength / 2),
                        y: trailerHeight + baseY + (index * item.height) + (item.height / 2),
                        z: baseZ + ((item.isRoll && item.fixedDiameter) ? 0 : itemWidth / 2)
                    };
                    
                    // Mark item as inside the container
                    item.isOutside = false;
                    
                    const meshData = {
                        ...item,
                        x: item.position.x,
                        y: item.position.y,
                        z: item.position.z,
                        // Override dimensions for non-roll items (they don't need rotation)
                        ...(item.type !== 'roll' && item.type !== 'steel-coil' ? {
                            length: itemLength,
                            width: itemWidth,
                            height: item.height
                        } : {})
                    };
                    
                    item.mesh = this.scene3d.addCargo(meshData);
                });
            });
        }
        
        // Place unpacked items outside instead of removing
        let totalUnpacked = 0;
        if (result.unpacked.length > 0) {
            const trailerHeight = this.containerDimensions.trailerHeight || 1.2;
            
            result.unpacked.forEach(unpackedStack => {
                totalUnpacked += unpackedStack.userData.items.length;
                
                // First create meshes for all items
                unpackedStack.userData.items.forEach((item, index) => {
                    // Temporarily place at origin inside container
                    item.position = {
                        x: 0,
                        y: trailerHeight + item.height / 2 + index * item.height,
                        z: 0
                    };
                    
                    const meshData = {
                        ...item,
                        x: item.position.x,
                        y: item.position.y,
                        z: item.position.z
                    };
                    
                    item.mesh = this.scene3d.addCargo(meshData);
                });
            });
            
            // Now move all unpacked items outside using the existing moveOutsideContainer method
            result.unpacked.forEach(unpackedStack => {
                unpackedStack.userData.items.forEach((item) => {
                    if (item.mesh) {
                        this.scene3d.moveOutsideContainer(item.mesh);
                        item.isOutside = true;
                    }
                });
            });
        }
        
        this.updateCenterOfGravity();
        
        if (totalUnpacked > 0) {
            return { success: false, unpackedCount: totalUnpacked };
        }
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
            // Only include items inside the container for center of gravity
            if (item.position && !item.isOutside) {
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
        // Separate items inside and outside the container
        const placedItems = this.cargoItems.filter(item => item.position !== null && !item.isOutside);
        const outsideItems = this.cargoItems.filter(item => item.position !== null && item.isOutside);
        
        let usedVolume = 0;
        let insideWeight = 0;
        placedItems.forEach(item => {
            usedVolume += item.length * item.width * item.height;
            insideWeight += item.weight;
        });
        
        const containerVolume = this.containerDimensions ? 
            this.containerDimensions.length * this.containerDimensions.width * this.containerDimensions.height : 1;
        
        return {
            totalItems: this.cargoItems.length,
            placedItems: placedItems.length,
            outsideItems: outsideItems.length,
            totalWeight: this.totalWeight,
            insideWeight: insideWeight,
            maxLoad: this.maxLoad,
            weightUsage: (insideWeight / this.maxLoad) * 100,
            volumeUsage: (usedVolume / containerVolume) * 100,
            centerOfGravity: this.calculateCenterOfGravity()
        };
    }
    
    exportConfiguration() {
        return {
            vehicleType: this.currentVehicleType || 'custom',
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
                position: item.position,
                maxStack: item.maxStack,
                maxStackWeight: item.maxStackWeight,
                loadingMethods: item.loadingMethods,
                unloadingMethods: item.unloadingMethods,
                groupId: item.groupId,
                isOutside: item.isOutside,
                rotation: item.rotation,
                isRoll: item.isRoll,
                diameter: item.diameter,
                isVerticalRoll: item.isVerticalRoll,
                fixedDiameter: item.fixedDiameter
            })),
            statistics: this.getStatistics()
        };
    }
    
    importConfiguration(config) {
        this.clearAllCargo();
        
        // Store the vehicle type to return it
        const vehicleType = config.vehicleType || 'custom';
        this.currentVehicleType = vehicleType;
        
        // Don't set container here - it should be set by UI before calling this method
        // Only set if container dimensions are different (for safety)
        if (config.container && (!this.containerDimensions || 
            this.containerDimensions.length !== config.container.length ||
            this.containerDimensions.width !== config.container.width ||
            this.containerDimensions.height !== config.container.height)) {
            this.setContainer(config.container, config.maxLoad);
        }
        
        if (config.cargoItems) {
            config.cargoItems.forEach(item => {
                // Prepare custom parameters with all properties
                const customParams = {
                    weight: item.weight,
                    maxStack: item.maxStack,
                    maxStackWeight: item.maxStackWeight,
                    loadingMethods: item.loadingMethods,
                    unloadingMethods: item.unloadingMethods,
                    name: item.name,
                    groupKey: `import_${item.groupId}`, // Preserve group during import
                    rotation: item.rotation,
                    isRoll: item.isRoll,
                    diameter: item.diameter,
                    isVerticalRoll: item.isVerticalRoll,
                    fixedDiameter: item.fixedDiameter
                };
                
                // If dimensions are provided, add them
                if (item.dimensions) {
                    customParams.dimensions = {
                        length: item.dimensions.length,
                        width: item.dimensions.width,
                        height: item.dimensions.height
                    };
                }
                
                const cargoItem = this.addCargoUnit(item.type, customParams);
                
                // Restore the original groupId
                if (item.groupId) {
                    cargoItem.groupId = item.groupId;
                }
                
                // Set position and isOutside flag
                if (item.position) {
                    cargoItem.position = item.position;
                }
                if (item.isOutside !== undefined) {
                    cargoItem.isOutside = item.isOutside;
                }
            });
            
            // After all items are added, create meshes with proper positions
            this.cargoItems.forEach(item => {
                if (item.position) {
                    const meshData = {
                        ...item,
                        x: item.position.x,
                        y: item.position.y,
                        z: item.position.z
                    };
                    
                    item.mesh = this.scene3d.addCargo(meshData);
                    
                    // If item was outside, move it outside
                    if (item.isOutside) {
                        this.scene3d.moveOutsideContainer(item.mesh);
                    }
                }
            });
        }
        
        this.updateCenterOfGravity();
        
        // Return the vehicle type so UI can update
        return { vehicleType };
    }
    
    updateCargoPositions(movedCargo) {
        // Update positions and isOutside flag of moved cargo items
        movedCargo.forEach(cargoData => {
            const item = this.cargoItems.find(c => c.id === cargoData.id);
            if (item) {
                if (cargoData.position) {
                    item.position = cargoData.position;
                }
                // Update isOutside flag if it exists in cargoData
                if (cargoData.isOutside !== undefined) {
                    item.isOutside = cargoData.isOutside;
                }
            }
        });
        
        // Update center of gravity after movement
        this.updateCenterOfGravity();
    }
    
    selectGroup(groupId) {
        if (this.selectedGroupId === groupId) {
            return; // Already selected
        }
        
        // Get all items in the group
        const groupItems = this.cargoItems.filter(item => item.groupId === groupId);
        
        // Filter only items that are inside the container (not outside)
        const itemsInsideContainer = groupItems.filter(item => !item.isOutside);
        
        // Only allow selection if group has more than 1 unit inside container
        if (itemsInsideContainer.length <= 1) {
            return; // Cannot select groups with only 1 unit inside
        }
        
        this.selectedGroupId = groupId;
        
        // Notify 3D scene to highlight only the items inside container
        if (this.scene3d && this.scene3d.highlightGroup) {
            // Pass the filtered items to highlight only those inside
            this.scene3d.highlightGroup(groupId, itemsInsideContainer);
        }
        
        // Notify UI about selection change
        if (this.onGroupSelectionChanged) {
            this.onGroupSelectionChanged(groupId);
        }
    }
    
    deselectGroup() {
        if (!this.selectedGroupId) {
            return; // Nothing selected
        }
        
        const previousGroupId = this.selectedGroupId;
        this.selectedGroupId = null;
        
        // Clear highlighting in 3D scene
        if (this.scene3d && this.scene3d.clearGroupHighlight) {
            this.scene3d.clearGroupHighlight();
        }
        
        // Notify UI about deselection
        if (this.onGroupSelectionChanged) {
            this.onGroupSelectionChanged(null);
        }
    }
    
    getSelectedGroup() {
        if (!this.selectedGroupId) {
            return null;
        }
        
        const groupItems = this.cargoItems.filter(item => item.groupId === this.selectedGroupId);
        if (groupItems.length === 0) {
            // Group no longer exists, clear selection
            this.selectedGroupId = null;
            return null;
        }
        
        return {
            groupId: this.selectedGroupId,
            items: groupItems,
            sample: groupItems[0]
        };
    }
    
    isGroupSelected(groupId) {
        return this.selectedGroupId === groupId;
    }
    
    toggleGroupSelection(groupId) {
        if (this.selectedGroupId === groupId) {
            this.deselectGroup();
        } else {
            this.selectGroup(groupId);
        }
    }
    
    rotateGroup(groupId, angle) {
        // Get all items in the group that are inside the container
        const groupItems = this.cargoItems.filter(item => 
            item.groupId === groupId && !item.isOutside
        );
        if (groupItems.length === 0) return;
        
        // Check if this is a Steel Coil group - they cannot be rotated
        if (groupItems[0].type === 'steel-coil' || groupItems[0].fixedDiameter) {
            console.warn('Steel Coil groups cannot be rotated');
            return;
        }
        
        // Check if this is a vertical Roll group - they cannot be rotated
        if (groupItems[0].isRoll && groupItems[0].isVerticalRoll) {
            console.warn('Vertical Roll groups cannot be rotated');
            return;
        }
        
        // Remember if this group is selected for highlighting restoration
        const wasSelected = this.selectedGroupId === groupId;
        
        // Update dimensions for each item if rotating 90 or -90 degrees
        if (Math.abs(angle) === 90) {
            groupItems.forEach(item => {
                // For horizontal rolls, preserve the diameter info
                if (item.type === 'roll' && !item.isVerticalRoll) {
                    // Store diameter if not already stored
                    if (!item.diameter) {
                        item.diameter = item.width; // width is diameter for horizontal roll
                    }
                    
                    // Track rotation ONLY for horizontal rolls
                    if (!item.rotation) {
                        item.rotation = 0;
                    }
                    item.rotation += (angle * Math.PI) / 180;
                }
                
                // Swap dimensions for ALL items
                const tempLength = item.length;
                item.length = item.width;
                item.width = tempLength;
            });
        }
        
        // Now use autoArrangeGroup to rearrange only the items inside container
        // This will keep other groups and outside units in place
        this.autoArrangeGroup(groupId);
        
        // Restore highlighting if group was selected
        if (wasSelected && this.scene3d) {
            // Small delay to ensure meshes are created
            setTimeout(() => {
                // Force re-selection by temporarily clearing the selected group
                const tempSelectedId = this.selectedGroupId;
                this.selectedGroupId = null;
                
                // Clear any old highlighting state in scene
                if (this.scene3d.clearGroupHighlight) {
                    this.scene3d.clearGroupHighlight();
                }
                
                // Now re-select the group (this will work because selectedGroupId is null)
                this.selectGroup(groupId);
            }, 100);
        }
    }
}