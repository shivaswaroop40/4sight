// Generated from public/data/iphone.json. Keep the two identical.
import type { IPhoneData } from "./iphoneData";

export const IPHONE_DATA_FALLBACK: IPhoneData = {
  "components": [
    {
      "id": "frame",
      "name": "Frame",
      "description": "The aluminium band that holds everything together. Every other part clicks into it, and it carries the buttons, the speaker holes, and the USB-C port.",
      "properties": {
        "material": "aluminium",
        "size": "about 147.6 x 71.6 x 7.8 mm",
        "port": "USB-C"
      },
      "assembled": {
        "position": [
          0,
          0,
          0
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          -1.3,
          0,
          0
        ],
        "rotation": [
          0.12,
          0.3,
          0.03
        ]
      },
      "stage": {
        "start": 0.02,
        "end": 0.14
      }
    },
    {
      "id": "logic-board",
      "name": "Logic board",
      "description": "The phone's brain. It carries the A-series chip, a system on a chip that combines the CPU, GPU, and Neural Engine, plus memory and radios.",
      "properties": {
        "chip": "A-series system on a chip",
        "memory": "about 6 GB",
        "radios": "5G, Wi-Fi, Bluetooth"
      },
      "assembled": {
        "position": [
          0,
          1.62,
          -0.03
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          1.7,
          1.8,
          0.5
        ],
        "rotation": [
          -0.12,
          0.35,
          0.06
        ]
      },
      "stage": {
        "start": 0.1,
        "end": 0.24
      }
    },
    {
      "id": "battery",
      "name": "Battery",
      "description": "A flat lithium-ion pouch that fills most of the lower body and powers the phone through the day.",
      "properties": {
        "capacity": "about 3,300 mAh",
        "chemistry": "lithium-ion",
        "charging": "USB-C and wireless"
      },
      "assembled": {
        "position": [
          0,
          -0.95,
          -0.04
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          1.8,
          -1.7,
          0.5
        ],
        "rotation": [
          0.1,
          0.35,
          -0.06
        ]
      },
      "stage": {
        "start": 0.2,
        "end": 0.34
      }
    },
    {
      "id": "taptic-engine",
      "name": "Taptic Engine",
      "description": "A small linear motor that makes the gentle taps and buzzes you feel when you type or get a notification.",
      "properties": {
        "type": "linear vibration motor",
        "feel": "crisp taps"
      },
      "assembled": {
        "position": [
          0.72,
          -2.58,
          -0.03
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          3.3,
          -4,
          0.8
        ],
        "rotation": [
          0.2,
          0.3,
          0.3
        ]
      },
      "stage": {
        "start": 0.3,
        "end": 0.42
      }
    },
    {
      "id": "speaker",
      "name": "Speaker",
      "description": "The bottom loudspeaker that plays ringtones, music, and speakerphone calls through the holes in the frame.",
      "properties": {
        "type": "small dynamic driver",
        "pairs": "with the earpiece for stereo"
      },
      "assembled": {
        "position": [
          -0.72,
          -2.6,
          -0.03
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          0.9,
          -4.1,
          0.8
        ],
        "rotation": [
          0.2,
          0.3,
          -0.2
        ]
      },
      "stage": {
        "start": 0.38,
        "end": 0.5
      }
    },
    {
      "id": "main-camera",
      "name": "Main cameras",
      "description": "Two big rear lenses set diagonally on a raised glass plateau: a main camera and an ultra wide, with a flash beside them.",
      "properties": {
        "main": "about 48 MP",
        "ultra wide": "about 12 MP",
        "layout": "two lenses, diagonal"
      },
      "assembled": {
        "position": [
          0.78,
          2.3,
          -0.17
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          5.1,
          3.6,
          -0.3
        ],
        "rotation": [
          0.15,
          2.6,
          0.1
        ]
      },
      "stage": {
        "start": 0.46,
        "end": 0.58
      }
    },
    {
      "id": "side-buttons",
      "name": "Side buttons",
      "description": "The action button and volume keys on the left, and the side (power) button on the right.",
      "properties": {
        "left": "action button, volume up, volume down",
        "right": "side button"
      },
      "assembled": {
        "position": [
          0,
          0,
          0
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          -1.3,
          0,
          0.1
        ],
        "rotation": [
          0.12,
          0.3,
          0.03
        ]
      },
      "stage": {
        "start": 0.54,
        "end": 0.66
      }
    },
    {
      "id": "back-glass",
      "name": "Back glass",
      "description": "A coloured glass back that lets wireless charging through. The camera plateau is part of it.",
      "properties": {
        "material": "colour-infused glass",
        "charging": "wireless and MagSafe"
      },
      "assembled": {
        "position": [
          0,
          0,
          -0.145
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          4.9,
          0.1,
          -0.8
        ],
        "rotation": [
          0.1,
          2.6,
          -0.04
        ]
      },
      "stage": {
        "start": 0.62,
        "end": 0.76
      }
    },
    {
      "id": "display",
      "name": "Display",
      "description": "The OLED screen under a tough glass cover. It lights up, senses touch, and at the end it wakes up and says hello.",
      "properties": {
        "type": "OLED",
        "size": "about 6.1 inches",
        "cover": "hardened glass"
      },
      "assembled": {
        "position": [
          0,
          0,
          0.145
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          -5.9,
          0.2,
          0.8
        ],
        "rotation": [
          -0.08,
          0.4,
          0.04
        ]
      },
      "stage": {
        "start": 0.74,
        "end": 0.9
      }
    },
    {
      "id": "dynamic-island",
      "name": "Dynamic Island",
      "description": "A black pill at the top of the screen that hides the front camera and Face ID sensors and shows live alerts.",
      "properties": {
        "hides": "front camera and Face ID",
        "front": "about 12 MP"
      },
      "assembled": {
        "position": [
          0,
          2.6,
          0.19
        ],
        "rotation": [
          0,
          0,
          0
        ]
      },
      "exploded": {
        "position": [
          -5.6,
          3.9,
          1.2
        ],
        "rotation": [
          0,
          0.4,
          0.25
        ]
      },
      "stage": {
        "start": 0.8,
        "end": 0.91
      }
    }
  ],
  "events": [
    {
      "id": "exploded",
      "time": 0,
      "title": "Exploded view",
      "when": "Step 1 of 8",
      "description": "Every part of the iPhone floats apart, laid out in the order it goes together.",
      "keyPoints": [
        "Parts are laid out front to back, left to right",
        "Drag the slider to build the phone"
      ]
    },
    {
      "id": "frame",
      "time": 0.04,
      "title": "The frame",
      "when": "Step 2 of 8",
      "description": "The aluminium frame comes first. It is the skeleton that everything else attaches to.",
      "keyPoints": [
        "Holds the USB-C port and speaker holes",
        "Sets the phone's size and shape"
      ]
    },
    {
      "id": "logic-board",
      "time": 0.12,
      "title": "Logic board",
      "when": "Step 3 of 8",
      "description": "The logic board drops in near the top. Its A-series chip is a system on a chip that combines the CPU, GPU, and Neural Engine.",
      "keyPoints": [
        "One chip does most of the thinking",
        "Memory and radios sit beside it"
      ]
    },
    {
      "id": "battery",
      "time": 0.22,
      "title": "Battery",
      "when": "Step 4 of 8",
      "description": "A flat lithium-ion battery fills most of the lower body, with the Taptic Engine and speaker tucked below it.",
      "keyPoints": [
        "The largest part inside",
        "Taptic Engine makes the taps you feel"
      ]
    },
    {
      "id": "cameras",
      "time": 0.46,
      "title": "Cameras",
      "when": "Step 5 of 8",
      "description": "The rear camera module arrives: two big lenses on a diagonal, plus a flash.",
      "keyPoints": [
        "Main and ultra wide cameras",
        "The diagonal layout is an iPhone signature"
      ]
    },
    {
      "id": "back-glass",
      "time": 0.62,
      "title": "Back glass",
      "when": "Step 6 of 8",
      "description": "The buttons slot into the sides and the coloured glass back closes the phone.",
      "keyPoints": [
        "Glass lets wireless charging through",
        "The camera plateau is part of the glass"
      ]
    },
    {
      "id": "display",
      "time": 0.76,
      "title": "Display",
      "when": "Step 7 of 8",
      "description": "The OLED display seals the front, and the Dynamic Island settles in at the top.",
      "keyPoints": [
        "The screen senses touch",
        "The Dynamic Island hides the front camera"
      ]
    },
    {
      "id": "wake",
      "time": 0.92,
      "title": "It's alive!",
      "when": "Step 8 of 8",
      "description": "The screen lights up with a sunset wallpaper, the phone opens its eyes, blinks, and does a happy little hop.",
      "keyPoints": [
        "Fully assembled",
        "Say hello to your new phone"
      ]
    }
  ]
};
