class Scene3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = null;
        this.mouse = null;
        this.containerMesh = null;
        this.containerDimensions = null; // Store container dimensions
        this.cargoMeshes = [];
        this.cargoGroup = null;
        this.hoveredObject = null;
        this.centerOfGravityMarker = null;
        this.geometryCache = new Map();
        
        // Ruler properties
        this.rulerGroup = null;
        this.rulerVisible = false;
        
        // Dimension labels properties
        this.dimensionLabelsGroup = null;
        
        // Drag & Drop properties
        this.isDragging = false;
        this.draggedObjects = [];
        this.dragPlane = null;
        this.dragOffset = new THREE.Vector3();
        this.clickCount = 0;
        this.clickTimer = null;
        this.ghostMesh = null;
        this.ignoreNextClick = false;
        
        // Track mouse movement for distinguishing click vs drag
        this.mouseDownPosition = { x: 0, y: 0 };
        this.mouseUpPosition = { x: 0, y: 0 };
        this.mouseHasMoved = false;
        this.totalMouseMovement = 0;
        this.lastCameraMovementTime = 0;
        
        // Performance optimization for axle updates
        this.axleUpdatePending = false;
        this.lastAxleUpdate = 0;
        this.axleUpdateThrottle = 16; // Update every 16ms max (60 FPS)
        this.validPosition = false;
        this.canStackAtPosition = true;
        this.containerBounds = null;
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        
        // Create gradient background
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // Create gradient from very light blue to white
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#e6f5ff');  // Almost white with tiny blue tint at top
        gradient.addColorStop(0.3, '#f3faff'); // Even lighter
        gradient.addColorStop(1, '#ffffff');   // Pure white at bottom
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Apply gradient as scene background
        this.scene.background = texture;
        
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(20, 15, 20);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Create OrbitControls with normal settings
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2;
        
        // Setup event listeners AFTER OrbitControls
        this.setupEventListeners();
        
        this.setupLights();
        this.setupGrid();
        
        this.animate();
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
        directionalLight2.position.set(-10, 15, -10);
        this.scene.add(directionalLight2);
    }
    
    setupGrid() {
        // Ground plane - light, almost white surface
        const planeGeometry = new THREE.PlaneGeometry(CONFIG.grid.size * 1.5, CONFIG.grid.size * 1.5);
        const planeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5f5,  // Very light gray, almost white
            roughness: 0.8,
            metalness: 0.1
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 0;
        this.scene.add(plane);
    }
    
    createContainer(dimensions) {
        if (this.containerMesh) {
            this.scene.remove(this.containerMesh);
        }
        
        // Store dimensions for later use
        this.containerDimensions = dimensions;
        
        const containerGroup = new THREE.Group();
        
        // Get trailer height (default 1.2m if not specified)
        const trailerHeight = dimensions.trailerHeight || 1.1;
        
        // Add truck and wheels visualization
        this.addTruckAndWheels(containerGroup, dimensions, trailerHeight);
        
        // Check if this is a JUMBO with sections
        if (dimensions.sections && dimensions.sections.length > 0) {
            // JUMBO with two sections
            const gap = 0.5; // 50cm gap between sections
            let xOffset = -dimensions.length / 2;
            
            dimensions.sections.forEach((section, index) => {
                // Add gap after first section
                if (index > 0) {
                    xOffset += gap;
                }
                
                // Floor for this section
                const floorGeometry = new THREE.BoxGeometry(section.length, 0.02, section.width);
                const floorMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xc0c0c0,  // Light gray
                    roughness: 0.9,
                    metalness: 0.1
                });
                const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                floor.position.set(xOffset + section.length / 2, trailerHeight, 0);
                containerGroup.add(floor);
                
                // Add grid on the floor of each section - square grid
                const gridSquareSize = 0.5;  // 50cm squares
                const gridDivisionsX = Math.round(section.length / gridSquareSize);
                const gridDivisionsZ = Math.round(section.width / gridSquareSize);
                
                // Create custom grid with squares
                const gridMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });
                const gridGeometry = new THREE.BufferGeometry();
                const gridVertices = [];
                
                // Lines along X axis (length)
                for (let i = 0; i <= gridDivisionsZ; i++) {
                    const z = -section.width/2 + (i * gridSquareSize);
                    gridVertices.push(
                        xOffset, trailerHeight + 0.01, z,
                        xOffset + section.length, trailerHeight + 0.01, z
                    );
                }
                
                // Lines along Z axis (width)
                for (let i = 0; i <= gridDivisionsX; i++) {
                    const x = xOffset + (i * gridSquareSize);
                    gridVertices.push(
                        x, trailerHeight + 0.01, -section.width/2,
                        x, trailerHeight + 0.01, section.width/2
                    );
                }
                
                gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridVertices, 3));
                const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
                containerGroup.add(grid);
                
                // Edges outline for this section
                const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(section.length, section.height, section.width));
                const edgesMaterial = new THREE.LineBasicMaterial({ 
                    color: CONFIG.colors.containerWireframe,
                    linewidth: 2
                });
                const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
                edges.position.set(xOffset + section.length / 2, trailerHeight + section.height / 2, 0);
                containerGroup.add(edges);
                
                // Add semi-transparent walls
                const wallMaterial = new THREE.MeshStandardMaterial({ 
                    color: CONFIG.colors.container,
                    transparent: true,
                    opacity: 0,
                    side: THREE.DoubleSide
                });
                
                // Back wall - gray fill like floor (front of trailer)
                const backWallMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xc0c0c0,  // Same gray as floor
                    transparent: false,
                    side: THREE.DoubleSide
                });
                const backWall = new THREE.Mesh(
                    new THREE.BoxGeometry(0.001, section.height, section.width),
                    backWallMaterial
                );
                backWall.position.set(xOffset - 0.003, trailerHeight + section.height / 2, 0);
                containerGroup.add(backWall);
                
                // Front wall
                const frontWall = new THREE.Mesh(
                    new THREE.BoxGeometry(0.02, section.height, section.width),
                    wallMaterial
                );
                frontWall.position.set(xOffset + section.length, trailerHeight + section.height / 2, 0);
                containerGroup.add(frontWall);
                
                // Side walls
                const leftWall = new THREE.Mesh(
                    new THREE.BoxGeometry(section.length, section.height, 0.02),
                    wallMaterial
                );
                leftWall.position.set(xOffset + section.length / 2, trailerHeight + section.height / 2, -section.width / 2);
                containerGroup.add(leftWall);
                
                const rightWall = new THREE.Mesh(
                    new THREE.BoxGeometry(section.length, section.height, 0.02),
                    wallMaterial
                );
                rightWall.position.set(xOffset + section.length / 2, trailerHeight + section.height / 2, section.width / 2);
                containerGroup.add(rightWall);
                
                // Add section label
                const labelGeometry = new THREE.PlaneGeometry(1, 0.3);
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 64;
                const context = canvas.getContext('2d');
                context.fillStyle = '#333333';
                context.font = 'bold 48px Arial';
                context.textAlign = 'center';
                context.fillText(`Sekcja ${index + 1}`, 128, 48);
                
                const labelTexture = new THREE.CanvasTexture(canvas);
                const labelMaterial = new THREE.MeshBasicMaterial({ 
                    map: labelTexture,
                    transparent: true,
                    side: THREE.DoubleSide
                });
                const label = new THREE.Mesh(labelGeometry, labelMaterial);
                label.position.set(xOffset + section.length / 2, trailerHeight + section.height + 0.5, 0);
                label.rotation.x = -Math.PI / 4;
                containerGroup.add(label);
                
                xOffset += section.length;
            });
        } else {
            // Standard single container
            const floorGeometry = new THREE.BoxGeometry(dimensions.length, 0.02, dimensions.width);
            const floorMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xc0c0c0,  // Light gray
                roughness: 0.9,
                metalness: 0.1
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.y = trailerHeight;
            containerGroup.add(floor);
            
            // Add grid on the floor - square grid
            const gridSquareSize = 0.5;  // 50cm squares
            const gridDivisionsX = Math.round(dimensions.length / gridSquareSize);
            const gridDivisionsZ = Math.round(dimensions.width / gridSquareSize);
            
            // Create custom grid with squares
            const gridMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });
            const gridGeometry = new THREE.BufferGeometry();
            const gridVertices = [];
            
            // Lines along X axis (length)
            for (let i = 0; i <= gridDivisionsZ; i++) {
                const z = -dimensions.width/2 + (i * gridSquareSize);
                gridVertices.push(
                    -dimensions.length/2, trailerHeight + 0.01, z,
                    dimensions.length/2, trailerHeight + 0.01, z
                );
            }
            
            // Lines along Z axis (width)
            for (let i = 0; i <= gridDivisionsX; i++) {
                const x = -dimensions.length/2 + (i * gridSquareSize);
                gridVertices.push(
                    x, trailerHeight + 0.01, -dimensions.width/2,
                    x, trailerHeight + 0.01, dimensions.width/2
                );
            }
            
            gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridVertices, 3));
            const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
            containerGroup.add(grid);
            
            // Add groove for Coilmulde
            if (dimensions.hasGroove) {
                const grooveXPosition = -dimensions.length / 2 + dimensions.grooveStartX + dimensions.grooveLength / 2;
                
                // Create a visible depression in the floor
                const grooveGeometry = new THREE.BoxGeometry(
                    dimensions.grooveLength,
                    0.05, // Make it thicker to be visible
                    dimensions.grooveWidth
                );
                const grooveMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x808080, // Medium gray for better visibility
                    roughness: 0.9,
                    metalness: 0.05
                });
                const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
                groove.position.set(grooveXPosition, trailerHeight - dimensions.grooveDepth / 2, 0); // Position in middle of depth
                containerGroup.add(groove);
                
                // Add visible border frame on floor level
                const frameThickness = 0.05;
                const frameMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xa0a0a0, // Light gray for frame
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                // Front frame
                const frameGeometry = new THREE.BoxGeometry(
                    dimensions.grooveLength + 0.1,
                    0.02,
                    frameThickness
                );
                const frontFrame = new THREE.Mesh(frameGeometry, frameMaterial);
                frontFrame.position.set(grooveXPosition, trailerHeight + 0.01, dimensions.grooveWidth / 2 + frameThickness / 2);
                containerGroup.add(frontFrame);
                
                // Back frame
                const backFrame = new THREE.Mesh(frameGeometry, frameMaterial);
                backFrame.position.set(grooveXPosition, trailerHeight + 0.01, -dimensions.grooveWidth / 2 - frameThickness / 2);
                containerGroup.add(backFrame);
                
                // Left frame
                const sideFrameGeometry = new THREE.BoxGeometry(
                    frameThickness,
                    0.02,
                    dimensions.grooveWidth + frameThickness * 2
                );
                const leftFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
                leftFrame.position.set(-dimensions.length / 2 + dimensions.grooveStartX - frameThickness / 2, trailerHeight + 0.01, 0);
                containerGroup.add(leftFrame);
                
                // Right frame
                const rightFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
                rightFrame.position.set(-dimensions.length / 2 + dimensions.grooveStartX + dimensions.grooveLength + frameThickness / 2, trailerHeight + 0.01, 0);
                containerGroup.add(rightFrame);
                
                // Create "COIL WELL" text along the inner edge of the frame
                const textCanvas = document.createElement('canvas');
                textCanvas.width = 512;
                textCanvas.height = 96;
                const textCtx = textCanvas.getContext('2d');
                textCtx.fillStyle = '#f0f0f0'; // Almost white
                textCtx.font = 'bold 64px Arial';
                textCtx.textAlign = 'center';
                textCtx.textBaseline = 'middle';
                textCtx.fillText('COIL WELL', 256, 48);
                
                const textTexture = new THREE.CanvasTexture(textCanvas);
                const textMaterial = new THREE.MeshBasicMaterial({ 
                    map: textTexture,
                    transparent: true
                });
                
                const textGeometry = new THREE.PlaneGeometry(2.5, 0.5);
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.rotation.x = -Math.PI / 2; // Lay flat on floor
                textMesh.position.set(
                    grooveXPosition, // Center along length
                    trailerHeight + 0.02, // Just above floor level
                    dimensions.grooveWidth / 2 - 0.15 // Inside the frame, along the front edge
                );
                containerGroup.add(textMesh);
            }
            
            const wallMaterial = new THREE.MeshStandardMaterial({ 
                color: CONFIG.colors.container,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide
            });
            
            // Back wall - gray fill like floor (front of trailer)
            const backWallMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xc0c0c0,  // Same gray as floor
                transparent: false,
                side: THREE.DoubleSide
            });
            const backWall = new THREE.Mesh(
                new THREE.BoxGeometry(0.001, dimensions.height, dimensions.width),
                backWallMaterial
            );
            backWall.position.set(-dimensions.length / 2 - 0.003, trailerHeight + dimensions.height / 2, 0);
            containerGroup.add(backWall);
            
            const frontWall = new THREE.Mesh(
                new THREE.BoxGeometry(0.02, dimensions.height, dimensions.width),
                wallMaterial
            );
            frontWall.position.set(dimensions.length / 2, trailerHeight + dimensions.height / 2, 0);
            containerGroup.add(frontWall);
            
            const leftWall = new THREE.Mesh(
                new THREE.BoxGeometry(dimensions.length, dimensions.height, 0.02),
                wallMaterial
            );
            leftWall.position.set(0, trailerHeight + dimensions.height / 2, -dimensions.width / 2);
            containerGroup.add(leftWall);
            
            const rightWall = new THREE.Mesh(
                new THREE.BoxGeometry(dimensions.length, dimensions.height, 0.02),
                wallMaterial
            );
            rightWall.position.set(0, trailerHeight + dimensions.height / 2, dimensions.width / 2);
            containerGroup.add(rightWall);
            
            const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(dimensions.length, dimensions.height, dimensions.width));
            const edgesMaterial = new THREE.LineBasicMaterial({ 
                color: CONFIG.colors.containerWireframe,
                linewidth: 2
            });
            const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
            edges.position.y = trailerHeight + dimensions.height / 2;
            containerGroup.add(edges);
        }
        
        this.containerMesh = containerGroup;
        this.scene.add(this.containerMesh);
        
        // Set initial camera view to 3D
        this.setView('3d');
        
        // Update container bounds for drag & drop and context menu operations
        this.updateContainerBounds(dimensions);
    }
    
    addTruckAndWheels(containerGroup, dimensions, trailerHeight, axleConfig = null) {
        // Use provided config or get from axleCalculator if available
        const config = axleConfig || (window.axleCalculator?.axleConfig ? {
            tractorAxles: window.axleCalculator.axleConfig.tractorAxles,
            trailerAxles: window.axleCalculator.axleConfig.trailerAxles,
            distFrontToKingpin: window.axleCalculator.axleConfig.distFrontToKingpin,
            distKingpinToTrailer: window.axleCalculator.axleConfig.distKingpinToTrailer,
            distTrailerToEnd: window.axleCalculator.axleConfig.distTrailerToEnd,
            distFrontAxleToKingpin: window.axleCalculator.axleConfig.distFrontAxleToKingpin,
            distKingpinToDrive: window.axleCalculator.axleConfig.distKingpinToDrive
        } : {
            tractorAxles: 1,
            trailerAxles: 3,
            distFrontToKingpin: 1.7,
            distKingpinToTrailer: 7.7,
            distTrailerToEnd: 4.2,
            distFrontAxleToKingpin: 3.1,
            distKingpinToDrive: 0.5
        });
        
        // Store reference to truck visualization group
        this.truckVisualizationGroup = new THREE.Group();
        // Create wireframe material for truck parts
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: CONFIG.colors.containerWireframe, // Same color as container edges
            linewidth: 2
        });
        
        // Create fill material for truck parts
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0xfaf8f5, // Light creamy white
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        
        // Calculate positions based on provided distances
        // a) 1.7m from front of loading space to kingpin
        // b) 7.7m from kingpin to center of trailer axles
        // c) 4.2m from center of trailer axles to end of loading space
        // d) 3.1m from front axle to kingpin
        // e) 0.5m from drive axle BEHIND kingpin
        
        const containerFront = -dimensions.length / 2;
        const containerEnd = dimensions.length / 2;
        const kingPinX = containerFront + config.distFrontToKingpin;
        const trailerAxlesX = containerFront + config.distFrontToKingpin + config.distKingpinToTrailer;
        const frontAxleX = kingPinX - config.distFrontAxleToKingpin;
        const driveAxlesCenter = kingPinX + config.distKingpinToDrive
        
        // Trailer wheels (3 axles with more spacing)
        const wheelRadius = 0.546;  // Zmniejszone o 4mm aby nie nachodziły na podłogę
        const wheelWidth = 0.35;   // Zwiększone z 0.3 na 0.35 - szersze opony
        
        // Trailer axles based on configuration
        if (config.trailerAxles === 1) {
            // Single axle
            this.addWheel(this.truckVisualizationGroup, trailerAxlesX, wheelRadius, -1.0, wheelRadius, wheelWidth);
            this.addWheel(this.truckVisualizationGroup, trailerAxlesX, wheelRadius, 1.0, wheelRadius, wheelWidth);
        } else if (config.trailerAxles === 2) {
            // Tandem (2 axles)
            const spacing = 1.31;
            for (let i = -0.5; i <= 0.5; i += 1) {
                const axleX = trailerAxlesX + i * spacing;
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, -1.0, wheelRadius, wheelWidth);
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, 1.0, wheelRadius, wheelWidth);
            }
        } else if (config.trailerAxles === 3) {
            // Tridem (3 axles)
            const spacing = 1.31;
            for (let i = -1; i <= 1; i++) {
                const axleX = trailerAxlesX + i * spacing;
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, -1.0, wheelRadius, wheelWidth);
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, 1.0, wheelRadius, wheelWidth);
            }
        }
        
        // Front axle wheels (always single)
        this.addWheel(this.truckVisualizationGroup, frontAxleX, wheelRadius, -1.0, wheelRadius, wheelWidth);
        this.addWheel(this.truckVisualizationGroup, frontAxleX, wheelRadius, 1.0, wheelRadius, wheelWidth);
        
        // Drive axle wheels based on configuration
        if (config.tractorAxles === 1) {
            // Single drive axle (double wheels on each side)
            this.addWheel(this.truckVisualizationGroup, driveAxlesCenter, wheelRadius, -0.8, wheelRadius, wheelWidth);
            this.addWheel(this.truckVisualizationGroup, driveAxlesCenter, wheelRadius, -1.1, wheelRadius, wheelWidth);
            this.addWheel(this.truckVisualizationGroup, driveAxlesCenter, wheelRadius, 0.8, wheelRadius, wheelWidth);
            this.addWheel(this.truckVisualizationGroup, driveAxlesCenter, wheelRadius, 1.1, wheelRadius, wheelWidth);
        } else if (config.tractorAxles === 2) {
            // Tandem drive axles
            const spacing = 1.35;
            for (let axle = -0.5; axle <= 0.5; axle += 1) {
                const axleX = driveAxlesCenter + axle * spacing;
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, -0.8, wheelRadius, wheelWidth);
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, -1.1, wheelRadius, wheelWidth);
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, 0.8, wheelRadius, wheelWidth);
                this.addWheel(this.truckVisualizationGroup, axleX, wheelRadius, 1.1, wheelRadius, wheelWidth);
            }
        }
        
        // Draw simplified truck cabin outline
        const cabinHeight = 2.3;
        const cabinLength = 2.2; // Reduced by 10cm
        const cabinWidth = 2.4;
        
        // Add chassis rectangle under the cabin first to calculate its position
        const cabinX = frontAxleX - 0.2; // Moved 10cm closer to reduce gap to 45cm
        const cabinFrontX = cabinX - cabinLength/2; // Front of both cabin and chassis align
        const chassisEndX = driveAxlesCenter + 1.0;
        const chassisHeight = 0.7; // Increased to be above wheels
        const chassisWidth = cabinWidth; // Same width as cabin
        const chassisTopY = 1.09; // Lowered by 1cm to avoid overlapping with floor
        const chassisBottomY = chassisTopY - chassisHeight;
        
        // Create custom chassis geometry with wheel arches
        const chassisShape = new THREE.Shape();
        
        // Start from front bottom left
        chassisShape.moveTo(cabinFrontX, chassisBottomY);
        
        // Go up to top at front
        chassisShape.lineTo(cabinFrontX, chassisTopY);
        
        // Move along top
        const archRadius = 0.65; // Slightly larger than wheel radius (0.5)
        
        chassisShape.lineTo(chassisEndX, chassisTopY);
        
        // Go down at the back
        chassisShape.lineTo(chassisEndX, chassisBottomY);
        
        // Return along bottom with wheel cutouts for drive axles
        if (config.tractorAxles === 2) {
            // Two drive axles - create two arches
            const spacing = 1.35;
            const axle2X = driveAxlesCenter + 0.5 * spacing;
            const axle1X = driveAxlesCenter - 0.5 * spacing;
            
            // From back to second drive axle arch
            chassisShape.lineTo(axle2X + archRadius, chassisBottomY);
            chassisShape.lineTo(axle2X + archRadius, chassisTopY - archRadius);
            chassisShape.arc(-archRadius, 0, archRadius, 0, Math.PI, false);
            chassisShape.lineTo(axle2X - archRadius, chassisBottomY);
            
            // To first drive axle arch
            chassisShape.lineTo(axle1X + archRadius, chassisBottomY);
            chassisShape.lineTo(axle1X + archRadius, chassisTopY - archRadius);
            chassisShape.arc(-archRadius, 0, archRadius, 0, Math.PI, false);
            chassisShape.lineTo(axle1X - archRadius, chassisBottomY);
        } else {
            // Single drive axle - one arch
            chassisShape.lineTo(driveAxlesCenter + archRadius, chassisBottomY);
            chassisShape.lineTo(driveAxlesCenter + archRadius, chassisTopY - archRadius);
            chassisShape.arc(-archRadius, 0, archRadius, 0, Math.PI, false);
            chassisShape.lineTo(driveAxlesCenter - archRadius, chassisBottomY);
        }
        
        // Continue to front axle arch
        chassisShape.lineTo(frontAxleX + archRadius, chassisBottomY);
        
        // Front wheel arch cutout
        chassisShape.lineTo(frontAxleX + archRadius, chassisTopY - archRadius);
        chassisShape.arc(-archRadius, 0, archRadius, 0, Math.PI, false);
        chassisShape.lineTo(frontAxleX - archRadius, chassisBottomY);
        
        // Return to front
        chassisShape.lineTo(cabinFrontX, chassisBottomY);
        
        // Create line segments from the shape
        const chassisPoints = chassisShape.getPoints(50);
        const chassisGeometry = new THREE.BufferGeometry().setFromPoints(chassisPoints);
        const chassisLine = new THREE.Line(chassisGeometry, lineMaterial);
        
        // Create the same for the other side
        const chassisLine2 = chassisLine.clone();
        chassisLine.position.z = -chassisWidth/2;
        chassisLine2.position.z = chassisWidth/2;
        
        // Add connecting lines between the two sides
        const connectGeometry = new THREE.BufferGeometry();
        const connectPoints = [];
        
        // Front vertical edges
        connectPoints.push(new THREE.Vector3(cabinFrontX, chassisBottomY, -chassisWidth/2));
        connectPoints.push(new THREE.Vector3(cabinFrontX, chassisBottomY, chassisWidth/2));
        connectPoints.push(new THREE.Vector3(cabinFrontX, chassisTopY, chassisWidth/2));
        connectPoints.push(new THREE.Vector3(cabinFrontX, chassisTopY, -chassisWidth/2));
        connectPoints.push(new THREE.Vector3(cabinFrontX, chassisBottomY, -chassisWidth/2));
        
        // Back vertical edges
        connectPoints.push(new THREE.Vector3(chassisEndX, chassisBottomY, -chassisWidth/2));
        connectPoints.push(new THREE.Vector3(chassisEndX, chassisBottomY, chassisWidth/2));
        connectPoints.push(new THREE.Vector3(chassisEndX, chassisTopY, chassisWidth/2));
        connectPoints.push(new THREE.Vector3(chassisEndX, chassisTopY, -chassisWidth/2));
        connectPoints.push(new THREE.Vector3(chassisEndX, chassisBottomY, -chassisWidth/2));
        
        connectGeometry.setFromPoints(connectPoints);
        const connectLines = new THREE.Line(connectGeometry, lineMaterial);
        
        // Cabin positioned to sit directly on top of chassis
        // Create filled cabin
        const cabinBoxGeometry = new THREE.BoxGeometry(cabinLength, cabinHeight, cabinWidth);
        const cabinFill = new THREE.Mesh(cabinBoxGeometry, fillMaterial);
        cabinFill.position.set(cabinX, chassisTopY + cabinHeight/2, 0);
        
        // Create cabin edges
        const cabinGeometry = new THREE.EdgesGeometry(cabinBoxGeometry);
        const cabinEdges = new THREE.LineSegments(cabinGeometry, lineMaterial);
        cabinEdges.position.set(cabinX, chassisTopY + cabinHeight/2, 0);
        
        // Create filled chassis using ExtrudeGeometry
        // Extrude along Z axis
        const chassisExtrudeSettings = {
            depth: chassisWidth,
            bevelEnabled: false,
            curveSegments: 12
        };
        
        // Use the existing chassis shape
        const chassisExtrudeGeometry = new THREE.ExtrudeGeometry(chassisShape, chassisExtrudeSettings);
        const chassisFill = new THREE.Mesh(chassisExtrudeGeometry, fillMaterial);
        // No rotation needed, just position it correctly
        chassisFill.position.z = -chassisWidth/2;
        
        this.truckVisualizationGroup.add(cabinFill);
        this.truckVisualizationGroup.add(cabinEdges);
        this.truckVisualizationGroup.add(chassisFill);
        // Add all elements to truck visualization group
        this.truckVisualizationGroup.add(chassisLine);
        this.truckVisualizationGroup.add(chassisLine2);
        this.truckVisualizationGroup.add(connectLines);
        
        // Add the truck visualization group to the container
        containerGroup.add(this.truckVisualizationGroup);
    }
    
    addWheel(parent, x, y, z, radius, width) {
        const wheelGroup = new THREE.Group();
        
        // Create rubber material for tire walls - dark gray like real rubber
        const rubberMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x2a2a2a,  // Ciemnoszary/grafitowy jak prawdziwa guma
            side: THREE.DoubleSide
        });
        
        // Create black fill material for inner parts
        const blackFillMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x1a1a1a,  // Prawie czarny dla wewnętrznych części
            side: THREE.DoubleSide
        });
        
        // Create metallic material for inner disc - using MeshBasicMaterial for guaranteed color
        const metallicMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x808080,  // Średni srebrny kolor - dobrze wyważony
            side: THREE.DoubleSide
        });
        
        // Create wheel rim material for lines - changed to black
        const rimMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2
        });
        
        const innerRadius = radius * 0.5;  // Zmniejszone z 0.7 na 0.5 - mniejsza felga
        const hubRadius = radius * 0.15;   // Zmniejszone z 0.2 na 0.15 - mniejsza piasta
        
        // Create side faces (both sides of the wheel)
        // Outer ring (between outer edge and inner circle)
        const outerRingShape = new THREE.Shape();
        outerRingShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
        const outerRingHole = new THREE.Path();
        outerRingHole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        outerRingShape.holes = [outerRingHole];
        
        // Front outer ring face - use rubber material for tire
        const outerRingGeometry = new THREE.ShapeGeometry(outerRingShape);
        const outerRingFront = new THREE.Mesh(outerRingGeometry, rubberMaterial);
        outerRingFront.position.z = width / 2;
        wheelGroup.add(outerRingFront);
        
        // Back outer ring face - use rubber material for tire
        const outerRingBack = new THREE.Mesh(outerRingGeometry, rubberMaterial);
        outerRingBack.position.z = -width / 2;
        wheelGroup.add(outerRingBack);
        
        // Inner ring (between inner circle and hub) - single metallic disc in the center
        const innerRingShape = new THREE.Shape();
        innerRingShape.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);
        const innerRingHole = new THREE.Path();
        innerRingHole.absarc(0, 0, hubRadius, 0, Math.PI * 2, true);
        innerRingShape.holes = [innerRingHole];
        
        // Single center inner ring face with metallic material
        const innerRingGeometry = new THREE.ShapeGeometry(innerRingShape);
        const innerRingCenter = new THREE.Mesh(innerRingGeometry, metallicMaterial);
        innerRingCenter.position.z = 0; // Centered in the middle of the wheel
        wheelGroup.add(innerRingCenter);
        
        // Create dark gray material for hub
        const hubMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x404040,  // Ciemnoszary - między czarnym a srebrnym
            side: THREE.DoubleSide
        });
        
        // Hub center (solid circle) - dark gray, single disc in center
        const hubShape = new THREE.Shape();
        hubShape.absarc(0, 0, hubRadius, 0, Math.PI * 2, false);
        
        // Single center hub face with dark gray material
        const hubGeometryShape = new THREE.ShapeGeometry(hubShape);
        const hubCenter = new THREE.Mesh(hubGeometryShape, hubMaterial);
        hubCenter.position.z = 0; // Centered in the middle of the wheel
        wheelGroup.add(hubCenter);
        
        // Create cylindrical walls
        // Outer wall - use rubber material for tire
        const outerWallGeometry = new THREE.CylinderGeometry(radius, radius, width, 32, 1, true);
        const outerWall = new THREE.Mesh(outerWallGeometry, rubberMaterial);
        outerWall.rotation.x = Math.PI / 2;
        wheelGroup.add(outerWall);
        
        // Add caps at the ends of outer cylinder (tire ends) - use rubber material
        const outerCapShape = new THREE.Shape();
        outerCapShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
        const outerCapHole = new THREE.Path();
        outerCapHole.absarc(0, 0, radius * 0.9, 0, Math.PI * 2, true);
        outerCapShape.holes = [outerCapHole];
        
        // Front outer cap - rubber material
        const outerCapGeometry = new THREE.ShapeGeometry(outerCapShape);
        const outerCapFront = new THREE.Mesh(outerCapGeometry, rubberMaterial);
        outerCapFront.position.z = width / 2;
        wheelGroup.add(outerCapFront);
        
        // Back outer cap - rubber material
        const outerCapBack = new THREE.Mesh(outerCapGeometry, rubberMaterial);
        outerCapBack.position.z = -width / 2;
        wheelGroup.add(outerCapBack);
        
        // Inner wall (slightly shorter) - keep it open
        const innerWallGeometry = new THREE.CylinderGeometry(innerRadius, innerRadius, width * 0.9, 24, 1, true); // true = open cylinder
        const innerWall = new THREE.Mesh(innerWallGeometry, blackFillMaterial);
        innerWall.rotation.x = Math.PI / 2;
        wheelGroup.add(innerWall);
        
        // Add small caps at the ends of inner cylinder
        const innerCapShape = new THREE.Shape();
        const innerCapOuter = new THREE.Path();
        innerCapOuter.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);
        const innerCapInner = new THREE.Path();
        innerCapInner.absarc(0, 0, innerRadius * 0.9, 0, Math.PI * 2, true);
        innerCapShape.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);
        innerCapShape.holes = [innerCapInner];
        
        // Front cap
        const innerCapGeometry = new THREE.ShapeGeometry(innerCapShape);
        const innerCapFront = new THREE.Mesh(innerCapGeometry, blackFillMaterial);
        innerCapFront.position.z = width * 0.45;
        wheelGroup.add(innerCapFront);
        
        // Back cap  
        const innerCapBack = new THREE.Mesh(innerCapGeometry, blackFillMaterial);
        innerCapBack.position.z = -width * 0.45;
        wheelGroup.add(innerCapBack);
        
        // Hub wall (shorter - doesn't protrude as much) - use hubMaterial for consistency
        const hubWallGeometry = new THREE.CylinderGeometry(hubRadius, hubRadius, width * 0.7, 8, 1, true);
        const hubWall = new THREE.Mesh(hubWallGeometry, hubMaterial);  // Changed to hubMaterial (dark gray)
        hubWall.rotation.x = Math.PI / 2;
        wheelGroup.add(hubWall);
        
        // Add caps at the ends of hub cylinder (smallest inner cylinder) - also dark gray
        const hubCapShape = new THREE.Shape();
        hubCapShape.absarc(0, 0, hubRadius, 0, Math.PI * 2, false);
        // No hole for hub caps - they are solid
        
        // Front hub cap - use hubMaterial instead of black
        const hubCapGeometry = new THREE.ShapeGeometry(hubCapShape);
        const hubCapFront = new THREE.Mesh(hubCapGeometry, hubMaterial);
        hubCapFront.position.z = width * 0.35;  // Zmniejszone z 0.55 na 0.35
        wheelGroup.add(hubCapFront);
        
        // Back hub cap - use hubMaterial instead of black
        const hubCapBack = new THREE.Mesh(hubCapGeometry, hubMaterial);
        hubCapBack.position.z = -width * 0.35;  // Zmniejszone z -0.55 na -0.35
        wheelGroup.add(hubCapBack);
        
        // Add edge lines for better definition - all black
        // Outer circle edges
        const rimGeometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(radius, radius, width, 32, 1));
        const rim = new THREE.LineSegments(rimGeometry, rimMaterial);
        rim.rotation.x = Math.PI / 2;
        wheelGroup.add(rim);
        
        // Inner circle edges
        const innerGeometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(innerRadius, innerRadius, width * 0.9, 24, 1));
        const innerCircle = new THREE.LineSegments(innerGeometry, rimMaterial);
        innerCircle.rotation.x = Math.PI / 2;
        wheelGroup.add(innerCircle);
        
        // Hub edges - shortened to match the hub wall
        const hubGeometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(hubRadius, hubRadius, width * 0.7, 8, 1));
        const hub = new THREE.LineSegments(hubGeometry, rimMaterial);
        hub.rotation.x = Math.PI / 2;
        wheelGroup.add(hub);
        
        // Position the whole wheel group
        wheelGroup.position.set(x, y, z);
        parent.add(wheelGroup);
    }
    
    addCargo(cargoData) {
        // Create cargo group if it doesn't exist
        if (!this.cargoGroup) {
            this.cargoGroup = new THREE.Group();
            this.scene.add(this.cargoGroup);
        }
        
        // Create geometry key for caching
        const geoKey = cargoData.isRoll ? 
            `roll_${cargoData.length}_${cargoData.height}_${cargoData.width}` :
            `${cargoData.length}_${cargoData.height}_${cargoData.width}`;
        
        // Use cached geometry if available
        let geometry;
        if (this.geometryCache.has(geoKey)) {
            geometry = this.geometryCache.get(geoKey);
        } else {
            if (cargoData.isRoll && cargoData.fixedDiameter) {
                // Steel coil - horizontal cylinder with hole
                const outerRadius = cargoData.height / 2;
                const innerRadius = outerRadius * 0.35; // 35% of outer radius for the hole
                const length = cargoData.length;
                
                // Create a ring shape and extrude it
                const shape = new THREE.Shape();
                
                // Define outer circle
                shape.moveTo(outerRadius, 0);
                shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
                
                // Define inner circle (hole)
                const holePath = new THREE.Path();
                holePath.moveTo(innerRadius, 0);
                holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
                shape.holes = [holePath];
                
                // Extrude settings with smooth curves
                const extrudeSettings = {
                    depth: length,
                    bevelEnabled: true,
                    bevelThickness: 0.02,
                    bevelSize: 0.02,
                    bevelSegments: 8,
                    curveSegments: 64  // High number for smooth circles
                };
                
                geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                
                // Center and rotate the geometry
                geometry.center();
                geometry.rotateY(Math.PI / 2);  // Rotate to lie along X axis
                
            } else if (cargoData.isRoll && !cargoData.fixedDiameter) {
                // Roll - can be vertical or horizontal
                if (cargoData.isVerticalRoll) {
                    // Vertical cylinder
                    const radius = cargoData.width / 2; // width = diameter for vertical
                    const height = cargoData.height;
                    
                    geometry = new THREE.CylinderGeometry(
                        radius,    // top radius
                        radius,    // bottom radius
                        height,    // height
                        32,        // radial segments
                        1,         // height segments
                        false      // open ended
                    );
                } else {
                    // Horizontal cylinder - lying on its side
                    // Use diameter property if available (for rotated rolls)
                    // Otherwise use width as diameter
                    const diameter = cargoData.diameter || cargoData.width;
                    const radius = diameter / 2;
                    
                    // Cylinder length is the larger of length/width (for rotated items)
                    const cylinderLength = cargoData.diameter ? 
                        Math.max(cargoData.length, cargoData.width) : 
                        cargoData.length;
                    
                    geometry = new THREE.CylinderGeometry(
                        radius,    // top radius
                        radius,    // bottom radius
                        cylinderLength,    // length along the axis
                        32,        // radial segments
                        1,         // height segments
                        false      // open ended
                    );
                    
                    // Rotate to lie horizontally along X axis
                    geometry.rotateZ(Math.PI / 2);
                }
                
            } else {
                geometry = new THREE.BoxGeometry(
                    cargoData.length,
                    cargoData.height,
                    cargoData.width
                );
            }
            // Cache geometry for reuse
            if (this.geometryCache.size < 20) { // Limit cache size
                this.geometryCache.set(geoKey, geometry);
            }
        }
        
        // Different material properties for steel coils vs regular cargo
        const material = cargoData.isRoll ? 
            new THREE.MeshStandardMaterial({
                color: cargoData.color || 0xc0c0c0, // Silver color default
                roughness: 0.5,  // Medium roughness for better visibility
                metalness: 0.4   // Moderate metalness to avoid black appearance
            }) :
            new THREE.MeshStandardMaterial({
                color: cargoData.color || 0x8B4513,
                roughness: 0.7,
                metalness: 0.2
            });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position mesh based on type
        mesh.position.set(
            cargoData.x || 0,
            cargoData.y || cargoData.height / 2,
            cargoData.z || 0
        );
        
        // Apply rotation if it exists (for rotated items)
        if (cargoData.rotation) {
            mesh.rotation.y = cargoData.rotation;
        }
        
        mesh.userData = cargoData;
        
        // Add wireframe only if less than 100 items (performance)
        // For steel coils, don't add wireframe as it looks better without edge lines
        if (this.cargoMeshes.length < 100 && !cargoData.isRoll) {
            const edges = new THREE.EdgesGeometry(geometry);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
            const wireframe = new THREE.LineSegments(edges, lineMaterial);
            mesh.add(wireframe);
        }
        
        this.cargoMeshes.push(mesh);
        this.cargoGroup.add(mesh);
        
        return mesh;
    }
    
    removeCargo(mesh) {
        const index = this.cargoMeshes.indexOf(mesh);
        if (index > -1) {
            this.cargoMeshes.splice(index, 1);
            if (this.cargoGroup) {
                this.cargoGroup.remove(mesh);
            }
            // Dispose of materials and geometries
            if (mesh.material) mesh.material.dispose();
            // Don't dispose cached geometries
        }
    }
    
    clearAllCargo() {
        if (this.cargoGroup) {
            this.scene.remove(this.cargoGroup);
            // Dispose materials
            this.cargoMeshes.forEach(mesh => {
                if (mesh.material) mesh.material.dispose();
            });
            this.cargoGroup = null;
        }
        this.cargoMeshes = [];
    }
    
    updateCenterOfGravity(centerPoint) {
        if (this.centerOfGravityMarker) {
            this.scene.remove(this.centerOfGravityMarker);
        }
        
        if (!centerPoint) return;
        
        const geometry = new THREE.SphereGeometry(0.1, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: CONFIG.colors.centerOfGravity
        });
        
        this.centerOfGravityMarker = new THREE.Mesh(geometry, material);
        this.centerOfGravityMarker.position.copy(centerPoint);
        this.scene.add(this.centerOfGravityMarker);
    }
    
    setView(viewType) {
        const container = this.containerMesh;
        if (!container) return;
        
        // Use stored container dimensions
        const dimensions = this.containerDimensions || {
            length: 13.6,
            width: 2.48,
            height: 2.7
        };
        const trailerHeight = dimensions.trailerHeight || 1.2;
        
        const bounds = new THREE.Box3().setFromObject(container);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        
        switch(viewType) {
            case 'top':
                // View from top - show entire loading space with some margin
                this.camera.position.set(0, dimensions.height * 7, 0);
                this.controls.target.set(0, trailerHeight, 0);
                this.controls.update();
                return;
            case 'side':
                // View from side - show entire length with margin
                this.camera.position.set(0, trailerHeight + dimensions.height / 2, dimensions.width * 6);
                this.controls.target.set(0, trailerHeight + dimensions.height / 2, 0);
                this.controls.update();
                return;
            case 'front':
                // View from front/back - show entire width with margin
                this.camera.position.set(dimensions.length * 1.2, trailerHeight + dimensions.height / 2, 0);
                this.controls.target.set(0, trailerHeight + dimensions.height / 2, 0);
                this.controls.update();
                return;
            case '3d':
            default:
                // Use the same calculation as before in createContainer
                this.camera.position.set(
                    dimensions.length * 0.4,
                    trailerHeight + dimensions.height * 2,
                    dimensions.width * 5.5
                );
                this.controls.target.set(0, trailerHeight + dimensions.height / 2, 0);
                this.controls.update();
                return; // Exit early as we set target differently for 3D view
        }
        
        this.controls.target.copy(center);
        this.controls.update();
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Regular event listeners (no need for capture phase now)
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        this.renderer.domElement.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        
        // Create bound versions of handlers for document-level listeners
        this.documentMouseUpHandler = (e) => this.onDocumentMouseUp(e);
        this.documentContextMenuHandler = (e) => this.onDocumentContextMenu(e);
    }
    
    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Check if mouse has moved significantly from mouse down position
        if (this.mouseDownPosition) {
            const dx = Math.abs(event.clientX - this.mouseDownPosition.x);
            const dy = Math.abs(event.clientY - this.mouseDownPosition.y);
            if (dx > 2 || dy > 2) {
                this.mouseHasMoved = true;
                
                // Start actual dragging if we have a potential drag target
                if (this.potentialDragTarget && !this.isDragging) {
                    this.isDragging = true;
                    document.body.style.cursor = 'grabbing';
                }
            }
        }
        
        if (this.isDragging && this.draggedObjects.length > 0) {
            // Handle dragging
            this.handleDragging();
        } else if (this.cargoMeshes.length > 0) {
            // Normal hover behavior - only if we have cargo
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
            
            // Clear previous hover
            if (this.hoveredObject) {
                // Only clear emissive if the object is not part of selected group
                if (!this.selectedGroupId || 
                    !this.hoveredObject.userData || 
                    this.hoveredObject.userData.groupId !== this.selectedGroupId) {
                    this.hoveredObject.material.emissive = new THREE.Color(0x000000);
                } else {
                    // Keep group highlight
                    this.hoveredObject.material.emissive = new THREE.Color(0x444444);
                }
            }
            
            if (intersects.length > 0) {
                // Hovering over cargo - disable OrbitControls
                this.controls.enabled = false;
                this.hoveredObject = intersects[0].object;
                // Apply hover highlight (which might be stronger for selected group items)
                if (this.selectedGroupId && 
                    this.hoveredObject.userData && 
                    this.hoveredObject.userData.groupId === this.selectedGroupId) {
                    // Item is part of selected group - maybe use slightly stronger highlight
                    this.hoveredObject.material.emissive = new THREE.Color(0x666666);
                } else {
                    // Normal hover highlight
                    this.hoveredObject.material.emissive = new THREE.Color(0x444444);
                }
                // Show grab cursor
                document.body.style.cursor = 'grab';
                // Show ruler and dimension labels for hovered cargo only if inside container
                if (!this.isPositionOutsideContainer(this.hoveredObject.position)) {
                    this.showRulerForCargo(this.hoveredObject);
                    this.createDimensionLabels(this.hoveredObject);
                } else {
                    // Hide dimension labels for units outside container
                    this.hideDimensionLabels();
                }
            } else {
                // Not hovering over cargo - enable OrbitControls
                this.controls.enabled = true;
                this.hoveredObject = null;
                document.body.style.cursor = 'default';
                // Hide ruler and dimension labels when not hovering
                this.hideRuler();
                
                // Restore group highlight if any group is selected
                if (this.selectedGroupId) {
                    this.cargoMeshes.forEach(mesh => {
                        if (mesh.userData && mesh.userData.groupId === this.selectedGroupId) {
                            // Check if unit is inside container for highlighting
                            if (!this.isPositionOutsideContainer(mesh.position)) {
                                mesh.material.emissive = new THREE.Color(0x444444);
                            }
                        }
                    });
                }
            }
        } else {
            // No cargo - ensure OrbitControls is enabled
            this.controls.enabled = true;
            document.body.style.cursor = 'default';
            this.hideRuler();
        }
    }
    
    onMouseClick(event) {
        // Ignore clicks during dragging, after dragging
        if (this.isDragging || this.ignoreNextClick) {
            return;
        }
        
        // Check if mouse moved significantly (camera rotation)
        // Use totalMouseMovement which was calculated in mouseUp
        if (this.totalMouseMovement > 2) {
            // Clear any pending click timer
            if (this.clickTimer) {
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
                this.clickCount = 0;
            }
            return;
        }
        
        // Handle multi-click selection
        this.clickCount++;
        
        // Clear existing timer
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
        }
        
        // For double-click, execute immediately
        if (this.clickCount === 2) {
            this.handleSelection(2);
            this.clickCount = 0;
            this.clickTimer = null;
        } else {
            // For single click, wait to see if another click comes
            this.clickTimer = setTimeout(() => {
                if (this.clickCount === 1) {
                    this.handleSelection(1);
                }
                this.clickCount = 0;
                this.clickTimer = null;
            }, 300);
        }
    }
    
    handleSelection(clickCount) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
        
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const clickedPosition = clickedMesh.position.clone();
            
            // Handle group selection/deselection
            if (clickedMesh.userData && clickedMesh.userData.groupId) {
                const clickedGroupId = clickedMesh.userData.groupId;
                
                if (this.selectedGroupId === clickedGroupId) {
                    // Clicked on unit from currently selected group
                    if (clickCount === 2) {
                        // Double click on same group - deselect
                        if (this.onGroupDeselectionRequested) {
                            this.onGroupDeselectionRequested();
                        }
                    }
                    // Single click on same group - do nothing, keep selection
                } else {
                    // Clicked on unit from different group - deselect current group
                    if (this.selectedGroupId && this.onGroupDeselectionRequested) {
                        this.onGroupDeselectionRequested();
                    }
                }
            }
        } else {
            // Clicked on empty space - DO NOT deselect group, keep current selection
            // Group should only be deselected by:
            // 1. Clicking on unit from different group
            // 2. Double-clicking on unit from selected group
            // 3. Clicking on different group in menu
        }
    }
    
    findUnitBelow(position) {
        // Find unit directly below the given position
        let closestBelow = null;
        let minDistance = Infinity;
        
        this.cargoMeshes.forEach(mesh => {
            if (Math.abs(mesh.position.x - position.x) < 0.1 && 
                Math.abs(mesh.position.z - position.z) < 0.1 &&
                mesh.position.y < position.y - 0.1) {
                const distance = position.y - mesh.position.y;
                if (distance < minDistance) {
                    minDistance = distance;
                    closestBelow = mesh;
                }
            }
        });
        
        return closestBelow;
    }
    
    findEntireStack(position) {
        // Find all units in the same vertical stack
        const stack = [];
        const tolerance = 0.1;
        
        this.cargoMeshes.forEach(mesh => {
            if (Math.abs(mesh.position.x - position.x) < tolerance && 
                Math.abs(mesh.position.z - position.z) < tolerance) {
                stack.push(mesh);
            }
        });
        
        // Sort by Y position (top to bottom)
        stack.sort((a, b) => b.position.y - a.position.y);
        return stack;
    }
    
    onMouseDown(event) {
        // Store mouse down position to detect dragging for any button
        this.mouseDownPosition = { x: event.clientX, y: event.clientY };
        this.mouseHasMoved = false;
        this.totalMouseMovement = 0;
        
        // Add document-level listeners to catch mouse release outside canvas
        // This ensures dragging ends properly even when mouse is released outside
        document.addEventListener('mouseup', this.documentMouseUpHandler);
        document.addEventListener('contextmenu', this.documentContextMenuHandler);
        
        if (event.button !== 0) return; // Only continue for left button
        
        // Update mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
        
        if (intersects.length > 0) {
            // We hit a cargo item - OrbitControls should be disabled from onMouseMove
            
            // Prepare for potential dragging (but don't set isDragging yet)
            this.potentialDragTarget = intersects[0].object;
            
            // Get the clicked object and determine what to drag
            const clickedObject = intersects[0].object;
            
            // Check if the clicked object belongs to a selected group
            if (this.selectedGroupId && clickedObject.userData && 
                clickedObject.userData.groupId === this.selectedGroupId &&
                !this.isPositionOutsideContainer(clickedObject.position)) {
                // Drag the entire selected group - but only units inside the container
                const allGroupObjects = this.getGroupObjects(this.selectedGroupId);
                const groupObjectsInside = allGroupObjects.filter(obj => 
                    !this.isPositionOutsideContainer(obj.position)
                );
                
                // Start with group objects and find ALL units stacked above them
                const allUnitsToMove = new Set();
                
                // Add all group objects first
                groupObjectsInside.forEach(obj => {
                    allUnitsToMove.add(obj);
                });
                
                // Now for each position where we have a group unit, 
                // find ALL units stacked above (regardless of group)
                const tolerance = 0.1;
                groupObjectsInside.forEach(groupObj => {
                    const groupPos = groupObj.position;
                    
                    // Find the entire stack at this position
                    this.cargoMeshes.forEach(mesh => {
                        // Check if mesh is in the same column and above the group object
                        if (Math.abs(mesh.position.x - groupPos.x) < tolerance &&
                            Math.abs(mesh.position.z - groupPos.z) < tolerance &&
                            mesh.position.y > groupPos.y) {
                            // Add any unit that is above the group unit
                            allUnitsToMove.add(mesh);
                        }
                    });
                });
                
                this.draggedObjects = Array.from(allUnitsToMove);
            } else {
                // Drag just this object and all objects above it (default behavior)
                this.draggedObjects = this.getAllObjectsAbove(clickedObject);
            }
            
            // Show ruler and dimension labels for the dragged object only if inside container
            if (!this.isPositionOutsideContainer(clickedObject.position)) {
                this.showRulerForCargo(clickedObject);
                this.createDimensionLabels(clickedObject);
            }
            
            // Create drag plane at the clicked object's Y position
            const dragHeight = clickedObject.position.y;
            this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dragHeight);
            
            // Calculate offset
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
            this.dragOffset.subVectors(clickedObject.position, intersectPoint);
            
            // Store original positions in case we need to restore them
            this.originalPositions = this.draggedObjects.map(obj => ({
                object: obj,
                position: obj.position.clone()
            }));
            
            // Store last valid position as current position
            this.lastValidPosition = clickedObject.position.clone();
            
            // Keep dragged objects at full opacity during dragging
            // (removed transparency effect)
            
            // Calculate container bounds using stored dimensions
            this.updateContainerBounds(this.containerDimensions);
        }
    }
    
    getAllObjectsAbove(clickedObject) {
        const allObjects = new Set([clickedObject]);
        const clickedData = clickedObject.userData;
        const tolerance = 0.1;
        
        // Recursive function to find all objects supported by a given object
        const findSupported = (supportObject) => {
            const supportData = supportObject.userData;
            const supportTop = supportObject.position.y + supportData.height / 2;
            const supportHalfLength = supportData.length / 2;
            const supportHalfWidth = supportData.width / 2;
            
            for (let mesh of this.cargoMeshes) {
                if (allObjects.has(mesh)) continue; // Already in our set
                
                const meshData = mesh.userData;
                const meshBottom = mesh.position.y - meshData.height / 2;
                const meshHalfLength = meshData.length / 2;
                const meshHalfWidth = meshData.width / 2;
                
                // Check if this mesh is directly on top of the support object
                if (Math.abs(meshBottom - supportTop) < tolerance) {
                    // Check if mesh is actually ON TOP of support (not just touching sides)
                    // The mesh center must be within the support boundaries
                    const xMin = supportObject.position.x - supportHalfLength;
                    const xMax = supportObject.position.x + supportHalfLength;
                    const zMin = supportObject.position.z - supportHalfWidth;
                    const zMax = supportObject.position.z + supportHalfWidth;
                    
                    // Check if any part of the mesh is within support boundaries
                    const meshXMin = mesh.position.x - meshHalfLength;
                    const meshXMax = mesh.position.x + meshHalfLength;
                    const meshZMin = mesh.position.z - meshHalfWidth;
                    const meshZMax = mesh.position.z + meshHalfWidth;
                    
                    // Check for actual overlap (not just touching)
                    const xOverlap = meshXMax > xMin && meshXMin < xMax;
                    const zOverlap = meshZMax > zMin && meshZMin < zMax;
                    
                    if (xOverlap && zOverlap) {
                        // Additional check: ensure significant overlap (not just edge touching)
                        const overlapX = Math.min(meshXMax, xMax) - Math.max(meshXMin, xMin);
                        const overlapZ = Math.min(meshZMax, zMax) - Math.max(meshZMin, zMin);
                        
                        // Require at least 10% overlap in both dimensions to be considered "supported"
                        const minOverlapX = Math.min(meshData.length, supportData.length) * 0.1;
                        const minOverlapZ = Math.min(meshData.width, supportData.width) * 0.1;
                        
                        if (overlapX > minOverlapX && overlapZ > minOverlapZ) {
                            // This mesh is truly supported by our object
                            allObjects.add(mesh);
                            // Recursively find what this mesh supports
                            findSupported(mesh);
                        }
                    }
                }
            }
        };
        
        // Start the recursive search from the clicked object
        findSupported(clickedObject);
        
        // Convert set to array and sort by Y position (bottom to top)
        const objects = Array.from(allObjects);
        objects.sort((a, b) => a.position.y - b.position.y);
        
        return objects;
    }
    
    onMouseUp(event) {
        const wasDragging = this.isDragging;
        
        // Remove document-level listeners
        document.removeEventListener('mouseup', this.documentMouseUpHandler);
        document.removeEventListener('contextmenu', this.documentContextMenuHandler);
        
        // Store mouse up position for click event to check
        this.mouseUpPosition = { x: event.clientX, y: event.clientY };
        
        // Calculate total movement
        if (this.mouseDownPosition) {
            const dx = Math.abs(event.clientX - this.mouseDownPosition.x);
            const dy = Math.abs(event.clientY - this.mouseDownPosition.y);
            this.totalMouseMovement = Math.sqrt(dx * dx + dy * dy);
        }
        
        // Reset mouse tracking
        this.mouseDownPosition = null;
        this.potentialDragTarget = null;
        
        // Reset mouseHasMoved and totalMouseMovement after a longer delay 
        // to ensure click event AND setTimeout in click can check it
        // 350ms to be safe (click timeout is 300ms)
        setTimeout(() => {
            this.mouseHasMoved = false;
            this.totalMouseMovement = 0;
        }, 350);
        
        if (!this.isDragging) {
            // Re-enable controls if we're not dragging
            this.controls.enabled = true;
            return;
        }
        
        // Drop the objects - they're already in the correct position
        // Update their userData positions and isOutside flag
        this.draggedObjects.forEach(obj => {
            // Update userData position
            if (obj.userData) {
                obj.userData.position = {
                    x: obj.position.x,
                    y: obj.position.y,
                    z: obj.position.z
                };
                // Update isOutside flag based on current position
                obj.userData.isOutside = this.isPositionOutsideContainer(obj.position);
            }
        });
        
        // Notify cargo manager about position changes
        if (this.onCargoMoved) {
            this.onCargoMoved(this.draggedObjects.map(m => m.userData));
        }
        
        // Clean up dragging state
        this.isDragging = false;
        this.draggedObjects = [];
        this.originalPositions = [];
        this.lastValidPosition = null;
        this.dragPlane = null;
        
        // Hide ruler when done dragging
        this.hideRuler();
        
        // Re-enable controls after dragging
        this.controls.enabled = true;
        document.body.style.cursor = 'default';
        
        // Set flag to ignore next click event if we were dragging
        if (wasDragging) {
            this.ignoreNextClick = true;
            setTimeout(() => {
                this.ignoreNextClick = false;
            }, 100);
        }
    }
    
    onContextMenu(event) {
        event.preventDefault(); // Prevent default browser context menu
        
        // Remove document-level listeners when context menu is triggered
        document.removeEventListener('mouseup', this.documentMouseUpHandler);
        document.removeEventListener('contextmenu', this.documentContextMenuHandler);
        
        // If dragging, end the drag operation
        if (this.isDragging) {
            this.endDragging();
            return;
        }
        
        // If mouse has moved (camera rotation), don't show context menu
        if (this.mouseHasMoved) {
            this.hideContextMenu();
            return;
        }
        
        // Update mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Check if we clicked on a cargo item
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
        
        if (intersects.length > 0) {
            // We right-clicked on a cargo item
            const clickedMesh = intersects[0].object;
            this.showContextMenu(event.clientX, event.clientY, clickedMesh);
            
            // Show ruler and dimension labels for the right-clicked cargo only if inside container
            if (!this.isPositionOutsideContainer(clickedMesh.position)) {
                this.showRulerForCargo(clickedMesh);
                this.createDimensionLabels(clickedMesh);
            }
        } else {
            // Right-click on empty space - keep default orbit control behavior
            this.hideContextMenu();
            this.hideRuler();
        }
    }
    
    showContextMenu(x, y, mesh) {
        // Remove any existing context menu
        this.hideContextMenu();
        
        // Create context menu element
        const menu = document.createElement('div');
        menu.id = 'cargo-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px 0;
            box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 200px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const cargoData = mesh.userData;
        const isUnitOutside = this.isPositionOutsideContainer(mesh.position);
        
        // Check how many units from this group are inside the container
        const groupUnitsInside = this.cargoMeshes.filter(m => 
            m.userData && 
            m.userData.groupId === cargoData.groupId && 
            !this.isPositionOutsideContainer(m.position)
        ).length;
        
        // Group is selected AND has more than 1 unit inside container
        const isGroupSelected = this.selectedGroupId === cargoData.groupId && !isUnitOutside && groupUnitsInside > 1;
        
        // Add unit details section
        const detailsSection = document.createElement('div');
        detailsSection.style.cssText = `
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
            font-size: 12px;
            color: #666;
            ${isGroupSelected ? 'background: #e8f5e8;' : ''}
        `;
        
        // Check if it's a Roll and add orientation info
        let orientationInfo = '';
        if (cargoData.isRoll && !cargoData.fixedDiameter) {
            orientationInfo = `Orientacja: ${cargoData.isVerticalRoll ? '⬆ Pionowo' : '➡ Poziomo'}<br>`;
        }
        
        // Get group info if selected and unit is inside
        let groupInfo = '';
        if (isGroupSelected) {
            const groupMeshesInside = this.cargoMeshes.filter(m => 
                m.userData && 
                m.userData.groupId === cargoData.groupId && 
                !this.isPositionOutsideContainer(m.position)
            );
            groupInfo = `<div style="color: #10b981; font-weight: bold; margin-bottom: 4px;">✓ ZAZNACZONA GRUPA (${groupMeshesInside.length} szt. w przestrzeni)</div>`;
        }
        
        detailsSection.innerHTML = `
            ${groupInfo}
            <strong style="color: #333;">${cargoData.name || 'Jednostka'}</strong><br>
            Wymiary: ${(cargoData.length*100).toFixed(0)}×${(cargoData.width*100).toFixed(0)}×${(cargoData.height*100).toFixed(0)} cm<br>
            Waga: ${cargoData.weight} kg<br>
            ${orientationInfo}
            Piętrowanie: ${cargoData.maxStack || 0} szt.<br>
            Załadunek: ${this.formatMethods(cargoData.loadingMethods)}<br>
            Rozładunek: ${this.formatMethods(cargoData.unloadingMethods)}
        `;
        menu.appendChild(detailsSection);
        
        // Menu items
        const menuItems = [];
        
        // Check if this is a Steel Coil (cannot be rotated)
        const isSteelCoil = cargoData.type === 'steel-coil' || cargoData.fixedDiameter;
        
        if (isUnitOutside) {
            // Units outside container - only individual operations, no group operations
            // Steel Coils cannot be rotated
            if (!isSteelCoil) {
                menuItems.push(
                    { text: '↻ Obróć w prawo (90°)', action: () => this.rotateUnit(mesh, 90) },
                    { text: '↺ Obróć w lewo (-90°)', action: () => this.rotateUnit(mesh, -90) },
                    { text: '⟲ Obróć do góry (180°)', action: () => this.rotateUnit(mesh, 180) },
                    { separator: true }
                );
            }
            menuItems.push(
                { text: '🗑️ Usuń jednostkę', action: () => this.removeUnit(mesh), style: 'color: #dc3545;' }
            );
        } else if (isGroupSelected) {
            // Group operations - only for units inside container
            // Steel Coil groups cannot be rotated
            if (!isSteelCoil) {
                menuItems.push(
                    { text: '↻ Obróć grupę w prawo (90°)', action: () => this.rotateGroup(cargoData.groupId, 90), style: 'font-weight: bold; color: #10b981;' },
                    { text: '↺ Obróć grupę w lewo (-90°)', action: () => this.rotateGroup(cargoData.groupId, -90), style: 'font-weight: bold; color: #10b981;' },
                    { text: '⟲ Obróć grupę do góry (180°)', action: () => this.rotateGroup(cargoData.groupId, 180), style: 'font-weight: bold; color: #10b981;' },
                    { separator: true }
                );
            }
            menuItems.push(
                { text: '📦 Przenieś grupę poza przestrzeń', action: () => this.moveGroupOutsideContainer(cargoData.groupId), style: 'font-weight: bold; color: #10b981;' },
                { text: '🗑️ Usuń całą grupę', action: () => this.removeGroup(cargoData.groupId), style: 'font-weight: bold; color: #dc3545;' },
                { separator: true },
                { text: '❌ Odznacz grupę', action: () => this.onGroupDeselectionRequested && this.onGroupDeselectionRequested() }
            );
        } else {
            // Individual unit operations for units inside container
            // Only show "Select group" if group has more than 1 unit inside container
            if (groupUnitsInside > 1) {
                menuItems.push(
                    { text: '🎯 Zaznacz grupę', action: () => this.onGroupSelectionRequested && this.onGroupSelectionRequested(cargoData.groupId), style: 'font-weight: bold; color: #3b82f6;' },
                    { separator: true }
                );
            }
            
            // Steel Coils cannot be rotated
            if (!isSteelCoil) {
                menuItems.push(
                    { text: '↻ Obróć w prawo (90°)', action: () => this.rotateUnit(mesh, 90) },
                    { text: '↺ Obróć w lewo (-90°)', action: () => this.rotateUnit(mesh, -90) },
                    { text: '⟲ Obróć do góry (180°)', action: () => this.rotateUnit(mesh, 180) },
                    { separator: true }
                );
            }
            menuItems.push(
                { text: '📦 Przenieś poza przestrzeń', action: () => this.moveOutsideContainer(mesh) },
                { text: '🗑️ Usuń jednostkę', action: () => this.removeUnit(mesh), style: 'color: #dc3545;' }
            );
        }
        
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = 'border-top: 1px solid #eee; margin: 4px 0;';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 14px;
                    ${item.style || ''}
                `;
                menuItem.textContent = item.text;
                menuItem.onmouseover = () => menuItem.style.backgroundColor = '#f0f0f0';
                menuItem.onmouseout = () => menuItem.style.backgroundColor = 'transparent';
                menuItem.onclick = () => {
                    item.action();
                    this.hideContextMenu();
                };
                menu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(menu);
        
        // Add click outside listener to close menu
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenuHandler);
            document.addEventListener('contextmenu', this.hideContextMenuHandler);
        }, 100);
    }
    
    hideContextMenu() {
        const menu = document.getElementById('cargo-context-menu');
        if (menu) {
            menu.remove();
        }
        document.removeEventListener('click', this.hideContextMenuHandler);
        document.removeEventListener('contextmenu', this.hideContextMenuHandler);
        
        // Hide ruler when closing context menu
        this.hideRuler();
    }
    
    hideContextMenuHandler = (e) => {
        const menu = document.getElementById('cargo-context-menu');
        if (menu && !menu.contains(e.target)) {
            this.hideContextMenu();
        }
    }
    
    rotateUnit(mesh, angle) {
        // Check if this is a Steel Coil - they cannot be rotated
        if (mesh.userData.type === 'steel-coil' || mesh.userData.fixedDiameter) {
            console.warn('Steel Coils cannot be rotated');
            return;
        }
        
        // Get the entire stack (units above AND below)
        const entireStack = this.findEntireStack(mesh.position);
        
        // Find the bottom unit of the stack (pivot point)
        const bottomUnit = entireStack[entireStack.length - 1]; // Last in sorted array is bottom
        
        // Rotate around Y axis (in radians)
        const radians = (angle * Math.PI) / 180;
        
        // Calculate rotated positions
        const testPositions = [];
        
        entireStack.forEach(unit => {
            // Calculate new position relative to bottom unit
            const relativeX = unit.position.x - bottomUnit.position.x;
            const relativeZ = unit.position.z - bottomUnit.position.z;
            
            let newX, newZ;
            let newLength = unit.userData.length;
            let newWidth = unit.userData.width;
            
            if (unit === bottomUnit) {
                // Bottom unit rotates in place
                newX = bottomUnit.position.x;
                newZ = bottomUnit.position.z;
            } else {
                // Other units rotate around the bottom unit
                const newRelativeX = relativeX * Math.cos(radians) - relativeZ * Math.sin(radians);
                const newRelativeZ = relativeX * Math.sin(radians) + relativeZ * Math.cos(radians);
                newX = bottomUnit.position.x + newRelativeX;
                newZ = bottomUnit.position.z + newRelativeZ;
            }
            
            // Swap dimensions if rotating 90 or -90 degrees
            if (Math.abs(angle) === 90) {
                newLength = unit.userData.width;
                newWidth = unit.userData.length;
            }
            
            testPositions.push({
                unit: unit,
                newX: newX,
                newZ: newZ,
                newLength: newLength,
                newWidth: newWidth,
                y: unit.position.y
            });
        });
        
        // Find a valid position for the rotated stack
        const adjustedPositions = this.findValidPositionForRotatedStack(testPositions, entireStack);
        
        // Apply the rotation and adjusted positions
        adjustedPositions.forEach(test => {
            const unit = test.unit;
            
            // Update position
            unit.position.x = test.newX;
            unit.position.z = test.newZ;
            
            // Update rotation
            unit.rotation.y += radians;
            
            // Update dimensions in userData
            if (Math.abs(angle) === 90) {
                const tempLength = unit.userData.length;
                unit.userData.length = unit.userData.width;
                unit.userData.width = tempLength;
            }
            
            // Update userData position
            unit.userData.position = {
                x: unit.position.x,
                y: unit.position.y,
                z: unit.position.z
            };
        });
        
        // Notify about changes
        if (this.onCargoMoved) {
            this.onCargoMoved(entireStack.map(m => m.userData));
        }
    }
    
    findValidPositionForRotatedStack(testPositions, entireStack) {
        // Check if current position is valid
        if (this.isValidStackPosition(testPositions, entireStack)) {
            return testPositions;
        }
        
        // Find the bounding box of the rotated stack
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        testPositions.forEach(test => {
            const halfLength = test.newLength / 2;
            const halfWidth = test.newWidth / 2;
            minX = Math.min(minX, test.newX - halfLength);
            maxX = Math.max(maxX, test.newX + halfLength);
            minZ = Math.min(minZ, test.newZ - halfWidth);
            maxZ = Math.max(maxZ, test.newZ + halfWidth);
        });
        
        const stackWidth = maxX - minX;
        const stackDepth = maxZ - minZ;
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Try different offsets to find a valid position
        const searchRadius = 5; // Search within 5 meters
        const searchStep = 0.1; // 10cm steps
        let bestPosition = null;
        let minDistance = Infinity;
        
        // Search in a spiral pattern outward from current position
        for (let radius = 0; radius <= searchRadius; radius += searchStep) {
            const angles = radius === 0 ? [0] : Array.from({length: 36}, (_, i) => (i * 10 * Math.PI) / 180);
            
            for (let angle of angles) {
                const offsetX = radius * Math.cos(angle);
                const offsetZ = radius * Math.sin(angle);
                
                // Create test positions with offset
                const offsetPositions = testPositions.map(test => ({
                    ...test,
                    newX: test.newX + offsetX,
                    newZ: test.newZ + offsetZ
                }));
                
                if (this.isValidStackPosition(offsetPositions, entireStack)) {
                    const distance = Math.sqrt(offsetX * offsetX + offsetZ * offsetZ);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestPosition = offsetPositions;
                    }
                    
                    // If we found a very close position, use it immediately
                    if (distance < 0.2) {
                        return bestPosition;
                    }
                }
            }
            
            // If we found any valid position within current radius, use it
            if (bestPosition) {
                return bestPosition;
            }
        }
        
        // If no valid position found, try to at least keep it inside container
        if (!bestPosition) {
            bestPosition = this.adjustToContainerBounds(testPositions);
        }
        
        return bestPosition || testPositions;
    }
    
    isValidStackPosition(testPositions, entireStack) {
        // Check container bounds
        if (this.containerBounds) {
            for (let test of testPositions) {
                const halfLength = test.newLength / 2;
                const halfWidth = test.newWidth / 2;
                
                if (test.newX - halfLength < this.containerBounds.min.x ||
                    test.newX + halfLength > this.containerBounds.max.x ||
                    test.newZ - halfWidth < this.containerBounds.min.z ||
                    test.newZ + halfWidth > this.containerBounds.max.z) {
                    return false;
                }
            }
        }
        
        // Check collisions with other cargo
        for (let test of testPositions) {
            const halfLength = test.newLength / 2;
            const halfWidth = test.newWidth / 2;
            const halfHeight = test.unit.userData.height / 2;
            
            for (let otherMesh of this.cargoMeshes) {
                // Skip units in the current stack
                if (entireStack.includes(otherMesh)) continue;
                
                const otherData = otherMesh.userData;
                const otherHalfLength = otherData.length / 2;
                const otherHalfWidth = otherData.width / 2;
                const otherHalfHeight = otherData.height / 2;
                
                // Check for overlap
                // Use <= to check for overlap or touching
                const overlapX = Math.abs(test.newX - otherMesh.position.x) <= (halfLength + otherHalfLength);
                const overlapZ = Math.abs(test.newZ - otherMesh.position.z) <= (halfWidth + otherHalfWidth);
                const overlapY = Math.abs(test.y - otherMesh.position.y) <= (halfHeight + otherHalfHeight);
                
                if (overlapX && overlapZ && overlapY) {
                    // Check if units are truly overlapping (not just touching)
                    const xDistance = Math.abs(test.newX - otherMesh.position.x);
                    const zDistance = Math.abs(test.newZ - otherMesh.position.z);
                    const xSum = halfLength + otherHalfLength;
                    const zSum = halfWidth + otherHalfWidth;
                    
                    // Units are overlapping if distance is less than sum of half-dimensions
                    // Allow exact touching (distance == sum) with small tolerance
                    const xOverlapping = xDistance < (xSum - 0.001);
                    const zOverlapping = zDistance < (zSum - 0.001);
                    
                    if (xOverlapping && zOverlapping) {
                        return false; // Units are overlapping
                    }
                }
            }
        }
        
        return true;
    }
    
    adjustToContainerBounds(testPositions) {
        if (!this.containerBounds) return testPositions;
        
        // Find how much we need to shift to fit inside container
        let shiftX = 0;
        let shiftZ = 0;
        
        testPositions.forEach(test => {
            const halfLength = test.newLength / 2;
            const halfWidth = test.newWidth / 2;
            
            if (test.newX - halfLength < this.containerBounds.min.x) {
                shiftX = Math.max(shiftX, this.containerBounds.min.x - (test.newX - halfLength));
            }
            if (test.newX + halfLength > this.containerBounds.max.x) {
                shiftX = Math.min(shiftX, this.containerBounds.max.x - (test.newX + halfLength));
            }
            if (test.newZ - halfWidth < this.containerBounds.min.z) {
                shiftZ = Math.max(shiftZ, this.containerBounds.min.z - (test.newZ - halfWidth));
            }
            if (test.newZ + halfWidth > this.containerBounds.max.z) {
                shiftZ = Math.min(shiftZ, this.containerBounds.max.z - (test.newZ + halfWidth));
            }
        });
        
        // Apply the shift
        return testPositions.map(test => ({
            ...test,
            newX: test.newX + shiftX,
            newZ: test.newZ + shiftZ
        }));
    }
    
    moveOutsideContainer(mesh) {
        // Get all units in the stack
        const entireStack = this.findEntireStack(mesh.position);
        
        // Find which unit was clicked and its index in the stack
        const clickedIndex = entireStack.findIndex(unit => unit === mesh);
        
        // Split the stack into units to move and units that should fall
        const unitsToMove = entireStack.slice(0, clickedIndex + 1); // From top to clicked unit (inclusive)
        const unitsToFall = entireStack.slice(clickedIndex + 1); // Units below clicked unit
        
        // Get container bounds
        if (this.containerBounds) {
            // Track positions of units already outside
            if (!this.outsideUnitsPositions) {
                this.outsideUnitsPositions = [];
            }
            
            // Find next available position below container
            const offset = 2; // Move 2 meters below container
            const baseZ = this.containerBounds.max.z + offset;
            
            // Find next available X position
            let newX = this.containerBounds.min.x;
            let newZ = baseZ + mesh.userData.width / 2;
            
            // Check for overlaps with units already outside
            let positionFound = false;
            let currentRow = 0;
            const spacing = 0.1; // 10cm spacing between units
            
            while (!positionFound) {
                // Calculate position for current attempt
                newZ = baseZ + currentRow * 3 + mesh.userData.width / 2; // 3m between rows
                
                // Check all positions in current row
                let foundSpot = false;
                for (let xOffset = 0; xOffset < this.containerBounds.max.x - this.containerBounds.min.x + 10; xOffset += 0.5) {
                    newX = this.containerBounds.min.x + xOffset;
                    
                    // Check if this position overlaps with any existing outside units
                    let hasOverlap = false;
                    for (let otherMesh of this.cargoMeshes) {
                        // Skip units that are inside container
                        if (otherMesh.position.z < this.containerBounds.max.z) continue;
                        // Skip units in the current stack
                        if (unitsToMove.includes(otherMesh)) continue;
                        
                        const xOverlap = Math.abs(newX - otherMesh.position.x) < 
                                       (mesh.userData.length / 2 + otherMesh.userData.length / 2 + spacing);
                        const zOverlap = Math.abs(newZ - otherMesh.position.z) < 
                                       (mesh.userData.width / 2 + otherMesh.userData.width / 2 + spacing);
                        
                        if (xOverlap && zOverlap) {
                            hasOverlap = true;
                            break;
                        }
                    }
                    
                    if (!hasOverlap) {
                        foundSpot = true;
                        positionFound = true;
                        break;
                    }
                }
                
                if (!foundSpot) {
                    currentRow++;
                    if (currentRow > 10) { // Safety limit
                        // Fallback to stacking if too many rows
                        newX = this.containerBounds.min.x;
                        newZ = baseZ + mesh.userData.width / 2;
                        positionFound = true;
                    }
                }
            }
            
            // Move the selected unit and all units above it to the new position
            unitsToMove.forEach((unit, index) => {
                unit.position.x = newX;
                unit.position.z = newZ;
                unit.position.y = unit.userData.height / 2 + index * unit.userData.height; // Stack them vertically
                
                // Update userData position and mark as outside
                unit.userData.position = {
                    x: unit.position.x,
                    y: unit.position.y,
                    z: unit.position.z
                };
                unit.userData.isOutside = true; // Mark unit as outside the container
            });
            
            // Make units below fall to ground or onto other units
            if (unitsToFall.length > 0) {
                this.makeUnitsFall(unitsToFall);
            }
            
            // Notify about changes for all affected units
            const allAffectedUnits = [...unitsToMove, ...unitsToFall];
            if (this.onCargoMoved) {
                this.onCargoMoved(allAffectedUnits.map(m => m.userData));
            }
        }
    }
    
    makeUnitsFall(unitsToFall) {
        // Sort units by Y position (bottom to top) to process them in order
        unitsToFall.sort((a, b) => a.position.y - b.position.y);
        
        // Get trailer height
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.1;
        
        unitsToFall.forEach(unit => {
            const unitData = unit.userData;
            const halfHeight = unitData.height / 2;
            const halfLength = unitData.length / 2;
            const halfWidth = unitData.width / 2;
            
            // Check if unit is inside or outside container
            const isOutside = this.isPositionOutsideContainer(unit.position);
            
            // Start from current position and find where it should land
            // If inside container, ground is at trailer height, otherwise at 0
            let landingY = isOutside ? halfHeight : (trailerHeight + halfHeight);
            
            // Check all other cargo to see if we can land on something
            for (let otherMesh of this.cargoMeshes) {
                // Skip self and units that are also falling (will be processed later)
                if (otherMesh === unit || unitsToFall.includes(otherMesh)) continue;
                
                const otherData = otherMesh.userData;
                const otherTop = otherMesh.position.y + otherData.height / 2;
                
                // Check if we're above this unit and can land on it
                if (unit.position.y > otherTop) {
                    // Check X/Z overlap
                    const overlapX = Math.abs(unit.position.x - otherMesh.position.x) < 
                                   (halfLength + otherData.length / 2 - 0.01);
                    const overlapZ = Math.abs(unit.position.z - otherMesh.position.z) < 
                                   (halfWidth + otherData.width / 2 - 0.01);
                    
                    if (overlapX && overlapZ) {
                        // We can land on this unit
                        const potentialLandingY = otherTop + halfHeight;
                        if (potentialLandingY > landingY && potentialLandingY < unit.position.y) {
                            landingY = potentialLandingY;
                        }
                    }
                }
            }
            
            // Update the unit's Y position
            unit.position.y = landingY;
            
            // Update userData position
            unit.userData.position = {
                x: unit.position.x,
                y: unit.position.y,
                z: unit.position.z
            };
        });
    }
    
    removeUnit(mesh) {
        // Get all units above this one (they will fall down)
        const unitsAbove = this.getAllObjectsAbove(mesh).filter(u => u !== mesh);
        
        // Remove the selected unit from scene and cargo meshes array
        // Don't manually remove from cargoMeshes - let removeCargo handle it
        this.removeCargo(mesh);
        
        // Make units above fall down
        if (unitsAbove.length > 0) {
            this.makeUnitsFall(unitsAbove);
        }
        
        // Notify about removal
        if (this.onCargoRemoved) {
            this.onCargoRemoved(mesh.userData);
            
            // Also notify about units that fell
            if (unitsAbove.length > 0 && this.onCargoMoved) {
                this.onCargoMoved(unitsAbove.map(m => m.userData));
            }
        }
    }
    
    updateAxleLoads() {
        // Update timestamp
        this.lastAxleUpdate = Date.now();
        
        // Temporarily update cargoManager positions for axle calculation
        const tempUpdatedCargo = this.draggedObjects.map(obj => ({
            ...obj.userData,
            position: {
                x: obj.position.x,
                y: obj.position.y,
                z: obj.position.z
            }
        }));
        
        // Call the update callback
        if (this.onAxleUpdateNeeded) {
            this.onAxleUpdateNeeded(tempUpdatedCargo);
        }
    }
    
    handleDragging() {
        if (!this.dragPlane || this.draggedObjects.length === 0) return;
        
        // Calculate new position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersectPoint = new THREE.Vector3();
        
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            const targetPosition = intersectPoint.add(this.dragOffset);
            
            // Free movement in X and Z axes
            targetPosition.y = this.draggedObjects[0].position.y; // Temporary Y
            
            // Check if the unit is currently outside the container
            const isOutsideContainer = this.isPositionOutsideContainer(this.draggedObjects[0].position);
            
            // Check if dragging a steel coil in Coilmulde
            const draggedItem = this.draggedObjects[0].userData;
            const isCoilInGroove = draggedItem && draggedItem.fixedDiameter && 
                                  this.containerBounds && this.containerBounds.hasGroove;
            
            if (isOutsideContainer) {
                // Unit is outside container - allow free movement
                const targetOutside = this.isPositionOutsideContainer(targetPosition);
                
                if (targetOutside) {
                    // Moving outside to outside - free movement in X/Z, but check Y stacking
                    const finalPosition = this.calculateDropPosition(targetPosition);
                    
                    // For units outside, we only validate stacking (Y position)
                    // Allow free movement in X/Z plane
                    let canMove = true;
                    
                    // Check if we're trying to stack on something
                    const isStackingOnSomething = Math.abs(finalPosition.y - targetPosition.y) > 0.1;
                    if (isStackingOnSomething) {
                        // Only check stacking validity if we're actually stacking
                        canMove = this.canStackAtPosition !== false;
                    }
                    
                    if (canMove) {
                        // Move all dragged objects
                        const deltaX = finalPosition.x - this.draggedObjects[0].position.x;
                        const deltaY = finalPosition.y - this.draggedObjects[0].position.y;
                        const deltaZ = finalPosition.z - this.draggedObjects[0].position.z;
                        
                        this.draggedObjects.forEach(obj => {
                            obj.position.x += deltaX;
                            obj.position.y += deltaY;
                            obj.position.z += deltaZ;
                        });
                    }
                    // If not valid stacking, units stay at their current position
                    
                    // No ruler for units outside container
                    this.hideRuler();
                } else {
                    // Trying to move from outside to inside - apply normal container rules
                    let clampedPosition;
                    if (isCoilInGroove) {
                        clampedPosition = this.clampToGrooveBounds(targetPosition);
                    } else {
                        clampedPosition = this.clampToContainerBounds(targetPosition);
                    }
                    
                    const finalPosition = this.calculateDropPosition(clampedPosition);
                    const isValidPosition = this.checkValidPosition(finalPosition) && (this.canStackAtPosition !== false);
                    
                    if (isValidPosition) {
                        const deltaX = finalPosition.x - this.draggedObjects[0].position.x;
                        const deltaY = finalPosition.y - this.draggedObjects[0].position.y;
                        const deltaZ = finalPosition.z - this.draggedObjects[0].position.z;
                        
                        this.draggedObjects.forEach(obj => {
                            obj.position.x += deltaX;
                            obj.position.y += deltaY;
                            obj.position.z += deltaZ;
                        });
                        
                        this.lastValidPosition = finalPosition.clone();
                        this.showRulerForCargo(this.draggedObjects[0]);
                    }
                    // If not valid, unit stays outside (doesn't enter container)
                }
            } else {
                // Unit is inside container - apply normal restrictions
                let clampedPosition;
                if (isCoilInGroove) {
                    // Restrict steel coil movement to groove
                    clampedPosition = this.clampToGrooveBounds(targetPosition);
                } else {
                    // Regular clamping to container bounds
                    clampedPosition = this.clampToContainerBounds(targetPosition);
                }
                
                // Find the correct Y position (ground or on top of another unit)
                const finalPosition = this.calculateDropPosition(clampedPosition);
                
                // Check if position is valid (no collisions with other units)
                const isValidPosition = this.checkValidPosition(finalPosition) && (this.canStackAtPosition !== false);
                
                
                if (isValidPosition) {
                    // Valid position - move all dragged objects
                    const deltaX = finalPosition.x - this.draggedObjects[0].position.x;
                    const deltaY = finalPosition.y - this.draggedObjects[0].position.y;
                    const deltaZ = finalPosition.z - this.draggedObjects[0].position.z;
                    
                    
                    this.draggedObjects.forEach(obj => {
                        obj.position.x += deltaX;
                        obj.position.y += deltaY;
                        obj.position.z += deltaZ;
                    });
                    
                    // Store this as last valid position
                    this.lastValidPosition = finalPosition.clone();
                    
                    // Update ruler and dimension labels position
                    this.showRulerForCargo(this.draggedObjects[0]);
                    this.createDimensionLabels(this.draggedObjects[0]);
                } else {
                    // Position is invalid - try to find closest valid position along the path
                    const slidePosition = this.findSlidePosition(targetPosition, clampedPosition);
                    
                    if (slidePosition) {
                        // Found a valid slide position
                        const deltaX = slidePosition.x - this.draggedObjects[0].position.x;
                        const deltaY = slidePosition.y - this.draggedObjects[0].position.y;
                        const deltaZ = slidePosition.z - this.draggedObjects[0].position.z;
                        
                        this.draggedObjects.forEach(obj => {
                            obj.position.x += deltaX;
                            obj.position.y += deltaY;
                            obj.position.z += deltaZ;
                        });
                        
                        // Update ruler and dimension labels position for slide position
                        this.showRulerForCargo(this.draggedObjects[0]);
                        this.createDimensionLabels(this.draggedObjects[0]);
                        
                        // Store this as last valid position
                        this.lastValidPosition = slidePosition.clone();
                    }
                    // If no slide position found, objects stay at last valid position (sticky effect)
                }
            }
            
            // Update axle loads dynamically during dragging with throttling
            if (this.onAxleUpdateNeeded && !this.axleUpdatePending) {
                const now = Date.now();
                const timeSinceLastUpdate = now - this.lastAxleUpdate;
                
                if (timeSinceLastUpdate >= this.axleUpdateThrottle) {
                    // Update immediately if enough time has passed
                    this.updateAxleLoads();
                } else {
                    // Schedule update using requestAnimationFrame
                    this.axleUpdatePending = true;
                    requestAnimationFrame(() => {
                        this.updateAxleLoads();
                        this.axleUpdatePending = false;
                    });
                }
            }
        }
        
        document.body.style.cursor = 'grabbing';
    }
    
    findSlidePosition(targetPosition, clampedPosition) {
        // Try to find a valid position by sliding along obstacles
        if (!this.lastValidPosition) return null;
        
        const currentPos = this.draggedObjects[0].position.clone();
        const deltaX = clampedPosition.x - currentPos.x;
        const deltaZ = clampedPosition.z - currentPos.z;
        const distance = currentPos.distanceTo(clampedPosition);
        
        // If we're very close, don't bother sliding
        if (distance < 0.001) return null;
        
        // First, try to move directly to the target position
        const directDropPos = this.calculateDropPosition(clampedPosition);
        if (this.checkValidPosition(directDropPos) && (this.canStackAtPosition !== false)) {
            return directDropPos;
        }
        
        // Phase 1: Coarse search with smaller steps (5cm instead of 10cm)
        const coarseStepSize = 0.05; // 5cm steps
        const coarseSteps = Math.min(40, Math.ceil(distance / coarseStepSize));
        let lastValidPos = null;
        let collisionFraction = 1.0;
        
        for (let i = 1; i <= coarseSteps; i++) {
            const fraction = i / coarseSteps;
            const testPos = new THREE.Vector3(
                currentPos.x + deltaX * fraction,
                currentPos.y,
                currentPos.z + deltaZ * fraction
            );
            
            const dropPos = this.calculateDropPosition(testPos);
            if (this.checkValidPosition(dropPos) && (this.canStackAtPosition !== false)) {
                lastValidPos = dropPos;
            } else {
                // Found collision point
                collisionFraction = fraction;
                break;
            }
        }
        
        // Phase 2: Binary search refinement to get closer to obstacles
        if (lastValidPos && collisionFraction < 1.0) {
            // We found a collision, now refine using binary search
            let lowFraction = (collisionFraction * coarseSteps - 1) / coarseSteps; // Last valid position
            let highFraction = collisionFraction; // First invalid position
            const tolerance = 0.001 / distance; // 1mm tolerance relative to total distance
            
            // Binary search to find the exact boundary
            let iterations = 0;
            const maxIterations = 10; // Limit iterations for performance
            
            while (highFraction - lowFraction > tolerance && iterations < maxIterations) {
                const midFraction = (lowFraction + highFraction) / 2;
                const testPos = new THREE.Vector3(
                    currentPos.x + deltaX * midFraction,
                    currentPos.y,
                    currentPos.z + deltaZ * midFraction
                );
                
                const dropPos = this.calculateDropPosition(testPos);
                if (this.checkValidPosition(dropPos) && (this.canStackAtPosition !== false)) {
                    // Valid position, try to get closer
                    lowFraction = midFraction;
                    lastValidPos = dropPos;
                } else {
                    // Invalid position, back off
                    highFraction = midFraction;
                }
                
                iterations++;
            }
        }
        
        // If we found a valid position close to obstacle, use it
        if (lastValidPos) {
            return lastValidPos;
        }
        
        // Try sliding along axes when completely blocked
        // This creates the "sliding along walls" effect
        
        // Determine which axis has more movement
        const absX = Math.abs(deltaX);
        const absZ = Math.abs(deltaZ);
        
        // Try moving along the dominant axis first with binary search
        if (absX > absZ && absX > 0.001) {
            // Try moving only in X direction
            const xResult = this.binarySearchAxis(currentPos, clampedPosition.x, currentPos.z, true);
            if (xResult) return xResult;
        }
        
        if (absZ > 0.001) {
            // Try moving only in Z direction
            const zResult = this.binarySearchAxis(currentPos, currentPos.x, clampedPosition.z, false);
            if (zResult) return zResult;
        }
        
        // Try the other axis if the dominant one failed
        if (absZ > absX && absX > 0.001) {
            // Try X movement since Z was dominant but failed
            const xResult = this.binarySearchAxis(currentPos, clampedPosition.x, currentPos.z, true);
            if (xResult) return xResult;
        }
        
        return null; // No valid slide position found
    }
    
    // Helper method for binary search along a single axis
    binarySearchAxis(currentPos, targetX, targetZ, isXAxis) {
        const startValue = isXAxis ? currentPos.x : currentPos.z;
        const endValue = isXAxis ? targetX : targetZ;
        const delta = endValue - startValue;
        
        if (Math.abs(delta) < 0.001) return null;
        
        // First check if we can move all the way
        const fullPos = new THREE.Vector3(
            isXAxis ? endValue : currentPos.x,
            currentPos.y,
            isXAxis ? currentPos.z : endValue
        );
        const fullDropPos = this.calculateDropPosition(fullPos);
        if (this.checkValidPosition(fullDropPos) && (this.canStackAtPosition !== false)) {
            return fullDropPos;
        }
        
        // Binary search for the maximum valid position
        let lowFraction = 0;
        let highFraction = 1;
        let lastValidPos = null;
        const tolerance = 0.001 / Math.abs(delta); // 1mm tolerance
        let iterations = 0;
        const maxIterations = 10;
        
        while (highFraction - lowFraction > tolerance && iterations < maxIterations) {
            const midFraction = (lowFraction + highFraction) / 2;
            const testValue = startValue + delta * midFraction;
            
            const testPos = new THREE.Vector3(
                isXAxis ? testValue : currentPos.x,
                currentPos.y,
                isXAxis ? currentPos.z : testValue
            );
            
            const dropPos = this.calculateDropPosition(testPos);
            if (this.checkValidPosition(dropPos) && (this.canStackAtPosition !== false)) {
                lowFraction = midFraction;
                lastValidPos = dropPos;
            } else {
                highFraction = midFraction;
            }
            
            iterations++;
        }
        
        return lastValidPos;
    }
    
    isPositionOutsideContainer(position) {
        if (!this.containerBounds) return false;
        
        // Check if position is outside container bounds
        // We consider "outside" to be beyond the container in Z direction (below/behind)
        return position.z > this.containerBounds.max.z + 0.5; // Small margin
    }
    
    clampToGrooveBounds(position) {
        if (!this.containerBounds || !this.draggedObjects[0]) return position;
        
        const coilRadius = this.draggedObjects[0].userData.height / 2;
        const coilLength = this.draggedObjects[0].userData.length;
        
        const clamped = position.clone();
        
        // Calculate groove position in container coordinates
        const containerHalfLength = this.containerBounds.containerLength / 2;
        const grooveStartX = -containerHalfLength + this.containerBounds.grooveStartX;
        const grooveEndX = grooveStartX + this.containerBounds.grooveLength;
        
        // Restrict X movement within groove bounds
        const minX = grooveStartX + coilLength / 2;
        const maxX = grooveEndX - coilLength / 2;
        clamped.x = Math.max(minX, Math.min(maxX, position.x));
        
        // Force Z position to center of groove (coil can only move along X axis)
        clamped.z = 0;
        
        // Force Y position to groove depth
        clamped.y = -this.containerBounds.grooveDepth / 2 + coilRadius;
        
        return clamped;
    }
    
    clampToContainerBounds(position) {
        if (!this.containerBounds || !this.draggedObjects[0]) return position;
        
        // Find the maximum dimensions in the dragged stack
        let maxLength = 0;
        let maxWidth = 0;
        
        this.draggedObjects.forEach(obj => {
            maxLength = Math.max(maxLength, obj.userData.length);
            maxWidth = Math.max(maxWidth, obj.userData.width);
        });
        
        const halfLength = maxLength / 2;
        const halfWidth = maxWidth / 2;
        
        const clamped = position.clone();
        
        // Clamp X position to keep ALL units inside container
        const minX = this.containerBounds.min.x + halfLength;
        const maxX = this.containerBounds.max.x - halfLength;
        clamped.x = Math.max(minX, Math.min(maxX, position.x));
        
        // Clamp Z position to keep ALL units inside container
        const minZ = this.containerBounds.min.z + halfWidth;
        const maxZ = this.containerBounds.max.z - halfWidth;
        clamped.z = Math.max(minZ, Math.min(maxZ, position.z));
        
        // Ensure Y position doesn't go below ground
        clamped.y = Math.max(0, position.y);
        
        return clamped;
    }
    
    
    findPyramidStackingPosition(position, halfHeight, trailerHeight, isOutside) {
        const draggedData = this.draggedObjects[0].userData;
        
        // Only for vertical rolls
        if (!draggedData.isVerticalRoll) return null;
        
        const rollRadius = draggedData.width / 2;
        
        // Find all vertical rolls at ground level
        const groundRolls = [];
        for (let mesh of this.cargoMeshes) {
            if (this.draggedObjects.includes(mesh)) continue;
            
            const targetData = mesh.userData;
            if (!targetData.isVerticalRoll) continue;
            
            // Check if at ground level
            const expectedGroundY = isOutside ? targetData.height / 2 : (trailerHeight + targetData.height / 2);
            if (Math.abs(mesh.position.y - expectedGroundY) < 0.1) {
                groundRolls.push(mesh);
            }
        }
        
        // Try to find two adjacent rolls to stack between
        for (let i = 0; i < groundRolls.length; i++) {
            for (let j = i + 1; j < groundRolls.length; j++) {
                const roll1 = groundRolls[i];
                const roll2 = groundRolls[j];
                
                // Calculate distance between rolls
                const distance = Math.sqrt(
                    Math.pow(roll1.position.x - roll2.position.x, 2) +
                    Math.pow(roll1.position.z - roll2.position.z, 2)
                );
                
                // Check if rolls are adjacent (touching or nearly touching)
                const roll1Radius = roll1.userData.width / 2;
                const roll2Radius = roll2.userData.width / 2;
                const expectedDistance = roll1Radius + roll2Radius + rollRadius * 2;
                
                if (Math.abs(distance - (roll1Radius + roll2Radius)) < rollRadius * 2.2) {
                    // Calculate pyramid position (between the two rolls)
                    const midX = (roll1.position.x + roll2.position.x) / 2;
                    const midZ = (roll1.position.z + roll2.position.z) / 2;
                    
                    // Check if cursor is near this pyramid position
                    const cursorDistance = Math.sqrt(
                        Math.pow(position.x - midX, 2) +
                        Math.pow(position.z - midZ, 2)
                    );
                    
                    if (cursorDistance < rollRadius * 1.5) {
                        // Calculate stacking height
                        const baseHeight = Math.max(roll1.position.y, roll2.position.y);
                        const stackHeight = Math.sqrt(Math.pow(distance/2, 2) - Math.pow((distance - rollRadius*2)/2, 2)) * 0.8;
                        
                        return new THREE.Vector3(
                            midX,
                            baseHeight + stackHeight,
                            midZ
                        );
                    }
                }
            }
        }
        
        // Also check stacking between roll and wall
        if (this.containerBounds && !isOutside) {
            for (let roll of groundRolls) {
                const rollRadius = roll.userData.width / 2;
                
                // Check distance to walls
                const distToLeftWall = roll.position.x - this.containerBounds.minX;
                const distToRightWall = this.containerBounds.maxX - roll.position.x;
                const distToFrontWall = roll.position.z - this.containerBounds.minZ;
                const distToBackWall = this.containerBounds.maxZ - roll.position.z;
                
                // Check if roll is adjacent to a wall
                let wallPosition = null;
                let isNearWall = false;
                
                if (distToLeftWall < rollRadius * 1.5) {
                    wallPosition = new THREE.Vector3(
                        this.containerBounds.minX + rollRadius,
                        roll.position.y,
                        roll.position.z
                    );
                    isNearWall = true;
                } else if (distToRightWall < rollRadius * 1.5) {
                    wallPosition = new THREE.Vector3(
                        this.containerBounds.maxX - rollRadius,
                        roll.position.y,
                        roll.position.z
                    );
                    isNearWall = true;
                }
                
                if (isNearWall && wallPosition) {
                    // Check if cursor is near this position
                    const cursorDistance = Math.sqrt(
                        Math.pow(position.x - wallPosition.x, 2) +
                        Math.pow(position.z - wallPosition.z, 2)
                    );
                    
                    if (cursorDistance < rollRadius * 1.5) {
                        return wallPosition;
                    }
                }
            }
        }
        
        return null;
    }
    
    calculateDropPosition(position) {
        const draggedData = this.draggedObjects[0].userData;
        const halfHeight = draggedData.height / 2;
        
        // Get trailer height from container dimensions
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.1;
        
        // Check if position is outside container
        const isOutside = this.isPositionOutsideContainer(position);
        
        // Special handling for steel coils in Coilmulde
        if (draggedData.fixedDiameter && this.containerBounds && this.containerBounds.hasGroove && !isOutside) {
            // Steel coil (with fixedDiameter) must stay in groove
            const coilRadius = draggedData.height / 2;
            return new THREE.Vector3(
                position.x,
                trailerHeight - this.containerBounds.grooveDepth / 2 + coilRadius,
                0  // Always centered in groove
            );
        }
        
        // Find the maximum width and length in the stack for proper boundary checking
        let maxWidth = 0;
        let maxLength = 0;
        this.draggedObjects.forEach(obj => {
            maxWidth = Math.max(maxWidth, obj.userData.width);
            maxLength = Math.max(maxLength, obj.userData.length);
        });
        const halfWidth = maxWidth / 2;
        const halfLength = maxLength / 2;
        
        // Position is already clamped to container bounds, so just use it
        let adjustedPosition = position.clone();
        
        // Start with ground level - use trailer height only if inside container
        let targetY = isOutside ? halfHeight : (trailerHeight + halfHeight);
        let snapPosition = null;
        let canStack = true;
        let isStacking = false;
        
        // Find the closest unit for side snapping
        let closestUnit = null;
        let closestDistance = Infinity;
        // Different thresholds for different unit types
        // Reduced threshold to avoid interfering with stacking
        const snapThreshold = draggedData.isVerticalRoll ? 0.1 : 0.5; // Rolls: 10cm, others: 50cm
        
        
        // Special handling for vertical rolls - they can stack in pyramid formation
        if (draggedData.isVerticalRoll) {
            const pyramidPosition = this.findPyramidStackingPosition(position, halfHeight, trailerHeight, isOutside);
            if (pyramidPosition) {
                return pyramidPosition;
            }
        }
        
        // Check all cargo meshes for stacking or side snapping
        for (let mesh of this.cargoMeshes) {
            // Skip the dragged objects
            if (this.draggedObjects.includes(mesh)) continue;
            
            const targetData = mesh.userData;
            const targetHalfWidth = targetData.width / 2;
            const targetHalfLength = targetData.length / 2;
            const targetHalfHeight = targetData.height / 2;
            
            // Check if cursor is over this unit (for stacking)
            // Check if the cursor position itself is within the target unit's bounds
            const xDistance = Math.abs(adjustedPosition.x - mesh.position.x);
            const zDistance = Math.abs(adjustedPosition.z - mesh.position.z);
            
            // Check if cursor is directly over the target unit's surface
            const cursorOverX = xDistance <= targetHalfLength;
            const cursorOverZ = zDistance <= targetHalfWidth;
            
            // Prioritize stacking only if cursor is directly over the unit
            if (cursorOverX && cursorOverZ) {
                // We're over the unit - try to stack on top
                // Calculate the Y position on top of this unit
                const stackY = mesh.position.y + targetHalfHeight + halfHeight;
                
                // Removed verbose stacking log
                
                // If this unit is at or above our current target height
                if (mesh.position.y + targetHalfHeight >= targetY - halfHeight) {
                    // Create a proposed position for stacking
                    const proposedStackPosition = new THREE.Vector3(
                        adjustedPosition.x,  // Keep the cursor X position
                        stackY,
                        adjustedPosition.z   // Keep the cursor Z position
                    );
                    
                    // First clamp position to ensure unit stays within bounds of target
                    const clampedX = Math.max(
                        mesh.position.x - targetHalfLength + halfLength,
                        Math.min(
                            adjustedPosition.x,
                            mesh.position.x + targetHalfLength - halfLength
                        )
                    );
                    const clampedZ = Math.max(
                        mesh.position.z - targetHalfWidth + halfWidth,
                        Math.min(
                            adjustedPosition.z,
                            mesh.position.z + targetHalfWidth - halfWidth
                        )
                    );
                    
                    // Now check if we can place at the clamped position
                    const clampedStackPosition = new THREE.Vector3(
                        clampedX,
                        stackY,
                        clampedZ
                    );
                    
                    const canPlaceHere = this.canPlaceOnSurface(draggedData, mesh, clampedStackPosition);
                    
                    if (canPlaceHere) {
                        // Stack on top at the clamped position
                        targetY = stackY;
                        
                        // Only snap if we had to adjust the position
                        if (Math.abs(clampedX - adjustedPosition.x) > 0.01 || 
                            Math.abs(clampedZ - adjustedPosition.z) > 0.01) {
                            snapPosition = {
                                x: clampedX,
                                z: clampedZ
                            };
                        } else {
                            snapPosition = null; // Position is already valid
                        }
                        
                        canStack = true;
                        isStacking = true;
                    } else {
                        // Can't stack at this position
                        // Only search for alternative position if we're truly trying to stack on top
                        // (not when placing side-by-side on the same floor)
                        
                        // Check if there are other units at the same Y level that might be blocking
                        let hasCollisionOnSameFloor = false;
                        for (let otherMesh of this.cargoMeshes) {
                            if (this.draggedObjects.includes(otherMesh) || otherMesh === mesh) continue;
                            
                            // Check if other unit is at the same Y level as our proposed position
                            if (Math.abs(otherMesh.position.y - stackY) < 0.1) {
                                const otherData = otherMesh.userData;
                                const otherHalfLength = otherData.length / 2;
                                const otherHalfWidth = otherData.width / 2;
                                
                                // Check if it would collide at the clamped position
                                const xDist = Math.abs(clampedX - otherMesh.position.x);
                                const zDist = Math.abs(clampedZ - otherMesh.position.z);
                                
                                if (xDist < (halfLength + otherHalfLength - 0.001) &&
                                    zDist < (halfWidth + otherHalfWidth - 0.001)) {
                                    hasCollisionOnSameFloor = true;
                                    break;
                                }
                            }
                        }
                        
                        // Only search for alternative position if we're stacking on top of a unit
                        // and the collision is not with units on the same floor
                        if (!hasCollisionOnSameFloor) {
                            const validPosition = this.findValidStackPosition(draggedData, mesh, adjustedPosition);
                            if (validPosition) {
                                targetY = stackY;
                                snapPosition = {
                                    x: validPosition.x,
                                    z: validPosition.z
                                };
                                canStack = true;
                                isStacking = true;
                            }
                        }
                        // If collision is on same floor, don't try to find alternative position
                        // This prevents the "bouncing" effect
                    }
                }
            } else {
                // Not over this unit - check for side snapping
                const distance = Math.sqrt(
                    Math.pow(adjustedPosition.x - mesh.position.x, 2) + 
                    Math.pow(adjustedPosition.z - mesh.position.z, 2)
                );
                
                // Only consider units at ground level for side snapping
                // Check if mesh is at ground level (considering trailer height if inside container)
                const meshIsOutside = this.isPositionOutsideContainer(mesh.position);
                const expectedGroundY = meshIsOutside ? targetData.height / 2 : (trailerHeight + targetData.height / 2);
                const isGroundLevel = Math.abs(mesh.position.y - expectedGroundY) < 0.1;
                
                // Also check if we're NOT currently above a higher unit (to avoid side-snapping when we should be stacking)
                const notAboveHigherUnit = !isStacking || mesh.position.y < targetY - halfHeight;
                
                if (isGroundLevel && distance < closestDistance && notAboveHigherUnit) {
                    closestDistance = distance;
                    closestUnit = mesh;
                }
            }
        }
        
        // If not stacking and we have a very close unit, snap to its side
        // Additional check: make sure we're really trying to place beside, not on top
        const reallyCloseToBeside = closestDistance < snapThreshold * 0.7;
        if (!isStacking && closestUnit && reallyCloseToBeside) {
            const targetData = closestUnit.userData;
            const targetHalfWidth = targetData.width / 2;
            const targetHalfLength = targetData.length / 2;
            
            // Check if both units are vertical rolls
            const bothAreRolls = draggedData.isVerticalRoll && targetData.isVerticalRoll;
            
            if (bothAreRolls) {
                // For roll-to-roll, don't snap - allow free positioning
                // Only suggest snapping if very close to touching
                const targetRadius = targetData.diameter / 2;
                const draggedRadius = draggedData.diameter / 2;
                const desiredDistance = targetRadius + draggedRadius;
                
                const dx = adjustedPosition.x - closestUnit.position.x;
                const dz = adjustedPosition.z - closestUnit.position.z;
                const currentDistance = Math.sqrt(dx * dx + dz * dz);
                
                // Only snap if we're very close to the perfect touching distance (within 5cm)
                if (Math.abs(currentDistance - desiredDistance) < 0.05) {
                    const angle = Math.atan2(dz, dx);
                    snapPosition = {
                        x: closestUnit.position.x + desiredDistance * Math.cos(angle),
                        z: closestUnit.position.z + desiredDistance * Math.sin(angle)
                    };
                }
                // Otherwise, no snapping - free movement
            } else {
                // Original snapping logic for non-roll units
                // Calculate which side of the target unit we're closest to
                const dx = adjustedPosition.x - closestUnit.position.x;
                const dz = adjustedPosition.z - closestUnit.position.z;
                
                // Determine snap position based on which side is closest
                let snapX = adjustedPosition.x;
                let snapZ = adjustedPosition.z;
                
                // Check X axis (left/right sides)
                if (Math.abs(dx) > Math.abs(dz)) {
                    // Snap to left or right side
                    if (dx > 0) {
                        // Snap to right side of target
                        snapX = closestUnit.position.x + targetHalfLength + halfLength;
                    } else {
                        // Snap to left side of target
                        snapX = closestUnit.position.x - targetHalfLength - halfLength;
                    }
                    // Align Z position if close enough
                    if (Math.abs(dz) < targetHalfWidth + halfWidth) {
                        snapZ = closestUnit.position.z;
                    }
                } else {
                    // Snap to front or back side
                    if (dz > 0) {
                        // Snap to back side of target
                        snapZ = closestUnit.position.z + targetHalfWidth + halfWidth;
                    } else {
                        // Snap to front side of target
                        snapZ = closestUnit.position.z - targetHalfWidth - halfWidth;
                    }
                    // Align X position if close enough
                    if (Math.abs(dx) < targetHalfLength + halfLength) {
                        snapX = closestUnit.position.x;
                    }
                }
                
                snapPosition = { x: snapX, z: snapZ };
            }
            // Ground level for side placement - use trailer height if inside container
            targetY = isOutside ? halfHeight : (trailerHeight + halfHeight);
            canStack = true; // Side placement is always valid
        }
        
        // Store whether stacking is valid for color coding
        this.canStackAtPosition = canStack;
        
        // Return position with correct Y and snapped X/Z if needed
        const finalPosition = adjustedPosition;
        finalPosition.y = targetY;
        
        if (snapPosition) {
            finalPosition.x = snapPosition.x;
            finalPosition.z = snapPosition.z;
        }
        
        return finalPosition;
    }
    
    canFitOnTop(draggedData, targetData, draggedPosition, targetPosition) {
        // Check if dragged unit can fit on top of target at the given position
        // If positions are not provided, use simple dimension comparison (backward compatibility)
        if (!draggedPosition || !targetPosition) {
            // Old logic - simple dimension comparison
            const lengthFits = draggedData.length <= targetData.length;
            const widthFits = draggedData.width <= targetData.width;
            return lengthFits && widthFits;
        }
        
        // New logic - check if unit fits within the bounds at the specific position
        const draggedHalfLength = draggedData.length / 2;
        const draggedHalfWidth = draggedData.width / 2;
        const targetHalfLength = targetData.length / 2;
        const targetHalfWidth = targetData.width / 2;
        
        // Calculate the edges of dragged unit at the proposed position
        const draggedMinX = draggedPosition.x - draggedHalfLength;
        const draggedMaxX = draggedPosition.x + draggedHalfLength;
        const draggedMinZ = draggedPosition.z - draggedHalfWidth;
        const draggedMaxZ = draggedPosition.z + draggedHalfWidth;
        
        // Calculate the edges of target unit
        const targetMinX = targetPosition.x - targetHalfLength;
        const targetMaxX = targetPosition.x + targetHalfLength;
        const targetMinZ = targetPosition.z - targetHalfWidth;
        const targetMaxZ = targetPosition.z + targetHalfWidth;
        
        // Check if dragged unit is completely within target unit bounds
        // Use very small tolerance to prevent units from extending beyond edges
        const tolerance = 0.01; // 1cm tolerance - strict but allows for floating point errors
        const fitsInX = draggedMinX >= targetMinX - tolerance && draggedMaxX <= targetMaxX + tolerance;
        const fitsInZ = draggedMinZ >= targetMinZ - tolerance && draggedMaxZ <= targetMaxZ + tolerance;
        
        return fitsInX && fitsInZ;
    }
    
    findValidStackPosition(draggedData, targetMesh, desiredPosition) {
        // Try to find a valid position on the target surface near the desired position
        const targetData = targetMesh.userData;
        const targetPosition = targetMesh.position;
        const targetHalfLength = targetData.length / 2;
        const targetHalfWidth = targetData.width / 2;
        const targetHalfHeight = targetData.height / 2;
        const draggedHalfLength = draggedData.length / 2;
        const draggedHalfWidth = draggedData.width / 2;
        const draggedHalfHeight = draggedData.height / 2;
        
        const stackY = targetPosition.y + targetHalfHeight + draggedHalfHeight;
        
        // First try the exact desired position
        const exactPos = new THREE.Vector3(desiredPosition.x, stackY, desiredPosition.z);
        if (this.canPlaceOnSurface(draggedData, targetMesh, exactPos)) {
            return exactPos;
        }
        
        // If the exact position doesn't work, try to clamp to valid bounds
        // This helps when dragging near edges
        const clampedX = Math.max(
            targetPosition.x - targetHalfLength + draggedHalfLength,
            Math.min(
                desiredPosition.x,
                targetPosition.x + targetHalfLength - draggedHalfLength
            )
        );
        const clampedZ = Math.max(
            targetPosition.z - targetHalfWidth + draggedHalfWidth,
            Math.min(
                desiredPosition.z,
                targetPosition.z + targetHalfWidth - draggedHalfWidth
            )
        );
        
        const clampedPos = new THREE.Vector3(clampedX, stackY, clampedZ);
        if (this.canPlaceOnSurface(draggedData, targetMesh, clampedPos)) {
            return clampedPos;
        }
        
        // If clamped position still doesn't work (due to collision with other units),
        // search for the closest valid position
        const searchStep = 0.05; // 5cm steps for finer control
        const maxSearchDistance = Math.max(draggedHalfLength, draggedHalfWidth) * 0.5;
        
        let closestValidPos = null;
        let closestDistance = Infinity;
        
        // Start search from clamped position, not desired position
        const searchCenter = clampedPos;
        
        // Search in a grid pattern around the clamped position
        for (let dx = -maxSearchDistance; dx <= maxSearchDistance; dx += searchStep) {
            for (let dz = -maxSearchDistance; dz <= maxSearchDistance; dz += searchStep) {
                const testPos = new THREE.Vector3(
                    searchCenter.x + dx,
                    stackY,
                    searchCenter.z + dz
                );
                
                if (this.canPlaceOnSurface(draggedData, targetMesh, testPos)) {
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestValidPos = testPos;
                    }
                }
            }
        }
        
        return closestValidPos;
    }
    
    canPlaceOnSurface(draggedData, targetMesh, proposedPosition) {
        // Check if unit can be placed on the surface of target at the proposed position
        const targetData = targetMesh.userData;
        const targetPosition = targetMesh.position;
        
        // First check if the unit physically fits within the bounds
        const fitsOnTop = this.canFitOnTop(draggedData, targetData, proposedPosition, targetPosition);
        if (!fitsOnTop) {
            // Silently reject - unit doesn't fit on top
            return false;
        }
        
        // Check if stacking is allowed on this target at the proposed position
        const canStack = this.canStackOn(targetMesh, proposedPosition);
        if (!canStack) {
            // Silently reject - cannot stack on this target
            return false;
        }
        
        // Check for collisions with other units on the same level
        const targetTopY = targetPosition.y + targetData.height / 2;
        const draggedBottomY = proposedPosition.y - draggedData.height / 2;
        
        // Ensure the unit is actually on top (not floating or embedded)
        if (Math.abs(draggedBottomY - targetTopY) > 0.01) {
            // Silently reject - not properly on top
            return false;
        }
        
        // Check for collisions with other units at the same Y level
        const tolerance = 0.01;
        const draggedHalfLength = draggedData.length / 2;
        const draggedHalfWidth = draggedData.width / 2;
        const draggedHalfHeight = draggedData.height / 2;
        
        for (let mesh of this.cargoMeshes) {
            if (this.draggedObjects.includes(mesh) || mesh === targetMesh) continue;
            
            const otherData = mesh.userData;
            const otherHalfLength = otherData.length / 2;
            const otherHalfWidth = otherData.width / 2;
            const otherHalfHeight = otherData.height / 2;
            
            // Check if units are at the same floor level (same Y position)
            const sameFloor = Math.abs(mesh.position.y - proposedPosition.y) < tolerance;
            
            if (sameFloor) {
                // Check X/Z collision between units on the same floor
                // Use <= to allow exact touching without overlap
                const xOverlap = Math.abs(proposedPosition.x - mesh.position.x) <= 
                                (draggedHalfLength + otherHalfLength);
                const zOverlap = Math.abs(proposedPosition.z - mesh.position.z) <= 
                                (draggedHalfWidth + otherHalfWidth);
                
                // But they can't be at exactly the same position (would be inside each other)
                const samePosition = Math.abs(proposedPosition.x - mesh.position.x) < 0.001 && 
                                    Math.abs(proposedPosition.z - mesh.position.z) < 0.001;
                
                if (xOverlap && zOverlap && !samePosition) {
                    // Check if units are truly overlapping (not just touching)
                    const xDistance = Math.abs(proposedPosition.x - mesh.position.x);
                    const zDistance = Math.abs(proposedPosition.z - mesh.position.z);
                    const xSum = draggedHalfLength + otherHalfLength;
                    const zSum = draggedHalfWidth + otherHalfWidth;
                    
                    // Units are overlapping if distance is less than sum of half-dimensions
                    // Allow exact touching (distance == sum) with small tolerance for floating point
                    const xOverlapping = xDistance < (xSum - 0.001);
                    const zOverlapping = zDistance < (zSum - 0.001);
                    
                    if (xOverlapping && zOverlapping) {
                        return false; // Units are overlapping
                    }
                }
            }
        }
        
        // All checks passed - can place on surface
        return true;
    }
    
    // Removed createGhostMesh - no longer using ghost preview
    // Objects are now directly moved during dragging
    
    updateContainerBounds(dimensions) {
        if (!this.containerMesh) return;
        
        // Store dimensions for later use (needed for ruler in JUMBO)
        this.containerDimensions = dimensions;
        
        // Get trailer height
        const trailerHeight = dimensions.trailerHeight || 1.1;
        
        // Calculate container bounds based on cargo space dimensions
        // Don't use Box3.setFromObject as it includes wall thickness
        if (dimensions.sections && dimensions.sections.length > 0) {
            // JUMBO with sections - use total length including gap
            this.containerBounds = {
                min: new THREE.Vector3(
                    -dimensions.length / 2,  // Start of first section
                    trailerHeight,            // Floor level (elevated)
                    -dimensions.width / 2     // Inner edge of left wall
                ),
                max: new THREE.Vector3(
                    dimensions.length / 2,    // End of last section (includes gap)
                    trailerHeight + dimensions.height,  // Ceiling level (elevated)
                    dimensions.width / 2      // Inner edge of right wall
                )
            };
            
            // Store section information for ruler
            this.containerBounds.sections = dimensions.sections;
            this.containerBounds.isJumbo = true;
        } else {
            // Standard container
            this.containerBounds = {
                min: new THREE.Vector3(
                    -dimensions.length / 2,  // Inner edge of back wall
                    trailerHeight,            // Floor level (elevated)
                    -dimensions.width / 2     // Inner edge of left wall
                ),
                max: new THREE.Vector3(
                    dimensions.length / 2,    // Inner edge of front wall
                    trailerHeight + dimensions.height,  // Ceiling level (elevated)
                    dimensions.width / 2      // Inner edge of right wall
                )
            };
            this.containerBounds.isJumbo = false;
        }
        
        // Add groove information if container has groove (Coilmulde)
        if (dimensions && dimensions.hasGroove) {
            this.containerBounds.hasGroove = true;
            this.containerBounds.grooveWidth = dimensions.grooveWidth;
            this.containerBounds.grooveDepth = dimensions.grooveDepth;
            this.containerBounds.grooveLength = dimensions.grooveLength;
            this.containerBounds.grooveStartX = dimensions.grooveStartX;
            this.containerBounds.containerLength = dimensions.length;
        } else {
            this.containerBounds.hasGroove = false;
        }
    }
    
    checkValidPosition(position) {
        if (!this.containerBounds || !this.draggedObjects[0]) return false;
        
        // Check if we're dragging a group (including units stacked on the group)
        // We're dragging a group if we have a selected group and the first dragged object belongs to it
        const isDraggingGroup = this.selectedGroupId && 
                                this.draggedObjects[0].userData &&
                                this.draggedObjects[0].userData.groupId === this.selectedGroupId;
        
        if (isDraggingGroup) {
            return this.checkValidGroupPosition(position);
        }
        
        return this.checkValidSinglePosition(position);
    }
    
    checkValidSinglePosition(position) {
        if (!this.containerBounds || !this.draggedObjects[0]) return false;
        
        
        // Special handling for steel coils in groove
        const firstItem = this.draggedObjects[0].userData;
        if (firstItem.fixedDiameter && this.containerBounds.hasGroove) {
            // For steel coils (with fixedDiameter) in groove, just check X bounds
            const coilLength = firstItem.length;
            const coilWidth = firstItem.width; // diameter of the coil
            const coilHeight = firstItem.height; // also diameter of the coil
            const containerHalfLength = this.containerBounds.containerLength / 2;
            const grooveStartX = -containerHalfLength + this.containerBounds.grooveStartX;
            const grooveEndX = grooveStartX + this.containerBounds.grooveLength;
            
            const minX = grooveStartX + coilLength / 2;
            const maxX = grooveEndX - coilLength / 2;
            
            // Check if position is within groove bounds
            if (position.x < minX || position.x > maxX) {
                return false;
            }
            
            // Check collision with ALL cargo items (not just other coils)
            for (let mesh of this.cargoMeshes) {
                if (this.draggedObjects.includes(mesh)) continue;
                
                const otherData = mesh.userData;
                const otherHalfLength = otherData.length / 2;
                const otherHalfWidth = otherData.width / 2;
                const otherHalfHeight = otherData.height / 2;
                
                // Calculate coil's bounding box in its groove position
                const coilMinX = position.x - coilLength / 2;
                const coilMaxX = position.x + coilLength / 2;
                const coilMinZ = position.z - coilWidth / 2;
                const coilMaxZ = position.z + coilWidth / 2;
                const coilMinY = position.y - coilHeight / 2;
                const coilMaxY = position.y + coilHeight / 2;
                
                // Calculate other item's bounding box
                const otherMinX = mesh.position.x - otherHalfLength;
                const otherMaxX = mesh.position.x + otherHalfLength;
                const otherMinZ = mesh.position.z - otherHalfWidth;
                const otherMaxZ = mesh.position.z + otherHalfWidth;
                const otherMinY = mesh.position.y - otherHalfHeight;
                const otherMaxY = mesh.position.y + otherHalfHeight;
                
                // Check for collision (bounding boxes overlap)
                const overlapX = !(coilMaxX <= otherMinX + 0.01 || coilMinX >= otherMaxX - 0.01);
                const overlapZ = !(coilMaxZ <= otherMinZ + 0.01 || coilMinZ >= otherMaxZ - 0.01);
                const overlapY = !(coilMaxY <= otherMinY + 0.01 || coilMinY >= otherMaxY - 0.01);
                
                if (overlapX && overlapZ && overlapY) {
                    return false; // Collision detected
                }
            }
            
            return true;
        }
        
        // Check each dragged object for validity
        // Get the offset of the first dragged object (the one being directly moved)
        const firstObject = this.draggedObjects[0];
        
        for (let i = 0; i < this.draggedObjects.length; i++) {
            const draggedMesh = this.draggedObjects[i];
            const draggedData = draggedMesh.userData;
            const halfWidth = draggedData.width / 2;
            const halfLength = draggedData.length / 2;
            const halfHeight = draggedData.height / 2;
            
            // Calculate position for this object maintaining relative positions
            const relativeOffset = {
                x: draggedMesh.position.x - firstObject.position.x,
                y: draggedMesh.position.y - firstObject.position.y,
                z: draggedMesh.position.z - firstObject.position.z
            };
            
            const objectPosition = new THREE.Vector3(
                position.x + relativeOffset.x,
                position.y + relativeOffset.y,
                position.z + relativeOffset.z
            );
            
            // Check if this object is within container bounds
            // Allow 1mm tolerance for height to handle exact fit scenarios
            if (objectPosition.x - halfLength < this.containerBounds.min.x ||
                objectPosition.x + halfLength > this.containerBounds.max.x ||
                objectPosition.z - halfWidth < this.containerBounds.min.z ||
                objectPosition.z + halfWidth > this.containerBounds.max.z ||
                objectPosition.y + halfHeight > this.containerBounds.max.y + 0.001) {
                return false; // Outside container bounds
            }
            
            // Check for collisions with other cargo
            
            for (let mesh of this.cargoMeshes) {
                // Skip the dragged objects
                if (this.draggedObjects.includes(mesh)) continue;
                
                const targetData = mesh.userData;
                const targetHalfWidth = targetData.width / 2;
                const targetHalfLength = targetData.length / 2;
                const targetHalfHeight = targetData.height / 2;
                
                // Special collision detection for roll-to-roll
                if (draggedData.isVerticalRoll && targetData.isVerticalRoll) {
                    // For two vertical rolls, use circular collision detection
                    const draggedRadius = draggedData.diameter / 2;
                    const targetRadius = targetData.diameter / 2;
                    const minDistance = draggedRadius + targetRadius;
                    
                    // Check if cylinders are at similar height (can collide)
                    const heightOverlap = Math.abs(objectPosition.y - mesh.position.y) < (halfHeight + targetHalfHeight - 0.01);
                    
                    if (heightOverlap) {
                        // Check circular collision in X-Z plane
                        const dx = objectPosition.x - mesh.position.x;
                        const dz = objectPosition.z - mesh.position.z;
                        const distance = Math.sqrt(dx * dx + dz * dz);
                        
                        if (distance < minDistance - 0.01) {
                            return false; // Circular collision detected
                        }
                    }
                } else {
                    // Regular rectangular collision detection
                    // Check if boxes would overlap in X and Z
                    const xDistance = Math.abs(objectPosition.x - mesh.position.x);
                    const zDistance = Math.abs(objectPosition.z - mesh.position.z);
                    const xSum = halfLength + targetHalfLength;
                    const zSum = halfWidth + targetHalfWidth;
                    
                    // Check for actual overlap (not just touching)
                    const overlapX = xDistance < (xSum - 0.001);
                    const overlapZ = zDistance < (zSum - 0.001);
                    
                    
                    if (overlapX && overlapZ) {
                        // Check if we're at the same height level (collision)
                        const heightOverlap = Math.abs(objectPosition.y - mesh.position.y) < (halfHeight + targetHalfHeight - 0.01);
                        
                        if (heightOverlap) {
                            // Check if units are at the same floor level (same Y position)
                            const sameFloor = Math.abs(objectPosition.y - mesh.position.y) < 0.1;
                            
                            if (sameFloor) {
                                // Units on the same floor - this is a collision
                                return false;
                            } else {
                                // Check if this is a valid stacking position
                                const isAbove = objectPosition.y > mesh.position.y;
                                if (isAbove) {
                                    // Check if we're directly on top
                                    const expectedStackY = mesh.position.y + targetHalfHeight + halfHeight;
                                    const isDirectlyOnTop = Math.abs(objectPosition.y - expectedStackY) < 0.1;
                                    
                                    if (isDirectlyOnTop) {
                                        // We're stacking - check if it's allowed
                                        const proposedPos = new THREE.Vector3(
                                            objectPosition.x,
                                            objectPosition.y,
                                            objectPosition.z
                                        );
                                        const canPlace = this.canPlaceOnSurface(draggedData, mesh, proposedPos);
                                        if (!canPlace) {
                                            return false; // Can't stack here
                                        }
                                    } else {
                                        // Floating or embedded - not allowed
                                        return false;
                                    }
                                } else {
                                    // Unit is below - this shouldn't happen in normal dragging
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return true; // Valid position for all dragged objects
    }
    
    formatMethods(methods) {
        if (!methods || methods.length === 0) return 'Brak';
        const methodNames = {
            'rear': 'Tył',
            'side': 'Bok',
            'top': 'Góra'
        };
        return methods.map(m => methodNames[m] || m).join(', ');
    }
    
    canStackOn(targetMesh, proposedPosition = null) {
        // Check if the target allows stacking
        const targetData = targetMesh.userData;
        const draggedData = this.draggedObjects[0]?.userData;
        
        if (!targetData || !draggedData) return false;
        
        // Special handling for vertical rolls - they can stack in pyramid formation
        if (draggedData.isVerticalRoll && targetData.isVerticalRoll) {
            // Vertical rolls can stack on other vertical rolls in special patterns
            // This is handled separately in findBestStackingPosition
            return true;
        }
        
        // Horizontal rolls can only stack directly on top of each other
        if (draggedData.isHorizontalRoll && targetData.isHorizontalRoll) {
            // Check if they have same dimensions for stable stacking
            if (Math.abs(draggedData.length - targetData.length) < 0.01 &&
                Math.abs(draggedData.width - targetData.width) < 0.01) {
                // Continue with normal stacking rules below
            } else {
                return false; // Different dimensions - can't stack
            }
        }
        
        // Only horizontal rolls can stack on horizontal rolls
        if (targetData.isHorizontalRoll && !draggedData.isHorizontalRoll) {
            return false;
        }
        
        // Don't allow mixing vertical and horizontal rolls
        if ((draggedData.isVerticalRoll && targetData.isHorizontalRoll) ||
            (draggedData.isHorizontalRoll && targetData.isVerticalRoll)) {
            return false;
        }
        
        // Count how many units we're dragging (entire stack)
        const draggedStackSize = this.draggedObjects.length;
        
        // Calculate total weight of dragged stack
        let draggedStackWeight = 0;
        for (let obj of this.draggedObjects) {
            draggedStackWeight += obj.userData.weight || 0;
        }
        
        // Find ALL units that support the target (including the target itself)
        const supportingUnits = new Set([targetMesh]);
        const tolerance = 0.1;
        
        // Recursive function to find all units that support a given unit
        const findSupportingUnits = (unit) => {
            const unitBottom = unit.position.y - unit.userData.height / 2;
            const unitHalfLength = unit.userData.length / 2;
            const unitHalfWidth = unit.userData.width / 2;
            
            for (let mesh of this.cargoMeshes) {
                if (this.draggedObjects.includes(mesh) || supportingUnits.has(mesh)) continue;
                
                const meshTop = mesh.position.y + mesh.userData.height / 2;
                const meshHalfLength = mesh.userData.length / 2;
                const meshHalfWidth = mesh.userData.width / 2;
                
                // Check if this mesh supports our unit (unit is on top of mesh)
                if (Math.abs(unitBottom - meshTop) < tolerance) {
                    // Check if there's an overlap in X/Z
                    const xOverlap = Math.abs(mesh.position.x - unit.position.x) < 
                                    (unitHalfLength + meshHalfLength);
                    const zOverlap = Math.abs(mesh.position.z - unit.position.z) < 
                                    (unitHalfWidth + meshHalfWidth);
                    
                    if (xOverlap && zOverlap) {
                        // This mesh supports our unit
                        supportingUnits.add(mesh);
                        // Recursively find what supports this mesh
                        findSupportingUnits(mesh);
                    }
                }
            }
        };
        
        // Find all supporting units recursively
        findSupportingUnits(targetMesh);
        
        // Convert to array and sort by Y position (bottom to top)
        const stackUnits = Array.from(supportingUnits);
        stackUnits.sort((a, b) => a.position.y - b.position.y);
        
        // Check EACH supporting unit to see if it can handle the additional weight
        for (let unit of stackUnits) {
            const unitData = unit.userData;
            const maxStack = unitData.maxStack !== undefined ? unitData.maxStack : 1;
            const maxStackWeight = unitData.maxStackWeight !== undefined ? unitData.maxStackWeight : Infinity;
            
            // Find all units supported by this unit (directly or indirectly)
            const supportedUnits = new Set();
            const floorsAbove = new Map(); // Map of floor level to units on that floor
            
            // Get the top of our base unit
            const unitTop = unit.position.y + unit.userData.height / 2;
            
            // Recursive function to find all units supported by a given unit
            const findSupportedByUnit = (baseUnit, currentFloorLevel = 0) => {
                const baseTop = baseUnit.position.y + baseUnit.userData.height / 2;
                const baseHalfLength = baseUnit.userData.length / 2;
                const baseHalfWidth = baseUnit.userData.width / 2;
                
                for (let mesh of this.cargoMeshes) {
                    if (this.draggedObjects.includes(mesh) || supportedUnits.has(mesh)) continue;
                    if (mesh === unit) continue; // Don't count the unit itself
                    
                    const meshBottom = mesh.position.y - mesh.userData.height / 2;
                    const meshHalfLength = mesh.userData.length / 2;
                    const meshHalfWidth = mesh.userData.width / 2;
                    
                    // Check if this mesh is directly on top of baseUnit
                    if (Math.abs(meshBottom - baseTop) < tolerance) {
                        // Check if there's an overlap in X/Z
                        const xOverlap = Math.abs(mesh.position.x - baseUnit.position.x) < 
                                        (meshHalfLength + baseHalfLength);
                        const zOverlap = Math.abs(mesh.position.z - baseUnit.position.z) < 
                                        (meshHalfWidth + baseHalfWidth);
                        
                        if (xOverlap && zOverlap) {
                            // This mesh is supported by baseUnit
                            supportedUnits.add(mesh);
                            
                            // Calculate which floor this is on (relative to our base unit)
                            // Floor 1 = directly on unit, Floor 2 = on top of floor 1, etc.
                            const nextFloorLevel = currentFloorLevel + 1;
                            
                            if (!floorsAbove.has(nextFloorLevel)) {
                                floorsAbove.set(nextFloorLevel, new Set());
                            }
                            floorsAbove.get(nextFloorLevel).add(mesh);
                            
                            // Recursively find what this mesh supports
                            findSupportedByUnit(mesh, nextFloorLevel);
                        }
                    }
                }
            };
            
            // Start from the current unit and find everything it supports
            findSupportedByUnit(unit, 0);
            
            // Calculate total weight of all supported units
            let weightAbove = 0;
            for (let mesh of supportedUnits) {
                weightAbove += mesh.userData.weight || 0;
            }
            
            // The number of floors above is what counts for maxStack
            // This is the highest floor level we found
            const numFloorsAbove = floorsAbove.size > 0 ? Math.max(...floorsAbove.keys()) : 0;
            
            // Check if adding the dragged unit would create too many floors
            // When placing units side by side on the same floor, it doesn't increase floor count
            // Only placing units on top of existing units increases floor count
            let additionalFloors = 1; // Assume we're adding one new floor
            
            if (proposedPosition) {
                // Check if we're placing at an existing floor level
                // We need to check if the proposed Y position matches any existing floor
                const proposedBottom = proposedPosition.y - draggedData.height / 2;
                
                // Check each floor to see if we're adding to it
                for (const [floorLevel, unitsOnFloor] of floorsAbove) {
                    // Check if any unit on this floor has the same bottom Y as our proposed position
                    for (const floorUnit of unitsOnFloor) {
                        const floorUnitBottom = floorUnit.position.y - floorUnit.userData.height / 2;
                        if (Math.abs(proposedBottom - floorUnitBottom) < tolerance) {
                            // We're adding to an existing floor
                            additionalFloors = 0;
                            break;
                        }
                    }
                    if (additionalFloors === 0) break;
                }
            }
            
            // Removed verbose stack check log
            
            if (numFloorsAbove + additionalFloors > maxStack) {
                // Too many floors - silently reject
                return false; // This unit can't support additional floors
            }
            
            // Check if adding the ENTIRE dragged stack would exceed this unit's weight limit
            if (weightAbove + draggedStackWeight > maxStackWeight) {
                // Too much weight - silently reject
                return false; // This unit can't support the additional weight
            }
        }
        
        // Check container height - will the new stack fit?
        if (this.containerBounds) {
            // Get the height of the top unit in target stack
            const topTargetY = targetMesh.position.y + targetData.height / 2;
            
            // Find the highest point in the dragged stack
            let highestDraggedY = -Infinity;
            let lowestDraggedY = Infinity;
            for (let obj of this.draggedObjects) {
                const objTop = obj.position.y + obj.userData.height / 2;
                const objBottom = obj.position.y - obj.userData.height / 2;
                if (objTop > highestDraggedY) {
                    highestDraggedY = objTop;
                }
                if (objBottom < lowestDraggedY) {
                    lowestDraggedY = objBottom;
                }
            }
            
            // Calculate the actual height of the dragged stack
            const draggedStackHeight = highestDraggedY - lowestDraggedY;
            
            // Check if placing dragged stack on top would exceed container height
            // Allow 1mm tolerance for exact fit scenarios
            const newTopY = topTargetY + draggedStackHeight;
            if (newTopY > this.containerBounds.max.y + 0.001) {
                return false; // Stack would be too tall for container
            }
        }
        
        // Check if the dragged unit can physically fit on the target
        // (must be same size or smaller than the unit directly below it)
        if (!this.canFitOnTop(draggedData, targetData)) {
            return false;
        }
        
        return true; // Can stack
    }
    
    // Removed dropObjects and handleInvalidDrop - no longer needed
    // Objects now move in real-time during dragging, not after mouse up
    
    createRuler(cargoItem) {
        // Remove existing ruler if any
        this.hideRuler();
        
        if (!this.containerBounds || !cargoItem) return;
        
        // Create ruler group
        this.rulerGroup = new THREE.Group();
        
        const cargoEndX = cargoItem.position.x + cargoItem.userData.length / 2;
        const cargoStartX = cargoItem.position.x - cargoItem.userData.length / 2;
        
        // For JUMBO, calculate distances relative to sections, not total space
        if (this.containerBounds.isJumbo && this.containerBounds.sections) {
            const gap = 0.5; // 50cm gap between sections
            const section1Start = this.containerBounds.min.x;
            const section1End = section1Start + this.containerBounds.sections[0].length;
            const section2Start = section1End + gap;
            const section2End = this.containerBounds.max.x;
            
            // Determine which section(s) the cargo is in
            if (cargoEndX <= section1End) {
                // Cargo is entirely in section 1
                const distanceFromStart = Math.abs(cargoEndX - section1Start);
                const distanceToEnd = Math.abs(section1End - cargoEndX);
                this.createCombinedRuler(section1Start, cargoEndX, section1End, distanceFromStart, distanceToEnd);
            } else if (cargoStartX >= section2Start) {
                // Cargo is entirely in section 2
                const distanceFromStart = Math.abs(cargoEndX - section2Start);
                const distanceToEnd = Math.abs(section2End - cargoEndX);
                this.createCombinedRuler(section2Start, cargoEndX, section2End, distanceFromStart, distanceToEnd);
            }
            // If cargo spans the gap, don't show ruler (would be confusing)
        } else {
            // Standard container
            const containerStartX = this.containerBounds.min.x;
            const containerEndX = this.containerBounds.max.x;
            
            // Calculate distances
            const distanceFromStart = Math.abs(cargoEndX - containerStartX);
            const distanceToEnd = Math.abs(containerEndX - cargoEndX);
            
            // Create a combined ruler bar with two colored sections
            this.createCombinedRuler(containerStartX, cargoEndX, containerEndX, distanceFromStart, distanceToEnd);
        }
        
        this.scene.add(this.rulerGroup);
        this.rulerVisible = true;
    }
    
    createCombinedRuler(containerStartX, cargoEndX, containerEndX, distanceFromStart, distanceToEnd) {
        // Determine which Z edge (front or back) is closer to camera
        const containerCenterZ = (this.containerBounds.min.z + this.containerBounds.max.z) / 2;
        const rulerZ = this.camera.position.z > containerCenterZ 
            ? this.containerBounds.max.z + 0.25  // Front edge
            : this.containerBounds.min.z - 0.25; // Back edge
        
        // Get trailer height from container dimensions
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.1;
        const rulerY = trailerHeight + 0.02; // Slightly above trailer floor
        
        // Create a thicker bar using a rectangle (plane) for better visibility
        const barHeight = 0.16; // Height of the colored bar - doubled thickness
        
        // Blue section - from start to cargo end
        if (distanceFromStart > 0.01) {
            const blueGeometry = new THREE.PlaneGeometry(distanceFromStart, barHeight);
            const blueMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x2196F3, // Blue
                side: THREE.DoubleSide,
                opacity: 0.85,
                transparent: true
            });
            const blueMesh = new THREE.Mesh(blueGeometry, blueMaterial);
            blueMesh.position.set(
                containerStartX + distanceFromStart / 2,
                rulerY,
                rulerZ
            );
            blueMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
            this.rulerGroup.add(blueMesh);
            
            // White label for blue section
            this.createLabel(
                containerStartX + distanceFromStart / 2,
                rulerY,
                rulerZ,
                `${distanceFromStart.toFixed(2)} m`,
                '#FFFFFF'
            );
        }
        
        // Green section - from cargo end to container end
        if (distanceToEnd > 0.01) {
            const greenGeometry = new THREE.PlaneGeometry(distanceToEnd, barHeight);
            const greenMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x4CAF50, // Green
                side: THREE.DoubleSide,
                opacity: 0.85,
                transparent: true
            });
            const greenMesh = new THREE.Mesh(greenGeometry, greenMaterial);
            greenMesh.position.set(
                cargoEndX + distanceToEnd / 2,
                rulerY,
                rulerZ
            );
            greenMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
            this.rulerGroup.add(greenMesh);
            
            // White label for green section
            this.createLabel(
                cargoEndX + distanceToEnd / 2,
                rulerY,
                rulerZ,
                `${distanceToEnd.toFixed(2)} m`,
                '#FFFFFF'
            );
        }
        
        // Add end caps for the entire bar
        const capMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFFFF,
            linewidth: 2,
            opacity: 0.9,
            transparent: true
        });
        
        const capSize = barHeight / 2 + 0.02;
        
        // Start cap
        const startCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(containerStartX, rulerY - capSize, rulerZ),
            new THREE.Vector3(containerStartX, rulerY + capSize, rulerZ)
        ]);
        const startCap = new THREE.Line(startCapGeometry, capMaterial);
        this.rulerGroup.add(startCap);
        
        // Middle divider (at cargo position)
        if (distanceFromStart > 0.01 && distanceToEnd > 0.01) {
            const middleCapGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(cargoEndX, rulerY - capSize, rulerZ),
                new THREE.Vector3(cargoEndX, rulerY + capSize, rulerZ)
            ]);
            const middleCap = new THREE.Line(middleCapGeometry, capMaterial);
            this.rulerGroup.add(middleCap);
        }
        
        // End cap
        const endCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(containerEndX, rulerY - capSize, rulerZ),
            new THREE.Vector3(containerEndX, rulerY + capSize, rulerZ)
        ]);
        const endCap = new THREE.Line(endCapGeometry, capMaterial);
        this.rulerGroup.add(endCap);
    }
    
    createLabel(x, y, z, text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Add dark shadow for better contrast
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw text in white
        context.fillStyle = color;
        context.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            sizeAttenuation: false,
            opacity: 1,
            transparent: true,
            depthTest: false  // Always render on top
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.18, 0.045, 1);
        sprite.position.set(x, y + 0.001, z); // Slightly above the bar
        this.rulerGroup.add(sprite);
    }
    
    
    showRulerForCargo(cargoMesh) {
        if (!cargoMesh || !cargoMesh.userData) return;
        this.createRuler(cargoMesh);
    }
    
    getClosestVertexAndFaces(mesh) {
        if (!mesh || !mesh.userData) return null;
        
        const halfLength = mesh.userData.length / 2;
        const halfWidth = mesh.userData.width / 2;
        const halfHeight = mesh.userData.height / 2;
        
        // Get mesh world position
        const meshWorldPos = new THREE.Vector3();
        mesh.getWorldPosition(meshWorldPos);
        
        // Define 8 vertices of the box in local coordinates, then transform them
        const vertices = [
            new THREE.Vector3(-halfLength, -halfHeight, -halfWidth),
            new THREE.Vector3(halfLength, -halfHeight, -halfWidth),
            new THREE.Vector3(halfLength, -halfHeight, halfWidth),
            new THREE.Vector3(-halfLength, -halfHeight, halfWidth),
            new THREE.Vector3(-halfLength, halfHeight, -halfWidth),
            new THREE.Vector3(halfLength, halfHeight, -halfWidth),
            new THREE.Vector3(halfLength, halfHeight, halfWidth),
            new THREE.Vector3(-halfLength, halfHeight, halfWidth)
        ];
        
        // Apply mesh rotation to vertices and then add world position
        vertices.forEach(vertex => {
            vertex.applyQuaternion(mesh.quaternion);
            vertex.add(meshWorldPos);
        });
        
        // Find closest vertex to camera
        let closestVertex = vertices[0];
        let closestDistance = closestVertex.distanceTo(this.camera.position);
        let closestIndex = 0;
        
        for (let i = 1; i < vertices.length; i++) {
            const distance = vertices[i].distanceTo(this.camera.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestVertex = vertices[i];
                closestIndex = i;
            }
        }
        
        // Define face normals and centers (in local space, then transform)
        const faces = [
            { 
                normal: new THREE.Vector3(1, 0, 0), 
                dimension: 'length', 
                axis: 'x',
                center: new THREE.Vector3(halfLength, 0, 0)
            },   // Right face
            { 
                normal: new THREE.Vector3(-1, 0, 0), 
                dimension: 'length', 
                axis: 'x',
                center: new THREE.Vector3(-halfLength, 0, 0)
            },  // Left face
            { 
                normal: new THREE.Vector3(0, 1, 0), 
                dimension: 'height', 
                axis: 'y',
                center: new THREE.Vector3(0, halfHeight, 0)
            },   // Top face
            { 
                normal: new THREE.Vector3(0, -1, 0), 
                dimension: 'height', 
                axis: 'y',
                center: new THREE.Vector3(0, -halfHeight, 0)
            },  // Bottom face
            { 
                normal: new THREE.Vector3(0, 0, 1), 
                dimension: 'width', 
                axis: 'z',
                center: new THREE.Vector3(0, 0, halfWidth)
            },    // Front face
            { 
                normal: new THREE.Vector3(0, 0, -1), 
                dimension: 'width', 
                axis: 'z',
                center: new THREE.Vector3(0, 0, -halfWidth)
            }    // Back face
        ];
        
        // Apply mesh rotation to face centers and add world position
        faces.forEach(face => {
            face.center.applyQuaternion(mesh.quaternion);
            face.center.add(meshWorldPos);
        });
        
        // Get camera direction
        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        
        // Find the face that is most facing the camera
        let mostPerpendicularFace = faces[0];
        let bestScore = -Infinity;
        
        // Calculate vector from mesh center to camera
        const meshToCamera = new THREE.Vector3().subVectors(this.camera.position, meshWorldPos);
        meshToCamera.normalize();
        
        for (const face of faces) {
            // Apply mesh rotation to face normal
            const worldNormal = face.normal.clone();
            worldNormal.applyQuaternion(mesh.quaternion);
            
            // Calculate dot product with vector from mesh to camera
            // Positive dot product means face is pointing towards camera
            const dotProduct = worldNormal.dot(meshToCamera);
            
            // We want the face with the highest dot product (most facing the camera)
            if (dotProduct > bestScore) {
                bestScore = dotProduct;
                mostPerpendicularFace = face;
            }
        }
        
        // Update face normals to faceNormals for compatibility
        const faceNormals = faces.map(f => ({ normal: f.normal, dimension: f.dimension, axis: f.axis }));
        
        // Calculate dot products for each face normal with camera direction
        // More negative = more perpendicular (facing camera)
        const faceDots = faceNormals.map(face => ({
            ...face,
            dot: face.normal.dot(cameraDir)
        }));
        
        // Sort by most perpendicular (most negative dot product)
        faceDots.sort((a, b) => a.dot - b.dot);
        
        // Get the three faces that share the closest vertex
        const vertexFaces = this.getFacesForVertex(closestIndex);
        
        // Filter to only faces that share the closest vertex
        const relevantFaces = faceDots.filter(face => {
            return vertexFaces.some(vf => vf.normal.equals(face.normal));
        });
        
        // Take the two most perpendicular faces from the relevant ones
        const selectedFaces = relevantFaces.slice(0, 2);
        
        // Determine which dimensions to show on each face
        const dimensions = new Set(selectedFaces.map(f => f.dimension));
        const missingDimension = ['length', 'width', 'height'].find(d => !dimensions.has(d));
        
        // If we have two faces with the same dimension, replace one with the missing dimension
        if (selectedFaces[0].dimension === selectedFaces[1].dimension && missingDimension) {
            selectedFaces[1].dimension = missingDimension;
        }
        
        return {
            closestVertex,
            closestIndex,
            faces: selectedFaces,
            meshWorldPos,
            mostPerpendicularFace: mostPerpendicularFace
        };
    }
    
    getFacesForVertex(vertexIndex) {
        // Define which three faces each vertex touches
        const vertexFaceMap = {
            0: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)], // Left, Bottom, Back
            1: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)],  // Right, Bottom, Back
            2: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)],   // Right, Bottom, Front
            3: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)],  // Left, Bottom, Front
            4: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)],  // Left, Top, Back
            5: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)],   // Right, Top, Back
            6: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],    // Right, Top, Front
            7: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]    // Left, Top, Front
        };
        
        return vertexFaceMap[vertexIndex].map(normal => ({ normal }));
    }
    
    hideRuler() {
        if (this.rulerGroup) {
            this.scene.remove(this.rulerGroup);
            // Dispose of geometries and materials
            this.rulerGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
            this.rulerGroup = null;
            this.rulerVisible = false;
        }
        
        // Also hide dimension labels
        this.hideDimensionLabels();
    }
    
    createDimensionLabels(mesh) {
        if (!mesh || !mesh.userData) return;
        
        // Remove existing labels
        this.hideDimensionLabels();
        
        // Get closest vertex and most perpendicular faces
        const vertexData = this.getClosestVertexAndFaces(mesh);
        if (!vertexData) return;
        
        // Create new group for labels
        this.dimensionLabelsGroup = new THREE.Group();
        
        const halfLength = mesh.userData.length / 2;
        const halfWidth = mesh.userData.width / 2;
        const halfHeight = mesh.userData.height / 2;
        
        // Check if it's a cylindrical unit (Roll or Steel Coil)
        const isRoll = mesh.userData.isRoll;
        const isVerticalRoll = mesh.userData.isVerticalRoll;
        const isSteelCoil = mesh.userData.fixedDiameter;
        
        // Get dimensions in centimeters - adapt for cylindrical units
        let dimensions;
        if (isSteelCoil) {
            // Steel Coil - horizontal cylinder with fixed diameter
            // height is the diameter, length is the actual length
            dimensions = {
                length: Math.round(mesh.userData.length * 100),
                diameter: Math.round(mesh.userData.height * 100),  // height is diameter
                radius: Math.round(mesh.userData.height * 50)      // radius is half diameter
            };
        } else if (isRoll && isVerticalRoll) {
            // Vertical Roll - standing cylinder
            // width/length are diameter, height is the actual height
            dimensions = {
                diameter: Math.round(mesh.userData.width * 100),   // width is diameter
                radius: Math.round(mesh.userData.width * 50),      // radius is half diameter
                height: Math.round(mesh.userData.height * 100)
            };
        } else if (isRoll && !isVerticalRoll) {
            // Horizontal Roll - lying cylinder
            // length is actual length, width/height are diameter
            dimensions = {
                length: Math.round(mesh.userData.length * 100),
                diameter: Math.round(mesh.userData.width * 100),   // width is diameter
                radius: Math.round(mesh.userData.width * 50)       // radius is half diameter
            };
        } else {
            // Regular box unit
            dimensions = {
                length: Math.round(mesh.userData.length * 100),
                width: Math.round(mesh.userData.width * 100),
                height: Math.round(mesh.userData.height * 100)
            };
        }
        
        // Determine which edges are visible based on closest vertex
        const vertexIndex = vertexData.closestIndex;
        
        // Map vertex index to which edges are visible
        // Each vertex connects three edges
        const edgeMap = {
            0: { // back-bottom-left
                edges: [
                    { dimension: 'length', start: [-halfLength, -halfHeight, -halfWidth], end: [halfLength, -halfHeight, -halfWidth] },
                    { dimension: 'width', start: [-halfLength, -halfHeight, -halfWidth], end: [-halfLength, -halfHeight, halfWidth] },
                    { dimension: 'height', start: [-halfLength, -halfHeight, -halfWidth], end: [-halfLength, halfHeight, -halfWidth] }
                ]
            },
            1: { // back-bottom-right
                edges: [
                    { dimension: 'length', start: [-halfLength, -halfHeight, -halfWidth], end: [halfLength, -halfHeight, -halfWidth] },
                    { dimension: 'width', start: [halfLength, -halfHeight, -halfWidth], end: [halfLength, -halfHeight, halfWidth] },
                    { dimension: 'height', start: [halfLength, -halfHeight, -halfWidth], end: [halfLength, halfHeight, -halfWidth] }
                ]
            },
            2: { // front-bottom-right
                edges: [
                    { dimension: 'length', start: [-halfLength, -halfHeight, halfWidth], end: [halfLength, -halfHeight, halfWidth] },
                    { dimension: 'width', start: [halfLength, -halfHeight, -halfWidth], end: [halfLength, -halfHeight, halfWidth] },
                    { dimension: 'height', start: [halfLength, -halfHeight, halfWidth], end: [halfLength, halfHeight, halfWidth] }
                ]
            },
            3: { // front-bottom-left
                edges: [
                    { dimension: 'length', start: [-halfLength, -halfHeight, halfWidth], end: [halfLength, -halfHeight, halfWidth] },
                    { dimension: 'width', start: [-halfLength, -halfHeight, -halfWidth], end: [-halfLength, -halfHeight, halfWidth] },
                    { dimension: 'height', start: [-halfLength, -halfHeight, halfWidth], end: [-halfLength, halfHeight, halfWidth] }
                ]
            },
            4: { // back-top-left
                edges: [
                    { dimension: 'length', start: [-halfLength, halfHeight, -halfWidth], end: [halfLength, halfHeight, -halfWidth] },
                    { dimension: 'width', start: [-halfLength, halfHeight, -halfWidth], end: [-halfLength, halfHeight, halfWidth] },
                    { dimension: 'height', start: [-halfLength, -halfHeight, -halfWidth], end: [-halfLength, halfHeight, -halfWidth] }
                ]
            },
            5: { // back-top-right
                edges: [
                    { dimension: 'length', start: [-halfLength, halfHeight, -halfWidth], end: [halfLength, halfHeight, -halfWidth] },
                    { dimension: 'width', start: [halfLength, halfHeight, -halfWidth], end: [halfLength, halfHeight, halfWidth] },
                    { dimension: 'height', start: [halfLength, -halfHeight, -halfWidth], end: [halfLength, halfHeight, -halfWidth] }
                ]
            },
            6: { // front-top-right
                edges: [
                    { dimension: 'length', start: [-halfLength, halfHeight, halfWidth], end: [halfLength, halfHeight, halfWidth] },
                    { dimension: 'width', start: [halfLength, halfHeight, -halfWidth], end: [halfLength, halfHeight, halfWidth] },
                    { dimension: 'height', start: [halfLength, -halfHeight, halfWidth], end: [halfLength, halfHeight, halfWidth] }
                ]
            },
            7: { // front-top-left
                edges: [
                    { dimension: 'length', start: [-halfLength, halfHeight, halfWidth], end: [halfLength, halfHeight, halfWidth] },
                    { dimension: 'width', start: [-halfLength, halfHeight, -halfWidth], end: [-halfLength, halfHeight, halfWidth] },
                    { dimension: 'height', start: [-halfLength, -halfHeight, halfWidth], end: [-halfLength, halfHeight, halfWidth] }
                ]
            }
        };
        
        // For cylindrical units, we need to create custom labels
        if (isSteelCoil || isRoll) {
            // For cylindrical units, show different dimensions
            const edges = edgeMap[vertexIndex].edges;
            
            // Track if we already showed radius
            let radiusShown = false;
            
            edges.forEach(edge => {
                let dimensionValue;
                let dimensionText;
                let shouldShowLabel = true;
                
                // Get group name and weight for cylindrical units
                const groupName = mesh.userData.name || 'Jednostka';
                const weight = mesh.userData.weight || 0;
                
                if (isSteelCoil) {
                    // Steel Coil: show length and diameter (only once)
                    if (edge.dimension === 'length') {
                        dimensionValue = dimensions.length;
                        // Add name and weight to length label
                        dimensionText = `${dimensionValue} cm\n${groupName}\n${weight} kg`;
                    } else if ((edge.dimension === 'width' || edge.dimension === 'height') && !radiusShown) {
                        // Show diameter only once, on the first width/height edge
                        dimensionValue = dimensions.diameter;
                        dimensionText = `${dimensionValue} cm`;
                        radiusShown = true;
                    } else {
                        shouldShowLabel = false;
                    }
                } else if (isRoll && isVerticalRoll) {
                    // Vertical Roll: show height and diameter (only once)
                    if (edge.dimension === 'height') {
                        dimensionValue = dimensions.height;
                        // Add name and weight to height label (for vertical roll)
                        dimensionText = `${dimensionValue} cm\n${groupName}\n${weight} kg`;
                    } else if ((edge.dimension === 'length' || edge.dimension === 'width') && !radiusShown) {
                        // Show diameter only once, on the first length/width edge
                        dimensionValue = dimensions.diameter;
                        dimensionText = `${dimensionValue} cm`;
                        radiusShown = true;
                    } else {
                        shouldShowLabel = false;
                    }
                } else if (isRoll && !isVerticalRoll) {
                    // Horizontal Roll: show length and diameter (only once)
                    if (edge.dimension === 'length') {
                        dimensionValue = dimensions.length;
                        // Add name and weight to length label
                        dimensionText = `${dimensionValue} cm\n${groupName}\n${weight} kg`;
                    } else if ((edge.dimension === 'width' || edge.dimension === 'height') && !radiusShown) {
                        // Show diameter only once, on the first width/height edge
                        dimensionValue = dimensions.diameter;
                        dimensionText = `${dimensionValue} cm`;
                        radiusShown = true;
                    } else {
                        shouldShowLabel = false;
                    }
                }
                
                if (shouldShowLabel) {
                    // For cylindrical units, position labels in the center
                    if (isSteelCoil || isRoll) {
                        const meshWorldPos = vertexData.meshWorldPos;
                        const cameraRelative = this.camera.position.clone().sub(meshWorldPos);
                        
                        let labelPosition;
                        let radiusStart, radiusEnd;
                        
                        // Check if this is a radius or other dimension
                        // For vertical roll: width/length edges show radius, height edge shows height
                        // For horizontal roll/steel coil: width/height edges show radius, length edge shows length
                        const isRadiusEdge = (isRoll && isVerticalRoll && (edge.dimension === 'width' || edge.dimension === 'length')) ||
                                           ((isSteelCoil || (isRoll && !isVerticalRoll)) && (edge.dimension === 'width' || edge.dimension === 'height'));
                        const isRadius = radiusShown && isRadiusEdge;
                        const isHeight = edge.dimension === 'height' && isRoll && isVerticalRoll;
                        const isLength = edge.dimension === 'length' && (isSteelCoil || (isRoll && !isVerticalRoll));
                        
                        if (isRadius) {
                            // Radius label - position at center of circular face
                            if (isSteelCoil) {
                                // Horizontal cylinder along X axis - choose front or back face based on camera
                                const xOffset = cameraRelative.x > 0 ? halfLength : -halfLength;
                                labelPosition = new THREE.Vector3(xOffset, 0, 0).add(meshWorldPos);
                                radiusStart = new THREE.Vector3(xOffset, 0, 0);
                                radiusEnd = new THREE.Vector3(xOffset, halfHeight, 0);
                            } else if (isRoll && isVerticalRoll) {
                                // Vertical cylinder - choose top or bottom face based on camera
                                const yOffset = cameraRelative.y > 0 ? halfHeight : -halfHeight;
                                labelPosition = new THREE.Vector3(0, yOffset, 0).add(meshWorldPos);
                                radiusStart = new THREE.Vector3(0, yOffset, 0);
                                radiusEnd = new THREE.Vector3(halfWidth, yOffset, 0);
                            } else if (isRoll && !isVerticalRoll) {
                                // Horizontal cylinder along X axis - choose front or back face based on camera
                                const xOffset = cameraRelative.x > 0 ? halfLength : -halfLength;
                                labelPosition = new THREE.Vector3(xOffset, 0, 0).add(meshWorldPos);
                                radiusStart = new THREE.Vector3(xOffset, 0, 0);
                                radiusEnd = new THREE.Vector3(xOffset, halfWidth, 0);
                            }
                        } else if (isHeight || isLength) {
                            // Height/Length label - position at center of cylinder LENGTH FACE (not cylinder center)
                            if (isHeight) {
                                // Vertical Roll - position on the side surface of cylinder
                                // Choose front or back based on camera position
                                const zOffset = cameraRelative.z > 0 ? halfWidth : -halfWidth;
                                labelPosition = new THREE.Vector3(0, 0, zOffset).add(meshWorldPos);
                                // Vertical line for height
                                radiusStart = new THREE.Vector3(0, -halfHeight, zOffset);
                                radiusEnd = new THREE.Vector3(0, halfHeight, zOffset);
                            } else {
                                // Horizontal Roll/Steel Coil - position on the visible curved surface
                                // Calculate the optimal position on the cylinder's circumference
                                // Project camera direction onto the YZ plane (perpendicular to cylinder axis)
                                const cameraDir = cameraRelative.clone().normalize();
                                
                                // For horizontal cylinder (along X axis), we need angle in YZ plane
                                const angleToCamera = Math.atan2(cameraDir.z, cameraDir.y);
                                
                                // Position label on the surface facing the camera
                                const yOffset = Math.cos(angleToCamera) * halfHeight;
                                const zOffset = Math.sin(angleToCamera) * halfWidth;
                                
                                labelPosition = new THREE.Vector3(0, yOffset, zOffset).add(meshWorldPos);
                                // Horizontal line for length at the same position
                                radiusStart = new THREE.Vector3(-halfLength, yOffset, zOffset);
                                radiusEnd = new THREE.Vector3(halfLength, yOffset, zOffset);
                            }
                        }
                        
                        // Transform dummy line to world space for orientation
                        const radiusStartWorld = radiusStart.clone().add(meshWorldPos);
                        const radiusEndWorld = radiusEnd.clone().add(meshWorldPos);
                        
                        // Get the actual dimension value in meters
                        let actualDimension;
                        if (isRadius) {
                            actualDimension = mesh.userData.width / 2;  // radius in meters
                        } else if (isHeight) {
                            actualDimension = mesh.userData.height;  // height in meters
                        } else if (isLength) {
                            actualDimension = mesh.userData.length;  // length in meters
                        }
                        
                        // Create the label at the calculated position
                        this.createDimensionLabel(labelPosition, dimensionText, radiusStartWorld, radiusEndWorld, actualDimension, mesh);
                    }
                    
                    if (!isSteelCoil && !isRoll) {
                        // Regular edge label for box units
                        const edgeCenter = new THREE.Vector3(
                            (edge.start[0] + edge.end[0]) / 2,
                            (edge.start[1] + edge.end[1]) / 2,
                            (edge.start[2] + edge.end[2]) / 2
                        );
                        edgeCenter.add(vertexData.meshWorldPos);
                        
                        const edgeStartWorld = new THREE.Vector3(
                            edge.start[0],
                            edge.start[1],
                            edge.start[2]
                        ).add(vertexData.meshWorldPos);
                        
                        const edgeEndWorld = new THREE.Vector3(
                            edge.end[0],
                            edge.end[1],
                            edge.end[2]
                        ).add(vertexData.meshWorldPos);
                        
                        const labelPosition = edgeCenter.clone();
                        const edgeDimensionValue = mesh.userData[edge.dimension];
                        
                        this.createDimensionLabel(labelPosition, dimensionText, edgeStartWorld, edgeEndWorld, edgeDimensionValue, mesh);
                    }
                }
            });
        } else {
            // Regular box units - use existing logic
            const edges = edgeMap[vertexIndex].edges;
            
            edges.forEach(edge => {
                const dimensionValue = dimensions[edge.dimension];
                const dimensionText = `${dimensionValue} cm`;
                
                // Calculate edge center position in world space
                const edgeCenter = new THREE.Vector3(
                    (edge.start[0] + edge.end[0]) / 2,
                    (edge.start[1] + edge.end[1]) / 2,
                    (edge.start[2] + edge.end[2]) / 2
                );
                edgeCenter.add(vertexData.meshWorldPos);
                
                // Calculate edge direction vector for rotation
                const edgeDirection = new THREE.Vector3(
                    edge.end[0] - edge.start[0],
                    edge.end[1] - edge.start[1],
                    edge.end[2] - edge.start[2]
                );
                
                // Calculate edge start and end in world space for label
                const edgeStartWorld = new THREE.Vector3(
                    edge.start[0],
                    edge.start[1],
                    edge.start[2]
                ).add(vertexData.meshWorldPos);
                
                const edgeEndWorld = new THREE.Vector3(
                    edge.end[0],
                    edge.end[1],
                    edge.end[2]
                ).add(vertexData.meshWorldPos);
                
                // Position label directly on the edge center (text will be on the edge line)
                const labelPosition = edgeCenter.clone();
                
                // Calculate the actual dimension value for this edge
                const edgeDimensionValue = mesh.userData[edge.dimension];
                
                // Create the label with dimension info and edge endpoints for rotation
                this.createDimensionLabel(labelPosition, dimensionText, edgeStartWorld, edgeEndWorld, edgeDimensionValue, mesh);
            });
        }
        
        // Add group name and weight label on the most perpendicular face
        if (vertexData.mostPerpendicularFace) {
            this.createGroupInfoLabel(mesh, vertexData.mostPerpendicularFace);
        }
        
        this.scene.add(this.dimensionLabelsGroup);
    }
    
    createGroupInfoLabel(mesh, face) {
        // Get group name and weight from userData
        const cargoData = mesh.userData;
        const groupName = cargoData.name || 'Jednostka';
        const weight = cargoData.weight || 0;
        
        // Check if it's a cylindrical unit
        const isRoll = mesh.userData.isRoll;
        const isVerticalRoll = mesh.userData.isVerticalRoll;
        const isSteelCoil = mesh.userData.fixedDiameter;
        
        // Skip cylindrical units for now - they need special handling
        if (isSteelCoil || isRoll) {
            return;
        }
        
        // Create the label text
        const labelText = `${groupName}\n${weight} kg`;
        
        // Create canvas for text
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Clear background
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Add shadow for better contrast (same style as dimension labels)
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw text in white (same style as dimension labels)
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Split text into lines and draw each
        const lines = labelText.split('\n');
        const lineHeight = 45;
        const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
        
        lines.forEach((line, index) => {
            context.fillText(line, canvas.width / 2, startY + index * lineHeight);
        });
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Create sprite for constant screen size (same as dimension labels)
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            sizeAttenuation: false,  // This makes the sprite maintain constant screen size
            opacity: 1,
            transparent: true,
            depthTest: false  // Always render on top
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Position the sprite at face center
        const faceCenter = face.center.clone();
        sprite.position.copy(faceCenter);
        
        // Offset slightly from the face
        const worldNormal = face.normal.clone();
        worldNormal.applyQuaternion(mesh.quaternion);
        sprite.position.add(worldNormal.clone().multiplyScalar(0.02));
        
        // Calculate scale based on face dimensions - always 80% of smaller face dimension
        let baseScaleX = 0.2;  // Default
        let baseScaleY = 0.05; // Default
        
        if (mesh) {
            // Get face dimensions - we need to compute actual face dimensions in world space
            // Transform the face normal to world space to determine actual face orientation
            const worldNormal = face.normal.clone();
            worldNormal.applyQuaternion(mesh.quaternion);
            
            // Determine which world axis the face is most aligned with
            const absX = Math.abs(worldNormal.x);
            const absY = Math.abs(worldNormal.y);
            const absZ = Math.abs(worldNormal.z);
            
            let faceWidth, faceHeight;
            
            // Original dimensions
            const length = mesh.userData.length;
            const width = mesh.userData.width;
            const height = mesh.userData.height;
            
            // Determine face dimensions based on world-space normal orientation
            if (absX > absY && absX > absZ) {
                // Face is perpendicular to X axis (left/right face)
                faceWidth = width;
                faceHeight = height;
            } else if (absY > absX && absY > absZ) {
                // Face is perpendicular to Y axis (top/bottom face)
                faceWidth = length;
                faceHeight = width;
            } else {
                // Face is perpendicular to Z axis (front/back face)
                faceWidth = length;
                faceHeight = height;
            }
            
            // Use smaller dimension to ensure label fits
            const smallerDimension = Math.min(faceWidth, faceHeight);
            
            // Create points for the smaller dimension
            const halfDim = smallerDimension / 2;
            
            // Get dimensions from userData for creating points
            const halfLength = mesh.userData.length / 2;
            const halfWidth = mesh.userData.width / 2;
            const halfHeight = mesh.userData.height / 2;
            
            // Get mesh world position
            const meshWorldPos = new THREE.Vector3();
            mesh.getWorldPosition(meshWorldPos);
            
            // Create two points on the face to measure screen size
            // We need to create points in local space first, then transform
            let localPoint1, localPoint2;
            if (faceWidth < faceHeight || (faceWidth === faceHeight)) {
                // Measure width
                if (face.axis === 'x') {
                    // Left/Right face - measure along Z axis
                    localPoint1 = new THREE.Vector3(face.axis === 'x' && face.normal.x > 0 ? halfLength : -halfLength, 0, halfDim);
                    localPoint2 = new THREE.Vector3(face.axis === 'x' && face.normal.x > 0 ? halfLength : -halfLength, 0, -halfDim);
                } else if (face.axis === 'y') {
                    // Top/Bottom face - measure along X axis
                    localPoint1 = new THREE.Vector3(halfDim, face.normal.y > 0 ? halfHeight : -halfHeight, 0);
                    localPoint2 = new THREE.Vector3(-halfDim, face.normal.y > 0 ? halfHeight : -halfHeight, 0);
                } else if (face.axis === 'z') {
                    // Front/Back face - measure along X axis
                    localPoint1 = new THREE.Vector3(halfDim, 0, face.normal.z > 0 ? halfWidth : -halfWidth);
                    localPoint2 = new THREE.Vector3(-halfDim, 0, face.normal.z > 0 ? halfWidth : -halfWidth);
                }
            } else {
                // Measure height
                if (face.axis === 'x') {
                    // Left/Right face - measure along Y axis
                    localPoint1 = new THREE.Vector3(face.normal.x > 0 ? halfLength : -halfLength, halfDim, 0);
                    localPoint2 = new THREE.Vector3(face.normal.x > 0 ? halfLength : -halfLength, -halfDim, 0);
                } else if (face.axis === 'y') {
                    // Top/Bottom face - measure along Z axis
                    localPoint1 = new THREE.Vector3(0, face.normal.y > 0 ? halfHeight : -halfHeight, halfDim);
                    localPoint2 = new THREE.Vector3(0, face.normal.y > 0 ? halfHeight : -halfHeight, -halfDim);
                } else if (face.axis === 'z') {
                    // Front/Back face - measure along Y axis
                    localPoint1 = new THREE.Vector3(0, halfDim, face.normal.z > 0 ? halfWidth : -halfWidth);
                    localPoint2 = new THREE.Vector3(0, -halfDim, face.normal.z > 0 ? halfWidth : -halfWidth);
                }
            }
            
            // Transform points from local to world space
            const point1 = localPoint1.clone();
            const point2 = localPoint2.clone();
            point1.applyQuaternion(mesh.quaternion);
            point2.applyQuaternion(mesh.quaternion);
            point1.add(meshWorldPos);
            point2.add(meshWorldPos);
            
            // Project to screen space
            const screen1 = point1.clone().project(this.camera);
            const screen2 = point2.clone().project(this.camera);
            
            // Calculate screen distance
            const screenDist = Math.sqrt(
                Math.pow(screen2.x - screen1.x, 2) + 
                Math.pow(screen2.y - screen1.y, 2)
            );
            
            // Set label to 70% of smaller dimension on screen
            baseScaleX = screenDist * 0.7;
            baseScaleY = baseScaleX * 0.25; // Maintain aspect ratio (4:1)
            
            // Apply minimum and maximum scale limits
            baseScaleX = Math.max(0.05, Math.min(0.5, baseScaleX));
            baseScaleY = Math.max(0.0125, Math.min(0.125, baseScaleY));
        }
        
        sprite.scale.set(baseScaleX, baseScaleY, 1);
        
        // Store reference to mesh and face for dynamic updates
        sprite.userData = {
            mesh: mesh,
            isGroupInfo: true,
            face: face,
            baseScaleX: baseScaleX,
            baseScaleY: baseScaleY
        };
        
        this.dimensionLabelsGroup.add(sprite);
    }
    
    createDimensionLabel(position, text, edgeStart, edgeEnd, edgeDimension, mesh) {
        // Check if text has multiple lines
        const lines = text.split('\n');
        const isMultiLine = lines.length > 1;
        
        // Check if this is for a vertical roll HEIGHT label (not radius)
        // We only rotate the height label, not the radius label
        const isVerticalRoll = mesh && mesh.userData && mesh.userData.isRoll && mesh.userData.isVerticalRoll;
        // Check if this is specifically the height dimension (not radius)
        const isHeightLabel = isVerticalRoll && isMultiLine && lines[0].includes('cm') && lines.length > 2;
        
        // Calculate if we need to flip the vertical roll label based on camera position
        let needsFlip = false;
        if (isHeightLabel && edgeStart && edgeEnd) {
            // Get edge vector in screen space
            const edge3D = new THREE.Vector3().subVectors(edgeEnd, edgeStart);
            const edgeScreenStart = edgeStart.clone().project(this.camera);
            const edgeScreenEnd = edgeEnd.clone().project(this.camera);
            
            // Calculate screen space edge vector
            const edgeScreen = new THREE.Vector2(
                edgeScreenEnd.x - edgeScreenStart.x,
                edgeScreenEnd.y - edgeScreenStart.y
            );
            
            // For vertical roll height labels, the edge is vertical in 3D
            // After 90° rotation, text baseline will be perpendicular to the edge
            // Check if the edge appears more left-to-right or right-to-left on screen
            // If edge goes from right to left (negative X), we need to flip
            needsFlip = edgeScreen.x < 0;
        }
        
        // Create canvas for text
        const canvas = document.createElement('canvas');
        canvas.width = isMultiLine ? 256 : 256;   // Same width as single-line
        canvas.height = isMultiLine ? 128 : 64;   // Reduced height for tighter spacing
        const context = canvas.getContext('2d');
        
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // For vertical roll HEIGHT labels only, rotate the canvas context
        if (isHeightLabel) {
            // Save the context state
            context.save();
            // Move to center of canvas
            context.translate(canvas.width / 2, canvas.height / 2);
            // Rotate 90 degrees clockwise or counter-clockwise based on camera
            if (needsFlip) {
                context.rotate(-Math.PI / 2);  // Counter-clockwise for flipped text
            } else {
                context.rotate(Math.PI / 2);   // Clockwise for normal orientation
            }
            // Now drawing will be relative to the rotated coordinate system
        }
        
        // Add shadow for better contrast (same style as ruler)
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw text in white (same style as ruler)
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';  // Same font size for all labels
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        if (isMultiLine) {
            // Draw each line separately for multi-line text
            const lineHeight = 38;  // Tighter line spacing for better readability
            const startY = isHeightLabel ? 0 : canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
            
            lines.forEach((line, index) => {
                if (isHeightLabel) {
                    // For rotated context, draw at origin with offset
                    context.fillText(line, 0, -((lines.length - 1) * lineHeight / 2) + index * lineHeight);
                } else {
                    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
                }
            });
        } else {
            // Single line text
            context.fillText(text, canvas.width / 2, canvas.height / 2);
        }
        
        // Restore context if it was rotated
        if (isHeightLabel) {
            context.restore();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Create sprite for constant screen size (like ruler labels)
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            sizeAttenuation: false,  // This makes the sprite maintain constant screen size
            opacity: 1,
            transparent: true,
            depthTest: false  // Always render on top
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Base scale for good visibility (isMultiLine already declared above)
        // Canvas is 256x128 for multi-line (ratio 2:1), 256x64 for single (ratio 4:1)
        let baseScaleX = isMultiLine ? 0.15 : 0.15;  // Same width as radius labels
        let baseScaleY = isMultiLine ? 0.075 : 0.04;   // 2x height for tighter multi-line text
        
        // Fixed absolute maximum scale regardless of zoom
        const absoluteMaxScale = isMultiLine ? 0.12 : 0.08; // Reasonable max for multi-line labels
        
        // Calculate maximum scale based on 1 meter at container origin
        let maxScaleBasedOnMeter = absoluteMaxScale;
        if (this.containerBounds) {
            // Get container origin position (front-left corner of cargo space)
            const containerOrigin = new THREE.Vector3(
                this.containerBounds.min.x,
                this.containerBounds.min.y, 
                this.containerBounds.min.z
            );
            
            // Point 1 meter from the origin along X axis
            const meterPoint = new THREE.Vector3(
                this.containerBounds.min.x + 1.0,
                this.containerBounds.min.y,
                this.containerBounds.min.z
            );
            
            // Project both points to screen space
            const originScreen = containerOrigin.clone().project(this.camera);
            const meterScreen = meterPoint.clone().project(this.camera);
            
            // Get canvas dimensions
            const canvasWidth = this.renderer.domElement.width;
            const canvasHeight = this.renderer.domElement.height;
            
            // Convert to screen pixels
            const originX = (originScreen.x + 1) * canvasWidth / 2;
            const meterX = (meterScreen.x + 1) * canvasWidth / 2;
            
            // Calculate screen distance for 1 meter
            const screenDistanceForMeter = Math.abs(meterX - originX);
            
            // Calculate the normalized screen size (0-1 range)
            const normalizedMeterSize = screenDistanceForMeter / canvasWidth;
            
            // This is our maximum allowed scale (similar to how 1 meter would appear)
            // Use smaller multiplier to keep labels compact
            maxScaleBasedOnMeter = normalizedMeterSize * 0.3;
            
            // Apply strict limits
            maxScaleBasedOnMeter = Math.min(maxScaleBasedOnMeter, absoluteMaxScale); // Never larger than absolute max
            maxScaleBasedOnMeter = Math.max(maxScaleBasedOnMeter, 0.02); // Never smaller than 0.02
        }
        
        // If we have mesh and edge dimension, calculate scale based on edge but limited by meter scale
        // Skip this limiting logic for multi-line labels - they need to be larger
        if (mesh && edgeDimension && !isMultiLine) {
            // Get mesh world position and scale
            const meshWorldPos = new THREE.Vector3();
            mesh.getWorldPosition(meshWorldPos);
            
            // Calculate distance from camera to mesh
            const distanceToCamera = this.camera.position.distanceTo(meshWorldPos);
            
            // Calculate how large the edge appears on screen
            // Using perspective projection formula
            const fov = this.camera.fov * Math.PI / 180;
            const aspect = this.camera.aspect;
            
            // Calculate vertical and horizontal FOV
            const vFovHalf = Math.tan(fov / 2);
            const hFovHalf = vFovHalf * aspect;
            
            // Calculate screen height at the distance of the object
            const screenHeightAtDistance = 2 * distanceToCamera * vFovHalf;
            const screenWidthAtDistance = 2 * distanceToCamera * hFovHalf;
            
            // Calculate what portion of the screen the edge takes up
            // We use width for horizontal comparison since sprite width matters most
            const edgeScreenRatio = edgeDimension / screenWidthAtDistance;
            
            // Limit label to 80% of edge length on screen
            const maxAllowedScaleForEdge = edgeScreenRatio * 0.8;
            
            // Use the smaller of the two limits: edge-based or meter-based
            const maxAllowedScale = Math.min(maxAllowedScaleForEdge, maxScaleBasedOnMeter);
            
            // Apply the limit if label would be too large
            if (baseScaleX > maxAllowedScale) {
                const scaleFactor = maxAllowedScale / baseScaleX;
                baseScaleX *= scaleFactor;
                baseScaleY *= scaleFactor;
            }
        }
        
        sprite.scale.set(baseScaleX, baseScaleY, 1);
        sprite.position.copy(position);
        
        // Store reference to mesh, dimension, and edge endpoints for dynamic updates
        // Store the actual calculated base scales, not fixed values
        sprite.userData = {
            mesh: mesh,
            edgeDimension: edgeDimension,
            edgeStart: edgeStart,
            edgeEnd: edgeEnd,
            baseScaleX: baseScaleX,   // Use the actual calculated scale
            baseScaleY: baseScaleY    // Use the actual calculated scale
        };
        
        this.dimensionLabelsGroup.add(sprite);
    }
    
    hideDimensionLabels() {
        if (this.dimensionLabelsGroup) {
            this.scene.remove(this.dimensionLabelsGroup);
            // Dispose of geometries and materials
            this.dimensionLabelsGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
            this.dimensionLabelsGroup = null;
        }
    }
    
    updateDimensionLabelsScale() {
        if (!this.dimensionLabelsGroup) return;
        
        // Get canvas dimensions for accurate calculations
        const canvasWidth = this.renderer.domElement.width;
        const canvasHeight = this.renderer.domElement.height;
        
        // Update scale and rotation for each label sprite based on current camera position
        this.dimensionLabelsGroup.children.forEach(child => {
            // Handle group info labels (now sprites)
            if (child.userData && child.userData.isGroupInfo) {
                const mesh = child.userData.mesh;
                
                // Recalculate most perpendicular face facing camera
                const vertexData = this.getClosestVertexAndFaces(mesh);
                if (vertexData && vertexData.mostPerpendicularFace) {
                    const face = vertexData.mostPerpendicularFace;
                    
                    // Update position to new face center
                    const faceCenter = face.center.clone();
                    child.position.copy(faceCenter);
                    
                    // Offset slightly from the face
                    const worldNormal = face.normal.clone();
                    worldNormal.applyQuaternion(mesh.quaternion);
                    child.position.add(worldNormal.clone().multiplyScalar(0.02));
                    
                    // Store new face
                    child.userData.face = face;
                    
                    // Recalculate scale based on face size - 70% of smaller dimension
                    let scaleX = 0.2;  // Default
                    let scaleY = 0.05; // Default
                    
                    // Get face dimensions - compute actual face dimensions in world space
                    // Transform the face normal to world space to determine actual face orientation
                    const worldNormalForDims = face.normal.clone();
                    worldNormalForDims.applyQuaternion(mesh.quaternion);
                    
                    // Determine which world axis the face is most aligned with
                    const absX = Math.abs(worldNormalForDims.x);
                    const absY = Math.abs(worldNormalForDims.y);
                    const absZ = Math.abs(worldNormalForDims.z);
                    
                    let faceWidth, faceHeight;
                    
                    // Original dimensions
                    const length = mesh.userData.length;
                    const width = mesh.userData.width;
                    const height = mesh.userData.height;
                    
                    // Determine face dimensions based on world-space normal orientation
                    if (absX > absY && absX > absZ) {
                        // Face is perpendicular to X axis (left/right face)
                        faceWidth = width;
                        faceHeight = height;
                    } else if (absY > absX && absY > absZ) {
                        // Face is perpendicular to Y axis (top/bottom face)
                        faceWidth = length;
                        faceHeight = width;
                    } else {
                        // Face is perpendicular to Z axis (front/back face)
                        faceWidth = length;
                        faceHeight = height;
                    }
                    
                    // Use smaller dimension to ensure label fits
                    const smallerDimension = Math.min(faceWidth, faceHeight);
                    
                    // Create points for the smaller dimension
                    const halfDim = smallerDimension / 2;
                    
                    // Create two points on the face to measure screen size
                    // Need to get dimensions from userData
                    const halfLength = mesh.userData.length / 2;
                    const halfWidth = mesh.userData.width / 2;
                    const halfHeight = mesh.userData.height / 2;
                    
                    // Get mesh world position for transforms
                    const meshWorldPos = new THREE.Vector3();
                    mesh.getWorldPosition(meshWorldPos);
                    
                    // Create points in local space first, then transform
                    let localPoint1, localPoint2;
                    if (faceWidth < faceHeight || (faceWidth === faceHeight)) {
                        // Measure width
                        if (face.axis === 'x') {
                            // Left/Right face - measure along Z axis
                            localPoint1 = new THREE.Vector3(face.normal.x > 0 ? halfLength : -halfLength, 0, halfDim);
                            localPoint2 = new THREE.Vector3(face.normal.x > 0 ? halfLength : -halfLength, 0, -halfDim);
                        } else if (face.axis === 'y') {
                            // Top/Bottom face - measure along X axis
                            localPoint1 = new THREE.Vector3(halfDim, face.normal.y > 0 ? halfHeight : -halfHeight, 0);
                            localPoint2 = new THREE.Vector3(-halfDim, face.normal.y > 0 ? halfHeight : -halfHeight, 0);
                        } else if (face.axis === 'z') {
                            // Front/Back face - measure along X axis
                            localPoint1 = new THREE.Vector3(halfDim, 0, face.normal.z > 0 ? halfWidth : -halfWidth);
                            localPoint2 = new THREE.Vector3(-halfDim, 0, face.normal.z > 0 ? halfWidth : -halfWidth);
                        }
                    } else {
                        // Measure height
                        if (face.axis === 'x') {
                            // Left/Right face - measure along Y axis
                            localPoint1 = new THREE.Vector3(face.normal.x > 0 ? halfLength : -halfLength, halfDim, 0);
                            localPoint2 = new THREE.Vector3(face.normal.x > 0 ? halfLength : -halfLength, -halfDim, 0);
                        } else if (face.axis === 'y') {
                            // Top/Bottom face - measure along Z axis
                            localPoint1 = new THREE.Vector3(0, face.normal.y > 0 ? halfHeight : -halfHeight, halfDim);
                            localPoint2 = new THREE.Vector3(0, face.normal.y > 0 ? halfHeight : -halfHeight, -halfDim);
                        } else if (face.axis === 'z') {
                            // Front/Back face - measure along Y axis
                            localPoint1 = new THREE.Vector3(0, halfDim, face.normal.z > 0 ? halfWidth : -halfWidth);
                            localPoint2 = new THREE.Vector3(0, -halfDim, face.normal.z > 0 ? halfWidth : -halfWidth);
                        }
                    }
                    
                    // Transform points from local to world space
                    const point1 = localPoint1.clone();
                    const point2 = localPoint2.clone();
                    point1.applyQuaternion(mesh.quaternion);
                    point2.applyQuaternion(mesh.quaternion);
                    point1.add(meshWorldPos);
                    point2.add(meshWorldPos);
                    
                    // Project to screen space
                    const screen1 = point1.clone().project(this.camera);
                    const screen2 = point2.clone().project(this.camera);
                    
                    // Calculate screen distance
                    const screenDist = Math.sqrt(
                        Math.pow(screen2.x - screen1.x, 2) + 
                        Math.pow(screen2.y - screen1.y, 2)
                    );
                    
                    // Set label to 70% of smaller dimension on screen
                    scaleX = screenDist * 0.7;
                    scaleY = scaleX * 0.25; // Maintain aspect ratio (4:1)
                    
                    // Apply minimum and maximum scale limits
                    scaleX = Math.max(0.05, Math.min(0.5, scaleX));
                    scaleY = Math.max(0.0125, Math.min(0.125, scaleY));
                    
                    child.scale.set(scaleX, scaleY, 1);
                }
                return;
            }
            
            const sprite = child;
            if (sprite.userData && sprite.userData.mesh && sprite.userData.edgeDimension) {
                const mesh = sprite.userData.mesh;
                const edgeDimension = sprite.userData.edgeDimension;
                const edgeStart = sprite.userData.edgeStart;
                const edgeEnd = sprite.userData.edgeEnd;
                
                // If we have edge endpoints, calculate rotation
                if (edgeStart && edgeEnd) {
                    // Project edge endpoints to screen space
                    const startScreen = edgeStart.clone().project(this.camera);
                    const endScreen = edgeEnd.clone().project(this.camera);
                    
                    // Convert from normalized device coordinates to screen pixels
                    const startX = (startScreen.x + 1) * canvasWidth / 2;
                    const startY = (-startScreen.y + 1) * canvasHeight / 2;
                    const endX = (endScreen.x + 1) * canvasWidth / 2;
                    const endY = (-endScreen.y + 1) * canvasHeight / 2;
                    
                    // Calculate angle of the edge on screen
                    let angle = Math.atan2(endY - startY, endX - startX);
                    
                    // Normalize angle to be between -PI and PI
                    while (angle > Math.PI) angle -= 2 * Math.PI;
                    while (angle < -Math.PI) angle += 2 * Math.PI;
                    
                    // If text would be upside down (angle is between 90 and 270 degrees), flip it
                    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                        angle = angle + Math.PI;  // Rotate 180 degrees
                    }
                    
                    // Apply rotation to sprite (sprites rotate around Z axis)
                    sprite.material.rotation = -angle;  // Negative because screen Y is inverted
                    
                    // Calculate the edge length in screen pixels for scaling
                    const edgeScreenLength = Math.sqrt(
                        Math.pow(endX - startX, 2) + 
                        Math.pow(endY - startY, 2)
                    );
                    
                    // Convert edge screen length to normalized screen space (0-1)
                    const edgeNormalizedLength = edgeScreenLength / canvasWidth;
                    
                    // Base scales
                    let scaleX = sprite.userData.baseScaleX;
                    let scaleY = sprite.userData.baseScaleY;
                    
                    // Check if this is a multi-line label (for Roll/Steel Coil units)
                    const isMultiLine = sprite.userData.baseScaleY > 0.06;  // Multi-line labels have baseScaleY of 0.075
                    
                    if (!isMultiLine) {
                        // Regular single-line labels - limit to edge length
                        const maxAllowedScale = edgeNormalizedLength * 0.8;
                        
                        // Apply the limit if label would be too large
                        if (scaleX > maxAllowedScale) {
                            const scaleFactor = maxAllowedScale / scaleX;
                            scaleX *= scaleFactor;
                            scaleY *= scaleFactor;
                        }
                    } else {
                        // Multi-line labels - scale based on edge visibility but don't limit size
                        // Just scale proportionally with zoom level
                        const zoomFactor = edgeNormalizedLength / 0.2;  // Normalize to a reference edge size
                        scaleX = sprite.userData.baseScaleX * Math.min(Math.max(zoomFactor, 0.5), 2.0);  // Allow 0.5x to 2x scaling
                        scaleY = sprite.userData.baseScaleY * Math.min(Math.max(zoomFactor, 0.5), 2.0);
                    }
                    
                    // Apply minimum scale so labels don't become too small
                    const minScaleX = isMultiLine ? 0.075 : 0.1;
                    const minScaleY = isMultiLine ? 0.0375 : 0.024;
                    scaleX = Math.max(scaleX, minScaleX);
                    scaleY = Math.max(scaleY, minScaleY);
                    
                    // Apply maximum scale to prevent labels from being too large
                    const maxScaleX = isMultiLine ? 0.3 : 0.4;
                    const maxScaleY = isMultiLine ? 0.15 : 0.096;
                    scaleX = Math.min(scaleX, maxScaleX);
                    scaleY = Math.min(scaleY, maxScaleY);
                    
                    sprite.scale.set(scaleX, scaleY, 1);
                } else {
                    // Fallback for labels without edge endpoints (shouldn't happen with new code)
                    const meshWorldPos = new THREE.Vector3();
                    mesh.getWorldPosition(meshWorldPos);
                    
                    const edgeStart = new THREE.Vector3(-edgeDimension/2, 0, 0).add(meshWorldPos);
                    const edgeEnd = new THREE.Vector3(edgeDimension/2, 0, 0).add(meshWorldPos);
                    
                    const startScreen = edgeStart.clone().project(this.camera);
                    const endScreen = edgeEnd.clone().project(this.camera);
                    
                    startScreen.x = (startScreen.x + 1) * canvasWidth / 2;
                    startScreen.y = (-startScreen.y + 1) * canvasHeight / 2;
                    endScreen.x = (endScreen.x + 1) * canvasWidth / 2;
                    endScreen.y = (-endScreen.y + 1) * canvasHeight / 2;
                    
                    const edgeScreenLength = Math.sqrt(
                        Math.pow(endScreen.x - startScreen.x, 2) + 
                        Math.pow(endScreen.y - startScreen.y, 2)
                    );
                    
                    const edgeNormalizedLength = edgeScreenLength / canvasWidth;
                    
                    let scaleX = sprite.userData.baseScaleX;
                    let scaleY = sprite.userData.baseScaleY;
                    
                    const maxAllowedScale = edgeNormalizedLength * 0.8;
                    
                    if (scaleX > maxAllowedScale) {
                        const scaleFactor = maxAllowedScale / scaleX;
                        scaleX *= scaleFactor;
                        scaleY *= scaleFactor;
                    }
                    
                    const minScale = 0.1;
                    scaleX = Math.max(scaleX, minScale);
                    scaleY = Math.max(scaleY, minScale * 0.24);
                    
                    const maxScale = 0.4;
                    scaleX = Math.min(scaleX, maxScale);
                    scaleY = Math.min(scaleY, maxScale * 0.24);
                    
                    sprite.scale.set(scaleX, scaleY, 1);
                }
            }
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Only update controls if they've changed
        if (this.controls.enabled) {
            this.controls.update();
        }
        
        // Update dimension labels scale if they exist
        this.updateDimensionLabelsScale();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    exportToPNG() {
        return new Promise((resolve) => {
            this.renderer.render(this.scene, this.camera);
            this.renderer.domElement.toBlob((blob) => {
                resolve(blob);
            });
        });
    }
    
    updateAxleVisualization(config) {
        // Check if container exists and has truck visualization
        if (!this.containerMesh || !this.truckVisualizationGroup) {
            return;
        }
        
        // Get parent container group
        const parent = this.truckVisualizationGroup.parent;
        if (!parent) {
            return;
        }
        
        // Remove current truck visualization
        parent.remove(this.truckVisualizationGroup);
        this.truckVisualizationGroup = null;
        
        // Rebuild truck and wheels with new configuration
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.1;
        this.addTruckAndWheels(parent, this.containerDimensions, trailerHeight, config);
        
        // Force render update
        this.renderer.render(this.scene, this.camera);
    }
    
    highlightGroup(groupId, itemsToHighlight = null) {
        // Clear any existing highlights first
        this.clearGroupHighlight();
        
        // If specific items are provided, create a set of their IDs for quick lookup
        let itemIdsToHighlight = null;
        if (itemsToHighlight && itemsToHighlight.length > 0) {
            itemIdsToHighlight = new Set(itemsToHighlight.map(item => item.id));
        }
        
        // Find all meshes belonging to this group and highlight them
        this.cargoMeshes.forEach(mesh => {
            if (mesh.userData && mesh.userData.groupId === groupId) {
                // If specific items are provided, only highlight those
                if (itemIdsToHighlight && !itemIdsToHighlight.has(mesh.userData.id)) {
                    return; // Skip this mesh if it's not in the list to highlight
                }
                
                // Apply emissive highlight (same as hover effect)
                mesh.material.emissive = new THREE.Color(0x444444);
            }
        });
        
        this.selectedGroupId = groupId;
    }
    
    clearGroupHighlight() {
        // Clear emissive highlight from all meshes in the selected group
        if (this.selectedGroupId) {
            this.cargoMeshes.forEach(mesh => {
                if (mesh.userData && mesh.userData.groupId === this.selectedGroupId) {
                    // Reset emissive to black (no highlight)
                    mesh.material.emissive = new THREE.Color(0x000000);
                }
            });
        }
        
        this.selectedGroupId = null;
    }
    
    
    rotateGroup(groupId, angle) {
        // This method should delegate to CargoManager to properly rotate and rearrange the group
        // We need access to CargoManager through a callback
        if (this.onGroupRotationRequested) {
            this.onGroupRotationRequested(groupId, angle);
        }
    }
    
    moveGroupOutsideContainer(groupId) {
        // Only move units that are currently inside the container
        const groupMeshesInside = this.cargoMeshes.filter(mesh => 
            mesh.userData && 
            mesh.userData.groupId === groupId &&
            !this.isPositionOutsideContainer(mesh.position)
        );
        
        groupMeshesInside.forEach(mesh => {
            this.moveOutsideContainer(mesh);
        });
        
        // Deselect the group after moving it outside
        if (this.selectedGroupId === groupId && this.onGroupDeselectionRequested) {
            this.onGroupDeselectionRequested();
        }
    }
    
    removeGroup(groupId) {
        const groupMeshes = this.cargoMeshes.filter(mesh => 
            mesh.userData && mesh.userData.groupId === groupId
        );
        
        // Remove all meshes in the group
        groupMeshes.forEach(mesh => {
            this.removeUnit(mesh);
        });
        
        // Clear group selection if this group was selected
        if (this.selectedGroupId === groupId) {
            this.selectedGroupId = null;
        }
    }
    
    getGroupObjects(groupId) {
        return this.cargoMeshes.filter(mesh => 
            mesh.userData && mesh.userData.groupId === groupId
        );
    }
    
    calculateGroupBoundingBox(objects) {
        if (!objects || objects.length === 0) return null;
        
        const box = new THREE.Box3();
        objects.forEach(obj => {
            box.expandByObject(obj);
        });
        
        return box;
    }
    
    checkValidGroupPosition(targetPosition) {
        if (!this.draggedObjects || this.draggedObjects.length === 0) return false;
        
        // Use the first object as reference for calculating movement delta
        const mainObject = this.draggedObjects[0];
        const deltaX = targetPosition.x - mainObject.position.x;
        const deltaZ = targetPosition.z - mainObject.position.z;
        
        // Check each dragged object individually for collisions and bounds
        for (let draggedObj of this.draggedObjects) {
            const newPos = draggedObj.position.clone();
            newPos.x += deltaX;
            newPos.z += deltaZ;
            
            // Check container bounds for this specific object
            const halfLength = draggedObj.userData.length / 2;
            const halfWidth = draggedObj.userData.width / 2;
            
            if (newPos.x - halfLength < this.containerBounds.min.x || 
                newPos.x + halfLength > this.containerBounds.max.x ||
                newPos.z - halfWidth < this.containerBounds.min.z || 
                newPos.z + halfWidth > this.containerBounds.max.z) {
                return false;
            }
            
            // Check collisions with all other objects (not in the dragged group)
            for (let mesh of this.cargoMeshes) {
                if (this.draggedObjects.includes(mesh)) continue;
                
                if (this.objectsWouldCollide(newPos, draggedObj.userData, mesh.position, mesh.userData)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    objectsWouldCollide(pos1, data1, pos2, data2) {
        const tolerance = 0.01; // 1cm tolerance - pozwala na stykanie się, ale zapobiega nakładaniu
        
        // Calculate bounding boxes
        const halfLength1 = data1.length / 2;
        const halfWidth1 = data1.width / 2;
        const halfHeight1 = data1.height / 2;
        
        const halfLength2 = data2.length / 2;
        const halfWidth2 = data2.width / 2;
        const halfHeight2 = data2.height / 2;
        
        // More precise overlap calculation
        const minX1 = pos1.x - halfLength1;
        const maxX1 = pos1.x + halfLength1;
        const minX2 = pos2.x - halfLength2;
        const maxX2 = pos2.x + halfLength2;
        
        const minY1 = pos1.y - halfHeight1;
        const maxY1 = pos1.y + halfHeight1;
        const minY2 = pos2.y - halfHeight2;
        const maxY2 = pos2.y + halfHeight2;
        
        const minZ1 = pos1.z - halfWidth1;
        const maxZ1 = pos1.z + halfWidth1;
        const minZ2 = pos2.z - halfWidth2;
        const maxZ2 = pos2.z + halfWidth2;
        
        // Check for actual overlap (not just touching) - tolerance applied to prevent overlap, not touching
        const xOverlap = maxX1 > minX2 + tolerance && maxX2 > minX1 + tolerance;
        const yOverlap = maxY1 > minY2 + tolerance && maxY2 > minY1 + tolerance;
        const zOverlap = maxZ1 > minZ2 + tolerance && maxZ2 > minZ1 + tolerance;
        
        return xOverlap && yOverlap && zOverlap;
    }
    
    // Document-level event handlers for catching events outside canvas
    onDocumentMouseUp(event) {
        // Only handle if we're actually dragging
        if (this.isDragging) {
            this.endDragging();
        }
        
        // Clean up document listeners
        document.removeEventListener('mouseup', this.documentMouseUpHandler);
        document.removeEventListener('contextmenu', this.documentContextMenuHandler);
        
        // Reset mouse tracking
        this.mouseDownPosition = null;
        this.potentialDragTarget = null;
        this.mouseHasMoved = false;
        this.totalMouseMovement = 0;
    }
    
    onDocumentContextMenu(event) {
        // Prevent default context menu when dragging
        if (this.isDragging) {
            event.preventDefault();
            this.endDragging();
        }
        
        // Clean up document listeners
        document.removeEventListener('mouseup', this.documentMouseUpHandler);
        document.removeEventListener('contextmenu', this.documentContextMenuHandler);
        
        // Reset mouse tracking
        this.mouseDownPosition = null;
        this.potentialDragTarget = null;
        this.mouseHasMoved = false;
        this.totalMouseMovement = 0;
    }
    
    // Helper method to end dragging operation
    endDragging() {
        if (!this.isDragging) return;
        
        // Drop the objects - they're already in the correct position
        // Update their userData positions and isOutside flag
        this.draggedObjects.forEach(obj => {
            // Update userData position
            if (obj.userData) {
                obj.userData.position = {
                    x: obj.position.x,
                    y: obj.position.y,
                    z: obj.position.z
                };
                // Update isOutside flag based on current position
                obj.userData.isOutside = this.isPositionOutsideContainer(obj.position);
            }
        });
        
        // Notify cargo manager about position changes
        if (this.onCargoMoved) {
            this.onCargoMoved(this.draggedObjects.map(m => m.userData));
        }
        
        // Clean up dragging state
        this.isDragging = false;
        this.draggedObjects = [];
        this.originalPositions = [];
        this.lastValidPosition = null;
        this.dragPlane = null;
        
        // Hide ruler when done dragging
        this.hideRuler();
        
        // Re-enable controls after dragging
        this.controls.enabled = true;
        document.body.style.cursor = 'default';
    }
    
}