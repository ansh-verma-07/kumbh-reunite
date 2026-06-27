// Static reference data from the dataset (10 centres, sample zones).
export const CENTRES = [
  "Ramkund",
  "Sadhugram",
  "Adgaon",
  "Nashik Road",
  "Tapovan",
  "Trimbakeshwar",
  "Panchavati",
  "Madsangvi Transit",
  "CBS / Central Bus Stand",
  "Gangapur",
] as const;

// Top hotspot zones (unresolved-case clusters from the dataset).
export const ZONES = [
  "Sadhugram Gate 2",
  "Madsangvi Transit",
  "Ramkund Ghat",
  "Tapovan",
  "Trimbakeshwar Temple",
  "Nashik Road Station",
  "Panchavati",
  "CBS / Central Bus Stand",
] as const;

// Zone geo-data for the risk score + hotspot map (coords ~Nashik; camera /
// chokepoint counts are dataset-flavored). cameras_in_zone / chokepoints feed
// the risk formula (PRD §5); centroid drives the Leaflet map.
export interface ZoneMeta {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cameraCount: number;
  chokepointCount: number;
}

export const ZONE_DATA: ZoneMeta[] = [
  { id: "sadhugram-gate-2", name: "Sadhugram Gate 2", lat: 20.0118, lng: 73.7716, cameraCount: 4, chokepointCount: 9 },
  { id: "madsangvi-transit", name: "Madsangvi Transit", lat: 20.0205, lng: 73.8302, cameraCount: 6, chokepointCount: 8 },
  { id: "ramkund-ghat", name: "Ramkund Ghat", lat: 20.0046, lng: 73.7949, cameraCount: 5, chokepointCount: 7 },
  { id: "tapovan", name: "Tapovan", lat: 20.0153, lng: 73.8021, cameraCount: 9, chokepointCount: 5 },
  { id: "trimbakeshwar-temple", name: "Trimbakeshwar Temple", lat: 19.9404, lng: 73.5302, cameraCount: 7, chokepointCount: 6 },
  { id: "nashik-road-station", name: "Nashik Road Station", lat: 19.9485, lng: 73.8390, cameraCount: 12, chokepointCount: 4 },
  { id: "panchavati", name: "Panchavati", lat: 20.0083, lng: 73.7980, cameraCount: 10, chokepointCount: 5 },
  { id: "cbs-central-bus-stand", name: "CBS / Central Bus Stand", lat: 19.9975, lng: 73.7898, cameraCount: 8, chokepointCount: 6 },
];

// 11 transfer nodes from the chokepoint data — PA announcements queue to the
// nearest one. (Subset shown; nearest-by-name fallback to CBS.)
export const TRANSFER_NODES = [
  "CBS / Central Bus Stand",
  "Nashik Road Station",
  "Sadhugram Gate 2",
  "Madsangvi Transit",
  "Ramkund Ghat",
  "Tapovan",
  "Trimbakeshwar Temple",
  "Panchavati",
  "Dwarka Circle",
  "Old Gangapur Naka",
  "Tarwala Nagar",
] as const;

export function nearestTransferNode(lastSeenZone?: string): string {
  if (!lastSeenZone) return "CBS / Central Bus Stand";
  const hit = TRANSFER_NODES.find(
    (n) => n.toLowerCase().includes(lastSeenZone.toLowerCase()) ||
      lastSeenZone.toLowerCase().includes(n.toLowerCase()),
  );
  return hit ?? "CBS / Central Bus Stand";
}
