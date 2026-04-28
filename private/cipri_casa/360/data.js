var APP_DATA = {
  "scenes": [
    {
      "id": "0-garage",
      "name": "Garage",
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
        "yaw": -0.006298099294106407,
        "pitch": 0.1070170065147984,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 0.0539007578296129,
          "pitch": 0.27046824499292654,
          "rotation": 0,
          "target": "1-corredor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "1-corredor",
      "name": "Corredor",
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
        "yaw": -1.5285115974081247,
        "pitch": 0.2068396298581998,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -1.6242017434107687,
          "pitch": 0.4075816200585507,
          "rotation": 0,
          "target": "2-estar-social"
        },
        {
          "yaw": -3.1120210819438814,
          "pitch": 0.28963759573018777,
          "rotation": 0,
          "target": "0-garage"
        },
        {
          "yaw": -0.014542458109600531,
          "pitch": 0.30142053499545973,
          "rotation": 0,
          "target": "9-jardn"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "2-estar-social",
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
        "yaw": -0.07232954732019614,
        "pitch": 0.22214782796620014,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 1.5653567662712984,
          "pitch": 0.39860784142715744,
          "rotation": 0,
          "target": "1-corredor"
        },
        {
          "yaw": -1.8214409838075607,
          "pitch": 0.32009663504597086,
          "rotation": 0,
          "target": "3-cocina-comedor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "3-cocina-comedor",
      "name": "Cocina Comedor",
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
          "yaw": 0.3815645375039498,
          "pitch": 0.17949783384151985,
          "rotation": 0,
          "target": "11-jardn"
        },
        {
          "yaw": 2.100865176250906,
          "pitch": 0.4134906491640322,
          "rotation": 0,
          "target": "2-estar-social"
        },
        {
          "yaw": 2.8162858254320335,
          "pitch": 0.2915733503721185,
          "rotation": 0,
          "target": "4-distribuidor---dormitorios"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "4-distribuidor---dormitorios",
      "name": "Distribuidor - Dormitorios",
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
        "yaw": -0.6538198061126614,
        "pitch": 0.24975794202785373,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -1.4959740008513638,
          "pitch": 0.4070263588687233,
          "rotation": 0,
          "target": "6-dormitorio-de-visitas"
        },
        {
          "yaw": 2.804419968689831,
          "pitch": 0.4976775807282152,
          "rotation": 0,
          "target": "7-dormitorio-principal---vestidor"
        },
        {
          "yaw": 0.17207251402786028,
          "pitch": 0.14500699430768016,
          "rotation": 0,
          "target": "3-cocina-comedor"
        },
        {
          "yaw": 1.3881059506389573,
          "pitch": 0.40399485038761185,
          "rotation": 0,
          "target": "5-dormitorio-individual"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "5-dormitorio-individual",
      "name": "Dormitorio Individual",
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
        "yaw": 0.06760676681328448,
        "pitch": 0.42933082994083627,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -2.1253117163500104,
          "pitch": 0.16791267006401256,
          "rotation": 0,
          "target": "4-distribuidor---dormitorios"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "6-dormitorio-de-visitas",
      "name": "Dormitorio de Visitas",
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
        "yaw": -0.777342797619017,
        "pitch": 0.34481555911229655,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 2.1610898016706486,
          "pitch": 0.2152963847863525,
          "rotation": 0,
          "target": "4-distribuidor---dormitorios"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "7-dormitorio-principal---vestidor",
      "name": "Dormitorio Principal - Vestidor",
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
        "yaw": 1.2579637805202815,
        "pitch": 0.2516289126943203,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 1.4990244474918883,
          "pitch": 0.4143767459735095,
          "rotation": 0,
          "target": "8-dormitorio-principal---cama"
        },
        {
          "yaw": 0.37439503649027905,
          "pitch": 0.3949762959571679,
          "rotation": 0,
          "target": "4-distribuidor---dormitorios"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "8-dormitorio-principal---cama",
      "name": "Dormitorio Principal - Cama",
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
        "yaw": -0.4242722976706368,
        "pitch": 0.23887069375649084,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -1.5883338401723979,
          "pitch": 0.42691656383740373,
          "rotation": 0,
          "target": "7-dormitorio-principal---vestidor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "9-jardn",
      "name": "Jardín",
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
        "yaw": -0.4355434274472252,
        "pitch": 0.14676322282658383,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -3.139993435446291,
          "pitch": 0.18805817396358648,
          "rotation": 0,
          "target": "1-corredor"
        },
        {
          "yaw": -0.020794372278899687,
          "pitch": 0.37090338841415793,
          "rotation": 0,
          "target": "10-quincho---parrilla"
        },
        {
          "yaw": -0.8223183463541162,
          "pitch": 0.27002372525500284,
          "rotation": 0,
          "target": "12-quincho---comedor"
        },
        {
          "yaw": -1.7430384410566528,
          "pitch": 0.26101599132698894,
          "rotation": 0,
          "target": "11-jardn"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "10-quincho---parrilla",
      "name": "Quincho - Parrilla",
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
        "yaw": -0.478542597644239,
        "pitch": 0.19077500298505967,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -1.3494780354371407,
          "pitch": 0.2750808557765083,
          "rotation": 0,
          "target": "12-quincho---comedor"
        },
        {
          "yaw": 3.0655910701740883,
          "pitch": 0.3285648616399044,
          "rotation": 0,
          "target": "9-jardn"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "11-jardn",
      "name": "Jardín",
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
        "yaw": -1.26514590522517,
        "pitch": 0.18577525108944748,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": -1.7743036635753953,
          "pitch": 0.33443600037669796,
          "rotation": 0,
          "target": "13-jardn-posterior"
        },
        {
          "yaw": 0.6384263808600608,
          "pitch": 0.15430829092982634,
          "rotation": 0,
          "target": "12-quincho---comedor"
        },
        {
          "yaw": 1.6136591708199894,
          "pitch": 0.14316726229997911,
          "rotation": 0,
          "target": "9-jardn"
        },
        {
          "yaw": 2.884414810683259,
          "pitch": 0.11021596591250216,
          "rotation": 0,
          "target": "3-cocina-comedor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "12-quincho---comedor",
      "name": "Quincho - Comedor",
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
        "yaw": -3.1240351170327294,
        "pitch": 0.21610813266551432,
        "fov": 1.2815487683924927
      },
      "linkHotspots": [
        {
          "yaw": 1.5134979313616785,
          "pitch": 0.41656883538179734,
          "rotation": 0,
          "target": "10-quincho---parrilla"
        },
        {
          "yaw": 2.485982376359418,
          "pitch": 0.3051968810755472,
          "rotation": 0,
          "target": "9-jardn"
        },
        {
          "yaw": -2.508734574500018,
          "pitch": 0.36503596956731243,
          "rotation": 0,
          "target": "11-jardn"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "13-jardn-posterior",
      "name": "Jardín Posterior",
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
        "yaw": 1.5441122978071604,
        "pitch": 0.2671191460152489,
        "fov": 1.3474042771833745
      },
      "linkHotspots": [
        {
          "yaw": 1.6724162269847724,
          "pitch": 0.645384553262339,
          "rotation": 0,
          "target": "11-jardn"
        },
        {
          "yaw": 0.7957959592596922,
          "pitch": 0.23733888045647333,
          "rotation": 0,
          "target": "12-quincho---comedor"
        },
        {
          "yaw": 2.4614455114451586,
          "pitch": 0.18306677558251216,
          "rotation": 0,
          "target": "3-cocina-comedor"
        }
      ],
      "infoHotspots": []
    }
  ],
  "name": "Casa Cipri",
  "settings": {
    "mouseViewMode": "drag",
    "autorotateEnabled": true,
    "fullscreenButton": true,
    "viewControlButtons": false
  }
};
