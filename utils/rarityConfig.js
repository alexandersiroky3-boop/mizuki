// Decimal weights; edit tables, luck, boostUpgradeByLevel and rollingUpgradeByLevel.
module.exports = {
    "trollXP": {
        "messageMog": {
            "level1To99": [
                50000,
                250000
            ],
            "level100Plus": [
                500000,
                3000000
            ]
        },
        "messageFart": {
            "level1To99": [
                125000,
                1250000
            ],
            "level100Plus": [
                1250000,
                5000000
            ]
        },
        "immediateTransfer": {
            "level1To99": [
                500000,
                3000000
            ],
            "level100Plus": [
                3000000,
                15000000
            ]
        },
        "immediateLoss": {
            "level1To99": [
                500000,
                3000000
            ],
            "level100Plus": [
                3000000,
                15000000
            ]
        }
    },
    "tables": {
        "hug.level1To99": [
            {
                "key": "common",
                "min": 100000,
                "max": 500000,
                "rarity": "COMMON",
                "weight": 0.7536371507778711
            },
            {
                "key": "uncommon",
                "min": 500000,
                "max": 2000000,
                "rarity": "UNCOMMON",
                "weight": 0.21938784922212884
            },
            {
                "key": "rare",
                "min": 2000000,
                "max": 5000000,
                "rarity": "RARE",
                "weight": 0.022000000000000002
            },
            {
                "key": "epic",
                "min": 5000000,
                "max": 12500000,
                "rarity": "EPIC",
                "weight": 0.004024999999999999
            },
            {
                "key": "legendary",
                "min": 12500000,
                "max": 30000000,
                "rarity": "LEGENDARY",
                "weight": 0.0009375
            },
            {
                "key": "mythic",
                "min": 30000000,
                "max": 55000000,
                "rarity": "MYTHIC",
                "weight": 0.0000125
            }
        ],
        "hug.level100Plus": [
            {
                "key": "common",
                "min": 500000,
                "max": 2000000,
                "rarity": "COMMON",
                "weight": 0.6461615789473685
            },
            {
                "key": "uncommon",
                "min": 2000000,
                "max": 5000000,
                "rarity": "UNCOMMON",
                "weight": 0.2982284210526316
            },
            {
                "key": "rare",
                "min": 5000000,
                "max": 12500000,
                "rarity": "RARE",
                "weight": 0.044000000000000004
            },
            {
                "key": "epic",
                "min": 12500000,
                "max": 30000000,
                "rarity": "EPIC",
                "weight": 0.010235
            },
            {
                "key": "legendary",
                "min": 30000000,
                "max": 55000000,
                "rarity": "LEGENDARY",
                "weight": 0.00125
            },
            {
                "key": "mythic",
                "min": 55000000,
                "max": 200000000,
                "rarity": "MYTHIC",
                "weight": 0.000125
            }
        ],
        "hugBot.level1To99": [
            {
                "min": 35000,
                "max": 150000,
                "key": "common",
                "weight": 0.6357764705882353
            },
            {
                "min": 150000,
                "max": 750000,
                "key": "uncommon",
                "weight": 0.19562352941176472
            },
            {
                "min": 750000,
                "max": 2000000,
                "key": "rare",
                "weight": 0.11000000000000001
            },
            {
                "min": 2000000,
                "max": 5000000,
                "key": "epic",
                "weight": 0.044849999999999994
            },
            {
                "min": 5000000,
                "max": 15000000,
                "key": "legendary",
                "weight": 0.0125
            },
            {
                "min": 15000000,
                "max": 27500000,
                "key": "mythic",
                "weight": 0.00125
            }
        ],
        "hugBot.level100Plus": [
            {
                "min": 250000,
                "max": 1000000,
                "key": "common",
                "weight": 0.6358529411764706
            },
            {
                "min": 1000000,
                "max": 2500000,
                "key": "uncommon",
                "weight": 0.19564705882352942
            },
            {
                "min": 2500000,
                "max": 7500000,
                "key": "rare",
                "weight": 0.11000000000000001
            },
            {
                "min": 7500000,
                "max": 15000000,
                "key": "epic",
                "weight": 0.046
            },
            {
                "min": 15000000,
                "max": 27500000,
                "key": "legendary",
                "weight": 0.0125
            }
        ],
        "kiss.level1To99": [
            {
                "key": "common",
                "min": 20000,
                "max": 50000,
                "rarity": "COMMON",
                "weight": 0.7473324742268042
            },
            {
                "key": "uncommon",
                "min": 50000,
                "max": 125000,
                "rarity": "UNCOMMON",
                "weight": 0.21921752577319586
            },
            {
                "key": "rare",
                "min": 125000,
                "max": 350000,
                "rarity": "RARE",
                "weight": 0.024200000000000006
            },
            {
                "key": "epic",
                "min": 350000,
                "max": 750000,
                "rarity": "EPIC",
                "weight": 0.008624999999999999
            },
            {
                "key": "legendary",
                "min": 750000,
                "max": 2000000,
                "rarity": "LEGENDARY",
                "weight": 0.0006125
            },
            {
                "key": "mythic",
                "min": 2000000,
                "max": 5000000,
                "rarity": "MYTHIC",
                "weight": 0.0000125
            }
        ],
        "kiss.level100Plus": [
            {
                "key": "common",
                "min": 50000,
                "max": 125000,
                "rarity": "COMMON",
                "weight": 0.6958663157894737
            },
            {
                "key": "uncommon",
                "min": 125000,
                "max": 350000,
                "rarity": "UNCOMMON",
                "weight": 0.2485236842105263
            },
            {
                "key": "rare",
                "min": 350000,
                "max": 750000,
                "rarity": "RARE",
                "weight": 0.044000000000000004
            },
            {
                "key": "epic",
                "min": 750000,
                "max": 2000000,
                "rarity": "EPIC",
                "weight": 0.010235
            },
            {
                "key": "legendary",
                "min": 2000000,
                "max": 12500000,
                "rarity": "LEGENDARY",
                "weight": 0.00125
            },
            {
                "key": "mythic",
                "min": 12500000,
                "max": 75000000,
                "rarity": "MYTHIC",
                "weight": 0.000125
            }
        ],
        "steal.level100Plus": [
            {
                "key": "failure",
                "weight": 0.23199999999999998
            },
            {
                "key": "common",
                "min": 200000,
                "max": 500000,
                "rarity": "COMMON",
                "weight": 0.6478333333333334
            },
            {
                "key": "uncommon",
                "min": 500000,
                "max": 1250000,
                "rarity": "UNCOMMON",
                "weight": 0.09966666666666667
            },
            {
                "key": "rare",
                "min": 1250000,
                "max": 3000000,
                "rarity": "RARE",
                "weight": 0.011000000000000001
            },
            {
                "key": "epic",
                "min": 3000000,
                "max": 7500000,
                "rarity": "EPIC",
                "weight": 0.00575
            },
            {
                "key": "legendary",
                "min": 7500000,
                "max": 20000000,
                "rarity": "LEGENDARY",
                "weight": 0.003125
            },
            {
                "key": "mythic",
                "min": 20000000,
                "max": 150000000,
                "rarity": "MYTHIC",
                "weight": 0.000625
            }
        ],
        "steal.level1To99": [
            {
                "key": "failure",
                "weight": 0.1934
            },
            {
                "key": "common",
                "min": 50000,
                "max": 200000,
                "rarity": "COMMON",
                "weight": 0.74925
            },
            {
                "key": "uncommon",
                "min": 200000,
                "max": 500000,
                "rarity": "UNCOMMON",
                "weight": 0.04995
            },
            {
                "key": "rare",
                "min": 500000,
                "max": 1000000,
                "rarity": "RARE",
                "weight": 0.0055000000000000005
            },
            {
                "key": "epic",
                "min": 1000000,
                "max": 2500000,
                "rarity": "EPIC",
                "weight": 0.00115
            },
            {
                "key": "legendary",
                "min": 2500000,
                "max": 5000000,
                "rarity": "LEGENDARY",
                "weight": 0.000625
            },
            {
                "key": "mythic",
                "min": 5000000,
                "max": 12500000,
                "rarity": "MYTHIC",
                "weight": 0.000125
            }
        ],
        "ezwin.level1To99": [
            {
                "key": "common",
                "rarity": "COMMON",
                "evolvedChancePercent": 5,
                "normal": {
                    "gained": {
                        "min": 150000,
                        "max": 750000
                    },
                    "lost": {
                        "min": 750000,
                        "max": 1500000
                    }
                },
                "evolved": {
                    "gained": {
                        "min": 1500000,
                        "max": 7500000
                    },
                    "lost": {
                        "min": 7500000,
                        "max": 15000000
                    }
                },
                "weight": 0.9375
            },
            {
                "key": "legendary",
                "rarity": "LEGENDARY",
                "evolvedChancePercent": 5,
                "normal": {
                    "gained": {
                        "min": 750000,
                        "max": 4000000
                    },
                    "lost": {
                        "min": 4000000,
                        "max": 10000000
                    }
                },
                "evolved": {
                    "gained": {
                        "min": 7500000,
                        "max": 40000000
                    },
                    "lost": {
                        "min": 40000000,
                        "max": 100000000
                    }
                },
                "weight": 0.0625
            }
        ],
        "ezwin.level100Plus": [
            {
                "key": "common",
                "rarity": "COMMON",
                "evolvedChancePercent": 5,
                "normal": {
                    "gained": {
                        "min": 1250000,
                        "max": 5000000
                    },
                    "lost": {
                        "min": 5000000,
                        "max": 12500000
                    }
                },
                "evolved": {
                    "gained": {
                        "min": 12500000,
                        "max": 50000000
                    },
                    "lost": {
                        "min": 50000000,
                        "max": 125000000
                    }
                },
                "weight": 0.875
            },
            {
                "key": "legendary",
                "rarity": "LEGENDARY",
                "evolvedChancePercent": 5,
                "normal": {
                    "gained": {
                        "min": 7500000,
                        "max": 25000000
                    },
                    "lost": {
                        "min": 25000000,
                        "max": 100000000
                    }
                },
                "evolved": {
                    "gained": {
                        "min": 75000000,
                        "max": 250000000
                    },
                    "lost": {
                        "min": 250000000,
                        "max": 1000000000
                    }
                },
                "weight": 0.125
            }
        ],
        "fight": [
            {
                "key": "common",
                "label": "COMMON",
                "minXP": 1000000,
                "maxXP": 3000000,
                "lossMultiplier": 0.9,
                "weight": 0.7455682938638039
            },
            {
                "key": "uncommon",
                "label": "UNCOMMON",
                "minXP": 3000000,
                "maxXP": 7500000,
                "lossMultiplier": 0.9,
                "weight": 0.1987917061361962
            },
            {
                "key": "rare",
                "label": "RARE",
                "minXP": 7500000,
                "maxXP": 15000000,
                "lossMultiplier": 0.9,
                "weight": 0.042779000000000005
            },
            {
                "key": "epic",
                "label": "EPIC",
                "minXP": 15000000,
                "maxXP": 35000000,
                "lossMultiplier": 0.95,
                "weight": 0.01035
            },
            {
                "key": "legendary",
                "label": "LEGENDARY",
                "minXP": 35000000,
                "maxXP": 100000000,
                "lossMultiplier": 1.05,
                "weight": 0.001875
            },
            {
                "key": "mythic",
                "label": "MYTHIC",
                "minXP": 100000000,
                "maxXP": 350000000,
                "lossMultiplier": 1.2,
                "weight": 0.000625
            },
            {
                "key": "cosmic",
                "label": "COSMIC",
                "minXP": 350000000,
                "maxXP": 2000000000,
                "lossMultiplier": 1.5,
                "weight": 0.000011000000000000001
            }
        ],
        "troll": [
            {
                "key": "failed",
                "rarity": "failed",
                "weight": 0.245
            },
            {
                "key": "common",
                "rarity": "common",
                "weight": 0.583
            },
            {
                "key": "rare",
                "rarity": "rare",
                "weight": 0.1595
            },
            {
                "key": "legendary",
                "rarity": "legendary",
                "weight": 0.0125
            }
        ],
        "roll": [
            {
                "key": "common",
                "weight": 0.5982722222222222,
                "min": 1,
                "max": 12500,
                "type": "positive",
                "presentationXP": 1
            },
            {
                "key": "uncommon",
                "weight": 0.07478402777777778,
                "min": 12501,
                "max": 40000,
                "type": "positive",
                "presentationXP": 12501
            },
            {
                "key": "rare",
                "weight": 0.011000000000000001,
                "min": 40001,
                "max": 125000,
                "type": "positive",
                "presentationXP": 40001
            },
            {
                "key": "epic",
                "weight": 0.00575,
                "min": 125001,
                "max": 500000,
                "type": "positive",
                "presentationXP": 125001
            },
            {
                "key": "legendary",
                "weight": 0.0009375,
                "min": 500001,
                "max": 10000000,
                "type": "positive",
                "presentationXP": 500001
            },
            {
                "key": "mythic",
                "weight": 0.00003125,
                "min": 10000001,
                "max": 199999999,
                "type": "positive",
                "presentationXP": 10000001
            },
            {
                "key": "jackpot",
                "weight": 5e-7,
                "min": 200000000,
                "max": 200000000,
                "type": "positive",
                "presentationXP": 200000000
            }
        ],
        "rollNegative": [
            {
                "key": "common",
                "weight": 0.6,
                "min": -12500,
                "max": -1,
                "type": "negative",
                "presentationXP": 1
            },
            {
                "key": "uncommon",
                "weight": 0.07125,
                "min": -40000,
                "max": -12501,
                "type": "negative",
                "presentationXP": 12501
            },
            {
                "key": "rare",
                "weight": 0.009000000000000001,
                "min": -125000,
                "max": -40001,
                "type": "negative",
                "presentationXP": 40001
            },
            {
                "key": "epic",
                "weight": 0.00425,
                "min": -500000,
                "max": -125001,
                "type": "negative",
                "presentationXP": 125001
            },
            {
                "key": "legendary",
                "weight": 0.0006000000000000001,
                "min": -10000000,
                "max": -500001,
                "type": "negative",
                "presentationXP": 500001
            },
            {
                "key": "mythic",
                "weight": 0.000018750000000000002,
                "min": -199999999,
                "max": -10000001,
                "type": "negative",
                "presentationXP": 10000001
            },
            {
                "key": "jackpot",
                "weight": 3.5e-7,
                "min": -200000000,
                "max": -200000000,
                "type": "negative",
                "presentationXP": 200000000
            }
        ]
    },
    "luck": {
        "hug.level1To99": {
            "tier1": {
                "common": -0.00853076923076923,
                "uncommon": -0.002559230769230769,
                "rare": 0.0075,
                "epic": 0.003,
                "legendary": 0.00055,
                "mythic": 0.00004
            },
            "tier2": {
                "common": -0.011678030303030303,
                "uncommon": -0.003736969696969697,
                "rare": 0.01,
                "epic": 0.0045,
                "legendary": 0.000715,
                "mythic": 0.0002
            },
            "tier3": {
                "common": -0.0018291666666666664,
                "uncommon": -0.0010060416666666666,
                "rare": -0.0003658333333333333,
                "epic": -0.001188958333333333,
                "legendary": 0.0035,
                "mythic": 0.00089
            },
            "max": {
                "common": -0.00396,
                "uncommon": -0.00198,
                "rare": -0.00099,
                "epic": -0.00132,
                "legendary": 0.007,
                "mythic": 0.00125
            },
            "omega": {
                "common": -0.011111111111111112,
                "uncommon": -0.005555555555555556,
                "rare": -0.003333333333333333,
                "epic": -0.004999999999999999,
                "legendary": 0.02,
                "mythic": 0.005
            }
        },
        "hug.level100Plus": {
            "tier1": {
                "common": -0.0853076923076923,
                "uncommon": -0.025592307692307692,
                "rare": 0.075,
                "epic": 0.03,
                "legendary": 0.0055,
                "mythic": 0.0004
            },
            "tier2": {
                "common": -0.11678030303030303,
                "uncommon": -0.03736969696969697,
                "rare": 0.1,
                "epic": 0.045,
                "legendary": 0.00715,
                "mythic": 0.002
            },
            "tier3": {
                "common": -0.018291666666666668,
                "uncommon": -0.010060416666666667,
                "rare": -0.0036583333333333333,
                "epic": -0.011889583333333334,
                "legendary": 0.035,
                "mythic": 0.0089
            },
            "max": {
                "common": -0.03960000000000001,
                "uncommon": -0.019800000000000005,
                "rare": -0.009900000000000003,
                "epic": -0.013200000000000003,
                "legendary": 0.07,
                "mythic": 0.0125
            },
            "omega": {
                "common": -0.1111111111111111,
                "uncommon": -0.05555555555555555,
                "rare": -0.03333333333333333,
                "epic": -0.049999999999999996,
                "legendary": 0.2,
                "mythic": 0.05
            }
        },
        "hugBot.level1To99": {
            "tier1": {
                "common": -0.001314459049544995,
                "uncommon": -0.00040444893832153697,
                "rare": -0.00020222446916076848,
                "epic": -0.0000788675429726997,
                "legendary": 0.0016,
                "mythic": 0.0004
            },
            "tier2": {
                "common": -0.00492922143579373,
                "uncommon": -0.0015166835187057632,
                "rare": -0.0007583417593528816,
                "epic": -0.0002957532861476238,
                "legendary": 0.006,
                "mythic": 0.0015
            },
            "tier3": {
                "common": -0.013144590495449953,
                "uncommon": -0.004044489383215369,
                "rare": -0.0020222446916076846,
                "epic": -0.0007886754297269971,
                "legendary": 0.016,
                "mythic": 0.004
            },
            "max": {
                "common": -0.03286147623862488,
                "uncommon": -0.010111223458038424,
                "rare": -0.005055611729019212,
                "epic": -0.0019716885743174925,
                "legendary": 0.04000000000000001,
                "mythic": 0.010000000000000002
            },
            "omega": {
                "common": -0.1314459049544995,
                "uncommon": -0.040444893832153696,
                "rare": -0.020222446916076848,
                "epic": -0.00788675429726997,
                "legendary": 0.16000000000000003,
                "mythic": 0.04000000000000001
            }
        },
        "hugBot.level100Plus": {
            "tier1": {
                "common": -0.0013131313131313131,
                "uncommon": -0.00040404040404040404,
                "rare": -0.00020202020202020202,
                "epic": -0.00008080808080808081,
                "legendary": 0.002
            },
            "tier2": {
                "common": -0.004924242424242424,
                "uncommon": -0.001515151515151515,
                "rare": -0.0007575757575757575,
                "epic": -0.000303030303030303,
                "legendary": 0.0075
            },
            "tier3": {
                "common": -0.013131313131313134,
                "uncommon": -0.004040404040404041,
                "rare": -0.0020202020202020206,
                "epic": -0.0008080808080808083,
                "legendary": 0.02
            },
            "max": {
                "common": -0.03282828282828283,
                "uncommon": -0.010101010101010104,
                "rare": -0.005050505050505052,
                "epic": -0.0020202020202020206,
                "legendary": 0.05
            },
            "omega": {
                "common": -0.13131313131313133,
                "uncommon": -0.040404040404040414,
                "rare": -0.020202020202020207,
                "epic": -0.008080808080808083,
                "legendary": 0.2
            }
        },
        "kiss.level1To99": {
            "tier1": {
                "common": -0.001500750375187594,
                "uncommon": -0.00044022011005502755,
                "rare": -0.00004402201100550276,
                "epic": -0.00001500750375187594,
                "legendary": 0.0016,
                "mythic": 0.0004
            },
            "tier2": {
                "common": -0.0056278139069534765,
                "uncommon": -0.0016508254127063533,
                "rare": -0.00016508254127063532,
                "epic": -0.00005627813906953477,
                "legendary": 0.006,
                "mythic": 0.0015
            },
            "tier3": {
                "common": -0.015007503751875938,
                "uncommon": -0.004402201100550275,
                "rare": -0.0004402201100550276,
                "epic": -0.00015007503751875937,
                "legendary": 0.016,
                "mythic": 0.004
            },
            "max": {
                "common": -0.03751875937968985,
                "uncommon": -0.01100550275137569,
                "rare": -0.0011005502751375688,
                "epic": -0.0003751875937968985,
                "legendary": 0.04000000000000001,
                "mythic": 0.010000000000000002
            },
            "omega": {
                "common": -0.1500750375187594,
                "uncommon": -0.04402201100550276,
                "rare": -0.004402201100550275,
                "epic": -0.001500750375187594,
                "legendary": 0.16000000000000003,
                "mythic": 0.04000000000000001
            }
        },
        "kiss.level100Plus": {
            "tier1": {
                "common": -0.001401541695865452,
                "uncommon": -0.0005005506056662329,
                "rare": -0.00008008809690659726,
                "epic": -0.00001781960156171789,
                "legendary": 0.0016,
                "mythic": 0.0004
            },
            "tier2": {
                "common": -0.005255781359495445,
                "uncommon": -0.0018770647712483737,
                "rare": -0.00030033036339973974,
                "epic": -0.0000668235058564421,
                "legendary": 0.006,
                "mythic": 0.0015
            },
            "tier3": {
                "common": -0.014015416958654518,
                "uncommon": -0.005005506056662328,
                "rare": -0.0008008809690659726,
                "epic": -0.0001781960156171789,
                "legendary": 0.016,
                "mythic": 0.004
            },
            "max": {
                "common": -0.035038542396636306,
                "uncommon": -0.012513765141655824,
                "rare": -0.002002202422664932,
                "epic": -0.0004454900390429473,
                "legendary": 0.04000000000000001,
                "mythic": 0.010000000000000002
            },
            "omega": {
                "common": -0.16811492641906098,
                "uncommon": -0.06004104514966464,
                "rare": -0.009606567223946342,
                "epic": -0.002137461207328061,
                "legendary": 0.15,
                "mythic": 0.0899
            }
        },
        "steal.level100Plus": {
            "tier1": {
                "failure": -0.0004653961885656971,
                "common": -0.001303911735205617,
                "uncommon": -0.00020060180541624876,
                "rare": -0.000020060180541624878,
                "epic": -0.000010030090270812439,
                "legendary": 0.0016,
                "mythic": 0.0004
            },
            "tier2": {
                "failure": -0.0017452357071213638,
                "common": -0.004889669007021063,
                "uncommon": -0.0007522567703109327,
                "rare": -0.00007522567703109326,
                "epic": -0.00003761283851554663,
                "legendary": 0.006,
                "mythic": 0.0015
            },
            "tier3": {
                "failure": -0.00465396188565697,
                "common": -0.013039117352056167,
                "uncommon": -0.002006018054162487,
                "rare": -0.0002006018054162487,
                "epic": -0.00010030090270812435,
                "legendary": 0.016,
                "mythic": 0.004
            },
            "max": {
                "failure": -0.01163490471414243,
                "common": -0.03259779338014043,
                "uncommon": -0.00501504513540622,
                "rare": -0.0005015045135406221,
                "epic": -0.00025075225677031104,
                "legendary": 0.04000000000000001,
                "mythic": 0.010000000000000002
            },
            "omega": {
                "failure": -0.04653961885656972,
                "common": -0.13039117352056173,
                "uncommon": -0.02006018054162488,
                "rare": -0.0020060180541624883,
                "epic": -0.0010030090270812442,
                "legendary": 0.16000000000000003,
                "mythic": 0.04000000000000001
            }
        },
        "steal.level1To99": {
            "tier1": {
                "failure": -0.0003870322193315989,
                "common": -0.0015009005403241943,
                "uncommon": -0.00010006003602161297,
                "rare": -0.000010006003602161298,
                "epic": -0.000002001200720432259,
                "legendary": 0.0016,
                "mythic": 0.0004
            },
            "tier2": {
                "failure": -0.001451370822493496,
                "common": -0.005628377026215729,
                "uncommon": -0.0003752251350810486,
                "rare": -0.00003752251350810486,
                "epic": -0.000007504502701620972,
                "legendary": 0.006,
                "mythic": 0.0015
            },
            "tier3": {
                "failure": -0.00387032219331599,
                "common": -0.015009005403241947,
                "uncommon": -0.0010006003602161299,
                "rare": -0.000100060036021613,
                "epic": -0.0000200120072043226,
                "legendary": 0.016,
                "mythic": 0.004
            },
            "max": {
                "failure": -0.009675805483289977,
                "common": -0.03752251350810487,
                "uncommon": -0.002501500900540325,
                "rare": -0.0002501500900540325,
                "epic": -0.000050030018010806504,
                "legendary": 0.04000000000000001,
                "mythic": 0.010000000000000002
            },
            "omega": {
                "failure": -0.038703221933159906,
                "common": -0.15009005403241948,
                "uncommon": -0.0100060036021613,
                "rare": -0.00100060036021613,
                "epic": -0.00020012007204322601,
                "legendary": 0.16000000000000003,
                "mythic": 0.04000000000000001
            }
        },
        "ezwin.level1To99": {
            "tier1": {
                "common": -0.006666666666666666,
                "legendary": 0.006666666666666666
            },
            "tier2": {
                "common": -0.016666666666666666,
                "legendary": 0.016666666666666666
            },
            "tier3": {
                "common": -0.03333333333333333,
                "legendary": 0.03333333333333333
            },
            "max": {
                "common": -0.049999999999999996,
                "legendary": 0.049999999999999996
            },
            "omega": {
                "common": -0.09999999999999999,
                "legendary": 0.09999999999999999
            }
        },
        "ezwin.level100Plus": {
            "tier1": {
                "common": -0.01,
                "legendary": 0.01
            },
            "tier2": {
                "common": -0.025,
                "legendary": 0.025
            },
            "tier3": {
                "common": -0.05,
                "legendary": 0.05
            },
            "max": {
                "common": -0.075,
                "legendary": 0.075
            },
            "omega": {
                "common": -0.15,
                "legendary": 0.15
            }
        },
        "fight": {
            "tier1": {
                "common": -0.0015032214751650817,
                "uncommon": -0.00040080561929478246,
                "rare": -0.00007793665267187045,
                "epic": -0.000018036252868265215,
                "legendary": 0.0016,
                "mythic": 0.00038,
                "cosmic": 0.00002
            },
            "tier2": {
                "common": -0.0056370805318690575,
                "uncommon": -0.0015030210723554344,
                "rare": -0.00029226244751951423,
                "epic": -0.00006763594825599456,
                "legendary": 0.006,
                "mythic": 0.001425,
                "cosmic": 0.000075
            },
            "tier3": {
                "common": -0.015032214751650818,
                "uncommon": -0.004008056192947825,
                "rare": -0.0007793665267187045,
                "epic": -0.00018036252868265212,
                "legendary": 0.016,
                "mythic": 0.0038,
                "cosmic": 0.0002
            },
            "max": {
                "common": -0.037580536879127054,
                "uncommon": -0.010020140482369565,
                "rare": -0.0019484163167967621,
                "epic": -0.0004509063217066305,
                "legendary": 0.04000000000000001,
                "mythic": 0.009500000000000001,
                "cosmic": 0.0005
            },
            "omega": {
                "common": -0.16205264367092137,
                "uncommon": -0.043208277208617876,
                "rare": -0.008401849503215746,
                "epic": -0.0019443724743878046,
                "legendary": 0.14135714285714285,
                "mythic": 0.0595,
                "cosmic": 0.01475
            }
        },
        "troll": {
            "tier1": {
                "failed": -0.000494949494949495,
                "common": -0.0012121212121212121,
                "rare": -0.00029292929292929295,
                "legendary": 0.002
            },
            "tier2": {
                "failed": -0.001856060606060606,
                "common": -0.004545454545454545,
                "rare": -0.0010984848484848484,
                "legendary": 0.0075
            },
            "tier3": {
                "failed": -0.00494949494949495,
                "common": -0.012121212121212125,
                "rare": -0.0029292929292929295,
                "legendary": 0.02
            },
            "max": {
                "failed": -0.012373737373737377,
                "common": -0.03030303030303031,
                "rare": -0.007323232323232324,
                "legendary": 0.05
            },
            "omega": {
                "failed": -0.04949494949494951,
                "common": -0.12121212121212124,
                "rare": -0.029292929292929298,
                "legendary": 0.2
            }
        },
        "roll": {
            "tier1": {
                "common": -0.031027479452054803,
                "uncommon": -0.006722620547945208,
                "rare": 0.0275,
                "epic": 0.005,
                "legendary": 0.00425,
                "mythic": 0.001,
                "jackpot": 1e-7
            },
            "tier2": {
                "common": -0.07454581818181817,
                "uncommon": -0.027954681818181816,
                "rare": 0.06,
                "epic": 0.03,
                "legendary": 0.009,
                "mythic": 0.0035,
                "jackpot": 5e-7
            },
            "tier3": {
                "common": -0.15862575,
                "uncommon": -0.05287525000000001,
                "rare": 0.15,
                "epic": 0.0465,
                "legendary": 0.01,
                "mythic": 0.005,
                "jackpot": 0.000001
            },
            "max": {
                "common": -0.29431714285714283,
                "uncommon": -0.0981057142857143,
                "rare": -0.12263214285714286,
                "epic": 0.2,
                "legendary": 0.25,
                "mythic": 0.065,
                "jackpot": 0.000055
            },
            "omega": {
                "common": -0.4109677419354838,
                "uncommon": -0.30822580645161285,
                "rare": -0.14383870967741932,
                "epic": -0.09246774193548386,
                "legendary": 0.7,
                "mythic": 0.25,
                "jackpot": 0.0055
            }
        }
    },
    "boostUpgrade": {
        "hug.level1To99": {
            "common": -0.0037815739962371404,
            "uncommon": -0.0011008366358432411,
            "rare": -0.000100076057803931,
            "epic": -0.000017513310115687924,
            "legendary": 0.004,
            "mythic": 0.001
        },
        "hug.level100Plus": {
            "common": -0.0032535789368305134,
            "uncommon": -0.0015016518169986982,
            "rare": -0.00020022024226649314,
            "epic": -0.00004454900390429472,
            "legendary": 0.0007142857142857143,
            "mythic": 0.004285714285714286
        },
        "hugBot.level1To99": {
            "common": -0.0032861476238624883,
            "uncommon": -0.0010111223458038423,
            "rare": -0.0005055611729019212,
            "epic": -0.00019716885743174928,
            "legendary": 0.004,
            "mythic": 0.001
        },
        "hugBot.level100Plus": {
            "common": -0.0032828282828282836,
            "uncommon": -0.0010101010101010103,
            "rare": -0.0005050505050505052,
            "epic": -0.00020202020202020207,
            "legendary": 0.005
        },
        "kiss.level1To99": {
            "common": -0.0037518759379689846,
            "uncommon": -0.0011005502751375688,
            "rare": -0.0001100550275137569,
            "epic": -0.00003751875937968984,
            "legendary": 0.004,
            "mythic": 0.001
        },
        "kiss.level100Plus": {
            "common": -0.0035038542396636295,
            "uncommon": -0.001251376514165582,
            "rare": -0.00020022024226649314,
            "epic": -0.00004454900390429472,
            "legendary": 0.0007142857142857143,
            "mythic": 0.004285714285714286
        },
        "steal.level100Plus": {
            "failure": -0.0011634904714142426,
            "common": -0.0032597793380140416,
            "uncommon": -0.0005015045135406218,
            "rare": -0.00005015045135406218,
            "epic": -0.00002507522567703109,
            "legendary": 0.004,
            "mythic": 0.001
        },
        "steal.level1To99": {
            "failure": -0.0009675805483289976,
            "common": -0.003752251350810487,
            "uncommon": -0.00025015009005403246,
            "rare": -0.00002501500900540325,
            "epic": -0.00000500300180108065,
            "legendary": 0.004,
            "mythic": 0.001
        },
        "ezwin.level1To99": {
            "common": -0.005,
            "legendary": 0.005
        },
        "ezwin.level100Plus": {
            "common": -0.005,
            "legendary": 0.005
        },
        "fight": {
            "common": -0.0037580536879127046,
            "uncommon": -0.0010020140482369562,
            "rare": -0.00019484163167967614,
            "epic": -0.00004509063217066303,
            "legendary": 0.004,
            "mythic": 0.00095,
            "cosmic": 0.00005
        },
        "troll": {
            "failed": -0.0012373737373737375,
            "common": -0.003030303030303031,
            "rare": -0.0007323232323232324,
            "legendary": 0.005
        },
        "roll": {
            "common": -0.007302511394037085,
            "uncommon": -0.0006614918588443035,
            "rare": -0.00006879721713001923,
            "epic": -0.000017199529988591773,
            "legendary": 0.002,
            "mythic": 0.006,
            "jackpot": 0.00005
        },
        "rollOmega": {
            "common": -0.0076653691030575625,
            "uncommon": -0.0006943610195322195,
            "rare": -0.00007221571239113823,
            "epic": -0.00001805416501908081,
            "legendary": 0.002,
            "mythic": 0.006,
            "jackpot": 0.00045
        }
    },
    "rollingUpgrade": {
        "normal": {
            "common": -0.011811018428616501,
            "uncommon": -0.0010698911803916562,
            "rare": -0.00011127202074942242,
            "epic": -0.000027818370242417996,
            "legendary": 0.01,
            "mythic": 0.003,
            "jackpot": 0.00002
        },
        "omega": {
            "common": -0.0057490268272931706,
            "uncommon": -0.0005207707646491645,
            "rare": -0.000054161784293353656,
            "epic": -0.000013540623764310603,
            "legendary": 0.0015,
            "mythic": 0.0045,
            "jackpot": 0.0003375
        }
    },
    "externalLuck": {
        "blessingNormal": 0.01,
        "blessingRare": 0.03,
        "stolenBoost": 0.005,
        "leaderboard": 0.01,
        "maxExtra": 0.05
    },
    "evolved": {
        "commands": 0.05,
        "roll": 0.01,
        "rollMax": 0.03
    },
    "guarantee": [
        {
            "type": "positive",
            "min": 500000,
            "max": 2000000,
            "weight": 0.75
        },
        {
            "type": "positive",
            "min": 2000001,
            "max": 10000000,
            "weight": 0.23
        },
        {
            "type": "positive",
            "min": 10000001,
            "max": 30000000,
            "weight": 0.013999999999999999
        },
        {
            "type": "positive",
            "min": 30000001,
            "max": 50000000,
            "weight": 0.003
        },
        {
            "type": "positive",
            "min": 50000001,
            "max": 100000000,
            "weight": 0.0015
        },
        {
            "type": "positive",
            "min": 100000001,
            "max": 250000000,
            "weight": 0.001
        },
        {
            "type": "positive",
            "min": 250000001,
            "max": 1500000000,
            "weight": 0.0005
        }
    ],
    "boostUpgradeOmega": {
        "hug.level100Plus": {
            "common": -0.022775052557813594,
            "uncommon": -0.010511562718990888,
            "rare": -0.001401541695865452,
            "epic": -0.00031184302733006303,
            "legendary": 0.005,
            "mythic": 0.03
        },
        "kiss.level100Plus": {
            "common": -0.024526979677645406,
            "uncommon": -0.008759635599159075,
            "rare": -0.001401541695865452,
            "epic": -0.00031184302733006303,
            "legendary": 0.005,
            "mythic": 0.03
        }
    },
    "rollPolarity": {
        "negativeBase": 0.35,
        "negativeMinimum": 0.05,
        "luckReduction": {
            "none": 0,
            "tier1": 0.02,
            "tier2": 0.04,
            "tier3": 0.06,
            "max": 0.09,
            "omega": 0.15
        },
        "boostReduction": [
            0.01,
            0.01,
            0.02,
            0.02
        ],
        "rollingReduction": [
            0.005,
            0.005,
            0.01,
            0.01,
            0.01,
            0.015,
            0.025,
            0.025
        ]
    },
    "boostUpgradeByLevel": {
        "1": {
            "hug.level1To99": {
                "common": -0.0037815739962371404,
                "uncommon": -0.0011008366358432411,
                "rare": -0.000100076057803931,
                "epic": -0.000017513310115687924,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hug.level100Plus": {
                "common": -0.0032535789368305134,
                "uncommon": -0.0015016518169986982,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "hugBot.level1To99": {
                "common": -0.0032861476238624883,
                "uncommon": -0.0010111223458038423,
                "rare": -0.0005055611729019212,
                "epic": -0.00019716885743174928,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hugBot.level100Plus": {
                "common": -0.0032828282828282836,
                "uncommon": -0.0010101010101010103,
                "rare": -0.0005050505050505052,
                "epic": -0.00020202020202020207,
                "legendary": 0.005
            },
            "kiss.level1To99": {
                "common": -0.0037518759379689846,
                "uncommon": -0.0011005502751375688,
                "rare": -0.0001100550275137569,
                "epic": -0.00003751875937968984,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "kiss.level100Plus": {
                "common": -0.0035038542396636295,
                "uncommon": -0.001251376514165582,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "steal.level100Plus": {
                "failure": -0.0011634904714142426,
                "common": -0.0032597793380140416,
                "uncommon": -0.0005015045135406218,
                "rare": -0.00005015045135406218,
                "epic": -0.00002507522567703109,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "steal.level1To99": {
                "failure": -0.0009675805483289976,
                "common": -0.003752251350810487,
                "uncommon": -0.00025015009005403246,
                "rare": -0.00002501500900540325,
                "epic": -0.00000500300180108065,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "ezwin.level1To99": {
                "common": -0.005,
                "legendary": 0.005
            },
            "ezwin.level100Plus": {
                "common": -0.005,
                "legendary": 0.005
            },
            "fight": {
                "common": -0.0037580536879127046,
                "uncommon": -0.0010020140482369562,
                "rare": -0.00019484163167967614,
                "epic": -0.00004509063217066303,
                "legendary": 0.004,
                "mythic": 0.00095,
                "cosmic": 0.00005
            },
            "troll": {
                "failed": -0.0012373737373737375,
                "common": -0.003030303030303031,
                "rare": -0.0007323232323232324,
                "legendary": 0.005
            },
            "roll": {
                "common": -0.007302511394037085,
                "uncommon": -0.0006614918588443035,
                "rare": -0.00006879721713001923,
                "epic": -0.000017199529988591773,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00005
            },
            "roll.omega": {
                "common": -0.0076653691030575625,
                "uncommon": -0.0006943610195322195,
                "rare": -0.00007221571239113823,
                "epic": -0.00001805416501908081,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00045
            },
            "hug.level100Plus.omega": {
                "common": -0.022775052557813594,
                "uncommon": -0.010511562718990888,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            },
            "kiss.level100Plus.omega": {
                "common": -0.024526979677645406,
                "uncommon": -0.008759635599159075,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            }
        },
        "2": {
            "hug.level1To99": {
                "common": -0.0037815739962371404,
                "uncommon": -0.0011008366358432411,
                "rare": -0.000100076057803931,
                "epic": -0.000017513310115687924,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hug.level100Plus": {
                "common": -0.0032535789368305134,
                "uncommon": -0.0015016518169986982,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "hugBot.level1To99": {
                "common": -0.0032861476238624883,
                "uncommon": -0.0010111223458038423,
                "rare": -0.0005055611729019212,
                "epic": -0.00019716885743174928,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hugBot.level100Plus": {
                "common": -0.0032828282828282836,
                "uncommon": -0.0010101010101010103,
                "rare": -0.0005050505050505052,
                "epic": -0.00020202020202020207,
                "legendary": 0.005
            },
            "kiss.level1To99": {
                "common": -0.0037518759379689846,
                "uncommon": -0.0011005502751375688,
                "rare": -0.0001100550275137569,
                "epic": -0.00003751875937968984,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "kiss.level100Plus": {
                "common": -0.0035038542396636295,
                "uncommon": -0.001251376514165582,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "steal.level100Plus": {
                "failure": -0.0011634904714142426,
                "common": -0.0032597793380140416,
                "uncommon": -0.0005015045135406218,
                "rare": -0.00005015045135406218,
                "epic": -0.00002507522567703109,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "steal.level1To99": {
                "failure": -0.0009675805483289976,
                "common": -0.003752251350810487,
                "uncommon": -0.00025015009005403246,
                "rare": -0.00002501500900540325,
                "epic": -0.00000500300180108065,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "ezwin.level1To99": {
                "common": -0.005,
                "legendary": 0.005
            },
            "ezwin.level100Plus": {
                "common": -0.005,
                "legendary": 0.005
            },
            "fight": {
                "common": -0.0037580536879127046,
                "uncommon": -0.0010020140482369562,
                "rare": -0.00019484163167967614,
                "epic": -0.00004509063217066303,
                "legendary": 0.004,
                "mythic": 0.00095,
                "cosmic": 0.00005
            },
            "troll": {
                "failed": -0.0012373737373737375,
                "common": -0.003030303030303031,
                "rare": -0.0007323232323232324,
                "legendary": 0.005
            },
            "roll": {
                "common": -0.007302511394037085,
                "uncommon": -0.0006614918588443035,
                "rare": -0.00006879721713001923,
                "epic": -0.000017199529988591773,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00005
            },
            "roll.omega": {
                "common": -0.0076653691030575625,
                "uncommon": -0.0006943610195322195,
                "rare": -0.00007221571239113823,
                "epic": -0.00001805416501908081,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00045
            },
            "hug.level100Plus.omega": {
                "common": -0.022775052557813594,
                "uncommon": -0.010511562718990888,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            },
            "kiss.level100Plus.omega": {
                "common": -0.024526979677645406,
                "uncommon": -0.008759635599159075,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            }
        },
        "3": {
            "hug.level1To99": {
                "common": -0.0037815739962371404,
                "uncommon": -0.0011008366358432411,
                "rare": -0.000100076057803931,
                "epic": -0.000017513310115687924,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hug.level100Plus": {
                "common": -0.0032535789368305134,
                "uncommon": -0.0015016518169986982,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "hugBot.level1To99": {
                "common": -0.0032861476238624883,
                "uncommon": -0.0010111223458038423,
                "rare": -0.0005055611729019212,
                "epic": -0.00019716885743174928,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hugBot.level100Plus": {
                "common": -0.0032828282828282836,
                "uncommon": -0.0010101010101010103,
                "rare": -0.0005050505050505052,
                "epic": -0.00020202020202020207,
                "legendary": 0.005
            },
            "kiss.level1To99": {
                "common": -0.0037518759379689846,
                "uncommon": -0.0011005502751375688,
                "rare": -0.0001100550275137569,
                "epic": -0.00003751875937968984,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "kiss.level100Plus": {
                "common": -0.0035038542396636295,
                "uncommon": -0.001251376514165582,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "steal.level100Plus": {
                "failure": -0.0011634904714142426,
                "common": -0.0032597793380140416,
                "uncommon": -0.0005015045135406218,
                "rare": -0.00005015045135406218,
                "epic": -0.00002507522567703109,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "steal.level1To99": {
                "failure": -0.0009675805483289976,
                "common": -0.003752251350810487,
                "uncommon": -0.00025015009005403246,
                "rare": -0.00002501500900540325,
                "epic": -0.00000500300180108065,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "ezwin.level1To99": {
                "common": -0.005,
                "legendary": 0.005
            },
            "ezwin.level100Plus": {
                "common": -0.005,
                "legendary": 0.005
            },
            "fight": {
                "common": -0.0037580536879127046,
                "uncommon": -0.0010020140482369562,
                "rare": -0.00019484163167967614,
                "epic": -0.00004509063217066303,
                "legendary": 0.004,
                "mythic": 0.00095,
                "cosmic": 0.00005
            },
            "troll": {
                "failed": -0.0012373737373737375,
                "common": -0.003030303030303031,
                "rare": -0.0007323232323232324,
                "legendary": 0.005
            },
            "roll": {
                "common": -0.007302511394037085,
                "uncommon": -0.0006614918588443035,
                "rare": -0.00006879721713001923,
                "epic": -0.000017199529988591773,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00005
            },
            "roll.omega": {
                "common": -0.0076653691030575625,
                "uncommon": -0.0006943610195322195,
                "rare": -0.00007221571239113823,
                "epic": -0.00001805416501908081,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00045
            },
            "hug.level100Plus.omega": {
                "common": -0.022775052557813594,
                "uncommon": -0.010511562718990888,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            },
            "kiss.level100Plus.omega": {
                "common": -0.024526979677645406,
                "uncommon": -0.008759635599159075,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            }
        },
        "4": {
            "hug.level1To99": {
                "common": -0.0037815739962371404,
                "uncommon": -0.0011008366358432411,
                "rare": -0.000100076057803931,
                "epic": -0.000017513310115687924,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hug.level100Plus": {
                "common": -0.0032535789368305134,
                "uncommon": -0.0015016518169986982,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "hugBot.level1To99": {
                "common": -0.0032861476238624883,
                "uncommon": -0.0010111223458038423,
                "rare": -0.0005055611729019212,
                "epic": -0.00019716885743174928,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "hugBot.level100Plus": {
                "common": -0.0032828282828282836,
                "uncommon": -0.0010101010101010103,
                "rare": -0.0005050505050505052,
                "epic": -0.00020202020202020207,
                "legendary": 0.005
            },
            "kiss.level1To99": {
                "common": -0.0037518759379689846,
                "uncommon": -0.0011005502751375688,
                "rare": -0.0001100550275137569,
                "epic": -0.00003751875937968984,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "kiss.level100Plus": {
                "common": -0.0035038542396636295,
                "uncommon": -0.001251376514165582,
                "rare": -0.00020022024226649314,
                "epic": -0.00004454900390429472,
                "legendary": 0.0007142857142857143,
                "mythic": 0.004285714285714286
            },
            "steal.level100Plus": {
                "failure": -0.0011634904714142426,
                "common": -0.0032597793380140416,
                "uncommon": -0.0005015045135406218,
                "rare": -0.00005015045135406218,
                "epic": -0.00002507522567703109,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "steal.level1To99": {
                "failure": -0.0009675805483289976,
                "common": -0.003752251350810487,
                "uncommon": -0.00025015009005403246,
                "rare": -0.00002501500900540325,
                "epic": -0.00000500300180108065,
                "legendary": 0.004,
                "mythic": 0.001
            },
            "ezwin.level1To99": {
                "common": -0.005,
                "legendary": 0.005
            },
            "ezwin.level100Plus": {
                "common": -0.005,
                "legendary": 0.005
            },
            "fight": {
                "common": -0.0037580536879127046,
                "uncommon": -0.0010020140482369562,
                "rare": -0.00019484163167967614,
                "epic": -0.00004509063217066303,
                "legendary": 0.004,
                "mythic": 0.00095,
                "cosmic": 0.00005
            },
            "troll": {
                "failed": -0.0012373737373737375,
                "common": -0.003030303030303031,
                "rare": -0.0007323232323232324,
                "legendary": 0.005
            },
            "roll": {
                "common": -0.007302511394037085,
                "uncommon": -0.0006614918588443035,
                "rare": -0.00006879721713001923,
                "epic": -0.000017199529988591773,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00005
            },
            "roll.omega": {
                "common": -0.0076653691030575625,
                "uncommon": -0.0006943610195322195,
                "rare": -0.00007221571239113823,
                "epic": -0.00001805416501908081,
                "legendary": 0.002,
                "mythic": 0.006,
                "jackpot": 0.00045
            },
            "hug.level100Plus.omega": {
                "common": -0.022775052557813594,
                "uncommon": -0.010511562718990888,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            },
            "kiss.level100Plus.omega": {
                "common": -0.024526979677645406,
                "uncommon": -0.008759635599159075,
                "rare": -0.001401541695865452,
                "epic": -0.00031184302733006303,
                "legendary": 0.005,
                "mythic": 0.03
            }
        }
    },
    "rollingUpgradeByLevel": {
        "1": {
            "normal": {
                "common": -0.004992980216975112,
                "uncommon": -0.0010818123803446075,
                "rare": -0.0003328653477983408,
                "epic": -0.00011234205488194003,
                "legendary": 0.005,
                "mythic": 0.0015,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.022157240857652114,
                "uncommon": -0.020070950459258968,
                "rare": -0.0020874414677815494,
                "epic": -0.0005218672153073577,
                "legendary": 0.04,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "2": {
            "normal": {
                "common": -0.011811018428616501,
                "uncommon": -0.0010698911803916562,
                "rare": -0.00011127202074942242,
                "epic": -0.000027818370242417996,
                "legendary": 0.01,
                "mythic": 0.003,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.0057490268272931706,
                "uncommon": -0.0005207707646491645,
                "rare": -0.000054161784293353656,
                "epic": -0.000013540623764310603,
                "legendary": 0.0015,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "3": {
            "normal": {
                "common": -0.011811018428616501,
                "uncommon": -0.0010698911803916562,
                "rare": -0.00011127202074942242,
                "epic": -0.000027818370242417996,
                "legendary": 0.01,
                "mythic": 0.003,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.0057490268272931706,
                "uncommon": -0.0005207707646491645,
                "rare": -0.000054161784293353656,
                "epic": -0.000013540623764310603,
                "legendary": 0.0015,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "4": {
            "normal": {
                "common": -0.011811018428616501,
                "uncommon": -0.0010698911803916562,
                "rare": -0.00011127202074942242,
                "epic": -0.000027818370242417996,
                "legendary": 0.01,
                "mythic": 0.003,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.0057490268272931706,
                "uncommon": -0.0005207707646491645,
                "rare": -0.000054161784293353656,
                "epic": -0.000013540623764310603,
                "legendary": 0.0015,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "5": {
            "normal": {
                "common": -0.011811018428616501,
                "uncommon": -0.0010698911803916562,
                "rare": -0.00011127202074942242,
                "epic": -0.000027818370242417996,
                "legendary": 0.01,
                "mythic": 0.003,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.0057490268272931706,
                "uncommon": -0.0005207707646491645,
                "rare": -0.000054161784293353656,
                "epic": -0.000013540623764310603,
                "legendary": 0.0015,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "6": {
            "normal": {
                "common": -0.011811018428616501,
                "uncommon": -0.0010698911803916562,
                "rare": -0.00011127202074942242,
                "epic": -0.000027818370242417996,
                "legendary": 0.01,
                "mythic": 0.003,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.0057490268272931706,
                "uncommon": -0.0005207707646491645,
                "rare": -0.000054161784293353656,
                "epic": -0.000013540623764310603,
                "legendary": 0.0015,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "7": {
            "normal": {
                "common": -0.011811018428616501,
                "uncommon": -0.0010698911803916562,
                "rare": -0.00011127202074942242,
                "epic": -0.000027818370242417996,
                "legendary": 0.01,
                "mythic": 0.003,
                "jackpot": 0.00002
            },
            "omega": {
                "common": -0.0057490268272931706,
                "uncommon": -0.0005207707646491645,
                "rare": -0.000054161784293353656,
                "epic": -0.000013540623764310603,
                "legendary": 0.0015,
                "mythic": 0.0045,
                "jackpot": 0.0003375
            }
        },
        "8": {
            "normal": {
                "common": -0.09710843373493977,
                "uncommon": -0.036415662650602414,
                "rare": -0.043698795180722894,
                "epic": -0.024277108433734942,
                "legendary": 0.125,
                "mythic": 0.075,
                "jackpot": 0.0015
            },
            "omega": {
                "common": -0.12830284552845528,
                "uncommon": -0.08981199186991869,
                "rare": -0.02309451219512195,
                "epic": -0.011290650406504064,
                "legendary": 0.15,
                "mythic": 0.0975,
                "jackpot": 0.005
            }
        }
    }
};
