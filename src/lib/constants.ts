// Static reference data sourced from the five CSV datasets:
//   Zone_Boundaries.csv (32 zones), CCTV_Locations.csv (1,280 cameras, 40/zone),
//   Chokepoints_Parking.csv (85 points), Police_Stations.csv (14 stations),
//   Synthetic_Missing_Persons_2500.csv (reporting centres + last-seen locations).

// ── Reporting centres (10 Kho-Ya-Paya centres from the dataset) ──────────────
export const CENTRES = [
  "Ramkund Kho-Ya-Paya Kendra",
  "Sadhugram Lost Found",
  "Adgaon Kho-Ya-Paya",
  "Nashik Road Center",
  "Trimbakeshwar Kho-Ya-Paya Kendra",
  "Panchavati Center",
  "Central Control Room",
  "Bharat Bharati Control Room",
  "Police Main Control Room",
  "Rajur Bahula Center",
] as const;
export type Centre = (typeof CENTRES)[number];

// ── Last-seen locations from the dataset (20 named points) ───────────────────
export const LAST_SEEN_LOCATIONS = [
  "Adgaon Parking",
  "Bus Stand Nashik",
  "Dasak Ghat",
  "Dindori Road Crossing",
  "Gauri Patangan",
  "Kapila Sangam",
  "Kushavart Kund",
  "Laxmi Narayan Ghat",
  "Madsangvi Transit",
  "Main Police Chowki",
  "Nandur Ghat",
  "Nashik Road Station",
  "Panchavati Circle",
  "Rajur Bahula",
  "Ramkund Ghat",
  "Sadhugram Gate 1",
  "Sadhugram Gate 2",
  "Takli Sangam",
  "Trimbak Road",
  "Trimbakeshwar Approach",
] as const;
export type LastSeenLocation = (typeof LAST_SEEN_LOCATIONS)[number];

// ── Zone geo-data ─────────────────────────────────────────────────────────────
// All 32 zones from Zone_Boundaries.csv.
// cameraCount = 40 (CCTV_Locations.csv: exactly 40 cameras per zone, uniform).
// chokepointCount = traffic+no-vehicle+transfer chokepoints within 2 km of
//   centroid (computed from Chokepoints_Parking.csv via Haversine).
export interface ZoneMeta {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cameraCount: number;
  chokepointCount: number;
}

export const ZONE_DATA: ZoneMeta[] = [
  { id: "zone-area-1",  name: "Zone Area 1",  lat: 19.982676, lng: 73.712825, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-2",  name: "Zone Area 2",  lat: 20.04899,  lng: 73.804527, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-3",  name: "Zone Area 3",  lat: 20.04714,  lng: 73.800549, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-4",  name: "Zone Area 4",  lat: 20.052318, lng: 73.79478,  cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-5",  name: "Zone Area 5",  lat: 19.930185, lng: 73.718225, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-6",  name: "Zone Area 6",  lat: 20.000705, lng: 73.863689, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-7",  name: "Zone Area 7",  lat: 20.050195, lng: 73.882161, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-8",  name: "Zone Area 8",  lat: 19.998954, lng: 73.864869, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-9",  name: "Zone Area 9",  lat: 20.02868,  lng: 73.718788, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-10", name: "Zone Area 10", lat: 19.960999, lng: 73.756712, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-11", name: "Zone Area 11", lat: 19.949892, lng: 73.849059, cameraCount: 40, chokepointCount: 6  },
  { id: "zone-area-12", name: "Zone Area 12", lat: 20.075429, lng: 73.806543, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-13", name: "Zone Area 13", lat: 20.08427,  lng: 73.78208,  cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-14", name: "Zone Area 14", lat: 20.027645, lng: 73.718997, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-15", name: "Zone Area 15", lat: 19.940415, lng: 73.843123, cameraCount: 40, chokepointCount: 6  },
  { id: "zone-area-16", name: "Zone Area 16", lat: 19.945674, lng: 73.844561, cameraCount: 40, chokepointCount: 5  },
  { id: "zone-area-17", name: "Zone Area 17", lat: 20.075526, lng: 73.80698,  cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-18", name: "Zone Area 18", lat: 20.061555, lng: 73.810584, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-19", name: "Zone Area 19", lat: 19.936666, lng: 73.71736,  cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-20", name: "Zone Area 20", lat: 19.939742, lng: 73.714194, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-21", name: "Zone Area 21", lat: 19.983782, lng: 73.819156, cameraCount: 40, chokepointCount: 3  },
  { id: "zone-area-22", name: "Zone Area 22", lat: 19.968996, lng: 73.827684, cameraCount: 40, chokepointCount: 4  },
  { id: "zone-area-23", name: "Zone Area 23", lat: 19.968388, lng: 73.824545, cameraCount: 40, chokepointCount: 5  },
  { id: "zone-area-24", name: "Zone Area 24", lat: 20.036228, lng: 73.769557, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-25", name: "Zone Area 25", lat: 20.039942, lng: 73.738581, cameraCount: 40, chokepointCount: 0  },
  { id: "zone-area-26", name: "Zone Area 26", lat: 20.013389, lng: 73.834474, cameraCount: 40, chokepointCount: 4  },
  { id: "zone-area-27", name: "Zone Area 27", lat: 20.013673, lng: 73.833538, cameraCount: 40, chokepointCount: 4  },
  { id: "zone-area-28", name: "Zone Area 28", lat: 20.013122, lng: 73.835548, cameraCount: 40, chokepointCount: 4  },
  { id: "zone-area-29", name: "Zone Area 29", lat: 19.979904, lng: 73.819459, cameraCount: 40, chokepointCount: 3  },
  { id: "zone-area-30", name: "Zone Area 30", lat: 19.99501,  lng: 73.779993, cameraCount: 40, chokepointCount: 13 },
  { id: "zone-area-31", name: "Zone Area 31", lat: 19.986392, lng: 73.782566, cameraCount: 40, chokepointCount: 7  },
  { id: "zone-area-32", name: "Zone Area 32", lat: 19.956873, lng: 73.83786,  cameraCount: 40, chokepointCount: 7  },
];

// Convenience: zone names only (derived from ZONE_DATA — single source of truth).
export const ZONES = ZONE_DATA.map((z) => z.name) as unknown as readonly string[];

// ── Transfer nodes (11 from Chokepoints_Parking.csv, category = Transfer node) ─
export const TRANSFER_NODES = [
  "CBS / Central Bus Stand",
  "Nashik Road Railway Station",
  "Thakkar Bazaar / New Thakkar Bazar",
  "Mahamarg Bus Stand",
  "Satpur Bus Stand",
  "Sharad Chandra Pawar Market",
  "Nilgiri Baug",
  "Lakshmi Narayan Trust Hanuman Nagar",
  "Sinnar Bypass Market Yard",
  "Brahma Valley",
  "Pegalwadi",
] as const;
export type TransferNode = (typeof TRANSFER_NODES)[number];

export function nearestTransferNode(lastSeenZone?: string): string {
  if (!lastSeenZone) return "CBS / Central Bus Stand";
  const q = lastSeenZone.toLowerCase();
  const hit = TRANSFER_NODES.find(
    (n) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()),
  );
  return hit ?? "CBS / Central Bus Stand";
}

// ── Police stations (Police_Stations.csv — 14 stations) ──────────────────────
export interface PoliceStation {
  name: string;
  lat: number;
  lng: number;
}

export const POLICE_STATIONS: PoliceStation[] = [
  { name: "Adgaon Police Station",          lat: 20.015486,  lng: 73.826945   },
  { name: "Ambad Police Station",           lat: 19.96586,   lng: 73.763443   },
  { name: "Bhadrakali Police Station",      lat: 19.997799,  lng: 73.789208   },
  { name: "Devlali Camp Police Station",    lat: 19.905098,  lng: 73.826855   },
  { name: "Gangapur Police Station",        lat: 20.014267,  lng: 73.75007    },
  { name: "Indiranagar Police Station",     lat: 19.974576,  lng: 73.778583   },
  { name: "Mhasrul Police Station",         lat: 20.032542,  lng: 73.802388   },
  { name: "Mumbai Naka Police Station",     lat: 19.987591,  lng: 73.783917   },
  { name: "Panchavati Police Station",      lat: 20.015643,  lng: 73.796739   },
  { name: "Sarkarwada Police Station",      lat: 20.00562,   lng: 73.779772   },
  { name: "Satpur Police Station",          lat: 19.991434,  lng: 73.742909   },
  { name: "Upnagar Police Station",         lat: 19.967381,  lng: 73.824402   },
  { name: "Nashik Road Police Station",     lat: 19.9528351, lng: 73.8397366  },
  { name: "MIDC Chunchale Police Chowki",   lat: 19.9506575, lng: 73.7368018  },
];

// ── Chokepoints (Chokepoints_Parking.csv — 85 points) ────────────────────────
export type ChokepointCategory =
  | "traffic"
  | "no-vehicle"
  | "transfer"
  | "parking"
  | "outer-parking"
  | "parking-belt";

export interface Chokepoint {
  name: string;
  category: ChokepointCategory;
  lat: number;
  lng: number;
}

export const CHOKEPOINTS: Chokepoint[] = [
  { name: "Dwarka Circle / Dwarka Chowk",                    category: "traffic",       lat: 19.98695,    lng: 73.79564    },
  { name: "Nashik Road-Dwarka corridor",                     category: "traffic",       lat: 19.9871372,  lng: 73.8014105  },
  { name: "Kathe Galli",                                     category: "traffic",       lat: 19.9739,     lng: 73.8078     },
  { name: "Fame Signal",                                     category: "traffic",       lat: 19.9645,     lng: 73.821      },
  { name: "Upnagar",                                         category: "traffic",       lat: 19.9717777,  lng: 73.8167     },
  { name: "Upnagar Junction",                                category: "traffic",       lat: 19.9549,     lng: 73.8354     },
  { name: "Datta Mandir Signal",                             category: "traffic",       lat: 19.9515,     lng: 73.8395     },
  { name: "Dr. Ambedkar Nagar",                              category: "traffic",       lat: 19.9529,     lng: 73.846      },
  { name: "Mumbai Naka",                                     category: "traffic",       lat: 19.9870794,  lng: 73.7839866  },
  { name: "Panchavati / Ramkund access zone",                category: "no-vehicle",    lat: 20.0067,     lng: 73.79062    },
  { name: "Ramkund",                                         category: "no-vehicle",    lat: 20.0067,     lng: 73.79062    },
  { name: "Godavari Ghat approaches",                        category: "no-vehicle",    lat: 20.0064,     lng: 73.7902     },
  { name: "Nashik Road Railway Station",                     category: "transfer",      lat: 19.94884,    lng: 73.84059    },
  { name: "Bitco Signal / Bitco Chowk",                      category: "traffic",       lat: 19.9497,     lng: 73.839      },
  { name: "CBS / Central Bus Stand",                         category: "transfer",      lat: 19.9972,     lng: 73.7799     },
  { name: "Thakkar Bazaar / New Thakkar Bazar",              category: "transfer",      lat: 19.9964,     lng: 73.7774     },
  { name: "Trimbak Road exit / Nashik-Trimbak Road",         category: "traffic",       lat: 19.9663708,  lng: 73.6615256  },
  { name: "ABB Circle / ABB Signal",                         category: "traffic",       lat: 20.0029,     lng: 73.7505     },
  { name: "Adgaon",                                          category: "traffic",       lat: 20.0251185,  lng: 73.4130156  },
  { name: "Jatra Hotel",                                     category: "traffic",       lat: 20.0358,     lng: 73.8235     },
  { name: "Amrutdham",                                       category: "traffic",       lat: 20.0240143,  lng: 73.8206889  },
  { name: "K.K. Wagh College belt",                          category: "traffic",       lat: 20.0134117,  lng: 73.8219246  },
  { name: "Canada Corner",                                   category: "traffic",       lat: 20.0025076,  lng: 73.769685   },
  { name: "Gangapur Naka",                                   category: "traffic",       lat: 20.0078,     lng: 73.7638     },
  { name: "Jehan Circle",                                    category: "traffic",       lat: 20.0028,     lng: 73.7592     },
  { name: "Ashok Stambh",                                    category: "traffic",       lat: 20.006844,   lng: 73.7848996  },
  { name: "Ramsetu Bridge",                                  category: "traffic",       lat: 20.0082,     lng: 73.789      },
  { name: "Dahipul",                                         category: "traffic",       lat: 20.0025,     lng: 73.786      },
  { name: "Delhi Darwaja",                                   category: "traffic",       lat: 20.0055,     lng: 73.7875     },
  { name: "Nandur Naka",                                     category: "traffic",       lat: 20.0048,     lng: 73.831      },
  { name: "Sant Janardan Swami Bridge",                      category: "traffic",       lat: 20.0019,     lng: 73.8173     },
  { name: "Jail Road / Currency Note Press belt",            category: "traffic",       lat: 19.9647084,  lng: 73.838949   },
  { name: "Kulkarni Garden to Sadhu Vaswani Road",           category: "parking",       lat: 20.0045,     lng: 73.7695     },
  { name: "Kulkarni Garden to BSNL Office",                  category: "parking",       lat: 20.0038,     lng: 73.773      },
  { name: "Jyoti Store-Rishikesh Hospital-Gangapur Naka",    category: "parking",       lat: 20.0073,     lng: 73.7655     },
  { name: "Pramod Mahajan Park Entrance",                    category: "parking",       lat: 20.0231553,  lng: 73.8306054  },
  { name: "Gangapur Naka to Jehan Circle",                   category: "parking",       lat: 20.0053,     lng: 73.7615     },
  { name: "Jehan Circle to Guruji Hospital",                 category: "parking",       lat: 20.002,      lng: 73.7584     },
  { name: "Jehan Circle to ABB Circle",                      category: "parking",       lat: 20.0028,     lng: 73.7548     },
  { name: "Guruji Hospital to Pipeline Road",                category: "parking",       lat: 20.0031,     lng: 73.7561     },
  { name: "Modak Point to Khadkali Road",                    category: "parking",       lat: 19.9972,     lng: 73.7854     },
  { name: "Thattenagar Road",                                category: "parking",       lat: 20.0007,     lng: 73.7678     },
  { name: "Behind Kulkarni Udyan",                           category: "parking",       lat: 20.0042,     lng: 73.77       },
  { name: "Shraddha Petrol Pump to Bestside Mall",           category: "parking",       lat: 19.9988,     lng: 73.7615     },
  { name: "CBS to Shalimar",                                 category: "parking",       lat: 19.9992,     lng: 73.7836     },
  { name: "Canada Corner to Vise Mala",                      category: "parking",       lat: 20.0035,     lng: 73.774      },
  { name: "Gadge Maharaj Bridge to Talakuteshwar",           category: "parking",       lat: 20.0057,     lng: 73.792      },
  { name: "Model Colony Chowk to Bhosla Gate",               category: "parking",       lat: 20.0047,     lng: 73.767      },
  { name: "Pandit Colony Palika Building",                   category: "parking",       lat: 20.0005,     lng: 73.7742     },
  { name: "Shalimar to Nehru Garden",                        category: "parking",       lat: 20.001,      lng: 73.7863     },
  { name: "HDFC Chowk to MSEB Office",                       category: "parking",       lat: 20.0003,     lng: 73.773      },
  { name: "Chhatrapati Shivaji Statue to Dr. Ambedkar Statue", category: "parking",    lat: 19.9521,     lng: 73.8409     },
  { name: "Mahatma Gandhi Road",                             category: "parking",       lat: 20.0004,     lng: 73.784      },
  { name: "Canada Corner to Panasonic Gallery",              category: "parking",       lat: 20.0029,     lng: 73.7755     },
  { name: "Bitco Signal to Mahatma Gandhi Road",             category: "parking",       lat: 19.9491,     lng: 73.8408     },
  { name: "Jehan Circle to Nelinkar Circle",                 category: "parking",       lat: 20.002,      lng: 73.757      },
  { name: "Shaheed Circle to Model Colony Circle",           category: "parking",       lat: 20.0042,     lng: 73.7675     },
  { name: "Veterinary Clinic",                               category: "parking",       lat: 19.9975,     lng: 73.7866     },
  { name: "BD Bhalekar School Ground",                       category: "parking",       lat: 19.9987,     lng: 73.7812     },
  { name: "Anna Shastri Main Road",                          category: "parking",       lat: 19.951,      lng: 73.8378     },
  { name: "Angora Complex",                                  category: "parking",       lat: 20.0002,     lng: 73.778      },
  { name: "Shatabdi Hospital",                               category: "parking",       lat: 19.988147,   lng: 73.7840439  },
  { name: "Rajur Bahula",                                    category: "outer-parking", lat: 19.946,      lng: 73.673      },
  { name: "Dugaon Phata",                                    category: "outer-parking", lat: 20.031,      lng: 73.719      },
  { name: "Thakkar Maidan",                                  category: "outer-parking", lat: 20.004,      lng: 73.7725     },
  { name: "Adgaon Outer Parking",                            category: "outer-parking", lat: 20.042,      lng: 73.838      },
  { name: "Mhasrul",                                         category: "outer-parking", lat: 20.0463365,  lng: 73.8049507  },
  { name: "Madsangavi",                                      category: "outer-parking", lat: 20.066,      lng: 73.883      },
  { name: "Chincholi",                                       category: "outer-parking", lat: 19.8975833,  lng: 73.9094495  },
  { name: "Khambale",                                        category: "outer-parking", lat: 19.9548411,  lng: 73.632102   },
  { name: "Pahine",                                          category: "outer-parking", lat: 19.8993936,  lng: 73.5527429  },
  { name: "Talwade",                                         category: "outer-parking", lat: 19.9736973,  lng: 73.5553417  },
  { name: "Mahamarg Bus Stand",                              category: "transfer",      lat: 19.9888004,  lng: 73.7829469  },
  { name: "Satpur Bus Stand",                                category: "transfer",      lat: 19.9912276,  lng: 73.7319231  },
  { name: "Sharad Chandra Pawar Market",                     category: "transfer",      lat: 20.0185,     lng: 73.7905     },
  { name: "Nilgiri Baug",                                    category: "transfer",      lat: 20.0132,     lng: 73.8176     },
  { name: "Lakshmi Narayan Trust Hanuman Nagar",             category: "transfer",      lat: 20.0224,     lng: 73.8038     },
  { name: "Sinnar Bypass Market Yard",                       category: "transfer",      lat: 19.932,      lng: 73.858      },
  { name: "Brahma Valley",                                   category: "transfer",      lat: 19.9264,     lng: 73.574      },
  { name: "Pegalwadi",                                       category: "transfer",      lat: 19.9393065,  lng: 73.5537531  },
  { name: "Peth Road parking belt",                          category: "parking-belt",  lat: 20.0305,     lng: 73.7775     },
  { name: "Dindori Road parking belt",                       category: "parking-belt",  lat: 20.0344735,  lng: 73.8032903  },
  { name: "Dhule Road parking belt",                         category: "parking-belt",  lat: 20.04,       lng: 73.833      },
  { name: "Pune Road parking belt",                          category: "parking-belt",  lat: 18.7572012,  lng: 73.8592833  },
  { name: "Mumbai Road parking belt",                        category: "parking-belt",  lat: 20.0361024,  lng: 73.8638745  },
];
