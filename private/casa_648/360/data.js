var APP_DATA = {
  "scenes": [
    {
      "id": "0-hall",
      "name": "Hall",
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
          "yaw": 1.4364869022717892,
          "pitch": 0.245407450428484,
          "rotation": 0,
          "target": "1-habitacin-principal"
        },
        {
          "yaw": 0.03357977482967378,
          "pitch": 0.30033633428868,
          "rotation": 0,
          "target": "3-bao-social"
        },
        {
          "yaw": -1.4227100013883742,
          "pitch": 0.2233363940016755,
          "rotation": 0,
          "target": "4-habitacion-secundaria"
        },
        {
          "yaw": 1.2138811731438146,
          "pitch": 0.22596015595650343,
          "rotation": 0,
          "target": "2-bao-habitacin"
        },
        {
          "yaw": -3.100945110300975,
          "pitch": 0.32239554782090707,
          "rotation": 0,
          "target": "9-comedor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "1-habitacin-principal",
      "name": "Habitación Principal",
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
          "yaw": -1.6655876657821835,
          "pitch": 0.1739892526244322,
          "rotation": 0,
          "target": "0-hall"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "2-bao-habitacin",
      "name": "Baño Habitación",
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
          "yaw": 2.8590213627160095,
          "pitch": 0.31102707342639135,
          "rotation": 0,
          "target": "1-habitacin-principal"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "3-bao-social",
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
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 2.93993461458437,
          "pitch": 0.41266987882899997,
          "rotation": 0,
          "target": "0-hall"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "4-habitacion-secundaria",
      "name": "Habitacion Secundaria",
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
        "yaw": -0.02415978479983316,
        "pitch": 0.054159834528476836,
        "fov": 1.1479251634083179
      },
      "linkHotspots": [
        {
          "yaw": 2.086717511193063,
          "pitch": 0.28104611148826564,
          "rotation": 0,
          "target": "0-hall"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "5--atrs-",
      "name": " Atrás ",
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
        }
      ],
      "faceSize": 1024,
      "initialViewParameters": {
        "yaw": 2.964110571794638,
        "pitch": 0.20604929521016402,
        "fov": 1.1479251634083179
      },
      "linkHotspots": [
        {
          "yaw": -0.22515698039306287,
          "pitch": 0.06667978670578201,
          "rotation": 0,
          "target": "8-cocina"
        },
        {
          "yaw": 3.1367330159381037,
          "pitch": 0.13276321005780645,
          "rotation": 0,
          "target": "6-patio-trasero"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "6-patio-trasero",
      "name": "Patio Trasero",
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
          "yaw": 0.012543184342506564,
          "pitch": 0.12308285378046335,
          "rotation": 0,
          "target": "5--atrs-"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "7-entrada",
      "name": "Entrada",
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
          "yaw": 0.10099889171067389,
          "pitch": 0.224729673848298,
          "rotation": 0,
          "target": "10-sala"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "8-cocina",
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
        "yaw": 3.1380016855786073,
        "pitch": 0.138543195759258,
        "fov": 1.1479251634083179
      },
      "linkHotspots": [
        {
          "yaw": 2.9465644184410458,
          "pitch": 0.004105952440465188,
          "rotation": 0,
          "target": "5--atrs-"
        },
        {
          "yaw": -0.08924392544544801,
          "pitch": 0.20645498234206094,
          "rotation": 0,
          "target": "9-comedor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "9-comedor",
      "name": "Comedor",
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
        "yaw": 1.5361541705395592,
        "pitch": 0.07229979106170425,
        "fov": 1.1479251634083179
      },
      "linkHotspots": [
        {
          "yaw": 1.3846900979577548,
          "pitch": 0.09071578722492113,
          "rotation": 0,
          "target": "8-cocina"
        },
        {
          "yaw": 0.045653986848959605,
          "pitch": 0.2474158744193975,
          "rotation": 0,
          "target": "0-hall"
        },
        {
          "yaw": -1.5282227870636564,
          "pitch": 0.15694232107339623,
          "rotation": 0,
          "target": "10-sala"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "10-sala",
      "name": "Sala",
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
          "yaw": -0.15016849517514608,
          "pitch": 0.20996676268230985,
          "rotation": 0,
          "target": "9-comedor"
        },
        {
          "yaw": -2.7638382955117784,
          "pitch": 0.3619832104988596,
          "rotation": 0,
          "target": "7-entrada"
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
