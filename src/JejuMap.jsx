// 제주 지도 — 측정소 위치에 등급 색 원을 찍고, 클릭하면 그 지역의 미세먼지를 보여준다
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 측정소 이름 → 위도/경도 (대략적인 위치). 목록에 없는 측정소는 지도에 안 찍히고 아래 표에만 나온다.
export const STATION_COORDS = {
  이도동: [33.4996, 126.5312],
  연동: [33.4891, 126.4983],
  노형동: [33.4850, 126.4780],
  노형로: [33.4850, 126.4780],
  아라동: [33.4650, 126.5470],
  오라동: [33.4780, 126.5150],
  용담동: [33.5130, 126.5090],
  화북동: [33.5240, 126.5750],
  삼양동: [33.5230, 126.5900],
  외도동: [33.4950, 126.4260],
  한림읍: [33.4140, 126.2690],
  고산리: [33.2930, 126.1680],
  대정읍: [33.2240, 126.2530],
  안덕면: [33.2590, 126.3130],
  중문동: [33.2500, 126.4120],
  동홍동: [33.2500, 126.5700],
  서귀동: [33.2470, 126.5620],
  남원읍: [33.2790, 126.7170],
  표선면: [33.3270, 126.8330],
  성산읍: [33.4580, 126.9270],
  구좌읍: [33.5280, 126.8480],
  조천읍: [33.5420, 126.6370],
  애월읍: [33.4630, 126.3310],
};

const COLOR = { 좋음: "#2f80ed", 보통: "#27ae60", 나쁨: "#f2994a", 매우나쁨: "#eb5757" };
const GRAY = "#9aa0a6";

function popupHtml(r) {
  const row = (label, v, g) =>
    `<div>${label} <b>${v ?? "-"}</b> ` +
    (g ? `<span style="background:${COLOR[g]};color:#fff;border-radius:6px;padding:1px 7px">${g}</span>` : "") +
    `</div>`;
  return (
    `<div style="font-size:13px;line-height:1.6"><b style="font-size:14px">${r.station}</b>` +
    row("PM10", r.pm10, r.pm10_grade) +
    row("PM2.5", r.pm25, r.pm25_grade) +
    `<div style="color:#888;font-size:11px">${r.time.slice(5, 16).replace("T", " ")} 측정</div></div>`
  );
}

function nearest(latlng, rows) {
  let best = null, bestD = Infinity;
  for (const r of rows) {
    const c = STATION_COORDS[r.station];
    if (!c) continue;
    const d = latlng.distanceTo(L.latLng(c));
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

export default function JejuMap({ rows, selected, onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const markers = useRef({});
  const rowsRef = useRef(rows);
  const onSelectRef = useRef(onSelect);
  rowsRef.current = rows;
  onSelectRef.current = onSelect;

  // 지도는 한 번만 만든다
  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true }).setView([33.38, 126.55], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);

    // 지도의 빈 곳을 눌러도 가장 가까운 측정소 값을 보여준다
    map.current.on("click", (e) => {
      const r = nearest(e.latlng, rowsRef.current);
      if (!r) return;
      markers.current[r.station]?.openPopup();
      onSelectRef.current(r.station);
    });
    return () => map.current.remove();
  }, []);

  // 데이터가 바뀌면 마커를 다시 그린다
  useEffect(() => {
    layer.current.clearLayers();
    markers.current = {};
    const pts = [];
    rows.forEach((r) => {
      const c = STATION_COORDS[r.station];
      if (!c) return;
      pts.push(c);
      const m = L.circleMarker(c, {
        radius: 14,
        color: "#fff",
        weight: 2,
        fillColor: COLOR[r.pm10_grade] || GRAY,
        fillOpacity: 0.9,
      })
        .bindPopup(popupHtml(r))
        .bindTooltip(String(r.pm10 ?? "-"), { permanent: true, direction: "center", className: "pm-label" })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(r.station);
        })
        .addTo(layer.current);
      markers.current[r.station] = m;
    });
    map.current.invalidateSize(false);
    if (pts.length > 1) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 11, animate: false });
  }, [rows]);

  // 선택된 측정소는 테두리를 굵게
  useEffect(() => {
    Object.entries(markers.current).forEach(([st, m]) =>
      m.setStyle({ weight: st === selected ? 4 : 2, color: st === selected ? "#222" : "#fff" })
    );
  }, [selected, rows]);

  return (
    <>
      <style>{`.pm-label{background:transparent;border:0;box-shadow:none;color:#fff;font-weight:700;font-size:12px;padding:0}
.pm-label:before{display:none}`}</style>
      <div ref={el} style={{ height: 340, borderRadius: 8, border: "1px solid #ddd", marginBottom: 16 }} />
    </>
  );
}
