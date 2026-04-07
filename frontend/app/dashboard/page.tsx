"use client";

import { useState, useEffect } from "react";
import Head from "next/head";

// Dynamic API base for both mobile and desktop matching exact window hostname
const API_BASE = typeof window !== 'undefined' 
  ? `http://${window.location.hostname}:8000`
  : 'http://localhost:8000';

type WorkerData = {
  id: number;
  name: string;
  worker_id: string;
  zone: string;
  is_active: boolean;
  latest_session_status: string | null;
  heart_rate: number | null;
  oxygen_level: number | null;
  temperature: number | null;
  vitals_status: string | null;
};

type SessionData = {
  id: number;
  worker_name: string;
  worker_id: string;
  zone: string;
  created_at: string;
  status: string;
};

type AlertData = {
  id: number;
  worker_name: string;
  worker_id: string;
  zone: string;
  alert_type: string;
  timestamp: string;
  resolved: boolean;
};

export default function Dashboard() {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const fetchData = async () => {
    try {
      const [wRes, sRes, aRes] = await Promise.all([
        fetch(`${API_BASE}/api/workers/all`),
        fetch(`${API_BASE}/api/sessions/active`),
        fetch(`${API_BASE}/api/alerts`)
      ]);
      
      if (wRes.ok) setWorkers(await wRes.json());
      if (sRes.ok) setSessions(await sRes.json());
      if (aRes.ok) {
        const _alerts = await aRes.json();
        setAlerts(_alerts.filter((a: AlertData) => !a.resolved));
      }
    } catch (e) {
      console.error("Error polling API:", e);
    }
  };

  useEffect(() => {
    fetchData(); 
    const intervalId = setInterval(fetchData, 10000); 
    const clockId = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => {
      clearInterval(intervalId);
      clearInterval(clockId);
    };
  }, []);

  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone) return;

    try {
      await fetch(`${API_BASE}/api/worker/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, worker_id: regPhone.trim().toLowerCase(), zone: "Main Zone" }),
      });
      setRegName("");
      setRegPhone("");
      fetchData();
    } catch (err) {
      console.error("Register err:", err);
    }
  };

  const handleSendCheck = async (worker_id: string) => {
    try {
      await fetch(`${API_BASE}/api/session/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: worker_id.trim().toLowerCase() }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveAlert = async (alert_id: number) => {
    try {
      await fetch(`${API_BASE}/api/alert/resolve/${alert_id}`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const getWorkerCardClass = (status: string | null) => {
    if (!status) return "";
    if (status === "RESPONDED" || status === "SAFE") return "status-safe";
    if (status === "PENDING") return "status-pending";
    if (status === "YELLOW") return "status-yellow";
    if (status === "RED") return "status-red";
    return "";
  };

  const safeCount = workers.filter(w => w.latest_session_status === 'RESPONDED' || w.latest_session_status === 'SAFE').length;
  const warningCount = workers.filter(w => w.latest_session_status === 'YELLOW').length;
  const criticalCount = workers.filter(w => w.latest_session_status === 'RED').length;

  return (
    <>
      <title>Control Room | SafeDepth</title>
      <div style={{ backgroundColor: 'var(--bg-darker)', minHeight: '100vh', paddingBottom: '40px' }}>
        
        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.5px' }}>
              SAFEDEPTH 
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '12px' }}>| CONTROL ROOM</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="status-badge SAFE">SAFE: {safeCount}</span>
              <span className="status-badge YELLOW">WARNING: {warningCount}</span>
              <span className="status-badge RED">CRITICAL: {criticalCount}</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '16px', color: 'var(--text-muted)' }}>
              {currentTime}
            </div>
          </div>
        </header>

        <div className="dashboard-layout">
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="card">
              <h2 style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Field Workers</h2>
              <div>
                {workers.map(w => (
                  <div key={w.worker_id} className={`worker-card ${getWorkerCardClass(w.latest_session_status)} ${w.vitals_status === 'CRITICAL' ? 'status-red' : ''}`}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', color: 'var(--text-main)' }}>{w.name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>ID: {w.worker_id} • Zone: {w.zone}</p>
                      
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', alignItems: 'center' }}>
                        <span style={{ color: w.heart_rate && (w.heart_rate > 120 || w.heart_rate < 50) ? 'var(--status-red)' : 'var(--text-main)' }}>
                          Heart Rate: {w.heart_rate ?? '--'} BPM
                        </span>
                        <span style={{ color: w.oxygen_level && w.oxygen_level < 90 ? 'var(--status-red)' : 'var(--text-main)' }}>
                          Oxygen: {w.oxygen_level ?? '--'}%
                        </span>
                        <span style={{ color: w.temperature && w.temperature > 38.5 ? 'var(--status-red)' : 'var(--text-main)' }}>
                          Temp: {w.temperature ?? '--'}°C
                        </span>
                        {w.vitals_status && (
                          <span className={`status-badge ${w.vitals_status}`} style={{ padding: '2px 6px', fontSize: '10px' }}>
                            {w.vitals_status === 'CRITICAL' ? '⚠ CRITICAL VITALS' : w.vitals_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ width: '120px', textAlign: 'center' }}>
                      {w.latest_session_status ? (
                         <span className={`status-badge ${w.latest_session_status}`}>
                           {w.latest_session_status === 'RESPONDED' ? 'SAFE' : w.latest_session_status}
                         </span>
                      ) : (
                         <span style={{ color: "var(--text-muted)", fontSize: '12px' }}>Inactive</span>
                      )}
                    </div>
                    <div style={{ marginLeft: '16px' }}>
                      <button 
                         className="btn-primary" 
                         style={{ padding: '6px 12px', fontSize: '13px' }}
                         onClick={() => handleSendCheck(w.worker_id)}
                         disabled={w.latest_session_status === 'PENDING' || w.latest_session_status === 'YELLOW' || w.latest_session_status === 'RED'}
                      >
                         Send Check
                      </button>
                    </div>
                  </div>
                ))}
                {workers.length === 0 && (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: '20px', fontSize: '14px' }}>No workers registered.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Safety Sessions</h2>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 500 }}>Worker</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 500 }}>Time Elapsed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const minutesElapsed = Math.floor((new Date().getTime() - new Date(s.created_at + 'Z').getTime()) / 60000);
                      return (
                      <tr key={s.id}>
                        <td style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}>{s.worker_name}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                          <span className={`status-badge ${s.status}`}>
                             {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: "var(--text-muted)" }}>{minutesElapsed} min ago</td>
                      </tr>
                    )})}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px", fontSize: '14px' }}>No active sessions in progress.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="card">
              <h2 style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Incident Alerts
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.map(a => {
                  const minutesAgo = Math.floor((new Date().getTime() - new Date(a.timestamp + 'Z').getTime()) / 60000);
                  const isRed = a.alert_type === 'RED_CRITICAL' || a.alert_type === 'EMERGENCY';
                  return (
                  <div key={a.id} className="alert-item" style={{ borderLeft: `3px solid ${isRed ? 'var(--status-red)' : 'var(--status-yellow)'}`}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>{a.worker_name}</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{minutesAgo} min ago</p>
                        <span className={`status-badge ${a.alert_type}`} style={{ marginTop: '8px', fontSize: '11px' }}>
                           {a.alert_type.replace('_', ' ')}
                        </span>
                      </div>
                      <button className="resolve-btn" onClick={() => handleResolveAlert(a.id)}>
                        Resolve
                      </button>
                    </div>
                  </div>
                )})}
                {alerts.length === 0 && (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p style={{ color: "var(--text-muted)", fontSize: '14px' }}>No unresolved alerts.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Register Worker</h2>
              <form onSubmit={handleRegisterWorker}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={regName} 
                    onChange={(e) => setRegName(e.target.value)} 
                    required
                  />
                  <input 
                    type="tel" 
                    placeholder="Worker ID / Phone" 
                    value={regPhone} 
                    onChange={(e) => setRegPhone(e.target.value)} 
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ marginTop: '4px' }}>Submit</button>
                </div>
              </form>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}