// Vercel 프론트(React)에 넣는 화면 — 결과만 Railway에 물어본다
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;
const COLOR = { 좋음: "#2f80ed", 보통: "#27ae60", 나쁨: "#f2994a", 매우나쁨: "#eb5757" };

function Badge({ grade }) {
  if (!grade) return <span>-</span>;
  return (
    <span style={{ background: COLOR[grade], color: "#fff", borderRadius: 6, padding: "1px 8px" }}>
      {grade}
    </span>
  );
}

export default function AirDemo() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [pred, setPred] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [s, l] = await Promise.all([
        fetch(`${API}/air/summary`).then((r) => r.json()),
        fetch(`${API}/air/latest`).then((r) => r.json()),
      ]);
      setSummary(s);
      setRows(l);
    } catch (e) {
      setError(String(e));
    }
  }

  async function predict(station) {
    const r = await fetch(`${API}/air/predict?station=${encodeURIComponent(station)}`);
    setPred(await r.json());
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
      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr><th>측정소</th><th>시각</th><th>PM10</th><th>PM2.5</th><th>예측</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.station}>
              <td>{r.station}</td>
              <td>{r.time.slice(11)}</td>
              <td>{r.pm10 ?? "-"} <Badge grade={r.pm10_grade} /></td>
              <td>{r.pm25 ?? "-"} <Badge grade={r.pm25_grade} /></td>
              <td><button onClick={() => predict(r.station)}>1시간 뒤?</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {pred && (
        <p>
          <b>{pred.station}</b>{" "}
          {pred.ready
            ? <>1시간 뒤 PM10 약 <b>{pred.next_pm10}</b> <Badge grade={pred.next_grade} /> (평균 오차 ±{pred.avg_error})</>
            : pred.message}
        </p>
      )}
    </div>
  );
}
