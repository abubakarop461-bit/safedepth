"use client";

import { useState, useEffect } from "react";
import Head from "next/head";

const API_URL = "http://localhost:8000/api";

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

  // Registration states
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");

  const fetchData = async () => {
    try {
      const [wRes, sRes, aRes] = await Promise.all([
        fetch(`${API_URL}/workers/all`),
        fetch(`${API_URL}/sessions/active`),
        fetch(`${API_URL}/alerts`)
      ]);
      
      if (wRes.ok) setWorkers(await wRes.json());
      if (sRes.ok) setSessions(await sRes.json());
      if (aRes.ok) setAlerts((await aRes.json()).filter((a: AlertData) => !a.resolved));
    } catch (e) {
      console.error("Error polling backend:", e);
    }
  };

  useEffect(() => {
    fetchData(); // Initial load
    const intervalId = setInterval(fetchData, 10000); // 10-second polling
    return () => clearInterval(intervalId);
  }, []);

  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone) return;

    try {
      await fetch(`${API_URL}/worker/register`, {
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
      await fetch(`${API_URL}/session/create`, {
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
      await fetch(`${API_URL}/alert/resolve/${alert_id}`, { method: "POST" });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Head>
        <title>Supervisor Dashboard | SafeDepth</title>
      </Head>
      <div className="dashboard-layout">
        
        {/* Workers List Section */}
        <div className="card dashboard-workers">
          <div className="header-bar">
            <h2 className="page-title">Active Field Workers</h2>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID (Phone)</th>
                  <th>Zone</th>
                  <th>Session Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.worker_id}>
                    <td>
                      <strong>{w.name}</strong>
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{w.worker_id}</td>
                    <td>{w.zone}</td>
                    <td>
                      {w.latest_session_status ? (
                         <span className={`status-badge ${w.latest_session_status}`}>
                           {w.latest_session_status === 'RESPONDED' ? 'SAFE' : w.latest_session_status}
                         </span>
                      ) : (
                         <span style={{ color: "var(--text-muted)" }}>No Active Checks</span>
                      )}
                    </td>
                    <td>
                      <button 
                         className="btn-primary" 
                         onClick={() => handleSendCheck(w.worker_id)}
                         disabled={w.latest_session_status === 'PENDING' || w.latest_session_status === 'YELLOW' || w.latest_session_status === 'RED'}
                      >
                         Send Check
                      </button>
                    </td>
                  </tr>
                ))}
                {workers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>No workers registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sessions Section */}
        <div className="card">
          <h2>Active Safety Sessions</h2>
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
                    <td>{s.worker_name}</td>
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
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>No active sessions at risk.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar: Alerts & Registration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ borderColor: alerts.length > 0 ? "var(--status-red)" : "var(--border-subtle)" }}>
            <h2 style={{ color: alerts.length > 0 ? "var(--status-red)" : "inherit" }}>Critical Alerts</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {alerts.map(a => (
                <div key={a.id} style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${a.alert_type === 'YELLOW_WARNING' ? 'var(--status-yellow)' : 'var(--status-red)'}`}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{a.worker_name}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{new Date(a.timestamp + 'Z').toLocaleTimeString()}</p>
                      <span className={`status-badge ${a.alert_type}`} style={{ marginTop: '8px' }}>
                         {a.alert_type.replace('_', ' ')}
                      </span>
                    </div>
                    <button className="btn-primary" style={{ backgroundColor: 'var(--bg-hover)' }} onClick={() => handleResolveAlert(a.id)}>
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p style={{ color: "var(--text-muted)", textAlign: "center" }}>All clear. No unresolved alerts.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Add Worker</h2>
            <form onSubmit={handleRegisterWorker}>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={regName} 
                  onChange={(e) => setRegName(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group">
                <input 
                  type="tel" 
                  placeholder="Phone Number (ID)" 
                  value={regPhone} 
                  onChange={(e) => setRegPhone(e.target.value)} 
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }}>Register</button>
            </form>
          </div>

        </div>

      </div>
    </>
  );
}
