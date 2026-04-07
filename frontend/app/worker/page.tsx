"use client";

import { useState, useEffect } from "react";
import Head from "next/head";

// Dynamic API logic correctly binds to host dynamically.
const API_BASE = typeof window !== 'undefined' 
  ? `http://${window.location.hostname}:8000`
  : 'http://localhost:8000';

type SessionData = {
  id: number;
  status: string;
  created_at: string;
};

export default function WorkerTerminal() {
  const [workerPhone, setWorkerPhone] = useState("");
  const [isIdentified, setIsIdentified] = useState(false);
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);
  
  const [showResponded, setShowResponded] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);

  const [timeLeftStr, setTimeLeftStr] = useState("05:00");
  const [timerStatus, setTimerStatus] = useState<"GREEN" | "AMBER" | "RED">("GREEN");

  const [vitals, setVitals] = useState<{heart_rate: number, oxygen: number, temperature: number} | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('worker_id');
    if (savedId) {
      setWorkerPhone(savedId);
      setIsIdentified(true);
    }
  }, []);

  const pollSession = async () => {
    if (!isIdentified || !workerPhone || showResponded) return;

    // Properly trimmed and lowercased matching ID
    const queryId = workerPhone.trim().toLowerCase();
    
    // Debugging active polling call against expected exact worker identity.
    console.log(`Polling pending session for worker_id: "${queryId}"`);

    try {
      const res = await fetch(`${API_BASE}/api/session/pending/${queryId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === "PENDING") {
          setPendingSession(data);
        } else {
          setPendingSession(null);
        }
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  };

  useEffect(() => {
    if (isIdentified) {
      pollSession(); 
      const interval = setInterval(pollSession, 5000); 
      return () => clearInterval(interval);
    }
  }, [isIdentified, workerPhone, showResponded]);

  // Vitals Simulation
  useEffect(() => {
    if (!isIdentified || !workerPhone) return;

    const queryId = workerPhone.trim().toLowerCase();

    const simulateVitals = () => {
      const hr = Math.floor(Math.random() * (90 - 70 + 1)) + 70;
      const ox = Math.floor(Math.random() * (99 - 96 + 1)) + 96;
      const temp = +(Math.random() * (37.2 - 36.5) + 36.5).toFixed(1);

      setVitals({ heart_rate: hr, oxygen: ox, temperature: temp });

      fetch(`${API_BASE}/api/vitals/${queryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heart_rate: hr, oxygen_level: ox, temperature: temp })
      }).catch(e => console.error("Vitals post error:", e));
    };

    simulateVitals();
    const vitalsInterval = setInterval(simulateVitals, 10000);
    return () => clearInterval(vitalsInterval);
  }, [isIdentified, workerPhone]);

  // Handle vitals critical + pending session
  useEffect(() => {
    if (pendingSession && vitals) {
      const isCritical = vitals.heart_rate > 120 || vitals.heart_rate < 50 || vitals.oxygen < 90 || vitals.temperature > 38.5;
      if (isCritical) {
         handleEmergency();
      }
    }
  }, [pendingSession, vitals]);

  useEffect(() => {
    let clockInterval: NodeJS.Timeout;
    if (pendingSession && !showResponded) {
      clockInterval = setInterval(() => {
        const createdTime = new Date(pendingSession.created_at + 'Z').getTime();
        const deadline = createdTime + 5 * 60 * 1000;
        const now = new Date().getTime();
        const remaining = Math.max(0, deadline - now);

        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        
        setTimeLeftStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);

        if (remaining < 60000) {
          setTimerStatus("RED");
        } else if (remaining < 180000) {
          setTimerStatus("AMBER");
        } else {
          setTimerStatus("GREEN");
        }
      }, 1000);
    }
    return () => clearInterval(clockInterval);
  }, [pendingSession, showResponded]);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workerPhone.trim().length > 0) {
      const cleanedId = workerPhone.trim().toLowerCase();
      // Store both cleaned string & an object locally
      localStorage.setItem('worker_id', cleanedId);
      localStorage.setItem('worker_object', JSON.stringify({ worker_id: cleanedId, original_input: workerPhone }));
      setWorkerPhone(cleanedId);
      setIsIdentified(true);
    }
  };

  const handleRespondSafe = async () => {
    if (!pendingSession) return;
    try {
       await fetch(`${API_BASE}/api/session/respond/${pendingSession.id}`, {
         method: "POST"
       });
       setShowResponded(true);
       setPendingSession(null);
       
       setTimeout(() => {
         setShowResponded(false);
       }, 2000);

    } catch (err) {
       console.error("Error calling safe response:", err);
    }
  };

  const handleEmergency = async () => {
    const workerId = localStorage.getItem('worker_id');
    if (!workerId) {
      alert("Please check in first");
      return;
    }
    try {
      await fetch(`${API_BASE}/api/emergency/${workerId.trim().toLowerCase()}`, { method: "POST" });
      setEmergencyMessage("EMERGENCY SIGNAL SENT");
      setTimeout(() => setEmergencyMessage(null), 5000);
    } catch (err) {
      console.error("Error calling emergency:", err);
      setEmergencyMessage("SIGNAL SEND FAILED");
      setTimeout(() => setEmergencyMessage(null), 5000);
    }
  };

  if (!isIdentified) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '24px', backgroundColor: 'var(--bg-darker)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '360px', padding: '32px 24px' }}>
          <h1 style={{ marginBottom: '24px', textAlign: 'center', fontSize: '20px', color: 'var(--text-main)', fontWeight: 500 }}>Worker Check-In</h1>
          <form onSubmit={handleIdentify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
               type="text" 
               placeholder="Enter Worker ID..." 
               value={workerPhone}
               onChange={(e) => setWorkerPhone(e.target.value)}
               autoFocus
               required
               style={{ textAlign: 'center' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '12px' }}>
               Start Shift
            </button>
          </form>
        </div>
      </div>
    );
  }

  // State 3: Responded successfully screen
  if (showResponded) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px',
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-darker)'
      }}>
        <div style={{ fontSize: '80px', marginBottom: '20px', color: 'var(--status-safe)' }}>✓</div>
        <h1 style={{ fontSize: '28px', color: 'var(--text-main)', fontWeight: 600, textAlign: 'center', letterSpacing: '0.5px' }}>Response Recorded</h1>
        <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '8px' }}>Tracking updated.</p>
      </div>
    );
  }

  // State 2: Check Request Active
  if (pendingSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '32px 24px', backgroundColor: 'var(--bg-darker)' }}>
        
        <div style={{ backgroundColor: 'transparent', textAlign: 'center', padding: '12px', border: '1px solid var(--status-yellow)', borderRadius: 'var(--radius-md)' }}>
           <span style={{ color: 'var(--status-yellow)', fontWeight: 600, letterSpacing: '0.5px' }}>SAFETY CHECK REQUESTED</span>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
           
           <div style={{
              fontSize: '80px', 
              fontFamily: 'monospace', 
              fontWeight: 500, 
              lineHeight: 1,
              color: timerStatus === 'GREEN' ? 'var(--status-safe)' : timerStatus === 'AMBER' ? 'var(--status-yellow)' : 'var(--status-red)',
              transition: 'color 0.3s'
           }}>
             {timeLeftStr}
           </div>

           <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '24px 0 32px 0', letterSpacing: '0.5px' }}>
             Please acknowledge check-in
           </p>

           <button className="giant-btn safe" onClick={handleRespondSafe}>
              I'M SAFE
           </button>
        </div>

        {emergencyMessage && (
           <div style={{ color: 'var(--status-red)', textAlign: 'center', marginBottom: '16px', fontWeight: 600 }}>{emergencyMessage}</div>
        )}
        <button className="giant-btn emergency" onClick={handleEmergency}>
          🚨 EMERGENCY
        </button>

        {vitals && (
             <div style={{ display: 'flex', gap: '16px', margin: '24px auto 0 auto', backgroundColor: 'var(--bg-card)', padding: '12px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Heart Rate</div>
                 <div style={{ fontSize: '18px', fontWeight: 600 }}>{vitals.heart_rate} BPM</div>
               </div>
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Oxygen</div>
                 <div style={{ fontSize: '18px', fontWeight: 600 }}>{vitals.oxygen}%</div>
               </div>
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Temp</div>
                 <div style={{ fontSize: '18px', fontWeight: 600 }}>{vitals.temperature}°C</div>
               </div>
             </div>
        )}

      </div>
    );
  }

  // State 1: Waiting
  return (
    <>
      <title>Worker Terminal | SafeDepth</title>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '32px 24px', backgroundColor: 'var(--bg-darker)' }}>
        
        {/* Connection Bar */}
        <div style={{ width: '100%', textAlign: 'center', paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
           <h2 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 600 }}>{workerPhone}</h2>
           <span className="status-badge SAFE" style={{ marginTop: '12px' }}>Standard Protocol Active</span>
        </div>

        {/* Central Action Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
           <div className="sonar-circle">
             <div className="sonar-pulse"></div>
           </div>
           
           <h2 style={{ color: 'var(--text-main)', fontSize: '16px', fontWeight: 600, marginTop: '48px', letterSpacing: '0.5px' }}>
             MONITORING ACTIVE
           </h2>
           <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
             Awaiting supervisor check
           </p>

           {vitals && (
             <div style={{ display: 'flex', gap: '16px', marginTop: '24px', backgroundColor: 'var(--bg-card)', padding: '12px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Heart Rate</div>
                 <div style={{ fontSize: '18px', fontWeight: 600, color: vitals.heart_rate > 120 || vitals.heart_rate < 50 ? 'var(--status-red)' : 'inherit' }}>{vitals.heart_rate} BPM</div>
               </div>
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Oxygen</div>
                 <div style={{ fontSize: '18px', fontWeight: 600, color: vitals.oxygen < 90 ? 'var(--status-red)' : 'inherit' }}>{vitals.oxygen}%</div>
               </div>
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Temp</div>
                 <div style={{ fontSize: '18px', fontWeight: 600, color: vitals.temperature > 38.5 ? 'var(--status-red)' : 'inherit' }}>{vitals.temperature}°C</div>
               </div>
             </div>
           )}

        </div>

        {emergencyMessage && (
           <div style={{ color: 'var(--status-red)', textAlign: 'center', marginBottom: '16px', fontWeight: 600 }}>{emergencyMessage}</div>
        )}
        {/* Persistent Emergency Area */}
        <button className="giant-btn emergency" onClick={handleEmergency} style={{ marginTop: 'auto' }}>
          EMERGENCY
        </button>

      </div>
    </>
  );
}