"use client";

import { useState, useEffect } from "react";
import Head from "next/head";

const API_URL = "http://localhost:8000/api";

type SessionData = {
  id: number;
  status: string;
};

export default function WorkerTerminal() {
  const [workerPhone, setWorkerPhone] = useState("");
  const [isIdentified, setIsIdentified] = useState(false);
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);

  const pollSession = async () => {
    if (!isIdentified || !workerPhone) return;

    try {
      const res = await fetch(`${API_URL}/session/pending/${workerPhone}`);
      if (res.ok) {
        const data = await res.json();
        // The API returns the session object or null if none
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
      pollSession(); // initial read
      const interval = setInterval(pollSession, 10000); // 10s polling
      return () => clearInterval(interval);
    }
  }, [isIdentified, workerPhone]);

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    if (workerPhone.trim().length > 0) {
      setIsIdentified(true);
    }
  };

  const handleRespondSafe = async () => {
    if (!pendingSession) return;
    try {
       await fetch(`${API_URL}/session/respond/${pendingSession.id}`, {
         method: "POST"
       });
       setPendingSession(null);
    } catch (err) {
       console.error("Error calling safe response:", err);
    }
  };

  const handleEmergency = async () => {
    if (!workerPhone) return;
    try {
      // Alert visually immediately
      await fetch(`${API_URL}/emergency/${workerPhone}`, {
        method: "POST"
      });
      alert("EMERGENCY ALERT BROADCASTED. HELP IS ON THE WAY.");
    } catch (err) {
      console.error("Error calling emergency:", err);
      // Fallback alert
      alert("ATTEMPTED EMERGENCY ALERT, NETWORK FAILED.");
    }
  };

  if (!isIdentified) {
    return (
      <div className="worker-container" style={{ justifyContent: 'center' }}>
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

  return (
    <>
      <Head>
        <title>Worker Terminal | SafeDepth</title>
      </Head>
      <div className="worker-container">
        
        {/* Connection/Identity Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', maxWidth: '600px' }}>
           <span style={{ color: 'var(--text-muted)' }}>ID: <strong>{workerPhone}</strong></span>
           <span className="status-badge SAFE">Live</span>
        </div>

        {/* Central Action Area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
           {pendingSession ? (
              <button className="giant-btn safe" onClick={handleRespondSafe}>
                I'm Safe ✅
              </button>
           ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', animation: 'pulse 2s infinite' }}>
                   <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)' }}></div>
                </div>
                <h2 style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Waiting for check request...</h2>
              </div>
           )}
        </div>

        {/* Persistent Emergency Area */}
        <button className="giant-btn emergency" onClick={handleEmergency}>
          🚨 EMERGENCY
        </button>

        <style>{`
           @keyframes pulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.1); }
              70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(255, 255, 255, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
           }
        `}</style>
      </div>
    </>
  );
}
