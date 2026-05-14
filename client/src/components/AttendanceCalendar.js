import { useState, useEffect } from "react";
import API from "../api";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AttendanceCalendar({ studentId, month, year, interactive = false, initialDays = [], onUpdate }) {
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(initialDays.length === 0);
  const [updating, setUpdating] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await API.get(`/attendance/daily?student_id=${studentId}&month=${month}&year=${year}`);
      setDays(data);
    } catch (e) {
      console.error("Failed to load daily attendance", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (initialDays.length > 0) {
      setDays(initialDays);
      setLoading(false);
    } else if (studentId && month && year) {
      load();
    }
  }, [studentId, month, year, initialDays]);

  const toggleDay = async (day) => {
    if (!interactive || day.status === "not_enrolled" || day.status === "holiday" || day.status === "future") return;
    
    const oldDays = [...days];
    const newStatus = day.status === "present" ? "absent" : "present";
    
    // Optimistic update
    setDays(prev => prev.map(d => d.day === day.day ? { ...d, status: newStatus } : d));
    setUpdating(day.day);

    try {
      await API.post("/attendance/mark-day", {
        student_id: studentId,
        date: day.date,
        status: newStatus
      });
      // Silently refresh in background to ensure sync
      load(true);
      if (onUpdate) onUpdate();
    } catch (e) {
      // Revert on error
      setDays(oldDays);
      alert("Failed to update attendance");
    } finally {
      setUpdating(null);
    }
  };

  if (loading && days.length === 0) return <div style={{ padding: 20, textAlign: "center", color: "var(--text2)" }}>Loading calendar...</div>;

  // Calculate padding for the first day of the month
  const firstDay = new Date(year, month - 1, 1).getDay();
  const blanks = Array(firstDay).fill(null);

  const getDayStyle = (status) => {
    switch (status) {
      case "present": return { background: "var(--green)", color: "#fff", border: "none" };
      case "holiday": return { background: "var(--bg3)", color: "var(--text3)", border: "1px dashed var(--border)" };
      case "not_enrolled": return { background: "transparent", color: "var(--text3)", opacity: 0.3, border: "1px solid var(--border)" };
      case "absent": return { background: "var(--red)", color: "#fff", border: "none" };
      default: return { background: "var(--bg2)", color: "var(--text1)", border: "1px solid var(--border)" };
    }
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text1)" }}>
          {MONTHS[month - 1]} {year}
        </div>
        {interactive && <div style={{ fontSize: 11, color: "var(--text3)" }}>Tap a day to mark present/absent</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 20 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text3)", paddingBottom: 4 }}>
            {d}
          </div>
        ))}
        {blanks.map((_, i) => <div key={`b-${i}`} />)}
        {days.map((d) => (
          <div
            key={d.day}
            onClick={() => toggleDay(d)}
            title={d.note || d.status}
            style={{
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: interactive && d.status !== "not_enrolled" && d.status !== "holiday" ? "pointer" : "default",
              position: "relative",
              transition: "transform 0.1s, opacity 0.2s",
              opacity: updating === d.day ? 0.5 : 1,
              transform: updating === d.day ? "scale(0.9)" : "none",
              ...getDayStyle(d.status)
            }}
          >
            {d.day}
            {d.status === "holiday" && <div style={{ position: "absolute", bottom: 2, fontSize: 8 }}>🏖️</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--text2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--green)" }} /> Present</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--red)" }} /> Absent</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--bg3)", border: "1px dashed var(--border)" }} /> Holiday</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--bg2)", border: "1px solid var(--border)", opacity: 0.3 }} /> N/A</div>
      </div>
    </div>
  );
}
