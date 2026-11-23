"""Tiny in-process sliding-window limiter for the auth endpoints.

Pocketman runs as a single uvicorn process, so an in-memory store is enough;
it resets on restart, which is acceptable for brute-force throttling.
"""

import time
from collections import deque
from threading import Lock

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    def _prune(self, key: str, window: float, now: float) -> deque[float]:
        q = self._hits.setdefault(key, deque())
        while q and q[0] <= now - window:
            q.popleft()
        return q

    def check(self, key: str, limit: int, window: float) -> None:
        """Raise 429 if `key` already has `limit` hits inside the window."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, window, now)
            if len(q) >= limit:
                retry_after = max(1, int(q[0] + window - now) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._hits.setdefault(key, deque()).append(now)
            # keep memory bounded if someone sprays random usernames
            if len(self._hits) > 50_000:
                self._hits.clear()

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    # nginx (and Coolify's proxy in front of it) put the real client first in
    # X-Forwarded-For. It can be spoofed by a client, which only weakens the
    # per-IP limit; the per-username limit does not depend on it.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        first = fwd.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"
