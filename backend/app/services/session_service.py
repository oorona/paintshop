import json
import os
import uuid
from datetime import datetime
from typing import Dict, Optional, List, Any
from pathlib import Path

from ..models.schemas import SessionStats, TokenUsage, CostEstimate


class SessionService:
    """Service for managing sessions and tracking costs."""

    def __init__(self, storage_path: str = "/app/sessions"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._sessions: Dict[str, SessionStats] = {}

    def create_session(self) -> str:
        """Create a new session and return its ID."""
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = SessionStats(
            session_id=session_id,
            total_requests=0,
            total_input_tokens=0,
            total_output_tokens=0,
            total_cost=0.0,
            requests=[]
        )
        return session_id

    def get_session(self, session_id: str) -> Optional[SessionStats]:
        """Get session by ID."""
        if session_id not in self._sessions:
            # Try to load from file
            session_file = self.storage_path / f"{session_id}.json"
            if session_file.exists():
                with open(session_file, "r") as f:
                    data = json.load(f)
                    self._sessions[session_id] = SessionStats(**data)
            else:
                return None
        return self._sessions.get(session_id)

    def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """Get existing session or create a new one."""
        if session_id and self.get_session(session_id):
            return session_id
        return self.create_session()

    def record_request(
        self,
        session_id: str,
        request_type: str,
        token_usage: TokenUsage,
        cost_estimate: CostEstimate,
        model: str,
        prompt: Optional[str] = None
    ):
        """Record a request in the session."""
        session = self.get_session(session_id)
        if not session:
            session_id = self.create_session()
            session = self._sessions[session_id]

        # Update totals
        session.total_requests += 1
        session.total_input_tokens += token_usage.input_tokens
        session.total_output_tokens += token_usage.output_tokens
        session.total_cost += cost_estimate.total_cost

        # Add request record
        session.requests.append({
            "timestamp": datetime.utcnow().isoformat(),
            "type": request_type,
            "model": model,
            "input_tokens": token_usage.input_tokens,
            "output_tokens": token_usage.output_tokens,
            "cost": cost_estimate.total_cost,
            "prompt": prompt[:100] if prompt else None  # Truncate for storage
        })

        # Save to file
        self._save_session(session_id)

    def _save_session(self, session_id: str):
        """Save session to file."""
        session = self._sessions.get(session_id)
        if session:
            session_file = self.storage_path / f"{session_id}.json"
            with open(session_file, "w") as f:
                json.dump(session.model_dump(), f, indent=2, default=str)

    def get_session_stats(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed session statistics."""
        session = self.get_session(session_id)
        if not session:
            return None

        # Calculate additional stats
        stats = session.model_dump()
        stats["average_cost_per_request"] = (
            session.total_cost / session.total_requests
            if session.total_requests > 0 else 0
        )
        stats["average_tokens_per_request"] = (
            (session.total_input_tokens + session.total_output_tokens) / session.total_requests
            if session.total_requests > 0 else 0
        )

        # Group by request type
        type_counts = {}
        for req in session.requests:
            req_type = req.get("type", "unknown")
            type_counts[req_type] = type_counts.get(req_type, 0) + 1
        stats["requests_by_type"] = type_counts

        # Group by model
        model_costs = {}
        for req in session.requests:
            model = req.get("model", "unknown")
            if model not in model_costs:
                model_costs[model] = {"count": 0, "cost": 0.0, "tokens": 0}
            model_costs[model]["count"] += 1
            model_costs[model]["cost"] += req.get("cost", 0)
            model_costs[model]["tokens"] += req.get("input_tokens", 0) + req.get("output_tokens", 0)
        stats["usage_by_model"] = model_costs

        return stats

    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all sessions with summary info."""
        sessions = []

        # Load all session files
        for session_file in self.storage_path.glob("*.json"):
            try:
                with open(session_file, "r") as f:
                    data = json.load(f)
                    sessions.append({
                        "session_id": data["session_id"],
                        "total_requests": data["total_requests"],
                        "total_cost": data["total_cost"],
                        "created": data["requests"][0]["timestamp"] if data["requests"] else None,
                        "last_activity": data["requests"][-1]["timestamp"] if data["requests"] else None
                    })
            except Exception:
                continue

        return sorted(sessions, key=lambda x: x.get("last_activity") or "", reverse=True)

    def clear_session(self, session_id: str) -> bool:
        """Clear a session's history."""
        session_file = self.storage_path / f"{session_id}.json"
        if session_file.exists():
            session_file.unlink()
        if session_id in self._sessions:
            del self._sessions[session_id]
        return True


# Global service instance
session_service = SessionService()
