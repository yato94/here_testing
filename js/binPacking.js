class BinPacking3D {
    constructor(containerWidth, containerDepth, containerHeight, containerData = {}) {
        this.container = {
            width: containerWidth,
            depth: containerDepth,
            height: containerHeight,
            hasGroove: containerData.hasGroove || false,
            grooveWidth: containerData.grooveWidth || 0,
            grooveDepth: containerData.grooveDepth || 0,
            grooveLength: containerData.grooveLength || 0,
            grooveStartX: containerData.grooveStartX || 0
        };
        this.usedSpace = [];
        
        // Initialize free spaces same as in reset()
        if (this.container.hasGroove) {
            this.freeSpaces = [
                {
                    x: 0,
                    y: 0,
                    z: 0,
                    width: containerWidth,
                    depth: containerDepth,
                    height: containerHeight
                },
                {
                    x: this.container.grooveStartX,
                    y: 0,
                    z: (containerDepth - this.container.grooveWidth) / 2,
                    width: this.container.grooveLength,
                    depth: this.container.grooveWidth,
                    height: containerHeight,
                    isGroove: true
                }
            ];
        } else {
            this.freeSpaces = [{
                x: 0,
                y: 0,
                z: 0,
                width: containerWidth,
                depth: containerDepth,
                height: containerHeight
            }];
        }
    }
    
    reset() {
        this.usedSpace = [];
        
        // If container has groove (Coilmulde), create initial free space for steel coils in groove
        if (this.container.hasGroove) {
            this.freeSpaces = [
                // Main container space
                {
                    x: 0,
                    y: 0,
                    z: 0,
                    width: this.container.width,
                    depth: this.container.depth,
                    height: this.container.height
                },
                // Special groove space for steel coils (starts at groove position)
                {
                    x: this.container.grooveStartX,
                    y: 0,
                    z: (this.container.depth - this.container.grooveWidth) / 2,
                    width: this.container.grooveLength,
                    depth: this.container.grooveWidth,
                    height: this.container.height,
                    isGroove: true
                }
            ];
        } else {
            this.freeSpaces = [{
                x: 0,
                y: 0,
                z: 0,
                width: this.container.width,
                depth: this.container.depth,
                height: this.container.height
            }];
        }
    }
    
    setOccupiedSpaces(occupiedSpaces) {
        if (!occupiedSpaces || occupiedSpaces.length === 0) {
            return;
        }
        
        // Mark spaces as occupied
        occupiedSpaces.forEach(occupied => {
            // Add to used space
            this.usedSpace.push({
                x: occupied.x,
                y: occupied.y,  
                z: occupied.z,
                width: occupied.width,
                depth: occupied.depth,
                height: occupied.height,
                isRoll: occupied.isRoll || false,
                isVerticalRoll: occupied.isVerticalRoll || false,
                isHorizontalRoll: occupied.isHorizontalRoll || false
            });
            
            // Process each free space and split it around the occupied space
            const newFreeSpaces = [];
            this.freeSpaces.forEach(space => {
                // Create position and item objects for compatibility with spacesOverlap
                const position = {
                    x: occupied.x,
                    y: occupied.y,
                    z: occupied.z
                };
                const item = {
                    width: occupied.width,
                    depth: occupied.depth,
                    height: occupied.height
                };
                
                // Check if this free space overlaps with the occupied space
                if (this.spacesOverlap(space, position, item)) {
                    // Split the free space around the occupied area
                    const subspaces = this.splitSpace(space, position, item, 0);
                    newFreeSpaces.push(...subspaces);
                } else {
                    // Keep the free space as is
                    newFreeSpaces.push(space);
                }
            });
            
            // Update free spaces
            this.freeSpaces = this.cleanupFreeSpaces(newFreeSpaces);
        });
    }
    
    packItems(items, skipReset = false) {
        if (!skipReset) {
            this.reset();
        }
        const packedItems = [];
        const unpackedItems = [];
        
        // Items should already be sorted by CargoManager (by weight and order)
        // We just process them in the given order
        const sortedItems = [...items];
        
        for (const item of sortedItems) {
            const position = this.findBestPosition(item);
            
            if (position) {
                // Znaleziono miejsce
                const packedItem = {
                    ...item,
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    rotated: position.rotated || false
                };
                
                // Jeśli element został obrócony, zamień wymiary
                if (position.rotated) {
                    const temp = packedItem.width;
                    packedItem.width = packedItem.depth;
                    packedItem.depth = temp;
                }
                
                packedItems.push(packedItem);
                
                // Dodaj do użytej przestrzeni
                this.usedSpace.push({
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    width: packedItem.width,
                    depth: packedItem.depth,
                    height: packedItem.height,
                    isRoll: item.isRoll || false,
                    isVerticalRoll: item.isVerticalRoll || false,
                    isHorizontalRoll: item.isHorizontalRoll || false
                });
                
                // Zaktualizuj wolne przestrzenie
                this.updateFreeSpaces(position, packedItem, item.maxStack);
            } else {
                // Nie znaleziono miejsca
                unpackedItems.push(item);
            }
        }
        
        return {
            packed: packedItems,
            unpacked: unpackedItems
        };
    }
    
    findBestPosition(item) {
        let bestPosition = null;
        let minWaste = Infinity;
        let minY = Infinity;
        let bestScore = -Infinity;
        
        
        // Check if item can be stacked (for items that cannot stack, only floor level is allowed)
        const canStack = item.maxStack === undefined || item.maxStack !== 0;
        
        // Special handling for steel coils in Coilmulde
        if (item.fixedDiameter && this.container.hasGroove) {
            // Steel coils (with fixedDiameter) must be placed in the groove
            const grooveStartX = this.container.grooveStartX;
            const grooveEndX = grooveStartX + this.container.grooveLength;
            const grooveY = -this.container.grooveDepth / 2;
            const grooveZ = 0;
            
            // Find first available position in groove
            let bestX = grooveStartX;
            
            // Check for already placed items to find next free position
            for (const used of this.usedSpace) {
                // Check if any item (coil or other) blocks this position in the groove area
                // Calculate potential coil bounds
                const coilStartX = bestX;
                const coilEndX = bestX + item.width;
                const coilStartZ = grooveZ - item.depth / 2;
                const coilEndZ = grooveZ + item.depth / 2;
                const coilStartY = grooveY;
                const coilEndY = grooveY + item.height;
                
                // Check collision with this used space
                const usedStartX = used.x;
                const usedEndX = used.x + used.width;
                const usedStartZ = used.z;
                const usedEndZ = used.z + used.depth;
                const usedStartY = used.y;
                const usedEndY = used.y + used.height;
                
                // Check if there's an overlap in X axis and the item blocks our groove position
                if (!(coilEndX <= usedStartX || coilStartX >= usedEndX ||
                      coilEndZ <= usedStartZ || coilStartZ >= usedEndZ ||
                      coilEndY <= usedStartY || coilStartY >= usedEndY)) {
                    // There's a collision, we need to place after this item
                    if (usedEndX > bestX && usedEndX <= grooveEndX) {
                        bestX = usedEndX;
                    }
                }
            }
            
            // Check if coil fits in remaining groove space
            if (bestX + item.width <= grooveEndX) {
                // Final check: make sure the position is really free
                const finalCoilBounds = {
                    x: bestX,
                    y: grooveY,
                    z: grooveZ - item.depth / 2,
                    width: item.width,
                    height: item.height,
                    depth: item.depth
                };
                
                // Check collision with all existing items
                let positionIsFree = true;
                for (const used of this.usedSpace) {
                    if (!(finalCoilBounds.x + finalCoilBounds.width <= used.x ||
                          finalCoilBounds.x >= used.x + used.width ||
                          finalCoilBounds.y + finalCoilBounds.height <= used.y ||
                          finalCoilBounds.y >= used.y + used.height ||
                          finalCoilBounds.z + finalCoilBounds.depth <= used.z ||
                          finalCoilBounds.z >= used.z + used.depth)) {
                        positionIsFree = false;
                        break;
                    }
                }
                
                if (positionIsFree) {
                    const position = {
                        x: bestX,
                        y: grooveY,  // Place in groove depth
                        z: grooveZ,  // Center in groove
                        rotated: false
                    };
                    
                    return position;
                }
            }
            
            return null; // Can't place steel coil - groove is full or blocked
        }
        
        // For non-steel-coil items in Coilmulde, avoid the groove area
        if (!item.fixedDiameter && this.container.hasGroove) {
            // Non-steel-coil items should be placed outside the groove area
            // This is handled by normal placement but we need to check collision with groove
        }
        
        
        // Próbuj w każdej wolnej przestrzeni
        for (const space of this.freeSpaces) {
            // Skip non-floor spaces for non-stackable items
            if (!canStack && space.y > 0.01) {
                continue;
            }
            
            // Sprawdź czy element pasuje bez obrotu
            if (this.itemFits(item, space)) {
                // Center the item if it's exactly the same size or uses tolerance
                // This prevents floating point precision issues when units are "identical"
                const tolerance = 0.005; // Same tolerance as in itemFits
                const needsCenteringX = Math.abs(item.width - space.width) <= tolerance;
                const needsCenteringZ = Math.abs(item.depth - space.depth) <= tolerance;
                
                const position = {
                    x: needsCenteringX ? space.x + (space.width - item.width) / 2 : space.x,
                    y: space.y,
                    z: needsCenteringZ ? space.z + (space.depth - item.depth) / 2 : space.z,
                    rotated: false
                };
                
                // Check if item can be placed at the calculated position
                if (this.canPlaceItem(position.x, position.y, position.z, item.width, item.depth, item.height)) {
                    const waste = this.calculateWaste(item, space);
                    
                    // Calculate score: prioritize filling left to right, front to back, bottom to top
                    // Lower Y is always best (floor first)
                    // Then prefer lower X (left to right)
                    // Then prefer lower Z (front to back)
                    const yScore = -space.y * 1000; // Strong preference for lower Y
                    const xScore = -space.x * 10;   // Then left to right
                    const zScore = -space.z * 1;    // Then front to back
                    const wasteScore = -waste / 10000; // Less important
                    const score = yScore + xScore + zScore + wasteScore;
                    
                    // Preferuj lepszy score
                    if (score > bestScore) {
                        bestPosition = position;
                        minWaste = waste;
                        minY = space.y;
                        bestScore = score;
                    }
                }
            }
            
            // Zawsze testuj z obrotem o 90 stopni dla lepszego dopasowania
            const rotatedItem = {
                width: item.depth,
                depth: item.width,
                height: item.height,
                weight: item.weight
            };
            
            if (this.itemFits(rotatedItem, space)) {
                // Center the rotated item if it's exactly the same size or uses tolerance
                // This prevents floating point precision issues when units are "identical"
                const tolerance = 0.005; // Same tolerance as in itemFits
                const needsCenteringX = Math.abs(rotatedItem.width - space.width) <= tolerance;
                const needsCenteringZ = Math.abs(rotatedItem.depth - space.depth) <= tolerance;
                
                const position = {
                    x: needsCenteringX ? space.x + (space.width - rotatedItem.width) / 2 : space.x,
                    y: space.y,
                    z: needsCenteringZ ? space.z + (space.depth - rotatedItem.depth) / 2 : space.z,
                    rotated: true
                };
                
                // Check if rotated item can be placed at the calculated position
                if (this.canPlaceItem(position.x, position.y, position.z, rotatedItem.width, rotatedItem.depth, rotatedItem.height)) {
                    const waste = this.calculateWaste(rotatedItem, space);
                    
                    // Calculate score for rotated item (same logic)
                    const yScore = -space.y * 1000;
                    const xScore = -space.x * 10;
                    const zScore = -space.z * 1;
                    const wasteScore = -waste / 10000;
                    const score = yScore + xScore + zScore + wasteScore;
                    
                    if (score > bestScore) {
                        bestPosition = position;
                        minWaste = waste;
                        minY = space.y;
                        bestScore = score;
                    }
                }
            }
        }
        
        return bestPosition;
    }
    
    itemFits(item, space) {
        // Add tolerance for floating point errors (5mm)
        const tolerance = 0.005;
        const fits = item.width <= space.width + tolerance &&
               item.depth <= space.depth + tolerance &&
               item.height <= space.height + tolerance;
        
        return fits;
    }
    
    calculateWaste(item, space) {
        // Oblicz "zmarnowaną" przestrzeń
        const volumeItem = item.width * item.depth * item.height;
        const volumeSpace = space.width * space.depth * space.height;
        return volumeSpace - volumeItem;
    }
    
    updateFreeSpaces(position, item, maxStack) {
        const newFreeSpaces = [];
        
        for (const space of this.freeSpaces) {
            // Sprawdź czy przestrzeń koliduje z nowo umieszczonym elementem
            if (this.spacesOverlap(space, position, item)) {
                // Podziel przestrzeń na mniejsze wolne przestrzenie
                const subspaces = this.splitSpace(space, position, item, maxStack);
                newFreeSpaces.push(...subspaces);
            } else {
                // Przestrzeń nie koliduje, zachowaj ją
                newFreeSpaces.push(space);
            }
        }
        
        // Usuń przestrzenie, które są zbyt małe lub się pokrywają
        this.freeSpaces = this.cleanupFreeSpaces(newFreeSpaces);
    }
    
    spacesOverlap(space, position, item) {
        // Ensure item has required properties
        if (!item || item.width === undefined || item.depth === undefined || item.height === undefined) {
            console.error('Item missing required dimensions:', item);
            return false;
        }
        
        return !(space.x + space.width <= position.x ||
                position.x + item.width <= space.x ||
                space.y + space.height <= position.y ||
                position.y + item.height <= space.y ||
                space.z + space.depth <= position.z ||
                position.z + item.depth <= space.z);
    }
    
    splitSpace(space, position, item, maxStack) {
        const subspaces = [];
        const canStackOnTop = maxStack === undefined || maxStack !== 0;
        
        // Przestrzeń po prawej - cała wysokość od poziomu przestrzeni
        if (position.x + item.width < space.x + space.width) {
            subspaces.push({
                x: position.x + item.width,
                y: space.y,
                z: space.z,
                width: space.x + space.width - (position.x + item.width),
                depth: space.depth,
                height: space.height
            });
        }
        
        // Przestrzeń z przodu - rozdzielona na części
        if (position.z + item.depth < space.z + space.depth) {
            // Przestrzeń bezpośrednio przed elementem
            subspaces.push({
                x: position.x,
                y: space.y,
                z: position.z + item.depth,
                width: item.width,
                depth: space.z + space.depth - (position.z + item.depth),
                height: space.height
            });
            
            // Przestrzeń z przodu po lewej stronie elementu
            if (space.x < position.x) {
                subspaces.push({
                    x: space.x,
                    y: space.y,
                    z: position.z + item.depth,
                    width: position.x - space.x,
                    depth: space.z + space.depth - (position.z + item.depth),
                    height: space.height
                });
            }
            
            // Przestrzeń z przodu po prawej stronie elementu
            if (position.x + item.width < space.x + space.width) {
                subspaces.push({
                    x: position.x + item.width,
                    y: space.y,
                    z: position.z + item.depth,
                    width: space.x + space.width - (position.x + item.width),
                    depth: space.z + space.depth - (position.z + item.depth),
                    height: space.height
                });
            }
        }
        
        // Przestrzeń na górze - tylko jeśli jednostka może być piętrowana
        // Create multiple smaller spaces on top to allow flexible positioning
        if (canStackOnTop && position.y + item.height < space.y + space.height) {
            // Instead of one large space, create the actual surface space of the item
            // This allows multiple units to be placed side by side on top
            subspaces.push({
                x: position.x,  // Use the item's actual position
                y: position.y + item.height,
                z: position.z,  // Use the item's actual position
                width: item.width,  // Use the item's actual width
                depth: item.depth,  // Use the item's actual depth
                height: space.y + space.height - (position.y + item.height)
            });
            
            // Also add spaces around the item on top level if there's room
            // Space to the right of the item (at the stacking level)
            if (position.x + item.width < space.x + space.width) {
                subspaces.push({
                    x: position.x + item.width,
                    y: position.y + item.height,
                    z: space.z,
                    width: space.x + space.width - (position.x + item.width),
                    depth: space.depth,
                    height: space.y + space.height - (position.y + item.height)
                });
            }
            
            // Space in front of the item (at the stacking level)
            if (position.z + item.depth < space.z + space.depth) {
                subspaces.push({
                    x: space.x,
                    y: position.y + item.height,
                    z: position.z + item.depth,
                    width: space.width,
                    depth: space.z + space.depth - (position.z + item.depth),
                    height: space.y + space.height - (position.y + item.height)
                });
            }
        }
        
        // Przestrzeń po lewej
        if (space.x < position.x) {
            subspaces.push({
                x: space.x,
                y: space.y,
                z: space.z,
                width: position.x - space.x,
                depth: space.depth,
                height: space.height
            });
        }
        
        // Przestrzeń z tyłu
        if (space.z < position.z) {
            subspaces.push({
                x: space.x,
                y: space.y,
                z: space.z,
                width: space.width,
                depth: position.z - space.z,
                height: space.height
            });
        }
        
        // Przestrzeń na dole
        if (space.y < position.y) {
            subspaces.push({
                x: space.x,
                y: space.y,
                z: space.z,
                width: space.width,
                depth: space.depth,
                height: position.y - space.y
            });
        }
        
        return subspaces;
    }
    
    cleanupFreeSpaces(spaces) {
        const minVolume = 0.01; // Minimalna objętość przestrzeni
        const cleaned = [];
        
        // Limit number of free spaces to prevent performance issues
        const maxFreeSpaces = 100;
        
        // Sort spaces by volume (largest first) and take only the most promising ones
        const sortedSpaces = spaces
            .filter(space => {
                const volume = space.width * space.depth * space.height;
                return volume >= minVolume;
            })
            .sort((a, b) => {
                const volumeA = a.width * a.depth * a.height;
                const volumeB = b.width * b.depth * b.height;
                return volumeB - volumeA;
            })
            .slice(0, maxFreeSpaces);
        
        for (const space of sortedSpaces) {
            // Sprawdź czy przestrzeń nie jest całkowicie zajęta przez użyte przestrzenie
            let isValid = true;
            for (const used of this.usedSpace) {
                if (this.spaceInsideUsed(space, used)) {
                    isValid = false;
                    break;
                }
            }
            
            if (isValid) {
                cleaned.push(space);
            }
        }
        
        // Limit merging for performance
        if (cleaned.length > 50) {
            return cleaned.slice(0, 50);
        }
        
        // Połącz sąsiadujące przestrzenie jeśli to możliwe
        return this.mergeFreeSpaces(cleaned);
    }
    
    spaceInsideUsed(space, used) {
        return space.x >= used.x &&
               space.y >= used.y &&
               space.z >= used.z &&
               space.x + space.width <= used.x + used.width &&
               space.y + space.height <= used.y + used.height &&
               space.z + space.depth <= used.z + used.depth;
    }
    
    mergeFreeSpaces(spaces) {
        // Skip merging if too many spaces (performance optimization)
        if (spaces.length > 30) {
            return spaces;
        }
        
        const merged = [];
        const used = new Set();
        
        for (let i = 0; i < spaces.length; i++) {
            if (used.has(i)) continue;
            
            let current = { ...spaces[i] };
            let mergeCount = 0;
            const maxMerges = 5; // Limit merges per space
            
            for (let j = i + 1; j < spaces.length && mergeCount < maxMerges; j++) {
                if (used.has(j)) continue;
                
                const other = spaces[j];
                
                // Sprawdź czy przestrzenie można połączyć
                if (this.canMerge(current, other)) {
                    current = this.merge(current, other);
                    used.add(j);
                    mergeCount++;
                }
            }
            
            merged.push(current);
            used.add(i);
        }
        
        return merged;
    }
    
    canMerge(space1, space2) {
        // Sprawdź czy przestrzenie sąsiadują i można je połączyć
        // Przestrzenie w osi X
        if (space1.y === space2.y && space1.z === space2.z &&
            space1.height === space2.height && space1.depth === space2.depth) {
            return (space1.x + space1.width === space2.x) ||
                   (space2.x + space2.width === space1.x);
        }
        
        // Przestrzenie w osi Y
        if (space1.x === space2.x && space1.z === space2.z &&
            space1.width === space2.width && space1.depth === space2.depth) {
            return (space1.y + space1.height === space2.y) ||
                   (space2.y + space2.height === space1.y);
        }
        
        // Przestrzenie w osi Z
        if (space1.x === space2.x && space1.y === space2.y &&
            space1.width === space2.width && space1.height === space2.height) {
            return (space1.z + space1.depth === space2.z) ||
                   (space2.z + space2.depth === space1.z);
        }
        
        return false;
    }
    
    merge(space1, space2) {
        return {
            x: Math.min(space1.x, space2.x),
            y: Math.min(space1.y, space2.y),
            z: Math.min(space1.z, space2.z),
            width: Math.max(space1.x + space1.width, space2.x + space2.width) - Math.min(space1.x, space2.x),
            height: Math.max(space1.y + space1.height, space2.y + space2.height) - Math.min(space1.y, space2.y),
            depth: Math.max(space1.z + space1.depth, space2.z + space2.depth) - Math.min(space1.z, space2.z)
        };
    }
    
    canPlaceItem(x, y, z, width, depth, height) {
        // Sprawdź czy pozycja nie koliduje z żadną użytą przestrzenią
        for (const used of this.usedSpace) {
            if (!(x + width <= used.x || 
                  x >= used.x + used.width ||
                  y + height <= used.y || 
                  y >= used.y + used.height ||
                  z + depth <= used.z || 
                  z >= used.z + used.depth)) {
                return false;
            }
        }
        return true;
    }
}