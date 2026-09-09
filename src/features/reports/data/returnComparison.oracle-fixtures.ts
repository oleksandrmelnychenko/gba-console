// Synthetic independently calculated published controls only. No browser business calculation.
// Inputs SHA256 58dd9ba8a95973c46eb3dcd4a819e6ea90275aa0cbe7527e57c5be15e9f50c2b
// Expected SHA256 e5fde8913b7658672ce8bfd70efa7077e6c1d631acd085295cad211a14aa5cb2
export const returnOracleControls = [
  {
    "id": "weighted-contract-client-grand",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -200.0,
          -100.0,
          -100.0,
          100.0
        ]
      },
      {
        "group": "contract:9007199254740993:9007199254741995",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741995]",
          -30.0,
          -300.0,
          270.0,
          -90.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -230.0,
          -400.0,
          170.0,
          -42.5
        ]
      },
      {
        "group": "contract:9007199254740995:9007199254741997",
        "cells": [
          "Клієнт [9007199254740995]",
          "Договір [9007199254741997]",
          -70.0,
          -100.0,
          30.0,
          -30.0
        ]
      },
      {
        "group": "client:9007199254740995",
        "cells": [
          "Підсумок: Клієнт [9007199254740995]",
          null,
          -70.0,
          -100.0,
          30.0,
          -30.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -300.0,
          -500.0,
          200.0,
          -40.0
        ]
      }
    ]
  },
  {
    "id": "exact-ca-filter-shared-agreement",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {
        "clientAgreementIds": [
          "9007199254741993"
        ]
      }
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -200.0,
          -100.0,
          -100.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -200.0,
          -100.0,
          -100.0,
          100.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -200.0,
          -100.0,
          -100.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "negative-stored-amount-positive-effect",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          50.0,
          -100.0,
          150.0,
          -150.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          50.0,
          -100.0,
          150.0,
          -150.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          50.0,
          -100.0,
          150.0,
          -150.0
        ]
      }
    ]
  },
  {
    "id": "known-zero-active-both-periods",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          0.0,
          0.0,
          0.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          0.0,
          0.0,
          0.0,
          100.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          0.0,
          0.0,
          0.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "signed-exact-cancellation",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          0.0,
          0.0,
          0.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          0.0,
          0.0,
          0.0,
          100.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          0.0,
          0.0,
          0.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "complete-empty",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          0.0,
          0.0,
          0.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "unknown-current-imported-money",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          null,
          -100.0,
          null,
          null
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          null,
          -100.0,
          null,
          null
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          null,
          -100.0,
          null,
          null
        ]
      }
    ]
  },
  {
    "id": "unknown-previous-imported-money",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -100.0,
          null,
          null,
          null
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -100.0,
          null,
          null,
          null
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -100.0,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "id": "hidden-product-sibling-invalidates-document",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {
        "productIds": [
          "9007199254742993"
        ]
      }
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          null,
          -50.0,
          null,
          null
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          null,
          -50.0,
          null,
          null
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          null,
          -50.0,
          null,
          null
        ]
      }
    ]
  },
  {
    "id": "missing-buyer-outside-filter-ignored",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {
        "productIds": [
          "9007199254742993"
        ]
      }
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -25.0,
          0.0,
          -25.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -25.0,
          0.0,
          -25.0,
          100.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -25.0,
          0.0,
          -25.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "known-large-identity-missing-captions",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -25.0,
          0.0,
          -25.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -25.0,
          0.0,
          -25.0,
          100.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -25.0,
          0.0,
          -25.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "overlapping-independent-periods",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-15",
      "previousTo": "2026-07-15",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -50.0,
          -30.0,
          -20.0,
          66.67
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -50.0,
          -30.0,
          -20.0,
          66.67
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -50.0,
          -30.0,
          -20.0,
          66.67
        ]
      }
    ]
  },
  {
    "id": "chronologically-reversed-windows",
    "request": {
      "currentFrom": "2026-06-01",
      "currentTo": "2026-06-30",
      "previousFrom": "2026-07-01",
      "previousTo": "2026-07-31",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -100.0,
          -200.0,
          100.0,
          -50.0
        ]
      },
      {
        "group": "contract:9007199254740993:9007199254741995",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741995]",
          -300.0,
          -30.0,
          -270.0,
          900.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -400.0,
          -230.0,
          -170.0,
          73.91
        ]
      },
      {
        "group": "contract:9007199254740995:9007199254741997",
        "cells": [
          "Клієнт [9007199254740995]",
          "Договір [9007199254741997]",
          -100.0,
          -70.0,
          -30.0,
          42.86
        ]
      },
      {
        "group": "client:9007199254740995",
        "cells": [
          "Підсумок: Клієнт [9007199254740995]",
          null,
          -100.0,
          -70.0,
          -30.0,
          42.86
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -500.0,
          -300.0,
          -200.0,
          66.67
        ]
      }
    ]
  },
  {
    "id": "independent-windows-ignore-gap",
    "request": {
      "currentFrom": "2026-03-01",
      "currentTo": "2026-03-31",
      "previousFrom": "2026-01-01",
      "previousTo": "2026-01-31",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -30.0,
          -10.0,
          -20.0,
          200.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -30.0,
          -10.0,
          -20.0,
          200.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -30.0,
          -10.0,
          -20.0,
          200.0
        ]
      }
    ]
  },
  {
    "id": "spring-dst-native-utc-imported-local",
    "request": {
      "currentFrom": "2026-03-29",
      "currentTo": "2026-03-29",
      "previousFrom": "2026-03-28",
      "previousTo": "2026-03-28",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -40.0,
          -60.0,
          20.0,
          -33.33
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -40.0,
          -60.0,
          20.0,
          -33.33
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -40.0,
          -60.0,
          20.0,
          -33.33
        ]
      }
    ]
  },
  {
    "id": "autumn-dst-end-exclusive-100ns",
    "request": {
      "currentFrom": "2026-10-25",
      "currentTo": "2026-10-25",
      "previousFrom": "2026-10-24",
      "previousTo": "2026-10-24",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -60.0,
          0.0,
          -60.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -60.0,
          0.0,
          -60.0,
          100.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -60.0,
          0.0,
          -60.0,
          100.0
        ]
      }
    ]
  },
  {
    "id": "raw-amounts-before-final-rounding",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47,
        48,
        49,
        50
      ],
      "filters": {}
    },
    "fields": [
      47,
      48,
      49,
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          0.0,
          0.0,
          0.0,
          33.33
        ]
      },
      {
        "group": "contract:9007199254740993:9007199254741995",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741995]",
          0.0,
          0.0,
          0.0,
          100.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -0.01,
          0.0,
          -0.01,
          166.67
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -0.01,
          0.0,
          -0.01,
          166.67
        ]
      }
    ]
  },
  {
    "id": "unselected-amount-overflow-allowed",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        50
      ],
      "filters": {}
    },
    "fields": [
      50
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          0.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          0.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          0.0
        ]
      }
    ]
  },
  {
    "id": "unselected-relative-overflow-allowed",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47
      ],
      "filters": {}
    },
    "fields": [
      47
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          -10000000000.0
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          -10000000000.0
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          -10000000000.0
        ]
      }
    ]
  },
  {
    "id": "selected-mask-order-independent-unknown",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        50,
        47,
        49
      ],
      "filters": {}
    },
    "fields": [
      50,
      47,
      49
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          null,
          -25.0,
          null
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          null,
          -25.0,
          null
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          null,
          -25.0,
          null
        ]
      }
    ]
  },
  {
    "id": "rounded-maximum-with-subcent-excess-allowed",
    "request": {
      "currentFrom": "2026-07-01",
      "currentTo": "2026-07-31",
      "previousFrom": "2026-06-01",
      "previousTo": "2026-06-30",
      "fields": [
        47
      ],
      "filters": {}
    },
    "fields": [
      47
    ],
    "rows": [
      {
        "group": "contract:9007199254740993:9007199254741993",
        "cells": [
          "Клієнт [9007199254740993]",
          "Договір [9007199254741993]",
          9999999999999.99
        ]
      },
      {
        "group": "client:9007199254740993",
        "cells": [
          "Підсумок: Клієнт [9007199254740993]",
          null,
          9999999999999.99
        ]
      },
      {
        "group": "grand",
        "cells": [
          "Загальний підсумок",
          null,
          9999999999999.99
        ]
      }
    ]
  }
]
