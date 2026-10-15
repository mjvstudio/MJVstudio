var APP_DATA = {
  "scenes": [
    {
      "id": "0-estar-cocina",
      "name": "Estar Cocina",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        }
      ],
      "faceSize": 443.5,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": -0.7834038653704667,
          "pitch": 0.006700221223285396,
          "rotation": 0,
          "target": "1-rea-ntima"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "1-rea-ntima",
      "name": "Área íntima",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        }
      ],
      "faceSize": 443.5,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 1.5344819506294396,
          "pitch": 0.18291698178020255,
          "rotation": 0,
          "target": "0-estar-cocina"
        },
        {
          "yaw": -1.7844048271012003,
          "pitch": 0.35900964246051004,
          "rotation": 0,
          "target": "2-dormitorio"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "2-dormitorio",
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
        }
      ],
      "faceSize": 443.5,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 1.0547976970094712,
          "pitch": 0.3201818089263284,
          "rotation": 0,
          "target": "1-rea-ntima"
        }
      ],
      "infoHotspots": []
    }
  ],
  "name": "Reforma Norma 2",
  "settings": {
    "mouseViewMode": "drag",
    "autorotateEnabled": true,
    "fullscreenButton": false,
    "viewControlButtons": false
  }
};
