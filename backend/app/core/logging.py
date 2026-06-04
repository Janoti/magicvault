"""Structured logging. In production every log line is JSON (easy to grep/ingest
in Render/any log tool); in dev it's a readable single line. A per-request id is
attached to every log emitted while handling that request."""
import json
import logging
import sys
import contextvars

from app.core.config import settings

# Set per request (see the middleware in main.py) so all logs in a request correlate.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

# Standard LogRecord attributes we don't want to duplicate as "extra".
_STD = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        # Merge structured fields passed via logger.x("...", extra={...}).
        for k, v in record.__dict__.items():
            if k not in _STD and not k.startswith("_"):
                data[k] = v
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False, default=str)


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    if settings.environment == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    # Route uvicorn through the same handler (no double lines).
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers = [handler]
        lg.propagate = False
