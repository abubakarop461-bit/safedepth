from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional
import datetime
import asyncio
import contextlib

# --- DATABASE SETUP ---
DATABASE_URL = "sqlite:///./safedepth.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- MODELS ---
class Worker(Base):
    __tablename__ = "workers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    worker_id = Column(String, unique=True, index=True)
    zone = Column(String)
    is_active = Column(Boolean, default=False)
    checkin_time = Column(DateTime, nullable=True)

class SafetySession(Base):
    __tablename__ = "safety_sessions"
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(String, ForeignKey("workers.worker_id"))
    worker_name = Column(String)
    zone = Column(String)
    created_at = Column(DateTime)
    deadline = Column(DateTime)
    responded_at = Column(DateTime, nullable=True)
    status = Column(String) # PENDING/RESPONDED/YELLOW/RED
    resolved = Column(Boolean, default=False)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(String)
    worker_name = Column(String)
    zone = Column(String)
    alert_type = Column(String) # YELLOW_WARNING/RED_CRITICAL/EMERGENCY
    timestamp = Column(DateTime)
    resolved = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

# --- PYDANTIC SCHEMAS ---
class WorkerCreate(BaseModel):
    name: str
    worker_id: str
    zone: str

class SessionCreate(BaseModel):
    worker_id: str
    
class WorkerResponse(BaseModel):
    id: int
    name: str
    worker_id: str
    zone: str
    is_active: bool
    checkin_time: Optional[datetime.datetime]
    
    class Config:
        from_attributes = True

class SafetySessionResponse(BaseModel):
    id: int
    worker_id: str
    worker_name: str
    zone: str
    created_at: datetime.datetime
    deadline: datetime.datetime
    responded_at: Optional[datetime.datetime]
    status: str
    resolved: bool

    class Config:
        from_attributes = True

class AlertResponse(BaseModel):
    id: int
    worker_id: str
    worker_name: str
    zone: str
    alert_type: str
    timestamp: datetime.datetime
    resolved: bool

    class Config:
        from_attributes = True

# --- BACKGROUND TASK ---

async def background_session_checker():
    """
    Run every 30 seconds:
    - Find all PENDING sessions where deadline passed
    - If created_at + 5 min passed and not responded: set status = YELLOW, create YELLOW_WARNING alert
    - If created_at + 10 min passed and not responded: set status = RED, create RED_CRITICAL alert
    """
    while True:
        await asyncio.sleep(30)
        db = SessionLocal()
        try:
            now = datetime.datetime.utcnow()
            
            # Find sessions that are not responded and potentially need updates
            active_sessions = db.query(SafetySession).filter(
                SafetySession.status.in_(["PENDING", "YELLOW"])
            ).all()

            for session in active_sessions:
                delta = now - session.created_at
                minutes_passed = delta.total_seconds() / 60.0

                new_status = None
                alert_type = None

                if session.status == "PENDING" and minutes_passed >= 5 and minutes_passed < 10:
                    new_status = "YELLOW"
                    alert_type = "YELLOW_WARNING"
                elif session.status in ["PENDING", "YELLOW"] and minutes_passed >= 10:
                    new_status = "RED"
                    alert_type = "RED_CRITICAL"

                if new_status and alert_type:
                    session.status = new_status
                    alert = Alert(
                        worker_id=session.worker_id,
                        worker_name=session.worker_name,
                        zone=session.zone,
                        alert_type=alert_type,
                        timestamp=now,
                        resolved=False
                    )
                    db.add(alert)
                    
            db.commit()
        except Exception as e:
            print(f"Error in background task: {e}")
        finally:
            db.close()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(background_session_checker())
    yield
    task.cancel()
    
# --- FASTAPI APP ---
app = FastAPI(title="SafeDepth API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- SUPERVISOR ENDPOINTS ---

@app.post("/api/worker/register", response_model=WorkerResponse)
def register_worker(worker: WorkerCreate, db: Session = Depends(get_db)):
    db_worker = db.query(Worker).filter(Worker.worker_id == worker.worker_id).first()
    if db_worker:
        db_worker.name = worker.name
        db_worker.zone = worker.zone
        db_worker.is_active = True
        db_worker.checkin_time = datetime.datetime.utcnow()
    else:
        db_worker = Worker(
            name=worker.name,
            worker_id=worker.worker_id,
            zone=worker.zone,
            is_active=True,
            checkin_time=datetime.datetime.utcnow()
        )
        db.add(db_worker)
    db.commit()
    db.refresh(db_worker)
    return db_worker

@app.post("/api/session/create", response_model=SafetySessionResponse)
def create_session(session_init: SessionCreate, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.worker_id == session_init.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
        
    now = datetime.datetime.utcnow()
    deadline = now + datetime.timedelta(minutes=5)
    
    new_session = SafetySession(
        worker_id=worker.worker_id,
        worker_name=worker.name,
        zone=worker.zone,
        created_at=now,
        deadline=deadline,
        status="PENDING",
        resolved=False
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.get("/api/workers/all")
def get_all_workers(db: Session = Depends(get_db)):
    workers = db.query(Worker).all()
    result = []
    for w in workers:
        latest_session = db.query(SafetySession).filter(
            SafetySession.worker_id == w.worker_id
        ).order_by(SafetySession.created_at.desc()).first()
        
        status = latest_session.status if latest_session else None
        
        # We return a dict since the schema might not exactly match
        worker_dict = {
            "id": w.id,
            "name": w.name,
            "worker_id": w.worker_id,
            "zone": w.zone,
            "is_active": w.is_active,
            "checkin_time": w.checkin_time,
            "latest_session_status": status
        }
        result.append(worker_dict)
    return result

@app.get("/api/sessions/active", response_model=List[SafetySessionResponse])
def get_active_sessions(db: Session = Depends(get_db)):
    sessions = db.query(SafetySession).filter(
        SafetySession.status.in_(["PENDING", "YELLOW", "RED"])
    ).order_by(SafetySession.created_at.desc()).all()
    return sessions

@app.get("/api/alerts", response_model=List[AlertResponse])
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.timestamp.desc()).all()
    return alerts

@app.post("/api/alert/resolve/{alert_id}")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.resolved = True
        db.commit()
    return {"status": "success", "resolved": True}

# --- WORKER ENDPOINTS ---

@app.get("/api/session/pending/{worker_id}")
def get_pending_session(worker_id: str, db: Session = Depends(get_db)):
    session = db.query(SafetySession).filter(
        SafetySession.worker_id == worker_id, 
        SafetySession.status == "PENDING"
    ).order_by(SafetySession.created_at.desc()).first()
    return session

@app.post("/api/session/respond/{session_id}", response_model=SafetySessionResponse)
def respond_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SafetySession).filter(SafetySession.id == session_id).first()
    if session:
        session.responded_at = datetime.datetime.utcnow()
        session.status = "RESPONDED"
        session.resolved = True
        db.commit()
        db.refresh(session)
    return session

@app.post("/api/emergency/{worker_id}")
def create_emergency(worker_id: str, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    alert = Alert(
        worker_id=worker_id,
        worker_name=worker.name if worker else "Unknown",
        zone=worker.zone if worker else "Unknown",
        alert_type="EMERGENCY",
        timestamp=datetime.datetime.utcnow(),
        resolved=False
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

@app.post("/api/worker/checkout/{worker_id}")
def checkout_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if worker:
        worker.is_active = False
        db.commit()
    return {"status": "success"}
 
