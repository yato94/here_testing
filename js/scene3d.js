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
        
        // Drag & Drop properties
        this.isDragging = false;
        this.draggedObjects = [];
        this.dragPlane = null;
        this.dragOffset = new THREE.Vector3();
        this.clickCount = 0;
        this.clickTimer = null;
        this.ghostMesh = null;
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
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
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
        plane.receiveShadow = true;
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
                floor.receiveShadow = true;
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
            floor.receiveShadow = true;
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
                groove.receiveShadow = true;
                groove.castShadow = false;
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
        
        this.camera.position.set(
            dimensions.length * 1.5,
            trailerHeight + dimensions.height * 2,
            dimensions.width * 1.5
        );
        this.controls.target.set(0, trailerHeight + dimensions.height / 2, 0);
        this.controls.update();
        
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
            color: 0x003d7a, // Dark blue color for outlines
            linewidth: 2
        });
        
        // Create fill material for truck parts
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: 0x00a6fb, // Vivid blue
            transparent: true,
            opacity: 0.95,
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
                
            } else if (cargoData.isRoll && cargoData.isVerticalRoll) {
                // Roll - vertical cylinder by default
                const radius = cargoData.width / 2; // width = diameter
                const height = cargoData.height;
                
                geometry = new THREE.CylinderGeometry(
                    radius,    // top radius
                    radius,    // bottom radius
                    height,    // height
                    32,        // radial segments
                    1,         // height segments
                    false      // open ended
                );
                
                // Check if roll is rotated (lying on side)
                if (cargoData.rotated) {
                    geometry.rotateZ(Math.PI / 2); // Rotate to lie horizontally
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
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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
        
        const bounds = new THREE.Box3().setFromObject(container);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        
        switch(viewType) {
            case 'top':
                this.camera.position.set(center.x, size.y * 2, center.z);
                break;
            case 'side':
                this.camera.position.set(center.x, size.y / 2, size.z * 2);
                break;
            case 'front':
                this.camera.position.set(size.x * 2, size.y / 2, center.z);
                break;
            case '3d':
            default:
                this.camera.position.set(size.x * 1.5, size.y * 2, size.z * 1.5);
                break;
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
        
        if (this.isDragging && this.draggedObjects.length > 0) {
            // Handle dragging
            this.handleDragging();
        } else if (this.cargoMeshes.length > 0) {
            // Normal hover behavior - only if we have cargo
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
            
            // Clear previous hover
            if (this.hoveredObject) {
                this.hoveredObject.material.emissive = new THREE.Color(0x000000);
            }
            
            if (intersects.length > 0) {
                // Hovering over cargo - disable OrbitControls
                this.controls.enabled = false;
                this.hoveredObject = intersects[0].object;
                this.hoveredObject.material.emissive = new THREE.Color(0x444444);
                // Show grab cursor
                document.body.style.cursor = 'grab';
                // Show ruler for hovered cargo only if inside container
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
            }
        } else {
            // No cargo - ensure OrbitControls is enabled
            this.controls.enabled = true;
            document.body.style.cursor = 'default';
            this.hideRuler();
        }
    }
    
    onMouseClick(event) {
        // Ignore clicks during dragging
        if (this.isDragging) return;
        
        // Handle multi-click selection
        this.clickCount++;
        
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
        }
        
        this.clickTimer = setTimeout(() => {
            this.handleSelection(this.clickCount);
            this.clickCount = 0;
        }, 300);
    }
    
    handleSelection(clickCount) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
        
        // No selection highlighting - just detect clicks
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const clickedPosition = clickedMesh.position.clone();
            
            // Click handling without visual selection
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
        if (event.button !== 0) return; // Only left button
        
        // Update mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cargoMeshes);
        
        if (intersects.length > 0) {
            // We hit a cargo item - OrbitControls should be disabled from onMouseMove
            
            // Start dragging
            this.isDragging = true;
            document.body.style.cursor = 'grabbing';
            
            // Get the clicked object and all objects above it
            const clickedObject = intersects[0].object;
            this.draggedObjects = this.getAllObjectsAbove(clickedObject);
            
            // Show ruler for the dragged object only if inside container
            if (!this.isPositionOutsideContainer(clickedObject.position)) {
                this.showRulerForCargo(clickedObject);
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
        const objects = [clickedObject];
        const clickedPos = clickedObject.position;
        const tolerance = 0.1;
        
        // Find all objects that are above the clicked one (in the same stack)
        for (let mesh of this.cargoMeshes) {
            if (mesh === clickedObject) continue;
            
            // Check if this mesh is in the same X/Z position and above
            if (Math.abs(mesh.position.x - clickedPos.x) < tolerance &&
                Math.abs(mesh.position.z - clickedPos.z) < tolerance &&
                mesh.position.y > clickedPos.y) {
                objects.push(mesh);
            }
        }
        
        // Sort by Y position (bottom to top)
        objects.sort((a, b) => a.position.y - b.position.y);
        
        return objects;
    }
    
    onMouseUp(event) {
        if (!this.isDragging) {
            // Re-enable controls if we're not dragging
            this.controls.enabled = true;
            return;
        }
        
        // Drop the objects - they're already in the correct position
        // Update their userData positions
        this.draggedObjects.forEach(obj => {
            // Update userData position
            if (obj.userData) {
                obj.userData.position = {
                    x: obj.position.x,
                    y: obj.position.y,
                    z: obj.position.z
                };
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
    
    onContextMenu(event) {
        event.preventDefault(); // Prevent default browser context menu
        
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
            
            // Show ruler for the right-clicked cargo only if inside container
            if (!this.isPositionOutsideContainer(clickedMesh.position)) {
                this.showRulerForCargo(clickedMesh);
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
        
        // Add unit details section
        const detailsSection = document.createElement('div');
        detailsSection.style.cssText = `
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
            font-size: 12px;
            color: #666;
        `;
        detailsSection.innerHTML = `
            <strong style="color: #333;">${cargoData.name || 'Jednostka'}</strong><br>
            Wymiary: ${(cargoData.length*100).toFixed(0)}×${(cargoData.width*100).toFixed(0)}×${(cargoData.height*100).toFixed(0)} cm<br>
            Waga: ${cargoData.weight} kg<br>
            Piętrowanie: ${cargoData.maxStack || 0} szt.<br>
            Załadunek: ${this.formatMethods(cargoData.loadingMethods)}<br>
            Rozładunek: ${this.formatMethods(cargoData.unloadingMethods)}
        `;
        menu.appendChild(detailsSection);
        
        // Menu items
        const menuItems = [
            { text: '↻ Obróć w prawo (90°)', action: () => this.rotateUnit(mesh, 90) },
            { text: '↺ Obróć w lewo (-90°)', action: () => this.rotateUnit(mesh, -90) },
            { text: '⟲ Obróć do góry (180°)', action: () => this.rotateUnit(mesh, 180) },
            { separator: true },
            { text: '📦 Przenieś poza przestrzeń', action: () => this.moveOutsideContainer(mesh) },
            { text: '🗑️ Usuń jednostkę', action: () => this.removeUnit(mesh), style: 'color: #dc3545;' }
        ];
        
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
                const overlapX = Math.abs(test.newX - otherMesh.position.x) < (halfLength + otherHalfLength - 0.01);
                const overlapZ = Math.abs(test.newZ - otherMesh.position.z) < (halfWidth + otherHalfWidth - 0.01);
                const overlapY = Math.abs(test.y - otherMesh.position.y) < (halfHeight + otherHalfHeight - 0.01);
                
                if (overlapX && overlapZ && overlapY) {
                    return false;
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
                
                // Update userData position
                unit.userData.position = {
                    x: unit.position.x,
                    y: unit.position.y,
                    z: unit.position.z
                };
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
                    
                    // Update ruler position
                    this.showRulerForCargo(this.draggedObjects[0]);
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
                        
                        // Update ruler position for slide position
                        this.showRulerForCargo(this.draggedObjects[0]);
                        
                        // Store this as last valid position
                        this.lastValidPosition = slidePosition.clone();
                    }
                    // If no slide position found, objects stay at last valid position (sticky effect)
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
        if (distance < 0.01) return null;
        
        // First, try to move directly to the target position
        const directDropPos = this.calculateDropPosition(clampedPosition);
        if (this.checkValidPosition(directDropPos) && (this.canStackAtPosition !== false)) {
            return directDropPos;
        }
        
        // Try incremental movement along the path
        const steps = Math.min(20, Math.ceil(distance / 0.1)); // Max 20 steps, every 10cm
        let lastValidPos = null;
        
        for (let i = 1; i <= steps; i++) {
            const fraction = i / steps;
            const testPos = new THREE.Vector3(
                currentPos.x + deltaX * fraction,
                currentPos.y,
                currentPos.z + deltaZ * fraction
            );
            
            const dropPos = this.calculateDropPosition(testPos);
            if (this.checkValidPosition(dropPos) && (this.canStackAtPosition !== false)) {
                lastValidPos = dropPos;
            } else {
                // Hit an obstacle - return the last valid position we found
                if (lastValidPos) {
                    return lastValidPos;
                }
                break;
            }
        }
        
        // If we got here with a valid position, use it
        if (lastValidPos) {
            return lastValidPos;
        }
        
        // Try sliding along axes when blocked
        // This creates the "sliding along walls" effect
        
        // Determine which axis has more movement
        const absX = Math.abs(deltaX);
        const absZ = Math.abs(deltaZ);
        
        // Try moving along the dominant axis first
        if (absX > absZ && absX > 0.01) {
            // Try moving only in X direction
            const xOnlyPos = new THREE.Vector3(clampedPosition.x, currentPos.y, currentPos.z);
            const xDropPos = this.calculateDropPosition(xOnlyPos);
            if (this.checkValidPosition(xDropPos) && (this.canStackAtPosition !== false)) {
                return xDropPos;
            }
            
            // Try partial X movement
            for (let fraction = 0.9; fraction > 0.1; fraction -= 0.1) {
                const partialX = new THREE.Vector3(
                    currentPos.x + deltaX * fraction,
                    currentPos.y,
                    currentPos.z
                );
                const partialDropPos = this.calculateDropPosition(partialX);
                if (this.checkValidPosition(partialDropPos) && (this.canStackAtPosition !== false)) {
                    return partialDropPos;
                }
            }
        }
        
        if (absZ > 0.01) {
            // Try moving only in Z direction
            const zOnlyPos = new THREE.Vector3(currentPos.x, currentPos.y, clampedPosition.z);
            const zDropPos = this.calculateDropPosition(zOnlyPos);
            if (this.checkValidPosition(zDropPos) && (this.canStackAtPosition !== false)) {
                return zDropPos;
            }
            
            // Try partial Z movement
            for (let fraction = 0.9; fraction > 0.1; fraction -= 0.1) {
                const partialZ = new THREE.Vector3(
                    currentPos.x,
                    currentPos.y,
                    currentPos.z + deltaZ * fraction
                );
                const partialDropPos = this.calculateDropPosition(partialZ);
                if (this.checkValidPosition(partialDropPos) && (this.canStackAtPosition !== false)) {
                    return partialDropPos;
                }
            }
        }
        
        // Try the other axis if the dominant one failed
        if (absZ > absX && absX > 0.01) {
            // Try X movement since Z was dominant but failed
            const xOnlyPos = new THREE.Vector3(clampedPosition.x, currentPos.y, currentPos.z);
            const xDropPos = this.calculateDropPosition(xOnlyPos);
            if (this.checkValidPosition(xDropPos) && (this.canStackAtPosition !== false)) {
                return xDropPos;
            }
        }
        
        return null; // No valid slide position found
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
        const snapThreshold = draggedData.isVerticalRoll ? 0.1 : 1.0; // Rolls: 10cm, others: 1m
        
        
        // Check all cargo meshes for stacking or side snapping
        for (let mesh of this.cargoMeshes) {
            // Skip the dragged objects
            if (this.draggedObjects.includes(mesh)) continue;
            
            const targetData = mesh.userData;
            const targetHalfWidth = targetData.width / 2;
            const targetHalfLength = targetData.length / 2;
            const targetHalfHeight = targetData.height / 2;
            
            // Check if cursor is directly over this unit (for stacking)
            const overlapX = Math.abs(adjustedPosition.x - mesh.position.x) < Math.min(halfLength, targetHalfLength) * 0.8;
            const overlapZ = Math.abs(adjustedPosition.z - mesh.position.z) < Math.min(halfWidth, targetHalfWidth) * 0.8;
            
            if (overlapX && overlapZ) {
                // We're directly over the unit - try to stack on top
                const canStackResult = this.canStackOn(mesh);
                const canFitResult = this.canFitOnTop(draggedData, targetData);
                const stackAllowed = canStackResult && canFitResult;
                
                // Calculate the Y position on top of this unit
                const stackY = mesh.position.y + targetHalfHeight + halfHeight;
                
                // If this unit is at or above our current target height
                if (mesh.position.y + targetHalfHeight >= targetY - halfHeight) {
                    // Stack on top - center on the unit below
                    targetY = stackY;
                    snapPosition = {
                        x: mesh.position.x,
                        z: mesh.position.z
                    };
                    canStack = stackAllowed;
                    isStacking = true;
                }
            } else {
                // Not directly over - check for side snapping
                const distance = Math.sqrt(
                    Math.pow(adjustedPosition.x - mesh.position.x, 2) + 
                    Math.pow(adjustedPosition.z - mesh.position.z, 2)
                );
                
                // Only consider units at ground level for side snapping
                // Check if mesh is at ground level (considering trailer height if inside container)
                const meshIsOutside = this.isPositionOutsideContainer(mesh.position);
                const expectedGroundY = meshIsOutside ? targetData.height / 2 : (trailerHeight + targetData.height / 2);
                const isGroundLevel = Math.abs(mesh.position.y - expectedGroundY) < 0.1;
                
                if (isGroundLevel && distance < closestDistance) {
                    closestDistance = distance;
                    closestUnit = mesh;
                }
            }
        }
        
        // If not stacking and we have a close unit, snap to its side
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
    
    canFitOnTop(draggedData, targetData) {
        // Check if dragged unit can fit on top of target
        // Dragged unit must be same size or smaller than target
        const lengthFits = draggedData.length <= targetData.length;
        const widthFits = draggedData.width <= targetData.width;
        
        return lengthFits && widthFits;
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
        for (let i = 0; i < this.draggedObjects.length; i++) {
            const draggedMesh = this.draggedObjects[i];
            const draggedData = draggedMesh.userData;
            const halfWidth = draggedData.width / 2;
            const halfLength = draggedData.length / 2;
            const halfHeight = draggedData.height / 2;
            
            // Calculate position for this object in the stack
            const objectPosition = position.clone();
            if (i > 0) {
                // Adjust Y position for stacked objects
                let stackHeight = 0;
                for (let j = 0; j < i; j++) {
                    stackHeight += this.draggedObjects[j].userData.height;
                }
                objectPosition.y = position.y + stackHeight;
            }
            
            // Check if this object is within container bounds
            if (objectPosition.x - halfLength < this.containerBounds.min.x ||
                objectPosition.x + halfLength > this.containerBounds.max.x ||
                objectPosition.z - halfWidth < this.containerBounds.min.z ||
                objectPosition.z + halfWidth > this.containerBounds.max.z ||
                objectPosition.y + halfHeight > this.containerBounds.max.y) {
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
                    const overlapX = Math.abs(objectPosition.x - mesh.position.x) < (halfLength + targetHalfLength - 0.01);
                    const overlapZ = Math.abs(objectPosition.z - mesh.position.z) < (halfWidth + targetHalfWidth - 0.01);
                    
                    if (overlapX && overlapZ) {
                        // Check if we're at the same height level (collision)
                        const heightOverlap = Math.abs(objectPosition.y - mesh.position.y) < (halfHeight + targetHalfHeight - 0.01);
                        
                        if (heightOverlap) {
                            // Check if this is a valid stacking position
                            const isStacking = Math.abs(objectPosition.y - (mesh.position.y + targetHalfHeight + halfHeight)) < 0.1;
                            const canStack = this.canStackOn(mesh) && this.canFitOnTop(draggedData, targetData);
                            
                            if (!isStacking || !canStack) {
                                return false; // Collision or invalid stacking
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
    
    canStackOn(targetMesh) {
        // Check if the target allows stacking
        const targetData = targetMesh.userData;
        const draggedData = this.draggedObjects[0]?.userData;
        
        if (!targetData || !draggedData) return false;
        
        // Count how many units we're dragging (entire stack)
        const draggedStackSize = this.draggedObjects.length;
        
        // Calculate total weight of dragged stack
        let draggedStackWeight = 0;
        for (let obj of this.draggedObjects) {
            draggedStackWeight += obj.userData.weight || 0;
        }
        
        // Find ALL units in the target stack (below and including target)
        const stackUnits = [];
        const tolerance = 0.1;
        
        // First, find all units at this X/Z position
        for (let mesh of this.cargoMeshes) {
            if (this.draggedObjects.includes(mesh)) continue;
            
            if (Math.abs(mesh.position.x - targetMesh.position.x) < tolerance &&
                Math.abs(mesh.position.z - targetMesh.position.z) < tolerance &&
                mesh.position.y <= targetMesh.position.y + tolerance) {
                stackUnits.push(mesh);
            }
        }
        
        // Sort by Y position (bottom to top)
        stackUnits.sort((a, b) => a.position.y - b.position.y);
        
        // Check EACH unit in the stack from bottom up to see if it allows more units above it
        for (let unit of stackUnits) {
            const unitData = unit.userData;
            const maxStack = unitData.maxStack !== undefined ? unitData.maxStack : 1;
            const maxStackWeight = unitData.maxStackWeight !== undefined ? unitData.maxStackWeight : Infinity;
            
            // Count how many units are currently ABOVE this specific unit and their total weight
            let unitsAbove = 0;
            let weightAbove = 0;
            for (let mesh of this.cargoMeshes) {
                if (this.draggedObjects.includes(mesh)) continue;
                
                if (Math.abs(mesh.position.x - unit.position.x) < tolerance &&
                    Math.abs(mesh.position.z - unit.position.z) < tolerance &&
                    mesh.position.y > unit.position.y + tolerance) {
                    unitsAbove++;
                    weightAbove += mesh.userData.weight || 0;
                }
            }
            
            // Check if adding the ENTIRE dragged stack would exceed this unit's count limit
            // We're adding draggedStackSize units on top
            if (unitsAbove + draggedStackSize > maxStack) {
                return false; // This unit can't support the additional dragged stack
            }
            
            // Check if adding the ENTIRE dragged stack would exceed this unit's weight limit
            if (weightAbove + draggedStackWeight > maxStackWeight) {
                return false; // This unit can't support the additional weight
            }
        }
        
        // Check container height - will the new stack fit?
        if (this.containerBounds) {
            // Get the height of the top unit in target stack
            const topTargetY = targetMesh.position.y + targetData.height / 2;
            
            // Calculate total height of dragged stack
            let draggedStackHeight = 0;
            for (let obj of this.draggedObjects) {
                draggedStackHeight += obj.userData.height;
            }
            
            // Check if placing dragged stack on top would exceed container height
            const newTopY = topTargetY + draggedStackHeight;
            if (newTopY > this.containerBounds.max.y) {
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
        
        // Check if JUMBO and determine which section the cargo is in
        if (this.containerBounds.isJumbo && this.containerBounds.sections) {
            const gap = 0.5; // 50cm gap between sections
            const section1End = this.containerBounds.min.x + this.containerBounds.sections[0].length;
            const section2Start = section1End + gap;
            
            // Check which section the cargo is in
            const cargoStartX = cargoItem.position.x - cargoItem.userData.length / 2;
            const cargoEndX = cargoItem.position.x + cargoItem.userData.length / 2;
            
            // Always show main ruler from start of container
            const containerStartX = this.containerBounds.min.x;
            const totalDistance = Math.abs(cargoEndX - containerStartX);
            
            if (cargoStartX >= section2Start) {
                // Cargo is in second section
                // Main ruler (black) - distance excluding gap
                const mainDistance = totalDistance - gap;
                this.createRulerLine(containerStartX, cargoEndX, mainDistance, false);
                
                // Additional ruler (blue) - from start of second section
                const section2Distance = Math.abs(cargoEndX - section2Start);
                this.createRulerLine(section2Start, cargoEndX, section2Distance, true);
            } else {
                // Cargo is in first section - only main ruler
                this.createRulerLine(containerStartX, cargoEndX, totalDistance, false);
            }
        } else {
            // Standard container - single ruler
            const cargoEndX = cargoItem.position.x + cargoItem.userData.length / 2;
            const containerStartX = this.containerBounds.min.x;
            const distance = Math.abs(cargoEndX - containerStartX);
            this.createRulerLine(containerStartX, cargoEndX, distance, false);
        }
        
        this.scene.add(this.rulerGroup);
        this.rulerVisible = true;
    }
    
    createRulerLine(startX, endX, distance, isSecondSection) {
        // Determine which Z edge (front or back) is closer to camera
        const containerCenterZ = (this.containerBounds.min.z + this.containerBounds.max.z) / 2;
        const rulerZ = this.camera.position.z > containerCenterZ 
            ? this.containerBounds.max.z + (isSecondSection ? 0.9 : 0.2)  // Front edge, much bigger offset for second ruler
            : this.containerBounds.min.z - (isSecondSection ? 0.9 : 0.2); // Back edge, much bigger offset for second ruler
        
        // Get trailer height from container dimensions
        const trailerHeight = this.containerDimensions?.trailerHeight || 1.1;
        const rulerY = trailerHeight + (isSecondSection ? 0.08 : 0.01); // Place at trailer floor height
        
        const lineStart = new THREE.Vector3(startX, rulerY, rulerZ);
        const lineEnd = new THREE.Vector3(endX, rulerY, rulerZ);
        const labelPos = new THREE.Vector3(endX, trailerHeight + (isSecondSection ? -0.35 : -0.15), rulerZ);
        
        // Create main line - use different color for second section in JUMBO
        const lineColor = isSecondSection ? 0x0066cc : 0x000000; // Blue for second section
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([lineStart, lineEnd]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: lineColor,
            linewidth: 2,
            opacity: 0.9,
            transparent: true
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        this.rulerGroup.add(line);
        
        // Create small end caps
        const capSize = 0.05;
        const startCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(lineStart.x, rulerY - capSize, lineStart.z),
            new THREE.Vector3(lineStart.x, rulerY + capSize, lineStart.z)
        ]);
        const startCap = new THREE.Line(startCapGeometry, lineMaterial);
        this.rulerGroup.add(startCap);
        
        const endCapGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(lineEnd.x, rulerY - capSize, lineEnd.z),
            new THREE.Vector3(lineEnd.x, rulerY + capSize, lineEnd.z)
        ]);
        const endCap = new THREE.Line(endCapGeometry, lineMaterial);
        this.rulerGroup.add(endCap);
        
        // Create subtle arrow at end
        const arrowSize = 0.08;
        const arrowPoints = [
            new THREE.Vector3(lineEnd.x - arrowSize, rulerY + arrowSize/2, lineEnd.z),
            new THREE.Vector3(lineEnd.x, rulerY, lineEnd.z),
            new THREE.Vector3(lineEnd.x - arrowSize, rulerY - arrowSize/2, lineEnd.z)
        ];
        const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
        const arrowMaterial = new THREE.LineBasicMaterial({ 
            color: lineColor,
            linewidth: 2
        });
        const arrow = new THREE.Line(arrowGeometry, arrowMaterial);
        this.rulerGroup.add(arrow);
        
        // Create minimal text label with better quality
        const canvas = document.createElement('canvas');
        // Higher resolution for better quality
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        // Enable better rendering quality
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Add subtle white shadow for better readability on dark background
        context.shadowColor = 'rgba(255, 255, 255, 0.9)';
        context.shadowBlur = 4;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw text with better font - use matching color
        context.fillStyle = isSecondSection ? '#0066cc' : '#000000';
        context.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`${distance.toFixed(2)} m`, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        // Better texture filtering for quality
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            sizeAttenuation: false,
            opacity: 0.95,
            transparent: true,
            depthTest: false  // Always render on top
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.2, 0.05, 1); // Smaller and more compact
        sprite.position.copy(labelPos); // Below the arrow end
        this.rulerGroup.add(sprite);
        
        // Add subtle tick marks for every meter
        const tickColor = isSecondSection ? 0x6699ff : 0x333333; // Lighter blue for second section
        const tickMaterial = new THREE.LineBasicMaterial({ 
            color: tickColor,
            linewidth: 1,
            opacity: 0.6,
            transparent: true
        });
        
        const fullMeters = Math.floor(distance);
        for (let i = 1; i <= fullMeters; i++) {
            const tickSize = 0.03;
            // Calculate tick position
            let tickX;
            if (isSecondSection) {
                // For second section, place ticks accounting for the gap
                if (i <= 7.7) {  // Within first section length
                    tickX = startX + i;
                } else {
                    // Skip gap area and continue in second section
                    tickX = startX + i + 0.5;
                }
            } else {
                tickX = startX + i;
            }
            
            if (tickX < endX - 0.05) {
                const tickGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(tickX, rulerY - tickSize, rulerZ),
                    new THREE.Vector3(tickX, rulerY + tickSize, rulerZ)
                ]);
                const tick = new THREE.Line(tickGeometry, tickMaterial);
                this.rulerGroup.add(tick);
            }
        }
    }
    
    showRulerForCargo(cargoMesh) {
        if (!cargoMesh || !cargoMesh.userData) return;
        this.createRuler(cargoMesh);
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
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Only update controls if they've changed
        if (this.controls.enabled) {
            this.controls.update();
        }
        
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
}