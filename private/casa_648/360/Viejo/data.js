var APP_DATA = {
  "scenes": [
    {
      "id": "0-estar-social",
      "name": "Estar Social",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": -0.3310980223650173,
          "pitch": 0.20153715872673317,
          "rotation": 0,
          "target": "1-distribuidor"
        },
        {
          "yaw": -2.8624435197856215,
          "pitch": 0.4073735520260122,
          "rotation": 0,
          "target": "7-jardin-frontal"
        },
        {
          "yaw": -0.05333449851254457,
          "pitch": 0.138307439053861,
          "rotation": 0,
          "target": "2-cocina"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "1-distribuidor",
      "name": "Distribuidor",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": -1.6248984333542928,
        "pitch": 0.03264382860003856,
        "fov": 1.335888521808506
      },
      "linkHotspots": [
        {
          "yaw": 2.1126495004600763,
          "pitch": 0.40542631466673384,
          "rotation": 0,
          "target": "0-estar-social"
        },
        {
          "yaw": 0.03003806780932905,
          "pitch": 0.27396757043283415,
          "rotation": 0,
          "target": "4-dormitorio-principal"
        },
        {
          "yaw": -0.33854042822565056,
          "pitch": 0.3005474081368078,
          "rotation": 0,
          "target": "3-bao-privado"
        },
        {
          "yaw": -3.0832435731003063,
          "pitch": 0.3955988807419093,
          "rotation": 0,
          "target": "8-dormitorio"
        },
        {
          "yaw": -1.7267861056958296,
          "pitch": 0.54179733167161,
          "rotation": 0,
          "target": "9-bao-social"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "2-cocina",
      "name": "Cocina",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": -0.3883365096291147,
          "pitch": 0.2343423589199034,
          "rotation": 0,
          "target": "11-estar-exterior"
        },
        {
          "yaw": -3.0970146164052803,
          "pitch": 0.1452567128690987,
          "rotation": 0,
          "target": "0-estar-social"
        },
        {
          "yaw": -2.7101146289799125,
          "pitch": 0.17390666596604376,
          "rotation": 0,
          "target": "1-distribuidor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "3-bao-privado",
      "name": "Baño Privado",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": -1.6364192325166016,
        "pitch": -0.07784312815049432,
        "fov": 1.335888521808506
      },
      "linkHotspots": [
        {
          "yaw": 1.5064901405811995,
          "pitch": 0.02747109374424639,
          "rotation": 0,
          "target": "4-dormitorio-principal"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "4-dormitorio-principal",
      "name": "Dormitorio Principal",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": -1.5902564883013355,
        "pitch": 0.002203179050006554,
        "fov": 1.335888521808506
      },
      "linkHotspots": [
        {
          "yaw": 2.9366855510669367,
          "pitch": 0.19053451324418091,
          "rotation": 0,
          "target": "1-distribuidor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "5-estar-exterior",
      "name": "Estar Exterior",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [],
      "infoHotspots": []
    },
    {
      "id": "6-fachada-frontal",
      "name": "Fachada Frontal",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 0.19088633258672516,
          "pitch": 0.2051833630812112,
          "rotation": 0,
          "target": "7-jardin-frontal"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "7-jardin-frontal",
      "name": "Jardin Frontal",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 0.0867049336544099,
          "pitch": 0.10015641816925402,
          "rotation": 0,
          "target": "0-estar-social"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "8-dormitorio",
      "name": "Dormitorio",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": -1.6068935203446628,
        "pitch": 0.00957687563419185,
        "fov": 1.335888521808506
      },
      "linkHotspots": [
        {
          "yaw": 0.3771476096959141,
          "pitch": 0.186780642183491,
          "rotation": 0,
          "target": "1-distribuidor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "9-bao-social",
      "name": "Baño Social",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": -1.6263838680398948,
        "pitch": 0.013942645745157023,
        "fov": 1.335888521808506
      },
      "linkHotspots": [
        {
          "yaw": 1.2211528018328774,
          "pitch": 0.3718100564758622,
          "rotation": 0,
          "target": "1-distribuidor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "10-jardin-exterior",
      "name": "Jardin Exterior",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 3.0396510607161122,
          "pitch": 0.15237920587677323,
          "rotation": 0,
          "target": "11-estar-exterior"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "11-estar-exterior",
      "name": "Estar Exterior",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": 0.10970359624320913,
        "pitch": 0.11566401570158824,
        "fov": 1.335888521808506
      },
      "linkHotspots": [
        {
          "yaw": -0.12796025880667905,
          "pitch": 0.10268127545234407,
          "rotation": 0,
          "target": "10-jardin-exterior"
        },
        {
          "yaw": -3.0484898304398804,
          "pitch": 0.14503202716965014,
          "rotation": 0,
          "target": "2-cocina"
        }
      ],
      "infoHotspots": []
    }
  ],
  "name": "Project Title",
  "settings": {
    "mouseViewMode": "drag",
    "autorotateEnabled": true,
    "fullscreenButton": false,
    "viewControlButtons": false
  }
};
