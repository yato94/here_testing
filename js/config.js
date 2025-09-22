const CONFIG = {
    vehicles: {
        standard: {
            name: 'Naczepa standardowa',
            length: 13.62,
            width: 2.48,
            height: 2.7,
            maxLoad: 24000,
            axles: {
                kingPin: { position: 1.7 },  // a: czop siodła 1.7m od przodu naczepy
                trailer: { position: 9.4, maxLoad: 24000, emptyWeight: 5200 },  // 13.6-4.2=9.4m od przodu (4.2m od końca)
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },  // 1.7-3.1=-1.4m od przodu (3.1m przed siodłem)
                rear: { position: 2.2, maxLoad: 11500, emptyWeight: 3600 }  // 1.7+0.5=2.2m od przodu (0.5m ZA siodłem)
            },
            trailerHeight: 1.2  // wysokość podłogi naczepy nad ziemią
        },
        mega: {
            name: 'Mega trailer',
            length: 13.62,
            width: 2.48,
            height: 3.0,
            maxLoad: 24000,
            axles: {
                kingPin: { position: 1.7 },
                trailer: { position: 9.4, maxLoad: 24000, emptyWeight: 5200 },
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },
                rear: { position: 2.2, maxLoad: 11500, emptyWeight: 3600 }
            },
            trailerHeight: 1.2
        },
        jumbo: {
            name: 'JUMBO',
            sections: [
                { length: 7.7, width: 2.48, height: 3.0 },  // Truck section
                { length: 7.7, width: 2.48, height: 3.0 }   // Trailer section
            ],
            length: 15.9,  // 7.7 + 0.5 gap + 7.7
            width: 2.48,
            height: 3.0,
            maxLoad: 22000,  // 22 tons max load for JUMBO
            isJumbo: true,  // Flag to identify JUMBO type (truck + trailer)
            axles: {
                // Truck axles (similar to SOLO, positions from section 1 start)
                front: { position: -1.0, maxLoad: 10000, emptyWeight: 5800 },  // 1.0m before section 1 start
                rear: { position: 5.5, maxLoad: 11500, emptyWeight: 3600 },   // 5.5m from section 1 start
                // Trailer axles (positions from section 2 start)
                trailer: { position: 4.2, maxLoad: 18000, emptyWeight: 4200, count: 2 }  // 4.2m from section 2 start, 2 axles
            },
            trailerHeight: 1.2
        },
        container20: {
            name: 'Kontener 20\'',
            length: 6.06,
            width: 2.44,
            height: 2.59,
            maxLoad: 28000,
            axles: {
                kingPin: { position: 1.7 },
                trailer: { position: 5.0, maxLoad: 24000, emptyWeight: 5200 },
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },
                rear: { position: 1.2, maxLoad: 11500, emptyWeight: 3600 }
            },
            trailerHeight: 1.2
        },
        container40: {
            name: 'Kontener 40\'',
            length: 12.19,
            width: 2.44,
            height: 2.59,
            maxLoad: 28000,
            axles: {
                kingPin: { position: 1.7 },
                trailer: { position: 9.4, maxLoad: 24000, emptyWeight: 5200 },
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },
                rear: { position: 2.2, maxLoad: 11500, emptyWeight: 3600 }
            },
            trailerHeight: 1.2
        },
        container40hc: {
            name: 'Kontener 40\' HC',
            length: 12.19,
            width: 2.44,
            height: 2.90,
            maxLoad: 28000,
            axles: {
                kingPin: { position: 1.7 },
                trailer: { position: 9.4, maxLoad: 24000, emptyWeight: 5200 },
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },
                rear: { position: 2.2, maxLoad: 11500, emptyWeight: 3600 }
            },
            trailerHeight: 1.2
        },
        coilmuldeStandard: {
            name: 'Coilmulde Standard',
            length: 13.62,
            width: 2.48,
            height: 2.7,
            maxLoad: 24000,
            hasGroove: true,
            grooveWidth: 1.25,
            grooveDepth: 0.3,
            grooveLength: 8.59,
            grooveStartX: 3.99,
            axles: {
                kingPin: { position: 1.7 },
                trailer: { position: 9.4, maxLoad: 24000, emptyWeight: 5200 },
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },
                rear: { position: 2.2, maxLoad: 11500, emptyWeight: 3600 }
            },
            trailerHeight: 1.2
        },
        coilmuldeMega: {
            name: 'Coilmulde Mega',
            length: 13.62,
            width: 2.48,
            height: 3.0,
            maxLoad: 24000,
            hasGroove: true,
            grooveWidth: 1.25,
            grooveDepth: 0.3,
            grooveLength: 8.59,
            grooveStartX: 3.99,
            axles: {
                kingPin: { position: 1.7 },
                trailer: { position: 9.4, maxLoad: 24000, emptyWeight: 5200 },
                front: { position: -1.4, maxLoad: 10000, emptyWeight: 5800 },
                rear: { position: 2.2, maxLoad: 11500, emptyWeight: 3600 }
            },
            trailerHeight: 1.2
        },
        solo: {
            name: 'SOLO',
            length: 7.7,
            width: 2.48,
            height: 3.0,
            maxLoad: 18000,
            isSolo: true,  // Flag to identify SOLO type
            axles: {
                // For SOLO: positions are from cargo space start
                front: { position: -1.0, maxLoad: 10000, emptyWeight: 5800 },  // 1.0m before cargo start
                rear: { position: 5.5, maxLoad: 11500, emptyWeight: 3600 }   // 5.5m from cargo start
            },
            trailerHeight: 1.2  // Same floor height as trailer
        }
    },
    
    cargoUnits: {
        'eur-pallet': {
            name: 'Paleta EUR',
            length: 1.2,
            width: 0.8,
            height: 0.15,
            defaultWeight: 25,
            maxStack: 3,
            maxStackWeight: 750,
            loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
            color: 0x8B4513
        },
        'industrial-pallet': {
            name: 'Paleta przemysłowa',
            length: 1.2,
            width: 1.0,
            height: 1.0,
            defaultWeight: 500,
            maxStack: 2,
            maxStackWeight: 1000,
            loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
            color: 0x654321
        },
        'uk-pallet': {
            name: 'Paleta UK',
            length: 1.2,
            width: 1.0,
            height: 0.15,
            defaultWeight: 35,
            maxStack: 3,
            maxStackWeight: 750,
            loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
            color: 0xA0522D
        },
        'half-pallet': {
            name: 'Półpaleta',
            length: 0.6,
            width: 0.8,
            height: 0.15,
            defaultWeight: 15,
            maxStack: 4,
            maxStackWeight: 500,
            loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
            color: 0xD2691E
        },
        'ibc': {
            name: 'IBC',
            length: 1.2,
            width: 1.0,
            height: 1.18,
            defaultWeight: 1000,
            maxStack: 0,
            maxStackWeight: 0,
            loadingMethods: ['rear', 'top'],
            unloadingMethods: ['rear', 'top'],
            color: 0x4169E1
        },
        'steel-coil': {
            name: 'Steel Coil',
            length: 1.8,  // Variable length (default 1.8m)
            width: 1.8,   // Fixed diameter 1.8m
            height: 1.8,  // Fixed diameter 1.8m
            defaultWeight: 5000,
            maxStack: 0,
            maxStackWeight: 0,
            loadingMethods: ['top'],
            unloadingMethods: ['top'],
            color: 0xc0c0c0,  // Silver color
            isRoll: true,
            fixedDiameter: true  // Flag to indicate fixed diameter
        },
        'roll': {
            name: 'Roll',
            length: 0.8,  // Diameter (default 0.8m)
            width: 0.8,   // Diameter 
            height: 1.2,  // Height (default 1.2m)
            defaultWeight: 500,
            maxStack: 0,
            maxStackWeight: 0,
            loadingMethods: ['rear', 'side', 'top'],
            unloadingMethods: ['rear', 'side', 'top'],
            color: 0x708090,  // Slate gray color
            isRoll: true,
            isVerticalRoll: true  // Flag to indicate vertical orientation by default
        }
    },
    
    colors: {
        container: 0xcccccc,
        containerWireframe: 0x333333,
        ground: 0xf0f0f0,
        gridHelper: 0x888888,
        selectedCargo: 0x00ff00,
        hoveredCargo: 0xffff00,
        centerOfGravity: 0xff0000
    },
    
    grid: {
        size: 20,
        divisions: 40
    }
};
