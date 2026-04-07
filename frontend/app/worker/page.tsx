"use client";

import { useState, useEffect } from "react";
import Head from "next/head";

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
  
  // Responded overlay state
  const [showResponded, setShowResponded] = useState(false);

  // Timer logic
  const [timeLeftStr, setTimeLeftStr] = useState("05:00");
  const [timerStatus, setTimerStatus] = useState<"GREEN" | "AMBER" | "RED">("GREEN");

  useEffect(() => {
    // Read from localStorage on mount
    const saved = localStorage.getItem('worker_id');
    if (saved) {
      setWorkerPhone(saved);
      setIsIdentified(true);
    }
  }, []);

  const pollSession = async () => {
    if (!isIdentified || !workerPhone || showResponded) return;

    try {
      const res = await fetch(`${API_BASE}/api/session/pending/${workerPhone}`);
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

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    if (workerPhone.trim().length > 0) {
      localStorage.setItem('worker_id', workerPhone);
      setIsIdentified(true);
    }
  };

  const handleRespondSafe = async () => {
    if (!pendingSession) return;
    try {
       await fetch(`${API_BASE}/api/session/respond/${pendingSession.id}`, {
         method: "POST"
       });
       // Trigger visual state
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
      await fetch(`${API_BASE}/api/emergency/${workerId}`, { method: "POST" });
      alert("EMERGENCY ALERT BROADCASTED. HELP IS ON THE WAY.");
    } catch (err) {
      console.error("Error calling emergency:", err);
      alert("ATTEMPTED EMERGENCY ALERT, NETWORK FAILED.");
    }
  };

  if (!isIdentified) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '24px', backgroundColor: '#0B0E14' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
          <h1 style={{ marginBottom: '24px', textAlign: 'center' }}>Worker Sign-In</h1>
          <form onSubmit={handleIdentify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
               type="tel" 
               placeholder="Enter Phone Number..." 
               value={workerPhone}
               onChange={(e) => setWorkerPhone(e.target.value)}
               autoFocus
               style={{ fontSize: '20px', padding: '16px' }}
               required
            />
            <button type="submit" className="btn-primary" style={{ fontSize: '20px', padding: '16px' }}>
               Start Shift
            </button>
          </form>
        </div>
      </div>
    );
  }

  // State 3: Responded successfully flash screen
  if (showResponded) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px',
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--status-safe)', animation: 'full-flash 2.5s forwards'
      }}>
        <div style={{ fontSize: '100px', marginBottom: '20px' }}>✅</div>
        <h1 style={{ fontSize: '36px', color: '#000', fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>RESPONSE RECORDED</h1>
        <p style={{ fontSize: '24px', color: '#111', marginTop: '10px' }}>Stay safe.</p>
      </div>
    );
  }

  // State 2: Check Request Active
  if (pendingSession) {
    return (
      <div className="worker-container vignette-red" style={{ padding: 0 }}>
        <div className="banner-amber">
           ⚠ SAFETY CHECK REQUESTED
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0 24px' }}>
           
           <div style={{
              fontSize: '100px', 
              fontFamily: 'monospace', 
              fontWeight: 900, 
              lineHeight: 1,
              color: timerStatus === 'GREEN' ? 'var(--status-safe)' : timerStatus === 'AMBER' ? 'var(--status-yellow)' : 'var(--status-red)',
              animation: timerStatus === 'RED' ? 'shake 0.5s infinite' : 'none'
           }}>
             {timeLeftStr}
           </div>

           <p style={{ color: 'var(--text-muted)', fontSize: '18px', margin: '20px 0 40px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
             Respond before time runs out
           </p>

           <button className="giant-btn safe" onClick={handleRespondSafe}>
              ✓ I'M SAFE
           </button>
        </div>

        <div style={{ padding: '0 24px 24px 24px', width: '100%' }}>
           <button className="giant-btn emergency" onClick={handleEmergency}>
             🚨 EMERGENCY
           </button>
        </div>
      </div>
    );
  }

  // State 1: Waiting
  return (
    <>
      <title>Worker Terminal | SafeDepth</title>
      <div className="worker-container" style={{ padding: '24px' }}>
        
        {/* Connection/Identity Bar */}
        <div style={{ width: '100%', textAlign: 'center', marginTop: '10px' }}>
           <h2 style={{ color: 'var(--status-safe)', fontSize: '24px', fontWeight: 800 }}>{workerPhone}</h2>
           <span className="status-badge SAFE" style={{ marginTop: '8px' }}>ZONE: Assigned</span>
        </div>

        {/* Central Action Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
           <div className="sonar-circle">
             <div className="sonar-pulse"></div>
           </div>
           
           <h2 style={{ color: 'var(--text-main)', fontSize: '22px', fontWeight: 800, marginTop: '40px', letterSpacing: '1px' }}>
             MONITORING ACTIVE
           </h2>
           <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '10px', animation: 'pulse 1.5s infinite' }}>
             Waiting for supervisor check...
           </p>
        </div>

        {/* Persistent Emergency Area */}
        <button className="giant-btn emergency" onClick={handleEmergency} style={{ marginTop: 'auto' }}>
          🚨 EMERGENCY
        </button>

      </div>
    </>
  );
}