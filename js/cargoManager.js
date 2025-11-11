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
            rotationAngle: customParams.rotationAngle !== undefined ? customParams.rotationAngle : 0, // Rotation angle in radians
            wasRotatedIndividually: false, // Flag to track individual rotation for group operations
            isRoll: isRoll, // Add isRoll property
            isVerticalRoll: customParams.isVerticalRoll !== undefined ? customParams.isVerticalRoll : (unitConfig.isVerticalRoll || false), // Add vertical roll flag
            isHorizontalRoll: customParams.isHorizontalRoll || false, // Add horizontal roll flag
            diameter: isRoll ? dimensions.width : undefined, // Add diameter for rolls (same as width)
            cylinderLength: isRoll ? (customParams.cylinderLength !== undefined ? customParams.cylinderLength : ((customParams.isVerticalRoll !== undefined ? customParams.isVerticalRoll : (unitConfig.isVerticalRoll || false)) ? dimensions.height : dimensions.length)) : undefined, // Store original cylinder length
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
            // Always use dimensions from cargoItems array (source of truth), not from mesh.userData
            // mesh.userData can become desynchronized after multiple rotations
            const itemLength = item.length;
            const itemWidth = item.width;
            const itemHeight = item.height;
            
            // For JUMBO, keep scene coordinates - they will be converted in _arrangeGroupItems
            // For standard containers, convert to bin packing coordinates
            if (this.sections) {
                // JUMBO: use scene coordinates directly
                return {
                    x: item.position.x - (itemLength / 2),
                    y: item.position.y - this.containerDimensions.trailerHeight - (itemHeight / 2),
                    z: item.position.z - (itemWidth / 2),
                    width: itemLength,
                    depth: itemWidth,
                    height: itemHeight,
                    isRoll: item.isRoll || false,
                    isVerticalRoll: item.isVerticalRoll || false,
                    isHorizontalRoll: item.isHorizontalRoll || false
                };
            } else {
                // Standard container: convert from scene coordinates to bin packing coordinates
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
            }
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

                // For horizontal rolls, sync corrected dimensions back from mesh.userData
                if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                    item.length = item.mesh.userData.length;
                    item.width = item.mesh.userData.width;
                    item.height = item.mesh.userData.height;
                }

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

        // Reset individual rotations before bin packing
        this.cargoItems.forEach(item => {
            // If item was rotated 90° or -90°, unswap dimensions back to original
            if (item.rotationAngle && Math.abs(Math.abs(item.rotationAngle) - Math.PI / 2) < 0.01) {
                const tempLength = item.length;
                item.length = item.width;
                item.width = tempLength;
            }
            item.rotationAngle = 0;
        });

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

        // Helper to check if two horizontal rolls have the same rotation state
        const hasSameRotationState = (item1, item2) => {
            if (!item1.isRoll || !item1.isHorizontalRoll || item1.fixedDiameter) {
                return true; // Not a horizontal roll, rotation doesn't matter
            }
            const rotation1 = item1.rotation || 0;
            const rotation2 = item2.rotation || 0;
            const steps1 = Math.round(rotation1 / (Math.PI / 2));
            const steps2 = Math.round(rotation2 / (Math.PI / 2));
            // Check if both are in the same orientation (both even or both odd steps)
            return Math.abs(steps1 % 2) === Math.abs(steps2 % 2);
        };

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
                        sample: item,  // Use actual item, not group.sample
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

                    // For horizontal rolls, also check if rotation state matches
                    const rotationMatches = currentStack.length === 0 || hasSameRotationState(currentStack[0], item);

                    const canAddToStack = currentStack.length < maxTotalHeight &&
                                         potentialStackHeight <= containerHeight &&
                                         potentialWeightAbove <= maxStackWeight &&
                                         rotationMatches;

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
                                sample: currentStack[0],  // Use first item of this stack
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
                        sample: currentStack[0],  // Use first item of this stack
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

        // Helper function to get correct dimensions for rolls
        const getItemDimensions = (item) => {
            if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                const rotation = item.rotation || 0;
                const rotationSteps = Math.round(rotation / (Math.PI / 2));
                const isSwapped = Math.abs(rotationSteps % 2) === 1;
                return {
                    width: isSwapped ? item.diameter : item.cylinderLength,
                    depth: isSwapped ? item.cylinderLength : item.diameter
                };
            }
            return {
                width: item.length,
                depth: item.width
            };
        };

        // Handle JUMBO with sections
        if (this.packers && this.sections) {
            // Reset packers
            this.packers.forEach(packer => packer.reset());

            const itemsForPacking = itemsToPlace.map(stack => {
                const dims = getItemDimensions(stack.sample);
                return {
                    width: dims.width,
                    depth: dims.depth,
                    height: stack.sample.height * stack.stackHeight, // Stack height
                    weight: stack.sample.weight * stack.stackHeight, // Total weight
                    userData: stack,
                    maxStack: stack.sample.maxStack, // Pass maxStack info
                    maxStackWeight: stack.sample.maxStackWeight, // Pass maxStackWeight info
                    isRoll: stack.sample.isRoll, // Pass isRoll info for steel coils
                    isVerticalRoll: stack.sample.isVerticalRoll, // Pass isVerticalRoll info for rolls
                    isHorizontalRoll: stack.sample.isHorizontalRoll, // Pass isHorizontalRoll info for rolls
                    diameter: stack.sample.diameter, // Pass diameter for rolls
                    cylinderLength: stack.sample.cylinderLength, // Pass cylinderLength for rolls
                    fixedDiameter: stack.sample.fixedDiameter // Pass fixedDiameter for steel coils
                };
            });
            
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
                        let itemLength, itemWidth;
                        if (stack.sample.isRoll && stack.sample.isHorizontalRoll && !stack.sample.fixedDiameter) {
                            // For horizontal rolls, use cylinderLength and diameter
                            const dims = getItemDimensions(stack.sample);
                            itemLength = dims.width;  // width in bin packing corresponds to length in item
                            itemWidth = dims.depth;    // depth in bin packing corresponds to width in item
                        } else {
                            // For other items, use rotation from bin packing
                            itemLength = packedItem.rotated ? stack.sample.width : stack.sample.length;
                            itemWidth = packedItem.rotated ? stack.sample.length : stack.sample.width;
                        }

                        // If bin packing rotated this item, save swapped dimensions
                        if (packedItem.rotated && item.type !== 'roll' && item.type !== 'steel-coil') {
                            item.length = itemLength;
                            item.width = itemWidth;
                        }

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
                            // Override dimensions to match what bin packing used (except steel coils and rolls)
                            ...(item.type !== 'steel-coil' && item.type !== 'roll' ? {
                                length: itemLength,
                                width: itemWidth,
                                height: stack.sample.height
                            } : {})
                        };
                        
                        item.mesh = this.scene3d.addCargo(meshData);

                        // For horizontal rolls, sync corrected dimensions back from mesh.userData
                        if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                            item.length = item.mesh.userData.length;
                            item.width = item.mesh.userData.width;
                            item.height = item.mesh.userData.height;
                        }
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

                        // For horizontal rolls, sync corrected dimensions back from mesh.userData
                        if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                            item.length = item.mesh.userData.length;
                            item.width = item.mesh.userData.width;
                            item.height = item.mesh.userData.height;
                        }
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
            
            const itemsForPacking = itemsToPlace.map(stack => {
                const dims = getItemDimensions(stack.sample);
                return {
                    width: dims.width,
                    depth: dims.depth,
                    height: stack.sample.height * stack.stackHeight, // Stack height
                    weight: stack.sample.weight * stack.stackHeight, // Total weight
                    userData: stack,
                    maxStack: stack.sample.maxStack, // Pass maxStack info
                    maxStackWeight: stack.sample.maxStackWeight, // Pass maxStackWeight info
                    isRoll: stack.sample.isRoll, // Pass isRoll info for steel coils
                    isVerticalRoll: stack.sample.isVerticalRoll, // Pass isVerticalRoll info for rolls
                    isHorizontalRoll: stack.sample.isHorizontalRoll, // Pass isHorizontalRoll info for rolls
                    diameter: stack.sample.diameter, // Pass diameter for rolls
                    cylinderLength: stack.sample.cylinderLength, // Pass cylinderLength for rolls
                    fixedDiameter: stack.sample.fixedDiameter // Pass fixedDiameter for steel coils
                };
            });
            
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
                    let itemLength, itemWidth;
                    if (stack.sample.isRoll && stack.sample.isHorizontalRoll && !stack.sample.fixedDiameter) {
                        // For horizontal rolls, use cylinderLength and diameter
                        const dims = getItemDimensions(stack.sample);
                        itemLength = dims.width;  // width in bin packing corresponds to length in item
                        itemWidth = dims.depth;    // depth in bin packing corresponds to width in item
                    } else {
                        // For other items, use rotation from bin packing
                        itemLength = packedItem.rotated ? stack.sample.width : stack.sample.length;
                        itemWidth = packedItem.rotated ? stack.sample.length : stack.sample.width;
                    }

                    // If bin packing rotated this item, save swapped dimensions
                    // Horizontal rolls have allowRotate=false, so they won't be rotated by bin packing
                    if (packedItem.rotated && item.type !== 'steel-coil' && item.type !== 'roll') {
                        item.length = itemLength;
                        item.width = itemWidth;
                    }

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
                        // Override dimensions to match what bin packing used (except steel coils and rolls)
                        ...(item.type !== 'steel-coil' && item.type !== 'roll' ? {
                            length: itemLength,
                            width: itemWidth,
                            height: stack.sample.height
                        } : {})
                    };
                    
                    item.mesh = this.scene3d.addCargo(meshData);

                    // For horizontal rolls, sync corrected dimensions back from mesh.userData
                    if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                        item.length = item.mesh.userData.length;
                        item.width = item.mesh.userData.width;
                        item.height = item.mesh.userData.height;
                    }
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

                        // For horizontal rolls, sync corrected dimensions back from mesh.userData
                        if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                            item.length = item.mesh.userData.length;
                            item.width = item.mesh.userData.width;
                            item.height = item.mesh.userData.height;
                        }
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

                        // For horizontal rolls, sync corrected dimensions back from mesh.userData
                        if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                            item.length = item.mesh.userData.length;
                            item.width = item.mesh.userData.width;
                            item.height = item.mesh.userData.height;
                        }

                        this.scene3d.moveOutsideContainer(item.mesh);
                        item.isOutside = true;
                    });
                });

                const totalExceeded = itemsExceedingLimit.reduce((sum, stack) => sum + stack.items.length, 0);
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

                // For horizontal rolls, sync corrected dimensions back from mesh.userData
                if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                    item.length = item.mesh.userData.length;
                    item.width = item.mesh.userData.width;
                    item.height = item.mesh.userData.height;
                }

                this.scene3d.moveOutsideContainer(item.mesh);
                item.isOutside = true;
            });
        });

        const totalExceeded = itemsExceedingLimit.reduce((sum, stack) => sum + stack.items.length, 0);

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

        // Helper to check if two horizontal rolls have the same rotation state
        const hasSameRotationState = (item1, item2) => {
            if (!item1.isRoll || !item1.isHorizontalRoll || item1.fixedDiameter) {
                return true; // Not a horizontal roll, rotation doesn't matter
            }
            const rotation1 = item1.rotation || 0;
            const rotation2 = item2.rotation || 0;
            const steps1 = Math.round(rotation1 / (Math.PI / 2));
            const steps2 = Math.round(rotation2 / (Math.PI / 2));
            // Check if both are in the same orientation (both even or both odd steps)
            return Math.abs(steps1 % 2) === Math.abs(steps2 % 2);
        };

        // If maxStack is 0, only single units
        if (maxStack === 0) {
            groupItems.forEach(item => {
                stacks.push({
                    items: [item],
                    sample: item,  // Use actual item, not firstItem
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

                // For horizontal rolls, also check if rotation state matches
                const rotationMatches = currentStack.length === 0 || hasSameRotationState(currentStack[0], item);

                const canAddToStack = currentStack.length < maxTotalHeight &&
                                     potentialStackHeight <= containerHeight &&
                                     potentialWeightAbove <= maxStackWeight &&
                                     rotationMatches;

                if (canAddToStack) {
                    currentStack.push(item);
                    if (currentStack.length > 1) {
                        weightAboveBottom += unitWeight;
                    }
                } else {
                    if (currentStack.length > 0) {
                        stacks.push({
                            items: currentStack,
                            sample: currentStack[0],  // Use first item of this stack, not firstItem
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
                    sample: currentStack[0],  // Use first item of this stack, not firstItem
                    stackHeight: currentStack.length
                });
            }
        }
        
        // Helper function to get correct dimensions for rolls
        const getItemDimensions = (item) => {
            if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                const rotation = item.rotation || 0;
                const rotationSteps = Math.round(rotation / (Math.PI / 2));
                const isSwapped = Math.abs(rotationSteps % 2) === 1;
                return {
                    width: isSwapped ? item.diameter : item.cylinderLength,
                    depth: isSwapped ? item.cylinderLength : item.diameter
                };
            }
            return {
                width: item.length,
                depth: item.width
            };
        };

        // Prepare items for packing
        const itemsForPacking = stacks.map(stack => {
            const dims = getItemDimensions(stack.sample);
            return {
                width: dims.width,
                depth: dims.depth,
                height: stack.sample.height * stack.stackHeight,
                weight: stack.sample.weight * stack.stackHeight,
                userData: stack,
                maxStack: stack.sample.maxStack,
                maxStackWeight: stack.sample.maxStackWeight,
                isRoll: stack.sample.isRoll,
                isVerticalRoll: stack.sample.isVerticalRoll,
                isHorizontalRoll: stack.sample.isHorizontalRoll,
                diameter: stack.sample.diameter,
                cylinderLength: stack.sample.cylinderLength,
                fixedDiameter: stack.sample.fixedDiameter
            };
        });
        
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
                // Note: occupied spaces are already in scene coordinates for JUMBO
                const spacesInSection = occupiedSpaces.filter(space => {
                    // Get the center position of the occupied space in scene coordinates
                    const spaceCenterX = space.x + (space.width / 2);
                    // Check if space center is within this section
                    return spaceCenterX >= sectionStart && spaceCenterX <= sectionEnd;
                }).map(space => {
                    // Convert from scene coordinates to section-local bin packing coordinates
                    // Scene coordinates: x is already at corner (not center)
                    // Section local: x starts at 0 for each section
                    const localX = space.x - sectionStart;
                    const localZ = space.z + (section.width / 2); // Adjust for section coordinate system
                    
                    return {
                        x: localX,
                        y: space.y,
                        z: localZ,
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

                            // If bin packing rotated this item, save swapped dimensions
                            if (packedItem.rotated && item.type !== 'roll' && item.type !== 'steel-coil') {
                                item.length = itemLength;
                                item.width = itemWidth;
                            }

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

                            // For horizontal rolls, sync corrected dimensions back from mesh.userData
                            if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                                item.length = item.mesh.userData.length;
                                item.width = item.mesh.userData.width;
                                item.height = item.mesh.userData.height;
                            }
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
                    let itemLength, itemWidth;
                    if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                        // For horizontal rolls, use cylinderLength and diameter
                        const dims = getItemDimensions(item);  // Use item, not stack.sample
                        itemLength = dims.width;  // width in bin packing corresponds to length in item
                        itemWidth = dims.depth;    // depth in bin packing corresponds to width in item
                    } else {
                        // For other items, use rotation from bin packing
                        itemLength = packedItem.rotated ? item.width : item.length;
                        itemWidth = packedItem.rotated ? item.length : item.width;
                    }

                    // If bin packing rotated this item, save swapped dimensions
                    // Horizontal rolls have allowRotate=false, so they won't be rotated by bin packing
                    if (packedItem.rotated && item.type !== 'steel-coil' && item.type !== 'roll') {
                        item.length = itemLength;
                        item.width = itemWidth;
                    }

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

                    // For horizontal rolls, sync corrected dimensions back from mesh.userData
                    if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                        item.length = item.mesh.userData.length;
                        item.width = item.mesh.userData.width;
                        item.height = item.mesh.userData.height;
                    }
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

                    // For horizontal rolls, sync corrected dimensions back from mesh.userData
                    if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                        item.length = item.mesh.userData.length;
                        item.width = item.mesh.userData.width;
                        item.height = item.mesh.userData.height;
                    }
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

        // For horizontal rolls, sync corrected dimensions back from mesh.userData
        if (cargoItem.isRoll && cargoItem.isHorizontalRoll && !cargoItem.fixedDiameter) {
            cargoItem.length = cargoItem.mesh.userData.length;
            cargoItem.width = cargoItem.mesh.userData.width;
            cargoItem.height = cargoItem.mesh.userData.height;
        }
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
            totalWeight: Math.round(this.totalWeight * 100) / 100,
            insideWeight: Math.round(insideWeight * 100) / 100,
            maxLoad: this.maxLoad,
            weightUsage: (insideWeight / this.maxLoad) * 100,
            volumeUsage: (usedVolume / containerVolume) * 100
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
                groupColor: item.color,
                isOutside: item.isOutside,
                rotationAngle: item.rotationAngle,
                rotation: item.rotation,  // For horizontal rolls group rotation tracking
                // Save originalLength/originalWidth only if they exist (not undefined)
                ...(item.originalLength !== undefined && { originalLength: item.originalLength }),
                ...(item.originalWidth !== undefined && { originalWidth: item.originalWidth }),
                isRoll: item.isRoll,
                diameter: item.diameter,
                cylinderLength: item.cylinderLength,
                isVerticalRoll: item.isVerticalRoll,
                fixedDiameter: item.fixedDiameter
            })),
            statistics: this.getStatistics()
        };
    }
    
    importConfiguration(config) {
        // Clear all cargo data
        this.cargoItems = [];
        this.totalWeight = 0;
        this.colorIndex = 0;
        this.deselectGroup();
        this.scene3d.clearAllCargo();

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
            // Track max groupId to update colorIndex properly
            let maxGroupId = 0;

            config.cargoItems.forEach((item, index) => {
                // Get unit config for defaults
                const unitConfig = CONFIG.cargoUnits[item.type] || {};

                // Use dimensions as they are saved in the file
                // If unit was rotated, dimensions are already swapped in the file
                // We don't need to swap them back or apply rotation to mesh
                // The geometry will be created with these dimensions directly

                // Check if item was individually rotated OR if it's a horizontal roll that was group-rotated
                // For horizontal rolls with cumulative rotation, check if dimensions are currently swapped (odd rotations)
                const wasRotatedIndividually = item.rotationAngle &&
                    Math.abs(Math.abs(item.rotationAngle) - Math.PI / 2) < 0.01;

                let wasRotatedAsGroup = false;
                if (item.rotation) {
                    const rotationSteps = Math.round(item.rotation / (Math.PI / 2));
                    wasRotatedAsGroup = Math.abs(rotationSteps % 2) === 1;
                }

                const wasRotated = wasRotatedIndividually || wasRotatedAsGroup;

                // Directly create cargo item with saved properties
                const cargoItem = {
                    id: Date.now() + Math.random() + index,
                    type: item.type,
                    name: item.name || unitConfig.name || 'Custom',
                    length: item.dimensions.length,
                    width: item.dimensions.width,
                    height: item.dimensions.height,
                    weight: item.weight,
                    maxStack: item.maxStack !== undefined ? item.maxStack : (unitConfig.maxStack ?? 3),
                    maxStackWeight: item.maxStackWeight !== undefined ? item.maxStackWeight : (unitConfig.maxStackWeight ?? 2000),
                    loadingMethods: item.loadingMethods || unitConfig.loadingMethods || ['rear', 'side', 'top'],
                    unloadingMethods: item.unloadingMethods || unitConfig.unloadingMethods || ['rear', 'side', 'top'],
                    orderIndex: index,
                    groupId: item.groupId,  // Use original groupId
                    groupKey: `import_${item.groupId}`,  // Mark as imported
                    color: item.groupColor || '#cccccc',  // Use original color
                    rotationAngle: 0,  // Don't apply rotation - dimensions are already correct
                    rotation: item.rotation || undefined,  // Preserve rotation for horizontal rolls
                    originalLength: item.originalLength || undefined,  // Preserve original dimensions for horizontal rolls
                    originalWidth: item.originalWidth || undefined,    // Preserve original dimensions for horizontal rolls
                    wasRotatedIndividually: wasRotated,  // Flag to track if unit was rotated before save
                    isRoll: item.isRoll || false,
                    isVerticalRoll: item.isVerticalRoll || false,
                    isHorizontalRoll: item.isHorizontalRoll || false,
                    diameter: item.diameter,
                    cylinderLength: item.cylinderLength !== undefined ? item.cylinderLength : (item.isRoll ? (item.isVerticalRoll ? item.dimensions.height : Math.max(item.dimensions.length, item.dimensions.width)) : undefined),
                    fixedDiameter: item.fixedDiameter || false,
                    position: item.position || null,
                    isOutside: item.isOutside || false,
                    mesh: null
                };

                this.cargoItems.push(cargoItem);
                this.totalWeight += cargoItem.weight;

                // Track max groupId for colorIndex
                if (item.groupId > maxGroupId) {
                    maxGroupId = item.groupId;
                }
            });

            // Update colorIndex to ensure new groups don't conflict with imported ones
            // Count unique groups to set colorIndex properly
            const uniqueGroups = new Set(config.cargoItems.map(item => item.groupId));
            this.colorIndex = uniqueGroups.size;

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

                    // For horizontal rolls, sync corrected dimensions back from mesh.userData
                    if (item.isRoll && item.isHorizontalRoll && !item.fixedDiameter) {
                        item.length = item.mesh.userData.length;
                        item.width = item.mesh.userData.width;
                        item.height = item.mesh.userData.height;
                    }

                    // If item was outside, move it outside
                    if (item.isOutside) {
                        this.scene3d.moveOutsideContainer(item.mesh);
                    }
                }
            });
        }

        // Return the vehicle type so UI can update
        return { vehicleType };
    }
    
    updateCargoPositions(movedCargo) {
        // Update positions, dimensions, rotation and isOutside flag of moved cargo items
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
                // Update dimensions if they changed (e.g., after rotation)
                if (cargoData.length !== undefined) {
                    item.length = cargoData.length;
                }
                if (cargoData.width !== undefined) {
                    item.width = cargoData.width;
                }
                if (cargoData.height !== undefined) {
                    item.height = cargoData.height;
                }
                // Update Roll-specific properties if they exist
                if (cargoData.diameter !== undefined) {
                    item.diameter = cargoData.diameter;
                }
                if (cargoData.cylinderLength !== undefined) {
                    item.cylinderLength = cargoData.cylinderLength;
                }
                if (cargoData.isVerticalRoll !== undefined) {
                    item.isVerticalRoll = cargoData.isVerticalRoll;
                }
                // Update rotation angle if it exists
                if (cargoData.rotationAngle !== undefined) {
                    item.rotationAngle = cargoData.rotationAngle;

                    // Set flag if unit was individually rotated (≈90° or -90°)
                    if (Math.abs(Math.abs(cargoData.rotationAngle) - Math.PI / 2) < 0.01) {
                        item.wasRotatedIndividually = true;
                    }

                    // If rotation was reset to 0, clear original dimensions
                    if (cargoData.rotationAngle === 0) {
                        delete item.originalLength;
                        delete item.originalWidth;
                    }
                }
                // Update rotation property for horizontal rolls
                if (cargoData.rotation !== undefined) {
                    item.rotation = cargoData.rotation;

                    // Set flag if horizontal roll was individually rotated (odd multiples of π/2)
                    const rotationSteps = Math.round(cargoData.rotation / (Math.PI / 2));
                    if (Math.abs(rotationSteps % 2) === 1) {
                        item.wasRotatedIndividually = true;
                    }

                    // If rotation was reset to 0, clear original dimensions
                    if (cargoData.rotation === 0) {
                        delete item.originalLength;
                        delete item.originalWidth;
                    }
                }
                // Update originalLength/originalWidth for horizontal rolls (only if not being cleared above)
                // Always sync these properties to ensure they're preserved through save/load
                if (cargoData.hasOwnProperty('originalLength')) {
                    item.originalLength = cargoData.originalLength;
                }
                if (cargoData.hasOwnProperty('originalWidth')) {
                    item.originalWidth = cargoData.originalWidth;
                }
            }
        });
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
        // Get ALL items in the group (including outside units)
        const allGroupItems = this.cargoItems.filter(item => item.groupId === groupId);
        if (allGroupItems.length === 0) return;

        // Check if this is a Steel Coil group - they cannot be rotated
        if (allGroupItems[0].type === 'steel-coil' || allGroupItems[0].fixedDiameter) {
            console.warn('Steel Coil groups cannot be rotated');
            return;
        }

        // Check if this is a vertical Roll group - they cannot be rotated
        if (allGroupItems[0].isRoll && allGroupItems[0].isVerticalRoll) {
            console.warn('Vertical Roll groups cannot be rotated');
            return;
        }

        // Remember if this group is selected for highlighting restoration
        const wasSelected = this.selectedGroupId === groupId;

        // Initialize rotation property for horizontal rolls BEFORE checking (must happen first!)
        allGroupItems.forEach(item => {
            if (item.type === 'roll' && !item.isVerticalRoll) {
                if (item.rotation === undefined) {
                    item.rotation = 0;
                }
                // Store diameter if not already stored
                if (!item.diameter) {
                    item.diameter = item.width; // width is diameter for horizontal roll
                }
            }
        });

        // For horizontal rolls: find minimum rotation (this is the group's base rotation)
        // Items with higher rotation were rotated individually and need to be reset to group rotation
        const horizontalRolls = allGroupItems.filter(item => item.type === 'roll' && !item.isVerticalRoll);
        const groupBaseRotation = horizontalRolls.length > 0
            ? Math.min(...horizontalRolls.map(item => item.rotation || 0))
            : 0;

        // Reset individual rotations before group rotation for ALL items (inside + outside)
        allGroupItems.forEach(item => {
            if (item.type === 'roll' && !item.isVerticalRoll) {
                // For horizontal rolls, store original dimensions if not already stored
                if (!item.originalLength) {
                    // Determine original dimensions based on current rotation state
                    if (item.rotation) {
                        const rotationSteps = Math.round(item.rotation / (Math.PI / 2));
                        const isCurrentlySwapped = Math.abs(rotationSteps % 2) === 1;
                        if (isCurrentlySwapped) {
                            item.originalLength = item.width;
                            item.originalWidth = item.length;
                        } else {
                            item.originalLength = item.length;
                            item.originalWidth = item.width;
                        }
                    } else {
                        item.originalLength = item.length;
                        item.originalWidth = item.width;
                    }
                }

                // Reset individually rotated items to group base rotation
                if (item.rotation !== groupBaseRotation) {
                    const currentRotationSteps = Math.round(item.rotation / (Math.PI / 2));
                    const targetRotationSteps = Math.round(groupBaseRotation / (Math.PI / 2));

                    const currentSwapped = Math.abs(currentRotationSteps % 2) === 1;
                    const targetSwapped = Math.abs(targetRotationSteps % 2) === 1;

                    // If swap state is different, adjust dimensions
                    if (currentSwapped !== targetSwapped) {
                        const temp = item.length;
                        item.length = item.width;
                        item.width = temp;

                        // DON'T swap originalLength/originalWidth!
                        // They should ALWAYS represent dimensions at rotation=0
                    }

                    item.rotation = groupBaseRotation;
                }
            } else {
                // For regular units, unswap if needed
                // Check ONLY rotationAngle to determine current dimension state
                // wasRotatedIndividually flag should NOT be used here as it's historical info
                const isCurrentlySwapped = item.rotationAngle && Math.abs(Math.abs(item.rotationAngle) - Math.PI / 2) < 0.01;

                if (isCurrentlySwapped) {
                    const tempLength = item.length;
                    item.length = item.width;
                    item.width = tempLength;
                }
            }

            // Reset rotationAngle and flag for all units
            item.rotationAngle = 0;
            item.wasRotatedIndividually = false;
        });

        // Update dimensions for each item if rotating 90 or -90 degrees (ALL items)
        if (Math.abs(angle) === 90) {
            allGroupItems.forEach(item => {
                // For horizontal rolls, handle rotation differently
                if (item.type === 'roll' && !item.isVerticalRoll) {
                    // Store original dimensions if not already stored
                    if (!item.originalLength) {
                        item.originalLength = item.length;
                        item.originalWidth = item.width;
                    }

                    // Increment rotation tracking
                    item.rotation += (angle * Math.PI) / 180;

                    // Determine if dimensions should be swapped based on FINAL rotation
                    // Swap only for odd multiples of π/2 (π/2, 3π/2, 5π/2...)
                    const rotationSteps = Math.round(item.rotation / (Math.PI / 2));
                    const shouldBeSwapped = Math.abs(rotationSteps % 2) === 1;

                    // Set dimensions based on final rotation state
                    if (shouldBeSwapped) {
                        item.length = item.originalWidth;
                        item.width = item.originalLength;
                    } else {
                        item.length = item.originalLength;
                        item.width = item.originalWidth;
                    }
                } else {
                    // Regular units: swap dimensions
                    const tempLength = item.length;
                    item.length = item.width;
                    item.width = tempLength;
                }
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