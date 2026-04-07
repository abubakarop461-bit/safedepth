"use client";

import { useState, useEffect } from "react";
import Head from "next/head";

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
        body: JSON.stringify({ name: regName, worker_id: regPhone, zone: "Main Zone" }),
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
        body: JSON.stringify({ worker_id }),
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

  // Compute counts
  const safeCount = workers.filter(w => w.latest_session_status === 'RESPONDED' || w.latest_session_status === 'SAFE').length;
  const warningCount = workers.filter(w => w.latest_session_status === 'YELLOW').length;
  const criticalCount = workers.filter(w => w.latest_session_status === 'RED').length;

  return (
    <>
      <title>Control Room | SafeDepth</title>
      <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', paddingBottom: '40px' }}>
        
        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: '#11151E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '1px' }}>
              SAFEDEPTH 
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '12px' }}>| SUPERVISOR CONTROL ROOM</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span className="status-badge SAFE">SAFE: {safeCount}</span>
              <span className="status-badge YELLOW">WARNING: {warningCount}</span>
              <span className="status-badge RED">CRITICAL: {criticalCount}</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '20px', color: 'var(--primary-accent)', fontWeight: 'bold' }}>
              {currentTime}
            </div>
          </div>
        </header>

        <div className="dashboard-layout">
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="card">
              <h2 style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '18px', textTransform: 'uppercase' }}>Active Field Workers</h2>
              <div>
                {workers.map(w => (
                  <div key={w.worker_id} className={`worker-card ${getWorkerCardClass(w.latest_session_status)}`}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{w.name} <span style={{fontSize:'12px', color:'var(--text-muted)', fontWeight:'normal'}}>- Zone: {w.zone}</span></h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>ID: {w.worker_id}</p>
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
                         onClick={() => handleSendCheck(w.worker_id)}
                         disabled={w.latest_session_status === 'PENDING' || w.latest_session_status === 'YELLOW' || w.latest_session_status === 'RED'}
                      >
                         Send Check
                      </button>
                    </div>
                  </div>
                ))}
                {workers.length === 0 && (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: '20px' }}>No workers registered.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '18px', textTransform: 'uppercase' }}>Active Safety Sessions</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Status</th>
                      <th>Time Elapsed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const minutesElapsed = Math.floor((new Date().getTime() - new Date(s.created_at + 'Z').getTime()) / 60000);
                      return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.worker_name}</td>
                        <td>
                          <span className={`status-badge ${s.status}`}>
                             {s.status}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>{minutesElapsed} min ago</td>
                      </tr>
                    )})}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>No active sessions in progress.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="card" style={{ borderColor: alerts.length > 0 ? "var(--status-red)" : "var(--border-subtle)" }}>
              <h2 style={{ color: alerts.length > 0 ? "var(--status-red)" : "var(--text-muted)", fontSize: '18px', textTransform: 'uppercase', marginBottom: '16px' }}>
                Incident Alerts
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.map(a => {
                  const minutesAgo = Math.floor((new Date().getTime() - new Date(a.timestamp + 'Z').getTime()) / 60000);
                  const isRed = a.alert_type === 'RED_CRITICAL' || a.alert_type === 'EMERGENCY';
                  return (
                  <div key={a.id} className="alert-item" style={{ borderLeft: `4px solid ${isRed ? 'var(--status-red)' : 'var(--status-yellow)'}`}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{a.worker_name}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{minutesAgo} min ago</p>
                        <span className={`status-badge ${a.alert_type}`} style={{ marginTop: '8px' }}>
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
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: '20px 0' }}>All clear. No unresolved alerts.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '18px', textTransform: 'uppercase' }}>Add Worker</h2>
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
                    placeholder="Phone Number (ID)" 
                    value={regPhone} 
                    onChange={(e) => setRegPhone(e.target.value)} 
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ marginTop: '4px' }}>Register</button>
                </div>
              </form>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}