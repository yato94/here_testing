const CONFIG = {
    vehicles: {
        standard: {
            name: 'Naczepa standardowa',
            length: 13.6,
            width: 2.48,
            height: 2.7,
            maxLoad: 24000,
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 11.5, maxLoad: 23000 }
            }
        },
        mega: {
            name: 'Mega trailer',
            length: 13.6,
            width: 2.48,
            height: 3.0,
            maxLoad: 24000,
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 11.5, maxLoad: 23000 }
            }
        },
        jumbo: {
            name: 'JUMBO',
            sections: [
                { length: 7.7, width: 2.48, height: 3.0 },
                { length: 7.7, width: 2.48, height: 3.0 }
            ],
            length: 15.9,  // 7.7 + 0.5 gap + 7.7
            width: 2.48,
            height: 3.0,
            maxLoad: 24000,
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 11.5, maxLoad: 23000 }
            }
        },
        container20: {
            name: 'Kontener 20\'',
            length: 6.06,
            width: 2.44,
            height: 2.59,
            maxLoad: 28000,
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 5.0, maxLoad: 23000 }
            }
        },
        container40: {
            name: 'Kontener 40\'',
            length: 12.19,
            width: 2.44,
            height: 2.59,
            maxLoad: 28000,
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 10.0, maxLoad: 23000 }
            }
        },
        container40hc: {
            name: 'Kontener 40\' HC',
            length: 12.19,
            width: 2.44,
            height: 2.90,
            maxLoad: 28000,
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 10.0, maxLoad: 23000 }
            }
        },
        coilmuldeStandard: {
            name: 'Coilmulde Standard',
            length: 13.6,
            width: 2.48,
            height: 2.7,
            maxLoad: 24000,
            hasGroove: true,
            grooveWidth: 1.25,  // Reduced by 0.85m total
            grooveDepth: 0.3,
            grooveLength: 8.59,
            grooveStartX: 3.99,  // Start position from the beginning
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 11.5, maxLoad: 23000 }
            }
        },
        coilmuldeMega: {
            name: 'Coilmulde Mega',
            length: 13.6,
            width: 2.48,
            height: 3.0,
            maxLoad: 24000,
            hasGroove: true,
            grooveWidth: 1.25,  // Reduced by 0.85m total
            grooveDepth: 0.3,
            grooveLength: 8.59,
            grooveStartX: 3.99,  // Start position from the beginning
            axles: {
                front: { position: 1.3, maxLoad: 7500 },
                rear: { position: 11.5, maxLoad: 23000 }
            }
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