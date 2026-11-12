// Vercel 프론트(React)에 넣는 화면 — 결과만 Railway에 물어본다
import { useEffect, useState } from "react";
import JejuMap, { STATION_COORDS } from "./JejuMap";

const API = import.meta.env.VITE_API_URL;
const COLOR = { 좋음: "#2f80ed", 보통: "#27ae60", 나쁨: "#f2994a", 매우나쁨: "#eb5757" };
// PM10 등급 경계 (collect.py 의 grade_pm10 과 같은 기준)
const BANDS = [
  { from: 0, to: 30, grade: "좋음" },
  { from: 31, to: 80, grade: "보통" },
  { from: 81, to: 150, grade: "나쁨" },
  { from: 151, to: 300, grade: "매우나쁨" },
];

function Badge({ grade }) {
  if (!grade) return <span>-</span>;
  return (
    <span style={{ background: COLOR[grade], color: "#fff", borderRadius: 6, padding: "1px 8px" }}>
      {grade}
    </span>
  );
}

// 시계열 차트: 최근 12시간 실측(실선) + 다음 1시간 예측(점선)
function TimeSeriesChart({ recent, next, grade }) {
  const W = 520, H = 220, L = 38, R = 16, T = 16, B = 34;
  const all = [...recent, next];
  const maxVal = Math.max(...all, 35);
  const yMax = Math.ceil((maxVal * 1.15) / 10) * 10;
  const n = all.length; // 실측 12 + 예측 1
  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);

  const real = recent.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const lastI = recent.length - 1;
  const label = (i) => {
    const off = i - lastI;
    return off === 0 ? "지금" : off > 0 ? `+${off}시간` : `${off}시간`;
  };
  const ticks = [0, Math.round(yMax / 2), yMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}
         role="img" aria-label="최근 PM10 추이와 1시간 뒤 예측">
      {/* 등급 배경 띠 */}
      {BANDS.filter((b) => b.from < yMax).map((b) => (
        <rect key={b.grade} x={L} width={W - L - R}
              y={y(Math.min(b.to, yMax))} height={y(b.from) - y(Math.min(b.to, yMax))}
              fill={COLOR[b.grade]} opacity="0.08" />
      ))}
      {/* y축 눈금 */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#ccc" strokeDasharray="2 3" />
          <text x={L - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#666">{t}</text>
        </g>
      ))}
      {/* x축 라벨 */}
      {[0, 3, 6, 9, lastI, n - 1].map((i) => (
        <text key={i} x={x(i)} y={H - 12} fontSize="11" textAnchor="middle" fill="#666">{label(i)}</text>
      ))}
      {/* 실측 선 */}
      <polyline points={real} fill="none" stroke="#333" strokeWidth="2" />
      {recent.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#333" />
      ))}
      {/* 예측 선(점선) + 예측 점 */}
      <line x1={x(lastI)} y1={y(recent[lastI])} x2={x(n - 1)} y2={y(next)}
            stroke={COLOR[grade] || "#e91e63"} strokeWidth="2.5" strokeDasharray="5 4" />
      <circle cx={x(n - 1)} cy={y(next)} r="6" fill={COLOR[grade] || "#e91e63"} stroke="#fff" strokeWidth="2" />
      <text x={x(n - 1)} y={y(next) - 11} fontSize="12" fontWeight="700" textAnchor="end"
            fill={COLOR[grade] || "#e91e63"}>예측 {next}</text>
    </svg>
  );
}

export default function AirDemo() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [pred, setPred] = useState(null);
  const [selected, setSelected] = useState("");
  const [loadingPred, setLoadingPred] = useState(false);
  const [error, setError] = useState("");

  async function predict(station) {
    setSelected(station);
    setLoadingPred(true);
    try {
      const r = await fetch(`${API}/air/predict?station=${encodeURIComponent(station)}`);
      if (!r.ok) throw new Error(`예측 요청 실패 (${r.status})`);
      setPred(await r.json());
    } catch (e) {
      setPred({ station, ready: false, message: String(e) });
    } finally {
      setLoadingPred(false);
    }
  }

  async function load() {
    try {
      const [s, l] = await Promise.all([
        fetch(`${API}/air/summary`).then((r) => r.json()),
        fetch(`${API}/air/latest`).then((r) => r.json()),
      ]);
      setSummary(s);
      setRows(l);
      if (l.length) predict(l[0].station); // 처음엔 PM10이 가장 높은 곳의 추이를 바로 보여준다
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 20, maxWidth: 560 }}>
      <h3>제주 미세먼지 (공공데이터 → FastAPI 가공 → Supabase)</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {summary && (
        <p>
          측정소 {summary.stations}곳 평균 PM10 <b>{summary.avg_pm10}</b>{" "}
          <Badge grade={summary.avg_pm10_grade} />
          {summary.mode === "demo" && <small> (연습 데이터)</small>}
        </p>
      )}

      {/* 지도: 지역(측정소)을 클릭하면 그 곳의 미세먼지를 표시 */}
      <JejuMap rows={rows} selected={selected} onSelect={predict} />
      {rows.some((r) => !STATION_COORDS[r.station]) && (
        <small style={{ color: "#888" }}>
          지도 좌표가 없는 측정소: {rows.filter((r) => !STATION_COORDS[r.station]).map((r) => r.station).join(", ")}
        </small>
      )}

      {/* 시계열 차트 + 예측 */}
      {selected && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ marginBottom: 6 }}>
            <b>{selected}</b> PM10 추이와 1시간 뒤 예측
          </div>
          {loadingPred && <p style={{ margin: 0 }}>불러오는 중…</p>}
          {!loadingPred && pred && pred.ready && (
            <>
              <TimeSeriesChart recent={pred.recent} next={pred.next_pm10} grade={pred.next_grade} />
              <p style={{ margin: "8px 0 0" }}>
                1시간 뒤 PM10 약 <b>{pred.next_pm10}</b> <Badge grade={pred.next_grade} />
                <small style={{ color: "#666" }}> (평균 오차 ±{pred.avg_error}, 데이터 {pred.points}개)</small>
              </p>
              <small style={{ color: "#888" }}>{pred.model}</small>
            </>
          )}
          {!loadingPred && pred && !pred.ready && (
            <p style={{ margin: 0 }}>
              {pred.message}
              {typeof pred.points === "number" && (
                <progress value={pred.points} max="12" style={{ display: "block", width: "100%", marginTop: 6 }} />
              )}
            </p>
          )}
        </div>
      )}

      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr><th>측정소</th><th>시각</th><th>PM10</th><th>PM2.5</th><th>추이·예측</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.station} style={r.station === selected ? { background: "#f0f6ff" } : undefined}>
              <td>{r.station}</td>
              <td>{r.time.slice(11)}</td>
              <td>{r.pm10 ?? "-"} <Badge grade={r.pm10_grade} /></td>
              <td>{r.pm25 ?? "-"} <Badge grade={r.pm25_grade} /></td>
              <td><button onClick={() => predict(r.station)}>차트 보기</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
