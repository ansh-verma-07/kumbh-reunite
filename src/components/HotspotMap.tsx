"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { ZoneRisk } from "@/lib/ops";

const BAND_COLOR: Record<ZoneRisk["riskBand"], string> = {
  critical: "#ff5252",
  elevated: "#ffd23f",
  moderate: "#5cd2ff",
  low: "#b8ff5c",
};

export default function HotspotMap({ zones }: { zones: ZoneRisk[] }) {
  const center: [number, number] = zones.length
    ? [
        zones.reduce((s, z) => s + z.lat, 0) / zones.length,
        zones.reduce((s, z) => s + z.lng, 0) / zones.length,
      ]
    : [20.0, 73.78];

  return (
    <div className="border-[3px] border-ink" style={{ height: 420 }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((z) => (
          <CircleMarker
            key={z.id}
            center={[z.lat, z.lng]}
            radius={10 + z.riskScore * 28}
            pathOptions={{
              color: "#111",
              weight: 2,
              fillColor: BAND_COLOR[z.riskBand],
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <div style={{ fontWeight: 700 }}>{z.name}</div>
              <div>
                Risk {z.riskScore.toFixed(2)} · <b>{z.riskBand.toUpperCase()}</b>
              </div>
              <div>Active cases: {z.activeCases}</div>
              <div>Cameras: {z.cameraCount} · CCTV gap {(z.cctvGap * 100).toFixed(0)}%</div>
              <div>Chokepoints: {z.chokepointCount}</div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
