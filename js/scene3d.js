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
        
        // Axle load visualization
        this.axleLoadGroup = null;
        this.showAxleLoads = false;
        this.axleBlinkAnimation = null;
        
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
        
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true  // Ważne dla eksportu PDF - zachowuje bufor do przechwytywania canvas
        });
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

        // Add truck and wheels visualization (skip for custom space)
        if (!dimensions.isCustomSpace) {
            this.addTruckAndWheels(containerGroup, dimensions, trailerHeight);
        }
        
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
                context.fillText(`Section ${index + 1}`, 128, 48);
                
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
        // Check if this is a SOLO or JUMBO vehicle
        const isSolo = dimensions.isSolo || false;
        const isJumbo = dimensions.isJumbo || false;
        
        // Use provided config or get from axleCalculator if available
        const config = axleConfig || (window.axleCalculator?.axleConfig ? {
            isSolo: isSolo,
            isJumbo: isJumbo,
            tractorAxles: window.axleCalculator.axleConfig.tractorAxles || 1,
            trailerAxles: isSolo ? 0 : (window.axleCalculator.axleConfig.trailerAxles || 3),
            distFrontToKingpin: window.axleCalculator.axleConfig.distFrontToKingpin || 1.7,
            distKingpinToTrailer: window.axleCalculator.axleConfig.distKingpinToTrailer || 7.7,
            distFrontAxleToKingpin: window.axleCalculator.axleConfig.distFrontAxleToKingpin || 3.1,
            distKingpinToDrive: window.axleCalculator.axleConfig.distKingpinToDrive || 0.5,
            distCargoStartToFront: window.axleCalculator.axleConfig.distCargoStartToFront || 1.0,
            distCargoStartToDrive: window.axleCalculator.axleConfig.distCargoStartToDrive || 5.5,
            distSection1StartToFront: window.axleCalculator.axleConfig.distSection1StartToFront || 1.0,
            distSection1StartToDrive: window.axleCalculator.axleConfig.distSection1StartToDrive || 5.5,
            distSection2StartToTrailerAxles: window.axleCalculator.axleConfig.distSection2StartToTrailerAxles || 5.5
        } : {
            isSolo: isSolo,
            isJumbo: isJumbo,
            tractorAxles: 1,
            trailerAxles: isSolo ? 0 : 3,
            distFrontToKingpin: 1.7,
            distKingpinToTrailer: 7.7,
            distFrontAxleToKingpin: 3.1,
            distKingpinToDrive: 0.5,
            distCargoStartToFront: 1.0,
            distCargoStartToDrive: 5.5,
            distSection1StartToFront: 1.0,
            distSection1StartToDrive: 5.5,
            distSection2StartToTrailerAxles: 5.5
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
        const containerFront = -dimensions.length / 2;
        const containerEnd = dimensions.length / 2;
        
        let kingPinX, trailerAxlesX, frontAxleX, driveAxlesCenter;
        
        if (isSolo) {
            // For SOLO: positions are relative to cargo space start
            // distCargoStartToFront is positive distance, so subtract to go before cargo start
            const distToFront = config.distCargoStartToFront || 1.0;
            const distToDrive = config.distCargoStartToDrive || 5.5;
            frontAxleX = containerFront - distToFront;
            driveAxlesCenter = containerFront + distToDrive;
            // No kingpin or trailer axles for SOLO
            kingPinX = null;
            trailerAxlesX = null;
        } else if (isJumbo) {
            // For JUMBO: two independent sections
            const sections = dimensions.sections || [];
            const section1Length = sections[0]?.length || 7.7;
            const section2Length = sections[1]?.length || 7.7;
            const gap = 0.5; // 50cm gap between sections
            
            // Section 1 (truck) - positions relative to section 1 start
            const section1Start = containerFront;
            const section1End = section1Start + section1Length;
            
            // Section 2 (trailer) - positions relative to section 2 start  
            const section2Start = section1End + gap;
            
            // Truck axles for section 1
            frontAxleX = section1Start - (config.distSection1StartToFront || 1.0);
            driveAxlesCenter = section1Start + (config.distSection1StartToDrive || 5.5);
            
            // Trailer axles for section 2
            trailerAxlesX = section2Start + (config.distSection2StartToTrailerAxles || 5.5);
            
            // No kingpin for JUMBO
            kingPinX = null;
        } else {
            // For trailers: standard positioning with kingpin
            kingPinX = containerFront + config.distFrontToKingpin;
            trailerAxlesX = containerFront + config.distFrontToKingpin + config.distKingpinToTrailer;
            frontAxleX = kingPinX - config.distFrontAxleToKingpin;
            driveAxlesCenter = kingPinX + config.distKingpinToDrive;
        }
        
        // Wheels configuration
        const wheelRadius = 0.546;  // Zmniejszone o 4mm aby nie nachodziły na podłogę
        const wheelWidth = 0.35;   // Zwiększone z 0.3 na 0.35 - szersze opony
        
        // Trailer axles based on configuration (skip for SOLO, but include for JUMBO)
        if (!isSolo || isJumbo) {
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
        const defaultCabinLength = 2.2; // Default cabin length (reduced by 10cm)
        const cabinWidth = 2.4;

        // Fixed cabin front position (always at frontAxle - 1.3)
        const cabinFrontX = frontAxleX - 1.3;

        // Check for collision with cargo space and adjust cabin length if needed
        // Cabin shortens from the BACK when front would collide with cargo space
        let cabinLength = defaultCabinLength;
        const cabinBackX = cabinFrontX + defaultCabinLength; // Ideal back position

        if (cabinBackX > containerFront) {
            // Collision detected - calculate maximum allowed cabin length with small buffer
            // cabinBackX = cabinFrontX + cabinLength must be <= containerFront - buffer
            const buffer = 0.02; // 2cm buffer to prevent visual overlap
            const maxCabinLength = containerFront - cabinFrontX - buffer;
            cabinLength = Math.max(0.3, Math.min(defaultCabinLength, maxCabinLength)); // Clamp between 0.3m and default
        }

        // Center position based on actual cabin length (front is fixed, back adjusts)
        const cabinX = cabinFrontX + cabinLength/2;
        // For SOLO, extend chassis to the end of cargo space
        // For JUMBO, extend chassis to the end of first section
        let chassisEndX;
        if (isSolo) {
            chassisEndX = containerEnd;
        } else if (isJumbo) {
            // For JUMBO, extend to end of first section
            const sections = dimensions.sections || [];
            const section1Length = sections[0]?.length || 7.7;
            chassisEndX = containerFront + section1Length;
        } else {
            chassisEndX = driveAxlesCenter + 1.0;
        }
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

        // Add logo on cabin sides
        const textureLoader = new THREE.TextureLoader();
        textureLoader.crossOrigin = "anonymous"; // Enable CORS
        const logoTexture = textureLoader.load(CONFIG.LOGO_URL);
        const logoAspectRatio = 3.39; // Real aspect ratio of logo (1351x398)
        const logoHeight = cabinHeight * 0.18; // 18% of cabin height
        const logoWidth = logoHeight * logoAspectRatio;

        const logoGeometry = new THREE.PlaneGeometry(logoWidth, logoHeight);
        const logoMaterial = new THREE.MeshBasicMaterial({
            map: logoTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Calculate logo Y position (lower part of cabin)
        const logoY = chassisTopY + cabinHeight * 0.10;

        // Left side logo
        const logoLeft = new THREE.Mesh(logoGeometry, logoMaterial);
        logoLeft.position.set(cabinX, logoY, -cabinWidth/2 - 0.05);
        logoLeft.rotation.y = Math.PI; // Rotate 180° to face outward (left)

        // Right side logo
        const logoRight = new THREE.Mesh(logoGeometry, logoMaterial);
        logoRight.position.set(cabinX, logoY, cabinWidth/2 + 0.05);
        logoRight.rotation.y = 0; // Face outward (right), no rotation needed

        this.truckVisualizationGroup.add(logoLeft);
        this.truckVisualizationGroup.add(logoRight);

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
        
        // Add wireframe only if less than 1000 items (performance)
        // For steel coils, don't add wireframe as it looks better without edge lines
        if (this.cargoMeshes.length < 1000 && cargoData.type !== 'steel-coil') {
            // For Roll units, only add circular edges at the bases
            if (cargoData.isRoll && !cargoData.fixedDiameter) {
                const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                
                if (cargoData.isVerticalRoll) {
                    // Vertical cylinder - add circles at top and bottom
                    const radius = cargoData.width / 2;
                    const height = cargoData.height;
                    
                    // Top circle
                    const topCircle = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false);
                    const topPoints = topCircle.getPoints(32);
                    const topGeometry = new THREE.BufferGeometry().setFromPoints(topPoints);
                    const topLine = new THREE.LineLoop(topGeometry, lineMaterial);
                    topLine.position.y = height / 2;
                    topLine.rotation.x = Math.PI / 2;
                    mesh.add(topLine);
                    
                    // Bottom circle
                    const bottomLine = new THREE.LineLoop(topGeometry.clone(), lineMaterial);
                    bottomLine.position.y = -height / 2;
                    bottomLine.rotation.x = Math.PI / 2;
                    mesh.add(bottomLine);
                } else {
                    // Horizontal cylinder - add circles at the ends
                    const diameter = cargoData.diameter || cargoData.width;
                    const radius = diameter / 2;
                    const cylinderLength = cargoData.diameter ? 
                        Math.max(cargoData.length, cargoData.width) : 
                        cargoData.length;
                    
                    // Create circle curve
                    const circle = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false);
                    const points = circle.getPoints(32);
                    const circleGeometry = new THREE.BufferGeometry().setFromPoints(points);
                    
                    // Front circle
                    const frontLine = new THREE.LineLoop(circleGeometry, lineMaterial);
                    frontLine.position.x = cylinderLength / 2;
                    frontLine.rotation.y = Math.PI / 2;
                    mesh.add(frontLine);
                    
                    // Back circle
                    const backLine = new THREE.LineLoop(circleGeometry.clone(), lineMaterial);
                    backLine.position.x = -cylinderLength / 2;
                    backLine.rotation.y = Math.PI / 2;
                    mesh.add(backLine);
                }
            } else {
                // Regular box units - add all edges
                const edges = new THREE.EdgesGeometry(geometry);
                const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                const wireframe = new THREE.LineSegments(edges, lineMaterial);
                mesh.add(wireframe);
            }
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
                // Show dimension labels for all hovered cargo
                this.createDimensionLabels(this.hoveredObject);
                // Show ruler only for cargo inside container
                if (!this.isPositionOutsideContainer(this.hoveredObject.position)) {
                    this.showRulerForCargo(this.hoveredObject);
                }
            } else {
                // Not hovering over cargo - enable OrbitControls
                this.controls.enabled = true;
                this.hoveredObject = null;
                document.body.style.cursor = 'default';
                // Hide ruler when not hovering
                this.hideRuler();
                // Hide dimension labels when not hovering
                this.hideDimensionLabels();
                
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
            orientationInfo = `${i18n.t('orientation')}: ${cargoData.isVerticalRoll ? `⬆ ${i18n.t('vertical')}` : `➡ ${i18n.t('horizontal')}`}<br>`;
        }

        // Get group info if selected and unit is inside
        let groupInfo = '';
        if (isGroupSelected) {
            const groupMeshesInside = this.cargoMeshes.filter(m =>
                m.userData &&
                m.userData.groupId === cargoData.groupId &&
                !this.isPositionOutsideContainer(m.position)
            );
            groupInfo = `<div style="color: #10b981; font-weight: bold; margin-bottom: 4px;">✓ ${i18n.t('selectedGroupInfo').replace('{count}', groupMeshesInside.length)}</div>`;
        }

        detailsSection.innerHTML = `
            ${groupInfo}
            <strong style="color: #333;">${cargoData.name || 'Unit'}</strong><br>
            ${i18n.t('dimensions')}: ${(cargoData.length*100).toFixed(0)}×${(cargoData.width*100).toFixed(0)}×${(cargoData.height*100).toFixed(0)} cm<br>
            ${i18n.t('weight')}: ${cargoData.weight} kg<br>
            ${orientationInfo}
            ${i18n.t('stacking')}: ${cargoData.maxStack || 0} ${i18n.t('pcs')}<br>
            ${i18n.t('loading')}: ${this.formatMethods(cargoData.loadingMethods)}<br>
            ${i18n.t('unloading')}: ${this.formatMethods(cargoData.unloadingMethods)}
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
                // For Roll units, check orientation for rotation options
                if (cargoData.isRoll && !cargoData.fixedDiameter) {
                    if (!cargoData.isVerticalRoll) {
                        // Horizontal roll - can rotate 90/-90
                        menuItems.push(
                            { text: `↻ ${i18n.t('rotateRight')}`, action: () => this.rotateUnit(mesh, 90) },
                            { text: `↺ ${i18n.t('rotateLeft')}`, action: () => this.rotateUnit(mesh, -90) },
                            { separator: true }
                        );
                    }
                    // Always show orientation toggle for rolls
                    menuItems.push(
                        { text: cargoData.isVerticalRoll ? `➡ ${i18n.t('changeToHorizontal')}` : `⬆ ${i18n.t('changeToVertical')}`,
                          action: () => this.toggleRollOrientation(mesh) },
                        { separator: true }
                    );
                } else {
                    // Regular units - can rotate 90/-90
                    menuItems.push(
                        { text: `↻ ${i18n.t('rotateRight')}`, action: () => this.rotateUnit(mesh, 90) },
                        { text: `↺ ${i18n.t('rotateLeft')}`, action: () => this.rotateUnit(mesh, -90) },
                        { separator: true }
                    );
                }
            }
            menuItems.push(
                { text: `🗑️ ${i18n.t('removeUnit')}`, action: () => this.removeUnit(mesh), style: 'color: #dc3545;' }
            );
        } else if (isGroupSelected) {
            // Group operations - only for units inside container
            // Steel Coil groups cannot be rotated
            if (!isSteelCoil) {
                // For Roll groups, check orientation for rotation options
                if (cargoData.isRoll && !cargoData.fixedDiameter) {
                    if (!cargoData.isVerticalRoll) {
                        // Horizontal roll group - can rotate 90/-90
                        menuItems.push(
                            { text: `↻ ${i18n.t('rotateGroupRight')}`, action: () => this.rotateGroup(cargoData.groupId, 90), style: 'font-weight: bold; color: #10b981;' },
                            { text: `↺ ${i18n.t('rotateGroupLeft')}`, action: () => this.rotateGroup(cargoData.groupId, -90), style: 'font-weight: bold; color: #10b981;' },
                            { separator: true }
                        );
                    }
                    // Note: Orientation toggle not available for groups - only individual units
                } else {
                    // Regular unit groups - can rotate 90/-90
                    menuItems.push(
                        { text: `↻ ${i18n.t('rotateGroupRight')}`, action: () => this.rotateGroup(cargoData.groupId, 90), style: 'font-weight: bold; color: #10b981;' },
                        { text: `↺ ${i18n.t('rotateGroupLeft')}`, action: () => this.rotateGroup(cargoData.groupId, -90), style: 'font-weight: bold; color: #10b981;' },
                        { separator: true }
                    );
                }
            }
            menuItems.push(
                { text: `📦 ${i18n.t('moveGroupOutsideSpace')}`, action: () => this.moveGroupOutsideContainer(cargoData.groupId), style: 'font-weight: bold; color: #10b981;' },
                { text: `🗑️ ${i18n.t('deleteEntireGroup')}`, action: () => this.removeGroup(cargoData.groupId), style: 'font-weight: bold; color: #dc3545;' },
                { separator: true },
                { text: `❌ ${i18n.t('deselectGroup')}`, action: () => this.onGroupDeselectionRequested && this.onGroupDeselectionRequested() }
            );
        } else {
            // Individual unit operations for units inside container
            // Only show "Select group" if group has more than 1 unit inside container
            if (groupUnitsInside > 1) {
                menuItems.push(
                    { text: `🎯 ${i18n.t('selectGroup')}`, action: () => this.onGroupSelectionRequested && this.onGroupSelectionRequested(cargoData.groupId), style: 'font-weight: bold; color: #3b82f6;' },
                    { separator: true }
                );
            }

            // Steel Coils cannot be rotated
            if (!isSteelCoil) {
                // For Roll units, check orientation for rotation options
                if (cargoData.isRoll && !cargoData.fixedDiameter) {
                    if (!cargoData.isVerticalRoll) {
                        // Horizontal roll - can rotate 90/-90
                        menuItems.push(
                            { text: `↻ ${i18n.t('rotateRight')}`, action: () => this.rotateUnit(mesh, 90) },
                            { text: `↺ ${i18n.t('rotateLeft')}`, action: () => this.rotateUnit(mesh, -90) },
                            { separator: true }
                        );
                    }
                    // Always show orientation toggle for rolls
                    menuItems.push(
                        { text: cargoData.isVerticalRoll ? `➡ ${i18n.t('changeToHorizontal')}` : `⬆ ${i18n.t('changeToVertical')}`,
                          action: () => this.toggleRollOrientation(mesh) },
                        { separator: true }
                    );
                } else {
                    // Regular units - can rotate 90/-90
                    menuItems.push(
                        { text: `↻ ${i18n.t('rotateRight')}`, action: () => this.rotateUnit(mesh, 90) },
                        { text: `↺ ${i18n.t('rotateLeft')}`, action: () => this.rotateUnit(mesh, -90) },
                        { separator: true }
                    );
                }
            }
            menuItems.push(
                { text: `📦 ${i18n.t('moveOutsideSpace')}`, action: () => this.moveOutsideContainer(mesh) },
                { text: `🗑️ ${i18n.t('removeUnit')}`, action: () => this.removeUnit(mesh), style: 'color: #dc3545;' }
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
    
    toggleRollOrientation(mesh) {
        // Only for Roll units (not Steel Coils)
        if (!mesh.userData.isRoll || mesh.userData.fixedDiameter) {
            console.warn('Only Roll units can change orientation');
            return;
        }
        
        // Get the entire stack (units above AND below)
        const entireStack = this.findEntireStack(mesh.position);
        
        // Find the bottom unit of the stack (pivot point)
        const bottomUnit = entireStack[entireStack.length - 1];
        
        // Check if already outside container
        const isAlreadyOutside = this.isPositionOutsideContainer(mesh.position);
        
        // Toggle orientation for all Roll units in the stack
        entireStack.forEach(unit => {
            if (unit.userData.isRoll && !unit.userData.fixedDiameter) {
                // Store original values before change
                const oldHeight = unit.userData.height;
                const currentDiameter = unit.userData.diameter;
                const currentCylinderLength = unit.userData.isVerticalRoll ? unit.userData.height : unit.userData.length;
                
                // Toggle the orientation
                unit.userData.isVerticalRoll = !unit.userData.isVerticalRoll;
                
                if (unit.userData.isVerticalRoll) {
                    // Changing from horizontal to vertical
                    // diameter stays same, cylinder length becomes height
                    unit.userData.diameter = currentDiameter;
                    unit.userData.height = currentCylinderLength; // cylinder length becomes height
                    unit.userData.length = currentDiameter; // footprint
                    unit.userData.width = currentDiameter; // footprint
                } else {
                    // Changing from vertical to horizontal
                    // diameter stays same, cylinder length becomes length
                    unit.userData.diameter = currentDiameter;
                    unit.userData.height = currentDiameter; // height is now diameter
                    unit.userData.length = currentCylinderLength; // cylinder length
                    unit.userData.width = currentDiameter; // width is diameter
                }
                
                // Calculate new Y position to keep bottom at same level
                const heightDifference = unit.userData.height - oldHeight;
                unit.position.y += heightDifference / 2;
                
                // Update the mesh geometry
                const geometry = new THREE.CylinderGeometry(
                    unit.userData.diameter / 2,
                    unit.userData.diameter / 2,
                    unit.userData.isVerticalRoll ? unit.userData.height : unit.userData.length,
                    32
                );
                
                // Apply rotation for horizontal orientation
                if (!unit.userData.isVerticalRoll) {
                    geometry.rotateZ(Math.PI / 2);
                }
                
                // Update mesh
                unit.geometry.dispose();
                unit.geometry = geometry;
                
                // Reset rotation since we're changing orientation
                unit.rotation.y = 0;
                
                // Remove old outline (LineLoop children)
                const lineLoops = [];
                unit.children.forEach(child => {
                    if (child instanceof THREE.LineLoop) {
                        lineLoops.push(child);
                    }
                });
                lineLoops.forEach(loop => {
                    if (loop.geometry) loop.geometry.dispose();
                    if (loop.material) loop.material.dispose();
                    unit.remove(loop);
                });
                
                // Add new outline based on new orientation
                if (this.cargoMeshes.length < 100) {
                    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
                    
                    if (unit.userData.isVerticalRoll) {
                        // Vertical cylinder - add circles at top and bottom
                        const radius = unit.userData.width / 2;
                        const height = unit.userData.height;
                        
                        // Top circle
                        const topCircle = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false);
                        const topPoints = topCircle.getPoints(32);
                        const topGeometry = new THREE.BufferGeometry().setFromPoints(topPoints);
                        const topLine = new THREE.LineLoop(topGeometry, lineMaterial);
                        topLine.position.y = height / 2;
                        topLine.rotation.x = Math.PI / 2;
                        unit.add(topLine);
                        
                        // Bottom circle
                        const bottomLine = new THREE.LineLoop(topGeometry.clone(), lineMaterial);
                        bottomLine.position.y = -height / 2;
                        bottomLine.rotation.x = Math.PI / 2;
                        unit.add(bottomLine);
                    } else {
                        // Horizontal cylinder - add circles at the ends
                        const diameter = unit.userData.diameter || unit.userData.width;
                        const radius = diameter / 2;
                        const cylinderLength = unit.userData.diameter ? 
                            Math.max(unit.userData.length, unit.userData.width) : 
                            unit.userData.length;
                        
                        // Create circle curve
                        const circle = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false);
                        const points = circle.getPoints(32);
                        const circleGeometry = new THREE.BufferGeometry().setFromPoints(points);
                        
                        // Front circle
                        const frontLine = new THREE.LineLoop(circleGeometry, lineMaterial);
                        frontLine.position.x = cylinderLength / 2;
                        frontLine.rotation.y = Math.PI / 2;
                        unit.add(frontLine);
                        
                        // Back circle
                        const backLine = new THREE.LineLoop(circleGeometry.clone(), lineMaterial);
                        backLine.position.x = -cylinderLength / 2;
                        backLine.rotation.y = Math.PI / 2;
                        unit.add(backLine);
                    }
                }
                
                // Update userData position
                unit.userData.position = {
                    x: unit.position.x,
                    y: unit.position.y,
                    z: unit.position.z
                };
            }
        });
        
        // If outside container, just update and return
        if (isAlreadyOutside) {
            // Notify about changes
            if (this.onCargoMoved) {
                this.onCargoMoved(entireStack.map(m => m.userData));
            }
            return;
        }
        
        // Find valid position for the reoriented stack
        const testPositions = entireStack.map(unit => ({
            unit: unit,
            newX: unit.position.x,
            newZ: unit.position.z,
            newLength: unit.userData.length,
            newWidth: unit.userData.width,
            y: unit.position.y
        }));
        
        const result = this.findValidPositionForRotatedStack(testPositions, entireStack);
        
        if (result.shouldMoveOutside) {
            this.moveOutsideContainer(bottomUnit);
            console.warn('No valid position found for orientation change - units moved outside container');
            return;
        }
        
        const adjustedPositions = result.positions || result;
        
        // Apply the adjusted positions
        adjustedPositions.forEach(test => {
            const unit = test.unit;
            
            // Update position
            unit.position.x = test.newX;
            unit.position.z = test.newZ;
            
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
    
    rotateUnit(mesh, angle) {
        // Check if this is a Steel Coil - they cannot be rotated
        if (mesh.userData.type === 'steel-coil' || mesh.userData.fixedDiameter) {
            console.warn('Steel Coils cannot be rotated');
            return;
        }
        
        // Check if this is a vertical Roll - they cannot be rotated
        if (mesh.userData.isRoll && mesh.userData.isVerticalRoll) {
            console.warn('Vertical Rolls cannot be rotated. Use orientation toggle instead.');
            return;
        }
        
        // Get the entire stack (units above AND below)
        const entireStack = this.findEntireStack(mesh.position);
        
        // Find the bottom unit of the stack (pivot point)
        const bottomUnit = entireStack[entireStack.length - 1]; // Last in sorted array is bottom
        
        // Check if the unit is already outside the container
        const isAlreadyOutside = this.isPositionOutsideContainer(mesh.position);
        
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
        
        // If unit is already outside container, just rotate in place
        if (isAlreadyOutside) {
            // Just apply the rotation without looking for a new position
            entireStack.forEach(unit => {
                // Update rotation
                unit.rotation.y += radians;
                
                // Update dimensions in userData
                if (Math.abs(angle) === 90) {
                    const tempLength = unit.userData.length;
                    unit.userData.length = unit.userData.width;
                    unit.userData.width = tempLength;
                }
                
                // Update userData position (stays the same, just dimensions change)
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
            return;
        }
        
        // Find a valid position for the rotated stack (only for units inside container)
        const result = this.findValidPositionForRotatedStack(testPositions, entireStack);
        
        // Check if we found a valid position or need to move outside
        if (result.shouldMoveOutside) {
            // First apply the rotation to the units
            entireStack.forEach((unit, index) => {
                // Update rotation
                unit.rotation.y += radians;
                
                // Update dimensions in userData
                if (Math.abs(angle) === 90) {
                    const tempLength = unit.userData.length;
                    unit.userData.length = unit.userData.width;
                    unit.userData.width = tempLength;
                }
            });
            
            // Then move the entire stack outside the container
            // Use the bottom unit as the reference for moving outside
            this.moveOutsideContainer(bottomUnit);
            
            console.warn('No valid position found for rotation - units moved outside container');
            return;
        }
        
        const adjustedPositions = result.positions || result;
        
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
            return { positions: testPositions, shouldMoveOutside: false };
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
        // Calculate search radius based on container dimensions to cover entire space
        const containerLength = this.containerBounds ? 
            (this.containerBounds.max.x - this.containerBounds.min.x) : 20;
        const containerWidth = this.containerBounds ? 
            (this.containerBounds.max.z - this.containerBounds.min.z) : 10;
        const searchRadius = Math.max(containerLength, containerWidth); // Search entire container space
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
                        return { positions: bestPosition, shouldMoveOutside: false };
                    }
                }
            }
            
            // If we found any valid position within current radius, use it
            if (bestPosition) {
                return { positions: bestPosition, shouldMoveOutside: false };
            }
        }
        
        // No valid position found in the entire container space
        // Return signal to move units outside
        return { positions: testPositions, shouldMoveOutside: true };
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
                
                // Additional check for JUMBO - ensure units don't overlap the gap
                if (this.containerBounds.isJumbo && this.containerBounds.sections) {
                    const gap = 0.5; // 50cm gap between sections
                    const section1Start = this.containerBounds.min.x;
                    const section1End = section1Start + this.containerBounds.sections[0].length;
                    const section2Start = section1End + gap;
                    
                    const unitStart = test.newX - halfLength;
                    const unitEnd = test.newX + halfLength;
                    
                    // Check if unit overlaps with gap area
                    // Unit is invalid if it starts before section2 and ends after section1
                    // (i.e., it spans the gap)
                    if (unitStart < section2Start && unitEnd > section1End) {
                        return false; // Unit would overlap the gap
                    }
                    
                    // Also check if unit is completely within the gap
                    if (unitStart >= section1End && unitEnd <= section2Start) {
                        return false; // Unit would be entirely in the gap
                    }
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
        // Hide ruler and dimension labels if visible
        this.hideRuler();
        this.hideDimensionLabels();

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
                        
                        // Update dimension labels for units outside container
                        this.createDimensionLabels(this.draggedObjects[0]);
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

        // Get reference values from first coil
        const firstCoil = this.draggedObjects[0];
        const coilRadius = firstCoil.userData.height / 2;
        const coilLength = firstCoil.userData.length;

        const clamped = position.clone();

        // Calculate groove position in container coordinates
        const containerHalfLength = this.containerBounds.containerLength / 2;
        const grooveStartX = -containerHalfLength + this.containerBounds.grooveStartX;
        const grooveEndX = grooveStartX + this.containerBounds.grooveLength;

        // Find all Steel Coils in dragged objects
        const steelCoils = this.draggedObjects.filter(obj =>
            obj.userData && obj.userData.fixedDiameter
        );

        if (steelCoils.length > 1) {
            // Multiple Steel Coils - calculate safe delta for entire group
            // Calculate what delta X would be for the first coil
            const originalFirstX = firstCoil.position.x;
            const basicMinX = grooveStartX + coilLength / 2;
            const basicMaxX = grooveEndX - coilLength / 2;
            const desiredFirstX = Math.max(basicMinX, Math.min(basicMaxX, position.x));
            const deltaX = desiredFirstX - originalFirstX;

            // Check if this delta would keep all coils within bounds
            let maxAllowedDelta = deltaX;
            for (let coil of steelCoils) {
                const coilLen = coil.userData.length;
                const newCoilX = coil.position.x + deltaX;
                const coilMinX = grooveStartX + coilLen / 2;
                const coilMaxX = grooveEndX - coilLen / 2;

                // If this coil would go out of bounds with current delta, restrict delta
                if (newCoilX < coilMinX) {
                    // Coil would go too far left - limit delta
                    const necessaryDelta = coilMinX - coil.position.x;
                    // Choose the delta that moves less (closer to 0 in the direction of movement)
                    if (deltaX < 0) {
                        // Moving left - choose larger (less negative) delta
                        maxAllowedDelta = Math.max(maxAllowedDelta, necessaryDelta);
                    } else {
                        // Not moving left but coil would be out - something is wrong, restrict to 0
                        maxAllowedDelta = 0;
                    }
                } else if (newCoilX > coilMaxX) {
                    // Coil would go too far right - limit delta
                    const necessaryDelta = coilMaxX - coil.position.x;
                    // Choose the delta that moves less (closer to 0 in the direction of movement)
                    if (deltaX > 0) {
                        // Moving right - choose smaller (less positive) delta
                        maxAllowedDelta = Math.min(maxAllowedDelta, necessaryDelta);
                    } else {
                        // Not moving right but coil would be out - something is wrong, restrict to 0
                        maxAllowedDelta = 0;
                    }
                }
            }

            // Apply the most restrictive delta
            clamped.x = originalFirstX + maxAllowedDelta;
        } else {
            // Single Steel Coil or no Steel Coils - use original logic
            const minX = grooveStartX + coilLength / 2;
            const maxX = grooveEndX - coilLength / 2;
            clamped.x = Math.max(minX, Math.min(maxX, position.x));
        }

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
        
        // Special handling for JUMBO - magnetic snapping to section boundary
        if (this.containerBounds.isJumbo && this.containerBounds.sections) {
            const gap = 0.5; // 50cm gap between sections
            const section1Start = this.containerBounds.min.x;
            const section1End = section1Start + this.containerBounds.sections[0].length;
            const section2Start = section1End + gap;
            
            // Define magnetic snapping zone (30cm before the wall)
            const snapDistance = 0.3; // 30cm snap zone
            const snapStrength = 0.15; // How far from wall to snap (15cm)
            
            const unitEnd = position.x + halfLength;
            const unitStart = position.x - halfLength;
            
            // Check if unit is in Section 2 and approaching the wall from the right
            if (unitStart >= section2Start) {
                // Calculate distance from unit's left edge to wall (section2 start)
                const distanceToWall = unitStart - section2Start;
                
                // If within snap zone, apply magnetic effect
                if (distanceToWall < snapDistance) {
                    // Calculate snap position (unit touches the wall with small gap)
                    const snapX = section2Start + halfLength + snapStrength;
                    
                    // Apply progressive resistance - the closer to wall, the stronger the snap
                    const snapFactor = 1 - (distanceToWall / snapDistance);
                    
                    // Blend between desired position and snap position based on proximity
                    clamped.x = position.x * (1 - snapFactor * 0.7) + snapX * (snapFactor * 0.7);
                    
                    // If very close to snap position, fully snap to it
                    if (Math.abs(clamped.x - snapX) < 0.05) {
                        clamped.x = snapX;
                    }
                }
            }
            
            // Still apply normal bounds checking to prevent going into the gap
            const minX = this.containerBounds.min.x + halfLength;
            const maxX = this.containerBounds.max.x - halfLength;
            
            // Additional check - prevent unit from entering the gap area
            const clampedUnitStart = clamped.x - halfLength;
            const clampedUnitEnd = clamped.x + halfLength;
            
            // If unit would overlap the gap, push it to the nearest valid section
            if (clampedUnitStart < section2Start && clampedUnitEnd > section1End) {
                // Unit spans the gap - determine which section it's closer to
                const distToSection1 = Math.abs(position.x - (section1End - halfLength));
                const distToSection2 = Math.abs(position.x - (section2Start + halfLength));
                
                if (distToSection1 < distToSection2) {
                    // Closer to section 1 - place at section 1 boundary
                    clamped.x = Math.min(section1End - halfLength, clamped.x);
                } else {
                    // Closer to section 2 - place at section 2 boundary
                    clamped.x = Math.max(section2Start + halfLength, clamped.x);
                }
            }
            
            // Final bounds check
            clamped.x = Math.max(minX, Math.min(maxX, clamped.x));
        } else {
            // Regular container - standard clamping
            const minX = this.containerBounds.min.x + halfLength;
            const maxX = this.containerBounds.max.x - halfLength;
            clamped.x = Math.max(minX, Math.min(maxX, position.x));
        }
        
        // Clamp Z position to keep ALL units inside container (same for all container types)
        const minZ = this.containerBounds.min.z + halfWidth;
        const maxZ = this.containerBounds.max.z - halfWidth;
        clamped.z = Math.max(minZ, Math.min(maxZ, position.z));
        
        // Ensure Y position doesn't go below ground
        clamped.y = Math.max(0, position.y);
        
        return clamped;
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
        const snapThreshold = draggedData.isVerticalRoll ? 0.15 : 0.5; // Rolls: 15cm, others: 50cm
        
        // Check all cargo meshes for stacking or side snapping
        for (let mesh of this.cargoMeshes) {
            // Skip the dragged objects
            if (this.draggedObjects.includes(mesh)) continue;
            
            const targetData = mesh.userData;
            const targetHalfWidth = targetData.width / 2;
            const targetHalfLength = targetData.length / 2;
            const targetHalfHeight = targetData.height / 2;
            
            // Calculate how close to the center of the unit we are (0 = edge, 1 = center)
            const xDistance = Math.abs(adjustedPosition.x - mesh.position.x);
            const zDistance = Math.abs(adjustedPosition.z - mesh.position.z);
            const xRatio = targetHalfLength > 0 ? (1 - xDistance / targetHalfLength) : 0;
            const zRatio = targetHalfWidth > 0 ? (1 - zDistance / targetHalfWidth) : 0;
            const centerRatio = Math.min(xRatio, zRatio); // 0 at edge, 1 at center
            
            // Check if cursor is directly over the target unit's surface
            const cursorOverX = xDistance <= targetHalfLength;
            const cursorOverZ = zDistance <= targetHalfWidth;
            
            // Prioritize stacking only if cursor is directly over the unit AND reasonably close to center
            // Use centerRatio > 0.25 to require being at least 25% toward center for stacking
            if (cursorOverX && cursorOverZ && centerRatio > 0.25) {
                // We're over the unit and close enough to center - try to stack on top
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
                // Not over this unit OR near edge - check for side snapping
                // Also check units that we're over but near the edge (centerRatio <= 0.25)
                const shouldConsiderSideSnap = !cursorOverX || !cursorOverZ || centerRatio <= 0.25;
                
                if (shouldConsiderSideSnap) {
                    const distance = Math.sqrt(
                        Math.pow(adjustedPosition.x - mesh.position.x, 2) + 
                        Math.pow(adjustedPosition.z - mesh.position.z, 2)
                    );
                    
                    // Consider units on the same floor level for side snapping
                    // Calculate expected Y position for dragged unit at same level as target
                    const targetFloorY = mesh.position.y - targetHalfHeight + halfHeight;
                    const onSameFloor = Math.abs(targetY - targetFloorY) < 0.2; // 20cm tolerance for same floor
                    
                    // Also check if we're NOT currently above a higher unit (to avoid side-snapping when we should be stacking)
                    const notAboveHigherUnit = !isStacking || mesh.position.y < targetY - halfHeight;
                    
                    if (onSameFloor && distance < closestDistance && notAboveHigherUnit) {
                        closestDistance = distance;
                        closestUnit = mesh;
                    }
                }
            }
        }
        
        // If not stacking and we have a close unit, snap to its side
        // Use full snapThreshold for better side snapping
        if (!isStacking && closestUnit && closestDistance < snapThreshold) {
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
            // Set Y to same level as the target unit (for side-by-side placement on same floor)
            targetY = closestUnit.position.y - closestUnit.userData.height / 2 + halfHeight;
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
        const canStack = this.canStackOn(targetMesh, proposedPosition, draggedData);
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
        // We're dragging a group if:
        // 1. We have a selected group
        // 2. We're dragging multiple objects from that group (not just a single unit)
        // A single unit from a group dragged from outside should use single validation
        const groupObjectsCount = this.draggedObjects.filter(obj => 
            obj.userData && obj.userData.groupId === this.selectedGroupId
        ).length;
        
        const isDraggingGroup = this.selectedGroupId && 
                                this.draggedObjects[0].userData &&
                                this.draggedObjects[0].userData.groupId === this.selectedGroupId &&
                                groupObjectsCount > 1; // Must be dragging multiple units from the group
        
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
        if (!methods || methods.length === 0) return i18n.t('back');
        const methodNames = {
            'rear': i18n.t('back'),
            'side': i18n.t('side'),
            'top': i18n.t('top')
        };
        return methods.map(m => methodNames[m] || m).join(', ');
    }
    
    canStackOn(targetMesh, proposedPosition = null, draggedData = null) {
        // Check if the target allows stacking
        const targetData = targetMesh.userData;
        
        // Use passed draggedData or try to get from draggedObjects
        if (!draggedData) {
            draggedData = this.draggedObjects[0]?.userData;
        }
        
        if (!targetData || !draggedData) return false;
        
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
        const draggedStackSize = this.draggedObjects.length || 1;
        
        // Calculate total weight of dragged stack
        let draggedStackWeight = 0;
        if (this.draggedObjects.length > 0) {
            for (let obj of this.draggedObjects) {
                draggedStackWeight += obj.userData.weight || 0;
            }
        } else {
            // If not dragging, use the passed draggedData weight
            draggedStackWeight = draggedData.weight || 0;
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
                if ((this.draggedObjects.length > 0 && this.draggedObjects.includes(mesh)) || supportingUnits.has(mesh)) continue;
                
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
                    if ((this.draggedObjects.length > 0 && this.draggedObjects.includes(mesh)) || supportedUnits.has(mesh)) continue;
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
        
        // Note: dimension labels are managed separately and not hidden with ruler
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

        // Get dimensions from userData (these reflect the logical dimensions after rotation)
        const halfLength = mesh.userData.length / 2;
        const halfWidth = mesh.userData.width / 2;
        const halfHeight = mesh.userData.height / 2;

        // For local space calculations (vertices), we need the actual geometry dimensions
        // which don't change when mesh is rotated - only mesh.rotation changes
        // Check if mesh is rotated 90 or -90 degrees
        const rotation = mesh.rotation.y;
        const isRotated90 = Math.abs(Math.abs(rotation) - Math.PI/2) < 0.1;

        // For local vertices, use geometry dimensions (swap if rotated)
        let localHalfLength = halfLength;
        let localHalfWidth = halfWidth;

        if (isRotated90) {
            // Geometry still has original dimensions, so swap back for local calculations
            localHalfLength = halfWidth;
            localHalfWidth = halfLength;
        }
        
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
        // Use LOCAL dimensions (from geometry, not userData) for vertex positions
        const edgeMap = {
            0: { // back-bottom-left
                edges: [
                    { dimension: 'length', start: [-localHalfLength, -halfHeight, -localHalfWidth], end: [localHalfLength, -halfHeight, -localHalfWidth] },
                    { dimension: 'width', start: [-localHalfLength, -halfHeight, -localHalfWidth], end: [-localHalfLength, -halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [-localHalfLength, -halfHeight, -localHalfWidth], end: [-localHalfLength, halfHeight, -localHalfWidth] }
                ]
            },
            1: { // back-bottom-right
                edges: [
                    { dimension: 'length', start: [-localHalfLength, -halfHeight, -localHalfWidth], end: [localHalfLength, -halfHeight, -localHalfWidth] },
                    { dimension: 'width', start: [localHalfLength, -halfHeight, -localHalfWidth], end: [localHalfLength, -halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [localHalfLength, -halfHeight, -localHalfWidth], end: [localHalfLength, halfHeight, -localHalfWidth] }
                ]
            },
            2: { // front-bottom-right
                edges: [
                    { dimension: 'length', start: [-localHalfLength, -halfHeight, localHalfWidth], end: [localHalfLength, -halfHeight, localHalfWidth] },
                    { dimension: 'width', start: [localHalfLength, -halfHeight, -localHalfWidth], end: [localHalfLength, -halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [localHalfLength, -halfHeight, localHalfWidth], end: [localHalfLength, halfHeight, localHalfWidth] }
                ]
            },
            3: { // front-bottom-left
                edges: [
                    { dimension: 'length', start: [-localHalfLength, -halfHeight, localHalfWidth], end: [localHalfLength, -halfHeight, localHalfWidth] },
                    { dimension: 'width', start: [-localHalfLength, -halfHeight, -localHalfWidth], end: [-localHalfLength, -halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [-localHalfLength, -halfHeight, localHalfWidth], end: [-localHalfLength, halfHeight, localHalfWidth] }
                ]
            },
            4: { // back-top-left
                edges: [
                    { dimension: 'length', start: [-localHalfLength, halfHeight, -localHalfWidth], end: [localHalfLength, halfHeight, -localHalfWidth] },
                    { dimension: 'width', start: [-localHalfLength, halfHeight, -localHalfWidth], end: [-localHalfLength, halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [-localHalfLength, -halfHeight, -localHalfWidth], end: [-localHalfLength, halfHeight, -localHalfWidth] }
                ]
            },
            5: { // back-top-right
                edges: [
                    { dimension: 'length', start: [-localHalfLength, halfHeight, -localHalfWidth], end: [localHalfLength, halfHeight, -localHalfWidth] },
                    { dimension: 'width', start: [localHalfLength, halfHeight, -localHalfWidth], end: [localHalfLength, halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [localHalfLength, -halfHeight, -localHalfWidth], end: [localHalfLength, halfHeight, -localHalfWidth] }
                ]
            },
            6: { // front-top-right
                edges: [
                    { dimension: 'length', start: [-localHalfLength, halfHeight, localHalfWidth], end: [localHalfLength, halfHeight, localHalfWidth] },
                    { dimension: 'width', start: [localHalfLength, halfHeight, -localHalfWidth], end: [localHalfLength, halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [localHalfLength, -halfHeight, localHalfWidth], end: [localHalfLength, halfHeight, localHalfWidth] }
                ]
            },
            7: { // front-top-left
                edges: [
                    { dimension: 'length', start: [-localHalfLength, halfHeight, localHalfWidth], end: [localHalfLength, halfHeight, localHalfWidth] },
                    { dimension: 'width', start: [-localHalfLength, halfHeight, -localHalfWidth], end: [-localHalfLength, halfHeight, localHalfWidth] },
                    { dimension: 'height', start: [-localHalfLength, -halfHeight, localHalfWidth], end: [-localHalfLength, halfHeight, localHalfWidth] }
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
                                const xOffset = cameraRelative.x > 0 ? localHalfLength : -localHalfLength;
                                const localLabelPos = new THREE.Vector3(xOffset, 0, 0);
                                localLabelPos.applyQuaternion(mesh.quaternion);
                                labelPosition = localLabelPos.add(meshWorldPos);
                                radiusStart = new THREE.Vector3(xOffset, 0, 0);
                                radiusEnd = new THREE.Vector3(xOffset, halfHeight, 0);
                            } else if (isRoll && isVerticalRoll) {
                                // Vertical cylinder - choose top or bottom face based on camera
                                const yOffset = cameraRelative.y > 0 ? halfHeight : -halfHeight;
                                const localLabelPos = new THREE.Vector3(0, yOffset, 0);
                                localLabelPos.applyQuaternion(mesh.quaternion);
                                labelPosition = localLabelPos.add(meshWorldPos);
                                radiusStart = new THREE.Vector3(0, yOffset, 0);
                                radiusEnd = new THREE.Vector3(localHalfWidth, yOffset, 0);
                            } else if (isRoll && !isVerticalRoll) {
                                // Horizontal cylinder along X axis - choose front or back face based on camera
                                const xOffset = cameraRelative.x > 0 ? localHalfLength : -localHalfLength;
                                const localLabelPos = new THREE.Vector3(xOffset, 0, 0);
                                localLabelPos.applyQuaternion(mesh.quaternion);
                                labelPosition = localLabelPos.add(meshWorldPos);
                                radiusStart = new THREE.Vector3(xOffset, 0, 0);
                                radiusEnd = new THREE.Vector3(xOffset, localHalfWidth, 0);
                            }
                        } else if (isHeight || isLength) {
                            // Height/Length label - position at center of cylinder LENGTH FACE (not cylinder center)
                            if (isHeight) {
                                // Vertical Roll - position on the side surface of cylinder
                                // Choose front or back based on camera position
                                const zOffset = cameraRelative.z > 0 ? localHalfWidth : -localHalfWidth;
                                const localLabelPos = new THREE.Vector3(0, 0, zOffset);
                                localLabelPos.applyQuaternion(mesh.quaternion);
                                labelPosition = localLabelPos.add(meshWorldPos);
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
                                const zOffset = Math.sin(angleToCamera) * localHalfWidth;

                                const localLabelPos = new THREE.Vector3(0, yOffset, zOffset);
                                localLabelPos.applyQuaternion(mesh.quaternion);
                                labelPosition = localLabelPos.add(meshWorldPos);
                                // Horizontal line for length at the same position
                                radiusStart = new THREE.Vector3(-localHalfLength, yOffset, zOffset);
                                radiusEnd = new THREE.Vector3(localHalfLength, yOffset, zOffset);
                            }
                        }
                        
                        // Transform dummy line to world space for orientation
                        // Apply mesh rotation (important for rotated horizontal rolls)
                        radiusStart.applyQuaternion(mesh.quaternion);
                        radiusEnd.applyQuaternion(mesh.quaternion);

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

                // Create edge start and end in local space
                const edgeStartLocal = new THREE.Vector3(
                    edge.start[0],
                    edge.start[1],
                    edge.start[2]
                );

                const edgeEndLocal = new THREE.Vector3(
                    edge.end[0],
                    edge.end[1],
                    edge.end[2]
                );

                // Transform local coordinates through mesh rotation (for rotated units)
                edgeStartLocal.applyQuaternion(mesh.quaternion);
                edgeEndLocal.applyQuaternion(mesh.quaternion);

                // Add mesh world position to get world coordinates
                const edgeStartWorld = edgeStartLocal.clone().add(vertexData.meshWorldPos);
                const edgeEndWorld = edgeEndLocal.clone().add(vertexData.meshWorldPos);

                // Calculate edge center in world space
                const edgeCenter = new THREE.Vector3()
                    .addVectors(edgeStartWorld, edgeEndWorld)
                    .multiplyScalar(0.5);

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
                    sprite.material.needsUpdate = true;  // Ensure material updates
                    
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
        
        // Update blinking for overloaded axle labels
        this.updateAxleLoadBlinking();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // Update blinking animation for overloaded axle labels
    updateAxleLoadBlinking() {
        if (!this.axleLoadGroup || !this.showAxleLoads) return;
        
        const currentTime = Date.now();
        
        this.axleLoadGroup.traverse((child) => {
            if (child.userData.isOverloaded) {
                // Check if it's time to toggle the blink state (every 0.5 second)
                if (currentTime - child.userData.lastBlinkTime >= 500) {
                    child.userData.lastBlinkTime = currentTime;
                    child.userData.blinkState = !child.userData.blinkState;
                    
                    // Redraw with current text and blinking color
                    const text = child.userData.currentText || '0.0t';
                    this.redrawAxleLabel(child, text, child.userData.blinkState);
                }
            }
        });
    }
    
    exportToPNG() {
        return new Promise((resolve) => {
            this.renderer.render(this.scene, this.camera);
            this.renderer.domElement.toBlob((blob) => {
                resolve(blob);
            });
        });
    }
    
    getOrdinalSuffix(num) {
        // Get English ordinal suffix (st, nd, rd, th)
        const j = num % 10;
        const k = num % 100;
        
        if (j == 1 && k != 11) {
            return 'st';
        }
        if (j == 2 && k != 12) {
            return 'nd';
        }
        if (j == 3 && k != 13) {
            return 'rd';
        }
        return 'th';
    }
    
    createInfoBoxSprite(group, position, baseBoxWidth = 4.28) {
        // Create canvas for the info box - matching UI card style
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        // Use higher resolution for better quality (3x scale for sharper text)
        const scale = 3;
        canvas.width = 280 * scale;
        canvas.height = 150 * scale;
        
        // Enable better text rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Scale context for drawing
        context.scale(scale, scale);
        
        // White background with slight shadow
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 280, 150);
        
        // Draw border
        context.strokeStyle = 'rgba(0,0,0,0.05)';
        context.lineWidth = 1;
        context.strokeRect(0, 0, 280, 150);
        
        // Draw header background
        context.fillStyle = '#f7f9fc';
        context.fillRect(0, 0, 280, 30);
        
        // Draw header bottom border
        context.strokeStyle = '#e0e6ed';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, 30);
        context.lineTo(280, 30);
        context.stroke();
        
        // Check if this is an overflow box
        const isOverflow = position.userData?.isOverflow;
        const overflowCount = position.userData?.overflowCount || 0;
        
        if (isOverflow) {
            // Special overflow box design
            context.fillStyle = '#94a3b8';
            context.font = 'bold 14px Arial';
            context.textAlign = 'center';
            context.fillText(`+ ${overflowCount} other groups`, 140, 75);
            
            context.font = '11px Arial';
            context.fillText('Details below', 140, 95);
            context.textAlign = 'left';
        } else {
            // Normal info box
            // Get first item as sample for group properties
            const sampleItem = group.items[0];
            
            // HEADER - number, color dot, quantity badge, name
            // Order number with ordinal suffix
            const orderNum = group.orderIndex || 1;
            const ordinalSuffix = this.getOrdinalSuffix(orderNum);
            
            // Draw number
            context.fillStyle = '#94a3b8';
            context.font = 'bold 11px Arial';
            context.fillText(orderNum.toString(), 10, 20);
            
            // Measure number width to position suffix
            const numWidth = context.measureText(orderNum.toString()).width;
            
            // Draw smaller suffix
            context.font = '8px Arial';  // Smaller font for suffix
            context.fillText(ordinalSuffix, 10 + numWidth, 20);
        
        // Shape indicator based on unit type (circle for cylindrical, square for box)
        const isCylindrical = sampleItem.isRoll || sampleItem.type === 'steel-coil';
        context.fillStyle = group.color || '#4A90E2';
        
        if (isCylindrical) {
            // Circle for Roll/Steel Coil
            context.beginPath();
            context.arc(38, 15, 8, 0, 2 * Math.PI);
            context.fill();
        } else {
            // Square for box units
            context.fillRect(30, 7, 16, 16);
        }
        
        // Quantity text next to shape
        context.fillStyle = '#1e293b';
        context.font = 'bold 11px Arial';
        context.textAlign = 'left';
        context.fillText(`× ${group.count}`, 52, 19);
        
        // Name
        context.fillStyle = '#1e293b';
        context.font = 'bold 11px Arial';
        context.textAlign = 'left';
        context.fillText(group.name, 92, 19);
        
        // CONTENT - two rows, four columns each
        // Row 1
        context.fillStyle = '#64748b';
        context.font = '9px Arial';
        context.fillText('Dimensions', 10, 45);
        context.fillStyle = '#1e293b';
        context.font = 'bold 11px Arial';
        const dims = `${(sampleItem.length*100).toFixed(0)}×${(sampleItem.width*100).toFixed(0)}×${(sampleItem.height*100).toFixed(0)} cm`;
        context.fillText(dims, 10, 58);
        context.fillStyle = '#94a3b8';
        context.font = '8px Arial';
        context.fillText('(L / W / H)', 10, 68);
        
        // Column 2 - Weight
        context.fillStyle = '#64748b';
        context.font = '9px Arial';
        context.fillText('Unit weight', 150, 45);
        context.fillStyle = '#1e293b';
        context.font = 'bold 11px Arial';
        context.fillText(`${sampleItem.weight} kg`, 150, 58);
        
        // Row 2
        // Column 1 - Stacking
        context.fillStyle = '#64748b';
        context.font = '9px Arial';
        context.fillText('Stacking', 10, 85);
        context.fillStyle = '#1e293b';
        context.font = 'bold 11px Arial';
        context.fillText(`${sampleItem.maxStack || 0}`, 10, 98);
        context.font = '10px Arial';
        context.fillStyle = '#64748b';
        context.fillText(` / `, 25, 98);
        context.fillStyle = '#1e293b';
        context.fillText(`${sampleItem.maxStackWeight || 0}kg`, 35, 98);
        
        // Column 2 - Loading/Unloading
        context.fillStyle = '#64748b';
        context.font = '9px Arial';
        context.fillText('Loading', 150, 85);
        const loadingMethodsDisplay = ['Back', 'Side', 'Top'];
        const loadingMethodsData = ['rear', 'side', 'top'];
        let xPos = 150;
        loadingMethodsDisplay.forEach((method, idx) => {
            const isActive = sampleItem.loadingMethods && sampleItem.loadingMethods.includes(loadingMethodsData[idx]);
            context.fillStyle = isActive ? '#10b981' : '#e2e8f0';
            context.font = 'bold 8px Arial';
            context.fillText(method, xPos, 98);
            xPos += 22;
        });
        
        context.fillStyle = '#64748b';
        context.font = '9px Arial';
        context.fillText('Unloading', 150, 108);
        xPos = 150;
        loadingMethodsDisplay.forEach((method, idx) => {
            const isActive = sampleItem.unloadingMethods && sampleItem.unloadingMethods.includes(loadingMethodsData[idx]);
            context.fillStyle = isActive ? '#10b981' : '#e2e8f0';
            context.font = 'bold 8px Arial';
            context.fillText(method, xPos, 118);
            xPos += 22;
        });
        
        // FOOTER - summary stats
        context.fillStyle = '#f1f5f9';
        context.fillRect(0, 125, 280, 25);
        
        // Calculate totals
        const totalWeight = group.totalWeight.toFixed(0);
        const unitVolume = sampleItem.length * sampleItem.width * sampleItem.height;
        const totalVolume = (unitVolume * group.count).toFixed(2);
        const area = (sampleItem.length * sampleItem.width * group.count).toFixed(2);
        
        // Calculate LDM properly - area divided by container width
        const containerWidth = this.containerDimensions ? this.containerDimensions.width : 2.4;
        let ldm = 0;
        group.items.forEach(item => {
            if (item.type === 'steel-coil' || (item.isRoll && !item.isVerticalRoll)) {
                // For cylinders, use circular area (π × r²) divided by container width
                const diameter = item.diameter || item.width || 1.8;
                const radius = diameter / 2;
                ldm += (Math.PI * radius * radius) / containerWidth;
            } else if (item.isRoll && item.isVerticalRoll) {
                // Vertical roll - use diameter × height
                const diameter = item.diameter || 0.8;
                ldm += (diameter * item.height) / containerWidth;
            } else {
                // Regular items - length × width
                ldm += (item.length * item.width) / containerWidth;
            }
        });
        ldm = ldm.toFixed(2);
        
            // Footer items
            const footerItems = [
                { value: `${totalWeight} kg`, label: 'TOTAL WEIGHT' },
                { value: `${totalVolume} m³`, label: 'VOLUME' },
                { value: `${area} m²`, label: 'AREA' },
                { value: `${ldm} m`, label: 'LDM' }
            ];
            
            const footerItemWidth = 280 / 4;
            footerItems.forEach((item, index) => {
                const x = index * footerItemWidth + footerItemWidth / 2;
                context.fillStyle = '#1e293b';
                context.font = 'bold 10px Arial';
                context.textAlign = 'center';
                context.fillText(item.value, x, 138);
                context.fillStyle = '#64748b';
                context.font = '7px Arial';
                context.fillText(item.label, x, 147);
            });
        } // Close the else block for normal info box
        
        // Create texture and sprite with high quality settings
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Set sprite position and scale
        sprite.position.copy(position);
        // Default scale - can be overridden by caller
        const scaleFactor = position.userData?.scale || 1.0;
        // Use dynamic box dimensions based on container size (maintaining aspect ratio)
        const boxHeight = baseBoxWidth * 0.537; // Maintain original 4.28:2.30 ratio (≈2:1)
        sprite.scale.set(baseBoxWidth * scaleFactor, boxHeight * scaleFactor, 1); // Dynamic scale based on container size

        return sprite;
    }
    
    getGroupCenter(groupItems) {
        // Calculate center of mass for a group of items
        const center = new THREE.Vector3();
        let count = 0;
        let minX = Infinity;
        
        groupItems.forEach(item => {
            const mesh = this.cargoMeshes.find(m => 
                m.userData && 
                m.userData.id === item.id
            );
            if (mesh && !this.isPositionOutsideContainer(mesh.position)) {
                center.add(mesh.position);
                minX = Math.min(minX, mesh.position.x);
                count++;
            }
        });
        
        if (count > 0) {
            center.divideScalar(count);
        }
        
        // Store minX for sorting purposes
        center.minX = minX !== Infinity ? minX : center.x;
        
        return center;
    }
    
    getClosestGroupItem(groupItems, targetPoint) {
        // Find the closest unit from the group to the target point (infobox)
        let closestPosition = null;
        let minDistance = Infinity;
        
        groupItems.forEach(item => {
            const mesh = this.cargoMeshes.find(m => 
                m.userData && 
                m.userData.id === item.id
            );
            if (mesh && !this.isPositionOutsideContainer(mesh.position)) {
                const distance = mesh.position.distanceTo(targetPoint);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPosition = mesh.position.clone();
                }
            }
        });
        
        // If no position found (shouldn't happen), return group center as fallback
        if (!closestPosition) {
            return this.getGroupCenter(groupItems);
        }
        
        return closestPosition;
    }
    
    createAnnotations(cargoGroups, viewName = 'default') {
        const annotationGroup = new THREE.Group();
        
        // Get container bounds for positioning info boxes
        const bounds = this.containerBounds || { 
            min: { x: -6.8, y: 0, z: -1.24 }, 
            max: { x: 6.8, y: 2.7, z: 1.24 } 
        };
        
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.2;
        const containerLength = bounds.max.x - bounds.min.x;
        const containerWidth = bounds.max.z - bounds.min.z;
        const containerHeight = bounds.max.y - bounds.min.y;
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        
        // Check if this is a SOLO vehicle
        const isSolo = this.containerDimensions?.isSolo || false;
        
        // Different positioning for different views
        let boxY, boxZ;
        if (viewName === 'top') {
            // For top view - position at the top edge of the visible area
            boxY = trailerHeight + 0.5; // Slightly above trailer level
            boxZ = bounds.min.z - containerWidth * 0.8; // Above container in view (at top edge of screen)
        } else {
            // For perspective view - position at top edge of screen
            // We need boxes to appear at the top of the frame
            // Position them above and behind the container to appear at top of viewport
            boxY = containerHeight + trailerHeight + 2; // Above container (raised higher for better visibility)
            boxZ = -1; // Behind container center (negative Z)
        }
        
        // First, calculate group centers and sort by X position
        const groupsWithPositions = cargoGroups.map(group => {
            const center = this.getGroupCenter(group.items);
            return { ...group, center, xPos: center.minX };
        }).filter(g => g.items && g.items.length > 0);
        
        // Sort groups by X position (left to right)
        groupsWithPositions.sort((a, b) => a.xPos - b.xPos);
        
        // Process all groups, not limit to 5
        const actualGroups = groupsWithPositions;
        
        // Calculate box dimensions in world space (accounting for scale)
        // Dynamic sizing based on container length for better adaptation to custom dimensions
        // Formula: 25% of container length, with min 2.0m and max 6.0m limits
        const baseBoxWidth = Math.min(Math.max(containerLength * 0.25, 2.0), 6.0);

        // For SOLO in top view, apply additional 30% reduction (20% + 10% = 30%)
        let topRowScale = viewName === 'top' ? 0.95 : 1.0; // Top view boxes are 5% smaller
        if (isSolo && viewName === 'top') {
            topRowScale *= 0.7; // Additional 30% reduction for SOLO in top view (0.95 * 0.7 = 0.665)
        }
        const boxWidth = baseBoxWidth * topRowScale; // Dynamically scaled sprite width
        const minSpacing = 0.3; // Minimum space between boxes
        const effectiveBoxWidth = boxWidth + minSpacing;
        
        // Maximum 4 boxes per row for better readability
        const boxesPerRow = Math.min(4, actualGroups.length);
        
        // Distribute groups into rows
        const topRowGroups = [];
        const bottomRowGroups = [];
        let overflowGroups = [];
        
        // Check if we need overflow handling
        const needsOverflow = actualGroups.length > boxesPerRow * 2;
        const maxGroups = needsOverflow ? boxesPerRow * 2 - 1 : boxesPerRow * 2;
        
        actualGroups.forEach((group, index) => {
            // Assign order index based on position (1-based)
            group.orderIndex = index + 1;
            
            if (index < boxesPerRow) {
                // First row
                topRowGroups.push(group);
            } else if (index < maxGroups) {
                // Second row (leave space for overflow if needed)
                bottomRowGroups.push(group);
            } else {
                // Overflow groups
                overflowGroups.push(group);
            }
        });
        
        // If we have overflow, add special overflow marker to bottom row
        if (overflowGroups.length > 0) {
            // Create a special overflow group marker
            const overflowMarker = {
                isOverflowMarker: true,
                overflowCount: overflowGroups.length,
                orderIndex: maxGroups + 1
            };
            bottomRowGroups.push(overflowMarker);
        }
        
        // Process top row
        topRowGroups.forEach((group, index) => {
            const rowCount = topRowGroups.length;
            const totalWidth = effectiveBoxWidth * rowCount - minSpacing; // Remove extra spacing at the end
            const startX = centerX - totalWidth / 2 + boxWidth / 2; // Shift right by half box width
            
            const boxX = startX + index * effectiveBoxWidth;
            const boxPosition = new THREE.Vector3(boxX, boxY, boxZ);
            
            // For top view, make boxes 5% smaller (or 66.5% for SOLO)
            if (viewName === 'top') {
                const scale = isSolo ? 0.665 : 0.95; // 33.5% smaller for SOLO, 5% smaller for others
                boxPosition.userData = { scale: scale };
            }
            
            // Create sprite for info box with full group data (pass baseBoxWidth for dynamic sizing)
            const sprite = this.createInfoBoxSprite(group, boxPosition, baseBoxWidth);
            annotationGroup.add(sprite);
            
            // Find the closest unit from the group to the infobox
            const closestUnitPosition = this.getClosestGroupItem(group.items, boxPosition);

            // Calculate edge point on info box
            // For top row infoboxes: line goes to bottom edge
            const boxHeight = baseBoxWidth * 0.537; // Maintain aspect ratio
            const infoBoxHeight = boxHeight * (boxPosition.userData?.scale || 1);
            
            // Bottom center of the infobox (Y-axis is vertical)
            const edgePoint = new THREE.Vector3(
                boxPosition.x, 
                boxPosition.y - infoBoxHeight / 2,  // Bottom edge of infobox (lower Y value)
                boxPosition.z
            );
            
            // Create straight line from closest unit to bottom edge of infobox
            const points = [closestUnitPosition, edgePoint];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Parse color for the line
            let lineColor = 0x4A90E2;
            if (group.color) {
                // Convert hex string to THREE color
                lineColor = new THREE.Color(group.color).getHex();
            }
            
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: lineColor,
                linewidth: 5,
                transparent: true,
                opacity: 0.8
            });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            annotationGroup.add(line);
            
            // Add a small sphere at the closest unit position for better visibility
            const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
            const sphereMaterial = new THREE.MeshBasicMaterial({ 
                color: group.color || 0x4A90E2,
                transparent: true,
                opacity: 0.9
            });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.copy(closestUnitPosition);
            annotationGroup.add(sphere);
        });
        
        // Process bottom row (if any)
        if (bottomRowGroups.length > 0 || overflowGroups.length > 0) {
            // Calculate bottom row Y position
            let bottomBoxY, bottomBoxZ;
            
            if (viewName === 'top') {
                // For top view - position at bottom edge of visible area
                bottomBoxY = trailerHeight + 0.5; // Same height as top row
                bottomBoxZ = bounds.max.z + containerWidth * 0.8; // Below container in view (at bottom edge of screen)
            } else {
                // For perspective view - position at bottom edge of screen
                bottomBoxY = trailerHeight; // Below container, raised higher for better visibility
                bottomBoxZ = containerWidth * 2; // In front of container (positive Z)
            }
            
            bottomRowGroups.forEach((group, index) => {
                const rowCount = bottomRowGroups.length;
                // For perspective view, adjust spacing for smaller boxes
                // For top view, use same scale as top row (95%, or 66.5% for SOLO)
                let bottomRowScale = (viewName === 'perspective' || viewName === 'default') ? 0.85 : 
                                      (viewName === 'top' ? 0.95 : 1.0);
                // Apply SOLO reduction if needed (30% total reduction)
                if (isSolo && viewName === 'top') {
                    bottomRowScale *= 0.7; // Additional 30% reduction for SOLO in top view
                }
                // Calculate bottom box width based on base width (4.28), not the already scaled boxWidth
                const bottomBoxWidth = 4.28 * bottomRowScale;
                const bottomEffectiveWidth = bottomBoxWidth + minSpacing;
                
                const totalWidth = bottomEffectiveWidth * rowCount - minSpacing; // Remove extra spacing at the end
                const startX = centerX - totalWidth / 2 + bottomBoxWidth / 2; // Shift right by half box width
                
                const boxX = startX + index * bottomEffectiveWidth;
                const boxPosition = new THREE.Vector3(boxX, bottomBoxY, bottomBoxZ);
                
                // For perspective view, make bottom row 15% smaller
                // For top view, make bottom row 5% smaller (or 66.5% for SOLO)
                if (viewName === 'perspective' || viewName === 'default') {
                    boxPosition.userData = { scale: 0.85 }; // 15% smaller than top row
                } else if (viewName === 'top') {
                    const scale = isSolo ? 0.665 : 0.95; // 33.5% smaller for SOLO, 5% smaller for others
                    boxPosition.userData = { scale: scale };
                }
                
                // Check if this is an overflow marker
                if (group.isOverflowMarker) {
                    // Add overflow info to userData
                    boxPosition.userData = {
                        ...boxPosition.userData,
                        isOverflow: true,
                        overflowCount: group.overflowCount
                    };
                }
                
                // Create sprite for info box with full group data (pass baseBoxWidth for dynamic sizing)
                const sprite = this.createInfoBoxSprite(group, boxPosition, baseBoxWidth);
                annotationGroup.add(sprite);
                
                // Skip leader lines for overflow markers
                if (!group.isOverflowMarker) {
                    // Find the closest unit from the group to the infobox
                    const closestUnitPosition = this.getClosestGroupItem(group.items, boxPosition);

                    // Calculate edge point on info box
                    // For bottom row infoboxes: line goes to top edge
                    const boxHeight = baseBoxWidth * 0.537; // Maintain aspect ratio
                    const infoBoxHeight = boxHeight * (boxPosition.userData?.scale || 1);
                    
                    // Top center of the infobox (Y-axis is vertical)
                    const edgePoint = new THREE.Vector3(
                        boxPosition.x, 
                        boxPosition.y + infoBoxHeight / 2,  // Top edge of infobox (higher Y value)
                        boxPosition.z
                    );
                    
                    // Create straight line from closest unit to top edge of infobox
                    const points = [closestUnitPosition, edgePoint];
                    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                    
                    // Parse color for the line
                    let lineColor = 0x4A90E2;
                    if (group.color) {
                        lineColor = new THREE.Color(group.color).getHex();
                    }
                    
                    const lineMaterial = new THREE.LineBasicMaterial({ 
                        color: lineColor,
                        linewidth: 5,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const line = new THREE.Line(lineGeometry, lineMaterial);
                    annotationGroup.add(line);
                    
                    // Add a small sphere at the closest unit position
                    const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
                    const sphereMaterial = new THREE.MeshBasicMaterial({ 
                        color: group.color || 0x4A90E2,
                        transparent: true,
                        opacity: 0.9
                    });
                    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                    sphere.position.copy(closestUnitPosition);
                    annotationGroup.add(sphere);
                } // Close if (!group.isOverflowMarker)
            });
            
        }
        
        // Add measurement ruler to the annotation group
        const ruler = this.createPDFRuler(viewName);
        if (ruler) {
            annotationGroup.add(ruler);
        }
        
        return annotationGroup;
    }
    
    createPDFRuler(viewName = 'default') {
        const rulerGroup = new THREE.Group();
        
        if (!this.containerBounds) return rulerGroup;
        
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.1;
        const containerLength = this.containerBounds.max.x - this.containerBounds.min.x;
        const containerWidth = this.containerBounds.max.z - this.containerBounds.min.z;
        const containerHeight = this.containerBounds.max.y - this.containerBounds.min.y;
        
        // === LENGTH RULER (bottom edge) ===
        // Ruler positioning based on view type
        let rulerY = trailerHeight; // Height of the ruler
        let rulerZ; // Z position depends on view
        
        if (viewName === 'top') {
            // For top view, place ruler at the bottom edge (max Z)
            rulerZ = this.containerBounds.max.z + 0.3;
        } else {
            // For perspective view, place ruler at the front edge (max Z)
            rulerZ = this.containerBounds.max.z + 0.2;
        }
        
        // Check if this is a JUMBO vehicle with sections
        if (this.containerBounds.isJumbo && this.containerBounds.sections) {
            // JUMBO: Create two separate rulers for each section
            const gap = 0.5; // 50cm gap between sections
            const section1Start = this.containerBounds.min.x;
            const section1End = section1Start + this.containerBounds.sections[0].length;
            const section2Start = section1End + gap;
            const section2End = this.containerBounds.max.x;
            
            // Section 1 ruler (starts from 0)
            this.addRulerSection(rulerGroup, section1Start, section1End, rulerY, rulerZ, 0, 'horizontal');
            
            // Section 2 ruler (also starts from 0 for its own section)
            this.addRulerSection(rulerGroup, section2Start, section2End, rulerY, rulerZ, 0, 'horizontal');
        } else {
            // Standard container: single ruler
            this.addRulerSection(rulerGroup, this.containerBounds.min.x, this.containerBounds.max.x, rulerY, rulerZ, 0, 'horizontal');
        }
        
        // === WIDTH RULER (top edge) ===
        // Position at top-front edge of container
        const widthRulerX = this.containerBounds.max.x + 0.05; // Very close to the container edge
        const widthRulerY = this.containerBounds.max.y + 0.05; // Just above container
        
        // Create width ruler along Z-axis (reversed - from max to min)
        this.addWidthRuler(rulerGroup, 
            this.containerBounds.max.z, 
            this.containerBounds.min.z, 
            widthRulerX, 
            widthRulerY, 
            viewName);
        
        // === HEIGHT RULER (side edge) ===
        // Position at right-front corner
        const heightRulerX = this.containerBounds.max.x + 0.05; // Very close to side
        const heightRulerZ = this.containerBounds.max.z + 0.05; // Very close to front
        
        // Create height ruler along Y-axis
        this.addHeightRuler(rulerGroup, 
            this.containerBounds.min.y, 
            this.containerBounds.max.y, 
            heightRulerX, 
            heightRulerZ, 
            viewName);
        
        return rulerGroup;
    }
    
    addRulerSection(rulerGroup, startX, endX, rulerY, rulerZ, startOffset = 0, orientation = 'horizontal') {
        const sectionLength = endX - startX;
        const tickSpacing = 0.5; // Tick every 0.5m
        const majorTickSpacing = 1.0; // Major tick every 1m
        
        // Create white outline for ruler baseline
        const outlineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFFFF,
            linewidth: 5,
            opacity: 1,
            transparent: true
        });
        
        const baselineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(startX, rulerY, rulerZ),
            new THREE.Vector3(endX, rulerY, rulerZ)
        ]);
        const outlineBaseline = new THREE.Line(baselineGeometry, outlineMaterial);
        rulerGroup.add(outlineBaseline);
        
        // Create black center line
        const baselineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2,
            opacity: 1,
            transparent: true
        });
        
        const baseline = new THREE.Line(baselineGeometry, baselineMaterial);
        rulerGroup.add(baseline);
        
        // Add tick marks and labels
        const numTicks = Math.floor(sectionLength / tickSpacing) + 1;
        
        for (let i = 0; i < numTicks; i++) {
            const distance = i * tickSpacing;
            const xPos = startX + distance;
            
            // Skip if position is beyond the section end
            if (xPos > endX + 0.01) continue;
            
            const isMajorTick = (distance + startOffset) % majorTickSpacing === 0;
            const tickHeight = isMajorTick ? 0.2 : 0.1;
            
            // Create tick mark with white outline
            const tickGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(xPos, rulerY - tickHeight/2, rulerZ),
                new THREE.Vector3(xPos, rulerY + tickHeight/2, rulerZ)
            ]);
            
            // White outline for tick
            const tickOutline = new THREE.Line(tickGeometry, outlineMaterial);
            rulerGroup.add(tickOutline);
            
            // Black center for tick
            const tick = new THREE.Line(tickGeometry, baselineMaterial);
            rulerGroup.add(tick);
            
            // Add label for every tick (every 0.5m)
            const labelDistance = distance + startOffset;
            const numberText = `${labelDistance.toFixed(1)}`;
            
            // Create text sprite with dual colors for visibility
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Draw black text with white outline for visibility on any background
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw the number
            context.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            const numberWidth = context.measureText(numberText).width;
            const numberX = (canvas.width / 2) - 6; // Shift left to make room for 'm'
            
            // White outline for number
            context.strokeStyle = '#FFFFFF';
            context.lineWidth = 2.5;
            context.strokeText(numberText, numberX, canvas.height / 2);
            
            // Black fill for number
            context.fillStyle = '#000000';
            context.fillText(numberText, numberX, canvas.height / 2);
            
            // Draw smaller 'm' unit
            context.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            const mX = numberX + numberWidth/2 + 5; // More spacing
            
            // White outline for 'm'
            context.strokeStyle = '#FFFFFF';
            context.lineWidth = 2.5;
            context.strokeText('m', mX, canvas.height / 2 + 1);
            
            // Black fill for 'm'
            context.fillStyle = '#000000';
            context.fillText('m', mX, canvas.height / 2 + 1);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                sizeAttenuation: false,
                opacity: 1,
                transparent: true,
                depthTest: false
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.035, 0.0175, 1); // Smaller scale with better proportions
            sprite.position.set(xPos, rulerY - 0.1, rulerZ);
            rulerGroup.add(sprite);
        }
        
        // Always add end label to show exact section length
        // Position it at the next 0.5m mark after the last regular tick, but show actual length value
        const displayValue = sectionLength; // Always use section length for display
        
        // Calculate positions
        const lastRegularTickDistance = Math.floor(sectionLength / tickSpacing) * tickSpacing;
        const remainingDistance = sectionLength - lastRegularTickDistance;
        
        // Only add end label if section doesn't end exactly on a tick mark
        if (remainingDistance > 0.01) {
            // Position the label at the next 0.5m position to avoid overlap
            const labelXPos = startX + lastRegularTickDistance + tickSpacing;
            
            // But show the actual end value
            const endLabelText = `${displayValue.toFixed(2)}`;
            
            // Create text sprite for end label
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Draw black text with white outline
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw the number
            context.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            const numberWidth = context.measureText(endLabelText).width;
            const numberX = (canvas.width / 2) - 6;
            
            // White outline for number
            context.strokeStyle = '#FFFFFF';
            context.lineWidth = 2.5;
            context.strokeText(endLabelText, numberX, canvas.height / 2);
            
            // Black fill for number
            context.fillStyle = '#000000';
            context.fillText(endLabelText, numberX, canvas.height / 2);
            
            // Draw smaller 'm' unit
            context.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            const mX = numberX + numberWidth/2 + 5;
            
            // White outline for 'm'
            context.strokeStyle = '#FFFFFF';
            context.lineWidth = 2.5;
            context.strokeText('m', mX, canvas.height / 2 + 1);
            
            // Black fill for 'm'
            context.fillStyle = '#000000';
            context.fillText('m', mX, canvas.height / 2 + 1);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                sizeAttenuation: false,
                opacity: 1,
                transparent: true,
                depthTest: false
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.035, 0.0175, 1);
            sprite.position.set(labelXPos, rulerY - 0.1, rulerZ); // Position at next 0.5m mark
            rulerGroup.add(sprite);
            
            // Add tick mark at the actual end position (not at label position)
            const endTickGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(endX, rulerY - 0.1, rulerZ),
                new THREE.Vector3(endX, rulerY + 0.1, rulerZ)
            ]);
            
            // White outline for end tick
            const endTickOutline = new THREE.Line(endTickGeometry, outlineMaterial);
            rulerGroup.add(endTickOutline);
            
            // Black center for end tick
            const endTick = new THREE.Line(endTickGeometry, baselineMaterial);
            rulerGroup.add(endTick);
        }
        
        // Add end caps
        const capSize = 0.2;
        
        // Start cap
        const startCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(startX, rulerY - capSize, rulerZ),
            new THREE.Vector3(startX, rulerY + capSize, rulerZ)
        ]);
        // White outline for start cap
        const startCapOutline = new THREE.Line(startCapGeometry, outlineMaterial);
        rulerGroup.add(startCapOutline);
        // Black center for start cap
        const startCap = new THREE.Line(startCapGeometry, baselineMaterial);
        rulerGroup.add(startCap);
        
        // End cap
        const endCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(endX, rulerY - capSize, rulerZ),
            new THREE.Vector3(endX, rulerY + capSize, rulerZ)
        ]);
        // White outline for end cap
        const endCapOutline = new THREE.Line(endCapGeometry, outlineMaterial);
        rulerGroup.add(endCapOutline);
        // Black center for end cap
        const endCap = new THREE.Line(endCapGeometry, baselineMaterial);
        rulerGroup.add(endCap);
    }
    
    addWidthRuler(rulerGroup, startZ, endZ, rulerX, rulerY, viewName) {
        const width = Math.abs(endZ - startZ);
        const isReversed = startZ > endZ;
        const tickSpacing = 0.5;
        const majorTickSpacing = 1.0;
        
        // Create white outline for ruler baseline
        const outlineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFFFF,
            linewidth: 4,
            opacity: 1,
            transparent: false
        });
        
        // Create black center line
        const baselineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2,
            opacity: 1,
            transparent: false
        });
        
        // Main baseline (along Z-axis)
        const baselineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX, rulerY, startZ),
            new THREE.Vector3(rulerX, rulerY, endZ)
        ]);
        
        // White outline
        const outlineLine = new THREE.Line(baselineGeometry, outlineMaterial);
        rulerGroup.add(outlineLine);
        
        // Black center line
        const baseline = new THREE.Line(baselineGeometry, baselineMaterial);
        rulerGroup.add(baseline);
        
        // Add tick marks and labels
        const numTicks = Math.floor(width / tickSpacing) + 1;
        
        for (let i = 0; i < numTicks; i++) {
            const distance = i * tickSpacing;
            if (distance > width) break;
            
            const zPos = isReversed ? startZ - distance : startZ + distance;
            const isMajor = distance % majorTickSpacing === 0;
            const tickLength = isMajor ? 0.1 : 0.05; // Smaller ticks for width ruler
            
            // Tick mark (perpendicular to baseline, along Y-axis for top ruler)
            const tickGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(rulerX, rulerY - tickLength, zPos),
                new THREE.Vector3(rulerX, rulerY + tickLength, zPos)
            ]);
            
            // White outline for tick
            const tickOutline = new THREE.Line(tickGeometry, outlineMaterial);
            rulerGroup.add(tickOutline);
            
            // Black center for tick
            const tick = new THREE.Line(tickGeometry, baselineMaterial);
            rulerGroup.add(tick);
            
            // Add number labels for major ticks (skip 0)
            if (isMajor && distance > 0) {
                this.createRulerLabel(rulerGroup, rulerX, rulerY + 0.15, zPos, distance, 'width');
            }
        }
        
        // Add end label if width doesn't end on tick mark
        const lastTickDistance = Math.floor(width / tickSpacing) * tickSpacing;
        const remainder = width - lastTickDistance;
        
        if (remainder > 0.01) {
            // Position label at next 0.5m mark
            const labelZPos = isReversed ? startZ - lastTickDistance - tickSpacing : startZ + lastTickDistance + tickSpacing;
            this.createRulerLabel(rulerGroup, rulerX, rulerY + 0.15, labelZPos, width, 'width');
            
            // Add tick at actual end
            const endTickGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(rulerX, rulerY - 0.05, endZ),
                new THREE.Vector3(rulerX, rulerY + 0.05, endZ)
            ]);
            
            const endTickOutline = new THREE.Line(endTickGeometry, outlineMaterial);
            rulerGroup.add(endTickOutline);
            
            const endTick = new THREE.Line(endTickGeometry, baselineMaterial);
            rulerGroup.add(endTick);
        }
        
        // Add end caps
        const capSize = 0.1; // Smaller end caps for width ruler
        
        // Start cap
        const startCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX, rulerY - capSize, startZ),
            new THREE.Vector3(rulerX, rulerY + capSize, startZ)
        ]);
        rulerGroup.add(new THREE.Line(startCapGeometry, outlineMaterial));
        rulerGroup.add(new THREE.Line(startCapGeometry, baselineMaterial));
        
        // End cap
        const endCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX, rulerY - capSize, endZ),
            new THREE.Vector3(rulerX, rulerY + capSize, endZ)
        ]);
        rulerGroup.add(new THREE.Line(endCapGeometry, outlineMaterial));
        rulerGroup.add(new THREE.Line(endCapGeometry, baselineMaterial));
    }
    
    addHeightRuler(rulerGroup, startY, endY, rulerX, rulerZ, viewName) {
        const height = endY - startY;
        const tickSpacing = 0.5;
        const majorTickSpacing = 1.0;
        
        // Create white outline for ruler baseline
        const outlineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFFFF,
            linewidth: 4,
            opacity: 1,
            transparent: false
        });
        
        // Create black center line
        const baselineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2,
            opacity: 1,
            transparent: false
        });
        
        // Main baseline (along Y-axis)
        const baselineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX, startY, rulerZ),
            new THREE.Vector3(rulerX, endY, rulerZ)
        ]);
        
        // White outline
        const outlineLine = new THREE.Line(baselineGeometry, outlineMaterial);
        rulerGroup.add(outlineLine);
        
        // Black center line
        const baseline = new THREE.Line(baselineGeometry, baselineMaterial);
        rulerGroup.add(baseline);
        
        // Add tick marks and labels
        const numTicks = Math.floor(height / tickSpacing) + 1;
        
        for (let i = 0; i < numTicks; i++) {
            const distance = i * tickSpacing;
            if (distance > height) break;
            
            const yPos = startY + distance;
            const isMajor = distance % majorTickSpacing === 0;
            const tickLength = isMajor ? 0.1 : 0.05; // Smaller ticks for height ruler
            
            // Tick mark (perpendicular to baseline, along X-axis for side ruler)
            const tickGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(rulerX - tickLength, yPos, rulerZ),
                new THREE.Vector3(rulerX + tickLength, yPos, rulerZ)
            ]);
            
            // White outline for tick
            const tickOutline = new THREE.Line(tickGeometry, outlineMaterial);
            rulerGroup.add(tickOutline);
            
            // Black center for tick
            const tick = new THREE.Line(tickGeometry, baselineMaterial);
            rulerGroup.add(tick);
            
            // Add number labels for major ticks (skip 0)
            if (isMajor && distance > 0) {
                this.createRulerLabel(rulerGroup, rulerX + 0.15, yPos, rulerZ, distance, 'height');
            }
        }
        
        // Add end label if height doesn't end on tick mark
        const lastTickDistance = Math.floor(height / tickSpacing) * tickSpacing;
        const remainder = height - lastTickDistance;
        
        if (remainder > 0.01) {
            // Position label at the actual end height
            const labelYPos = endY;
            this.createRulerLabel(rulerGroup, rulerX + 0.15, labelYPos, rulerZ, height, 'height');
            
            // Add tick at actual end
            const endTickGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(rulerX - 0.05, endY, rulerZ),
                new THREE.Vector3(rulerX + 0.05, endY, rulerZ)
            ]);
            
            const endTickOutline = new THREE.Line(endTickGeometry, outlineMaterial);
            rulerGroup.add(endTickOutline);
            
            const endTick = new THREE.Line(endTickGeometry, baselineMaterial);
            rulerGroup.add(endTick);
        }
        
        // Add end caps
        const capSize = 0.1; // Smaller end caps for height ruler
        
        // Start cap
        const startCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX - capSize, startY, rulerZ),
            new THREE.Vector3(rulerX + capSize, startY, rulerZ)
        ]);
        rulerGroup.add(new THREE.Line(startCapGeometry, outlineMaterial));
        rulerGroup.add(new THREE.Line(startCapGeometry, baselineMaterial));
        
        // End cap
        const endCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(rulerX - capSize, endY, rulerZ),
            new THREE.Vector3(rulerX + capSize, endY, rulerZ)
        ]);
        rulerGroup.add(new THREE.Line(endCapGeometry, outlineMaterial));
        rulerGroup.add(new THREE.Line(endCapGeometry, baselineMaterial));
    }
    
    createRulerLabel(rulerGroup, x, y, z, value, type = 'length') {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Prepare text
        const displayText = value.toFixed(2);
        
        // Set font for number
        context.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const numberWidth = context.measureText(displayText).width;
        const numberX = canvas.width / 2 - 8;
        
        // White outline for number
        context.strokeStyle = '#FFFFFF';
        context.lineWidth = 3;
        context.strokeText(displayText, numberX, canvas.height / 2);
        
        // Black fill for number
        context.fillStyle = '#000000';
        context.fillText(displayText, numberX, canvas.height / 2);
        
        // Draw 'm' unit
        context.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        const mX = numberX + numberWidth/2 + 5;
        
        // White outline for 'm'
        context.strokeStyle = '#FFFFFF';
        context.lineWidth = 2.5;
        context.strokeText('m', mX, canvas.height / 2 + 1);
        
        // Black fill for 'm'
        context.fillStyle = '#000000';
        context.fillText('m', mX, canvas.height / 2 + 1);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            sizeAttenuation: false,
            opacity: 1,
            transparent: true,
            depthTest: false
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Adjust scale based on type
        if (type === 'height') {
            sprite.scale.set(0.035, 0.0175, 1); // Same as length labels
        } else if (type === 'width') {
            sprite.scale.set(0.035, 0.0175, 1); // Same as length labels
        } else {
            sprite.scale.set(0.035, 0.0175, 1);
        }
        
        sprite.position.set(x, y, z);
        rulerGroup.add(sprite);
    }
    
    createAxleLoadVisualization() {
        // Skip for custom space (no truck/axles)
        if (this.containerDimensions?.isCustomSpace) {
            return null;
        }

        const group = new THREE.Group();

        // Get axle load data from the UI - filter out hidden elements
        const allIndicators = document.querySelectorAll('.axle-load-indicator .axle-item');
        const axleIndicators = Array.from(allIndicators).filter(el =>
            el.style.display !== 'none' && window.getComputedStyle(el).display !== 'none'
        );
        if (axleIndicators.length === 0) {
            return null;
        }

        const axleData = [];
        axleIndicators.forEach((indicator, index) => {
            const label = indicator.querySelector('.axle-label')?.textContent || '';
            const value = indicator.querySelector('.axle-value')?.textContent || '';
            const progressBar = indicator.querySelector('.progress-fill');

            // Get percentage from value (load / max)
            let percentage = 0;
            if (value) {
                const parts = value.split('/');
                if (parts.length === 2) {
                    const load = parseFloat(parts[0].trim());
                    const max = parseFloat(parts[1].trim().replace('kg', '').trim());
                    if (max > 0) {
                        percentage = (load / max) * 100;
                    }
                }
            }


            // Determine color based on percentage and warning class
            let color = '#22c55e'; // Green
            if (indicator.classList.contains('warning-min')) {
                color = '#fb923c'; // Orange for minimum warning
            } else if (percentage > 100) {
                color = '#ef4444'; // Red for overload
            } else if (percentage > 90) {
                color = '#fbbf24'; // Yellow for warning
            }

            axleData.push({ label, value, percentage, color });
        });
        
        // Get vehicle configuration
        const bounds = this.containerBounds;
        const isSolo = this.containerDimensions?.isSolo || false;
        const isJumbo = this.containerDimensions?.isJumbo || false;
        
        // Get axle configuration from axleCalculator or use defaults
        const vehicleType = this.containerDimensions?.vehicleType || 'standard';
        const config = window.axleCalculator?.axleConfig || {};
        const tractorAxles = config.tractorAxles || 1;
        const trailerAxles = config.trailerAxles || (isSolo ? 0 : 3);
        
        // Calculate axle positions based on current configuration
        const containerFront = bounds.min.x;
        const containerEnd = bounds.max.x;
        
        let frontAxleX, driveAxlePositions = [], trailerAxlePositions = [];
        
        if (isSolo) {
            // SOLO vehicle - front and drive axles only
            const distToFront = config.distCargoStartToFront || 1.0;
            const distToDrive = config.distCargoStartToDrive || 5.5;
            frontAxleX = containerFront - distToFront;
            const driveAxlesCenter = containerFront + distToDrive;
            
            // Calculate drive axle positions
            if (tractorAxles === 1) {
                driveAxlePositions = [driveAxlesCenter];
            } else if (tractorAxles === 2) {
                const spacing = 1.35;
                driveAxlePositions = [
                    driveAxlesCenter - spacing/2,
                    driveAxlesCenter + spacing/2
                ];
            }
        } else if (isJumbo) {
            // JUMBO vehicle
            const section1Start = containerFront;
            const section1Length = this.containerDimensions?.section1Length || 7.7;
            const section2Start = section1Start + section1Length + 0.5; // 0.5m gap
            
            // Truck axles
            frontAxleX = section1Start - (config.distSection1StartToFront || 1.0);
            const driveAxlesCenter = section1Start + (config.distSection1StartToDrive || 5.5);
            
            // Drive axle positions
            if (tractorAxles === 1) {
                driveAxlePositions = [driveAxlesCenter];
            } else if (tractorAxles === 2) {
                const spacing = 1.35;
                driveAxlePositions = [
                    driveAxlesCenter - spacing/2,
                    driveAxlesCenter + spacing/2
                ];
            }
            
            // Trailer axle positions
            const trailerAxlesCenter = section2Start + (config.distSection2StartToTrailerAxles || 5.5);
            if (trailerAxles === 1) {
                trailerAxlePositions = [trailerAxlesCenter];
            } else if (trailerAxles === 2) {
                const spacing = 1.31;
                trailerAxlePositions = [
                    trailerAxlesCenter - spacing/2,
                    trailerAxlesCenter + spacing/2
                ];
            }
        } else {
            // Standard trailer vehicle
            const kingpinX = containerFront + (config.distFrontToKingpin || 1.7);
            frontAxleX = kingpinX - (config.distFrontAxleToKingpin || 3.1);
            const driveAxlesCenter = kingpinX + (config.distKingpinToDrive || 0.5);
            const trailerAxlesCenter = containerFront + (config.distFrontToKingpin || 1.7) + (config.distKingpinToTrailer || 7.7);
            
            // Drive axle positions
            if (tractorAxles === 1) {
                driveAxlePositions = [driveAxlesCenter];
            } else if (tractorAxles === 2) {
                const spacing = 1.35;
                driveAxlePositions = [
                    driveAxlesCenter - spacing/2,
                    driveAxlesCenter + spacing/2
                ];
            }
            
            // Trailer axle positions
            if (trailerAxles === 1) {
                trailerAxlePositions = [trailerAxlesCenter];
            } else if (trailerAxles === 2) {
                const spacing = 1.31;
                trailerAxlePositions = [
                    trailerAxlesCenter - spacing/2,
                    trailerAxlesCenter + spacing/2
                ];
            } else if (trailerAxles === 3) {
                const spacing = 1.31;
                trailerAxlePositions = [
                    trailerAxlesCenter - spacing,
                    trailerAxlesCenter,
                    trailerAxlesCenter + spacing
                ];
            }
        }
        
        // Create sprites for axle loads
        let axleIndex = 0;
        
        // Front axle (always single)
        if (axleIndex < axleData.length) {
            const data = axleData[axleIndex++];
            // Create label for positive Z side (left side when viewing from back)
            const frontLabelPos = this.createAxleLoadSprite(
                data.label,
                data.value,
                data.percentage,
                data.color
            );
            frontLabelPos.position.x = frontAxleX;
            group.add(frontLabelPos);
            
            // Create label for negative Z side (right side when viewing from back)
            const frontLabelNeg = this.createAxleLoadSprite(
                data.label,
                data.value,
                data.percentage,
                data.color
            );
            frontLabelNeg.position.x = frontAxleX;
            frontLabelNeg.position.z = -frontLabelPos.position.z; // Mirror on the other side
            frontLabelNeg.rotation.y = Math.PI; // Rotate 180 degrees to face the other way
            group.add(frontLabelNeg);
        }
        
        // Drive axles - split the load equally if multiple axles
        if (axleIndex < axleData.length && driveAxlePositions.length > 0) {
            const data = axleData[axleIndex++];
            // Extract load value and divide by number of axles
            const totalLoadKg = parseFloat(data.value.split('/')[0].trim());
            const maxLoadKg = parseFloat(data.value.split('/')[1].trim().replace('kg', '').trim());
            const loadPerAxle = totalLoadKg / driveAxlePositions.length;
            const maxPerAxle = maxLoadKg / driveAxlePositions.length;
            
            driveAxlePositions.forEach(x => {
                const axleValue = `${Math.round(loadPerAxle)} / ${Math.round(maxPerAxle)} kg`;
                // Create label for positive Z side
                const labelPos = this.createAxleLoadSprite(
                    data.label,
                    axleValue,
                    data.percentage, // Keep same percentage for color
                    data.color,
                    true // isDriveAxle
                );
                labelPos.position.x = x;
                group.add(labelPos);
                
                // Create label for negative Z side
                const labelNeg = this.createAxleLoadSprite(
                    data.label,
                    axleValue,
                    data.percentage,
                    data.color,
                    true // isDriveAxle
                );
                labelNeg.position.x = x;
                labelNeg.position.z = -labelPos.position.z; // Mirror on the other side
                labelNeg.rotation.y = Math.PI; // Rotate 180 degrees to face the other way
                group.add(labelNeg);
            });
        }
        
        // Trailer axles - split the load equally if multiple axles
        if (axleIndex < axleData.length && trailerAxlePositions.length > 0) {
            const data = axleData[axleIndex++];
            // Extract load value and divide by number of axles
            const totalLoadKg = parseFloat(data.value.split('/')[0].trim());
            const maxLoadKg = parseFloat(data.value.split('/')[1].trim().replace('kg', '').trim());
            const loadPerAxle = totalLoadKg / trailerAxlePositions.length;
            const maxPerAxle = maxLoadKg / trailerAxlePositions.length;
            
            trailerAxlePositions.forEach(x => {
                const axleValue = `${Math.round(loadPerAxle)} / ${Math.round(maxPerAxle)} kg`;
                // Create label for positive Z side
                const labelPos = this.createAxleLoadSprite(
                    data.label,
                    axleValue,
                    data.percentage, // Keep same percentage for color
                    data.color
                );
                labelPos.position.x = x;
                group.add(labelPos);
                
                // Create label for negative Z side
                const labelNeg = this.createAxleLoadSprite(
                    data.label,
                    axleValue,
                    data.percentage,
                    data.color
                );
                labelNeg.position.x = x;
                labelNeg.position.z = -labelPos.position.z; // Mirror on the other side
                labelNeg.rotation.y = Math.PI; // Rotate 180 degrees to face the other way
                group.add(labelNeg);
            });
        }
        
        return group;
    }
    
    createAxleLoadSprite(label, value, percentage, color, isDriveAxle = false) {
        // Extract tonnage from value (e.g., "6888 / 10000 kg" -> "6.9t")
        const loadKg = parseFloat(value.split('/')[0].trim());
        const loadTons = (loadKg / 1000).toFixed(1);
        const text = `${loadTons}t`;
        
        // Check if overloaded (percentage > 100)
        const isOverloaded = percentage > 100;
        
        // Create smaller canvas for individual wheel labels
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        // Function to draw the text
        const drawText = (useRedColor = false) => {
            // Clear canvas
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            // Set text properties - smaller for individual wheels
            context.font = 'bold 38px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Add strong shadow for visibility
            context.shadowColor = 'rgba(0, 0, 0, 1)';
            context.shadowBlur = 6;
            context.shadowOffsetX = 2;
            context.shadowOffsetY = 2;
            
            // Set text color based on state
            context.fillStyle = useRedColor ? '#FF0000' : '#FFFFFF';
            
            // Draw text in an arc
            context.save();
            context.translate(80, 32);
            
            // Draw text with gentle upward curve (smile shape)
            const totalWidth = context.measureText(text).width;
            let currentX = -totalWidth * 0.5; // Center text properly
            
            text.split('').forEach((char, i, arr) => {
                context.save();
                
                const charWidth = context.measureText(char).width;
                const normalizedX = currentX / (totalWidth * 0.5); // Normalized position from -1 to 1
                
                // Simple parabolic curve for smile shape - centered properly
                const yOffset = 4 * (normalizedX * normalizedX - 0.5); // Gentler curve, properly centered
                
                // Very slight rotation for natural look
                const rotation = normalizedX * 0.1;
                
                context.translate(currentX + charWidth/2, yOffset);
                context.rotate(rotation);
                
                context.fillText(char, 0, 0);
                context.restore();
                
                currentX += charWidth; // Normal spacing between characters
            });
            
            context.restore();
        };
        
        // Initial draw
        drawText(false);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create a plane geometry instead of sprite
        const geometry = new THREE.PlaneGeometry(0.7, 0.28); // Even larger plane for better visibility
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: true,  // Enable depth testing so labels can be occluded
            depthWrite: true  // Enable depth writing so labels occlude other objects properly
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position the label on top of the wheel
        // Drive axles have double wheels, other axles have single wheels
        const zPosition = isDriveAxle ? 1.35 : 1.25;
        
        mesh.position.set(
            0, // X will be set when adding to scene
            0.95, // Y position - on top of wheel
            zPosition  // Z position - aligned with outer wheel
        );
        
        // No rotation needed - plane is vertical by default (standing up)
        
        // Store canvas and context for all labels (needed for updates)
        mesh.userData.canvas = canvas;
        mesh.userData.context = context;
        mesh.userData.drawText = drawText;
        mesh.userData.currentText = text;
        mesh.userData.percentage = percentage;
        
        // Add blinking animation for overloaded axles
        if (isOverloaded) {
            mesh.userData.isOverloaded = true;
            mesh.userData.blinkState = false;
            mesh.userData.lastBlinkTime = Date.now();
        }
        
        return mesh;
    }
    
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    // Toggle axle load visualization
    toggleAxleLoadDisplay(show) {
        this.showAxleLoads = show;
        
        if (show) {
            this.updateAxleLoadVisualization();
        } else {
            this.removeAxleLoadVisualization();
        }
    }
    
    // Update axle load visualization
    updateAxleLoadVisualization() {
        if (!this.showAxleLoads) {
            this.removeAxleLoadVisualization();
            return;
        }

        // Remove old visualization if it exists
        if (this.axleLoadGroup) {
            this.scene.remove(this.axleLoadGroup);
            this.axleLoadGroup = null;
        }

        // Always create new visualization to ensure positions and values are correct
        this.axleLoadGroup = this.createAxleLoadVisualization();
        if (this.axleLoadGroup) {
            this.scene.add(this.axleLoadGroup);
        }
    }
    
    // Update existing axle labels with new values
    updateExistingAxleLabels() {
        if (!this.axleLoadGroup) return;
        
        // Get current axle load data from the UI
        const allIndicators = document.querySelectorAll('.axle-load-indicator .axle-item');
        const axleIndicators = Array.from(allIndicators).filter(el => 
            el.style.display !== 'none' && window.getComputedStyle(el).display !== 'none'
        );
        
        if (axleIndicators.length === 0) return;
        
        // Get vehicle configuration
        const isSolo = this.containerDimensions?.isSolo || false;
        const isJumbo = this.containerDimensions?.isJumbo || false;
        const config = window.axleCalculator?.axleConfig || {};
        const tractorAxles = config.tractorAxles || 1;
        const trailerAxles = config.trailerAxles || (isSolo ? 0 : 3);
        
        const axleData = [];
        axleIndicators.forEach((indicator) => {
            const value = indicator.querySelector('.axle-value')?.textContent || '';
            
            // Get percentage from value (load / max)
            let percentage = 0;
            if (value) {
                const parts = value.split('/');
                if (parts.length === 2) {
                    const load = parseFloat(parts[0].trim());
                    const max = parseFloat(parts[1].trim().replace('kg', '').trim());
                    if (max > 0) {
                        percentage = (load / max) * 100;
                    }
                }
            }
            
            axleData.push({ value, percentage });
        });
        
        // Track which physical axle we're updating (considering multiple axles per group)
        let physicalAxleIndex = 0;
        let axleGroupIndex = 0;
        
        this.axleLoadGroup.traverse((child) => {
            if (child.isMesh && child.userData.canvas) {
                // Determine which axle group this label belongs to
                let axleCount = 1;
                let loadPerAxle = 0;
                let percentage = 0;
                
                if (physicalAxleIndex < 2) {
                    // Front axle (always single)
                    if (axleData[0]) {
                        const loadKg = parseFloat(axleData[0].value.split('/')[0].trim());
                        loadPerAxle = loadKg;
                        percentage = axleData[0].percentage;
                    }
                } else if (physicalAxleIndex < 2 + (tractorAxles * 2)) {
                    // Drive axles
                    if (axleData[1]) {
                        const totalLoadKg = parseFloat(axleData[1].value.split('/')[0].trim());
                        loadPerAxle = totalLoadKg / tractorAxles;
                        percentage = axleData[1].percentage;
                    }
                } else if (!isSolo && trailerAxles > 0 && axleData[2]) {
                    // Trailer axles
                    const totalLoadKg = parseFloat(axleData[2].value.split('/')[0].trim());
                    loadPerAxle = totalLoadKg / trailerAxles;
                    percentage = axleData[2].percentage;
                }
                
                const loadTons = (loadPerAxle / 1000).toFixed(1);
                const text = `${loadTons}t`;
                
                // Update overload status
                const wasOverloaded = child.userData.isOverloaded || false;
                const isOverloaded = percentage > 100;
                
                // Update text content
                child.userData.currentText = text;
                child.userData.percentage = percentage;
                
                if (wasOverloaded !== isOverloaded) {
                    // Overload status changed
                    child.userData.isOverloaded = isOverloaded;
                    
                    if (!isOverloaded) {
                        // No longer overloaded - reset to white
                        child.userData.blinkState = false;
                        if (child.userData.drawText) {
                            // Redraw with new text and white color
                            this.redrawAxleLabel(child, text, false);
                        }
                    } else if (!wasOverloaded) {
                        // Just became overloaded - initialize blinking
                        child.userData.blinkState = false;
                        child.userData.lastBlinkTime = Date.now();
                    }
                } else if (!isOverloaded) {
                    // Still not overloaded - just update text
                    this.redrawAxleLabel(child, text, false);
                }
                // If still overloaded, let the blinking animation handle the drawing
                
                physicalAxleIndex++;
            }
        });
    }
    
    // Helper function to redraw axle label
    redrawAxleLabel(mesh, text, useRedColor) {
        if (!mesh.userData.canvas || !mesh.userData.context) return;
        
        const context = mesh.userData.context;
        const canvas = mesh.userData.canvas;
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set text properties
        context.font = 'bold 38px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add shadow
        context.shadowColor = 'rgba(0, 0, 0, 1)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        
        // Set text color
        context.fillStyle = useRedColor ? '#FF0000' : '#FFFFFF';
        
        // Draw text in an arc
        context.save();
        context.translate(80, 32);
        
        const totalWidth = context.measureText(text).width;
        let currentX = -totalWidth * 0.5;
        
        text.split('').forEach((char) => {
            context.save();
            const charWidth = context.measureText(char).width;
            const normalizedX = currentX / (totalWidth * 0.5);
            const yOffset = 4 * (normalizedX * normalizedX - 0.5);
            const rotation = normalizedX * 0.1;
            
            context.translate(currentX + charWidth/2, yOffset);
            context.rotate(rotation);
            context.fillText(char, 0, 0);
            context.restore();
            
            currentX += charWidth;
        });
        
        context.restore();
        
        // Update texture
        if (mesh.material && mesh.material.map) {
            mesh.material.map.needsUpdate = true;
        }
    }
    
    // Start blinking animation for overloaded axles
    startAxleLoadBlinking() {
        // Animation is now handled in the main animate() loop
        // This function is kept for compatibility but doesn't need to do anything
    }
    
    // Remove axle load visualization
    removeAxleLoadVisualization() {
        if (this.axleLoadGroup) {
            this.scene.remove(this.axleLoadGroup);
            // Dispose of materials and geometries
            this.axleLoadGroup.traverse((child) => {
                if (child.material) {
                    if (child.material.map) {
                        child.material.map.dispose();
                    }
                    child.material.dispose();
                }
                if (child.geometry) {
                    child.geometry.dispose();
                }
            });
            this.axleLoadGroup = null;
        }
    }
    
    captureView(cameraSettings = null, includeAnnotations = false, cargoGroups = null, includeAxleLoads = false, focusGroupId = null) {
        return new Promise((resolve) => {
            // Store current camera state
            const originalCameraPosition = this.camera.position.clone();
            const originalControlsTarget = this.controls.target.clone();
            const originalCameraZoom = this.camera.zoom;
            const originalCameraFov = this.camera.fov;
            
            // Apply custom camera settings if provided
            if (cameraSettings) {
                if (cameraSettings.position) {
                    this.camera.position.set(
                        cameraSettings.position.x,
                        cameraSettings.position.y,
                        cameraSettings.position.z
                    );
                }
                if (cameraSettings.target) {
                    this.controls.target.set(
                        cameraSettings.target.x,
                        cameraSettings.target.y,
                        cameraSettings.target.z
                    );
                }
                if (cameraSettings.zoom !== undefined) {
                    this.camera.zoom = cameraSettings.zoom;
                }
                if (cameraSettings.fov !== undefined) {
                    this.camera.fov = cameraSettings.fov;
                }
                this.camera.updateProjectionMatrix();
                this.controls.update();
            }
            
            // Add annotations if requested
            let annotationGroup = null;
            if (includeAnnotations && cargoGroups) {
                const viewName = cameraSettings?.name || 'default';
                annotationGroup = this.createAnnotations(cargoGroups, viewName);
                this.scene.add(annotationGroup);
            }
            
            // Hide existing axle load visualization for perspective/top views
            let needToRestoreAxleLoad = false;
            if (this.axleLoadGroup && this.showAxleLoads && cameraSettings?.name !== 'side') {
                // Temporarily hide axle loads for non-side views
                this.scene.remove(this.axleLoadGroup);
                needToRestoreAxleLoad = true;
            }
            
            // Handle transparency for focused group
            const originalMaterials = new Map();
            const originalEdges = new Map();
            let closestUnitInGroup = null;
            let closestDistance = Infinity;
            
            if (focusGroupId !== null) {
                // Store original materials and set transparency for non-focused units
                for (let mesh of this.cargoMeshes) {
                    const userData = mesh.userData;
                    if (userData && userData.groupId !== undefined) {
                        // Store original material
                        originalMaterials.set(mesh, {
                            material: mesh.material.clone(),
                            transparent: mesh.material.transparent,
                            opacity: mesh.material.opacity
                        });
                        
                        // Set transparency for units not in the focused group
                        if (userData.groupId !== focusGroupId) {
                            mesh.material.transparent = true;
                            mesh.material.opacity = 0.2;
                            
                            // Find and hide ALL line-based elements (edges) for this mesh
                            // This includes LineSegments, Line, and LineLoop for cylinders
                            mesh.traverse(child => {
                                if (child.type === 'LineSegments' || child.type === 'Line' || child.type === 'LineLoop') {
                                    if (!originalEdges.has(child)) {
                                        originalEdges.set(child, child.visible);
                                    }
                                    child.visible = false;
                                }
                            });
                        } else {
                            // Find closest unit in the focused group to camera
                            const distance = mesh.position.distanceTo(this.camera.position);
                            if (distance < closestDistance) {
                                closestDistance = distance;
                                closestUnitInGroup = mesh;
                            }
                        }
                    }
                }
                
                // Don't add dimension labels for group view in PDF export
                // Labels are not needed and cause scaling issues
            }
            
            // Add axle load visualization if requested (for side view only)
            let axleLoadGroup = null;
            let createdTemporaryAxleGroup = false;
            if (includeAxleLoads && cameraSettings?.name === 'side') {
                // Always create or use axle load visualization for side view
                if (this.axleLoadGroup && this.showAxleLoads) {
                    // Ensure existing group is visible for side view
                    if (!this.axleLoadGroup.parent) {
                        this.scene.add(this.axleLoadGroup);
                    }
                    axleLoadGroup = this.axleLoadGroup;
                } else {
                    // Create temporary axle load group for PDF export
                    axleLoadGroup = this.createAxleLoadVisualization();
                    if (axleLoadGroup) {
                        this.scene.add(axleLoadGroup);
                        createdTemporaryAxleGroup = true;
                    }
                }
            }
            
            // Render the scene
            this.renderer.render(this.scene, this.camera);
            
            // Capture canvas as base64 with JPEG compression for smaller file size
            // Quality 0.75 provides good balance between file size and image quality
            const dataURL = this.renderer.domElement.toDataURL('image/jpeg', 0.75);
            
            // Remove annotations if they were added
            if (annotationGroup) {
                this.scene.remove(annotationGroup);
            }
            
            // No need to remove dimension labels since we're not adding them for group view anymore
            
            // Remove axle load visualization if it was temporarily created
            if (createdTemporaryAxleGroup && axleLoadGroup) {
                this.scene.remove(axleLoadGroup);
            }
            
            // Restore original materials and edges if transparency was applied
            if (focusGroupId !== null) {
                for (let [mesh, originalData] of originalMaterials) {
                    mesh.material.transparent = originalData.transparent;
                    mesh.material.opacity = originalData.opacity;
                }
                
                // Restore edge visibility for all line-based elements
                for (let [element, originalVisibility] of originalEdges) {
                    if (element.type === 'LineSegments' || element.type === 'Line' || element.type === 'LineLoop') {
                        element.visible = originalVisibility;
                    }
                }
            }
            
            // Restore axle load visualization if it was hidden
            if (needToRestoreAxleLoad && this.axleLoadGroup) {
                this.scene.add(this.axleLoadGroup);
            }
            
            // Restore original camera state
            this.camera.position.copy(originalCameraPosition);
            this.controls.target.copy(originalControlsTarget);
            this.camera.zoom = originalCameraZoom;
            this.camera.fov = originalCameraFov;
            this.camera.updateProjectionMatrix();
            this.controls.update();
            
            // Render again with original camera to restore view
            this.renderer.render(this.scene, this.camera);
            
            resolve(dataURL);
        });
    }
    
    captureGroupView(groupId, cargoGroups) {
        // Get container dimensions for calculating optimal camera position
        const bounds = this.containerBounds || { 
            min: { x: -6.8, y: 0, z: -1.24 }, 
            max: { x: 6.8, y: 2.7, z: 1.24 } 
        };
        
        const length = bounds.max.x - bounds.min.x;
        const width = bounds.max.z - bounds.min.z;
        const height = bounds.max.y - bounds.min.y;
        const containerHeight = this.containerHeight || height;
        const trailerHeight = this.trailerOffset || 1.2;
        
        // Find the specific group data
        const focusGroup = cargoGroups.find(g => {
            // Match based on the first item's groupId in the group
            return g.items && g.items.length > 0 && g.items[0].groupId === groupId;
        });
        
        if (!focusGroup) return null;
        
        // Create camera settings for perspective view
        const cameraSettings = {
            position: { x: 0, y: height * 3.5 + trailerHeight, z: width * 5.5 },
            target: { x: 0, y: height / 2 + trailerHeight, z: 0 },
            fov: 45,
            name: 'group_view'
        };
        
        // Store current canvas size
        const originalWidth = this.renderer.domElement.width;
        const originalHeight = this.renderer.domElement.height;
        
        // Set canvas size for group view (3:2 ratio, 1800x1200)
        this.renderer.setSize(1800, 1200);
        this.camera.aspect = 1800 / 1200;
        this.camera.updateProjectionMatrix();
        
        // Create annotations for only this group with single info box
        const singleGroupArray = [focusGroup];
        
        // Capture view with focus on this group
        return this.captureView(cameraSettings, true, singleGroupArray, false, groupId).then(dataURL => {
            // Restore original canvas size
            this.renderer.setSize(originalWidth, originalHeight);
            this.camera.aspect = originalWidth / originalHeight;
            this.camera.updateProjectionMatrix();
            
            return dataURL;
        });
    }
    
    getMultipleViews(cargoGroups = null, includeSideView = false) {
        // Get container dimensions for calculating optimal camera positions
        const bounds = this.containerBounds || { 
            min: { x: -6.8, y: 0, z: -1.24 }, 
            max: { x: 6.8, y: 2.7, z: 1.24 } 
        };
        
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerY = (bounds.min.y + bounds.max.y) / 2;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;
        const length = bounds.max.x - bounds.min.x;
        const width = bounds.max.z - bounds.min.z;
        const height = bounds.max.y - bounds.min.y;
        
        // Get trailer height for better camera positioning
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.2;
        
        // Define camera views with better visibility of full container
        const views = [
            {
                name: 'default',
                // Perspective view from center, slightly from back, zoomed out more
                position: { 
                    x: 0,  // Centered
                    y: height * 3.5 + trailerHeight,  // Higher for better overview
                    z: width * 5.5  // Further back to see entire container
                },
                target: { x: centerX, y: trailerHeight + height/2, z: centerZ },
                fov: 45  // Narrower FOV for less distortion
            },
            {
                name: 'top',
                // Top-down view, closer for better detail
                position: { 
                    x: centerX, 
                    y: Math.max(length, width) * 0.85 + trailerHeight,  // Closer than before
                    z: centerZ 
                },
                target: { x: centerX, y: trailerHeight, z: centerZ },
                fov: 55  // Adjusted FOV for better framing
            }
        ];
        
        // Add side view if requested
        if (includeSideView) {
            // For side view, calculate precise center of entire vehicle (truck + cargo space)
            // Get actual truck cabin position from the visualization
            // Cabin is positioned at frontAxle - 0.2, and extends cabinLength/2 = 1.1 forward
            // So truck front is at: frontAxle - 0.2 - 1.1 = frontAxle - 1.3
            // Front axle is typically at containerFront - 1.0 (for SOLO) or kingpin - 3.1 (for standard)
            
            let truckFrontX;
            let cargoEndX = bounds.max.x;
            
            // Check vehicle type to calculate accurate truck front position
            const isSolo = this.containerDimensions?.isSolo || false;
            const isJumbo = this.containerDimensions?.isJumbo || false;
            
            if (isSolo) {
                // SOLO: front axle is 1.0m before cargo start
                // Cabin front is 1.3m before front axle
                truckFrontX = bounds.min.x - 1.0 - 1.3;
            } else if (isJumbo) {
                // JUMBO: similar to SOLO for first section
                truckFrontX = bounds.min.x - 1.0 - 1.3;
            } else {
                // Standard trailer: front axle is 3.1m before kingpin
                // Kingpin is 1.7m from cargo front
                // Cabin front is 1.3m before front axle
                const kingpinX = bounds.min.x + 1.7;
                const frontAxleX = kingpinX - 3.1;
                truckFrontX = frontAxleX - 1.3;
            }
            
            // Add small margins for better framing
            truckFrontX -= 0.5;
            cargoEndX += 0.5;
            
            // Calculate true center of the entire vehicle
            const vehicleCenterX = (truckFrontX + cargoEndX) / 2;
            
            views.push({
                name: 'side',
                // Side view from the right side of the vehicle - optimized for full width display
                position: { 
                    x: vehicleCenterX, 
                    y: trailerHeight + height * 0.55,  // Slightly elevated for better view
                    z: width * 3.9  // Further back for better overview
                },
                target: { x: vehicleCenterX, y: trailerHeight + height/2, z: centerZ },
                fov: 40  // Balanced FOV for proper framing
            });
        }
        
        // Store original canvas size
        const originalWidth = this.renderer.domElement.width;
        const originalHeight = this.renderer.domElement.height;
        
        // Capture all views - include annotations if cargo groups provided
        const includeAnnotations = cargoGroups !== null && cargoGroups.length > 0;
        const promises = views.map(view => {
            // Set different aspect ratios for different views
            let exportWidth, exportHeight;
            
            if (view.name === 'side') {
                // Wide aspect ratio for side view to fill page width
                exportWidth = 3000;
                exportHeight = 1000; // 3:1 ratio for wide side view
            } else {
                // Standard aspect ratio for other views
                exportWidth = 3000;
                exportHeight = 2000; // 3:2 ratio
            }
            
            this.renderer.setSize(exportWidth, exportHeight);
            this.camera.aspect = exportWidth / exportHeight;
            this.camera.updateProjectionMatrix();
            
            // Include axle loads only for side view, but no annotations for side view
            const includeAxleLoads = view.name === 'side';
            const includeAnnotationsForView = view.name === 'side' ? false : includeAnnotations;
            return this.captureView(view, includeAnnotationsForView, includeAnnotationsForView ? cargoGroups : null, includeAxleLoads).then(dataURL => ({ 
                name: view.name, 
                image: dataURL 
            }));
        });
        
        return Promise.all(promises).then(results => {
            // Restore original canvas size
            this.renderer.setSize(originalWidth, originalHeight);
            this.camera.aspect = originalWidth / originalHeight;
            this.camera.updateProjectionMatrix();
            return results;
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