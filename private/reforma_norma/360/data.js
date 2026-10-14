var APP_DATA = {
  "scenes": [
    {
      "id": "0-estar-social-y-cocina-integrada",
      "name": "Estar Social y cocina integrada",
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
        "yaw": 2.327843140894018,
        "pitch": -0.08156420415499532,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -0.78106731983911,
          "pitch": 0.07365125669999273,
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
        "yaw": -1.71810025674211,
        "pitch": 0.14986294594933902,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 1.4250751383841553,
          "pitch": 0.24108358622948245,
          "rotation": 0,
          "target": "0-estar-social-y-cocina-integrada"
        },
        {
          "yaw": -1.8090940447568933,
          "pitch": 0.4048112855950965,
          "rotation": 0,
          "target": "2-dormitorio-principal"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "2-dormitorio-principal",
      "name": "Dormitorio principal",
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
        "yaw": -1.9245469879530734,
        "pitch": -0.07091553345517454,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 1.1461111012285699,
          "pitch": 0.12652567586133046,
          "rotation": 0,
          "target": "1-rea-ntima"
        }
      ],
      "infoHotspots": []
    }
  ],
  "name": "Reforma Norma",
  "settings": {
    "mouseViewMode": "drag",
    "autorotateEnabled": true,
    "fullscreenButton": false,
    "viewControlButtons": false
  }
};
