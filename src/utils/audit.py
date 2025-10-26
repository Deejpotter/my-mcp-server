"""
Audit Logging System
Created: 26/10/25
By: Daniel Potter

Comprehensive audit logging for security-sensitive operations with structured
logging, log rotation, and configurable retention policies.

Features:
- Structured audit logs with JSON format
- Automatic log rotation by size and time
- User context tracking
- Operation categorization
- Success/failure tracking
- Sensitive data filtering

References:
Python Logging: https://docs.python.org/3/library/logging.html
Logging Handlers: https://docs.python.org/3/library/logging.handlers.html
OWASP Logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class AuditCategory(Enum):
    """Categories of auditable operations"""

    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    FILE_DELETE = "file_delete"
    COMMAND_EXEC = "command_exec"
    API_CALL = "api_call"
    CONFIG_CHANGE = "config_change"
    AUTH = "authentication"
    ACCESS_DENIED = "access_denied"
    ERROR = "error"


class AuditSeverity(Enum):
    """Severity levels for audit events"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    """
    Represents a single audit event.

    Attributes:
        timestamp: ISO format timestamp
        category: Event category (file operation, command, etc.)
        action: Specific action taken
        user: User identifier (if available)
        resource: Resource affected (file path, command, etc.)
        result: Operation result (success/failure)
        severity: Event severity level
        details: Additional context as dictionary
        client_info: Client information (MCP client, user agent, etc.)
    """

    timestamp: str
    category: str
    action: str
    resource: str
    result: str
    severity: str
    user: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    client_info: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {k: v for k, v in asdict(self).items() if v is not None}

    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict())


class AuditLogger:
    """
    Centralized audit logging system with rotation and filtering.

    Provides structured logging for security-sensitive operations with
    automatic log rotation, sensitive data filtering, and searchable
    JSON format.

    Usage:
        auditor = AuditLogger(log_dir="logs")
        auditor.log_file_operation(
            action="write",
            file_path="/path/to/file",
            success=True,
            user="user@example.com"
        )
    """

    # Patterns to filter from logs (sensitive data)
    SENSITIVE_PATTERNS: Set[str] = {
        "password",
        "token",
        "secret",
        "api_key",
        "private_key",
        "authorization",
        "credential",
        "passwd",
    }

    def __init__(
        self,
        log_dir: Optional[str] = None,
        max_bytes: int = 10 * 1024 * 1024,  # 10MB
        backup_count: int = 5,
        enable_rotation: bool = True,
    ):
        """
        Initialize audit logger.

        Args:
            log_dir: Directory for audit logs (default: logs/)
            max_bytes: Maximum size per log file before rotation
            backup_count: Number of backup files to keep
            enable_rotation: Enable automatic log rotation
        """
        self.log_dir = Path(log_dir or "logs")
        self.log_dir.mkdir(parents=True, exist_ok=True)

        self.audit_file = self.log_dir / "audit.log"
        self.max_bytes = max_bytes
        self.backup_count = backup_count

        # Setup specialized logger
        self.logger = logging.getLogger("audit")
        self.logger.setLevel(logging.INFO)
        self.logger.propagate = False  # Don't propagate to root logger

        # Remove existing handlers
        self.logger.handlers.clear()

        # Add rotating file handler
        handler: Union[RotatingFileHandler, logging.FileHandler]
        if enable_rotation:
            handler = RotatingFileHandler(
                self.audit_file,
                maxBytes=max_bytes,
                backupCount=backup_count,
                encoding="utf-8",
            )
        else:
            handler = logging.FileHandler(self.audit_file, encoding="utf-8")

        # JSON formatter for structured logs
        formatter = logging.Formatter("%(message)s")
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)

    def close(self) -> None:
        """
        Close all file handlers to release file locks.

        Important for Windows compatibility where open file handles
        prevent file deletion.
        """
        for handler in self.logger.handlers[:]:
            handler.close()
            self.logger.removeHandler(handler)

    def _filter_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Filter sensitive data from dictionary.

        Args:
            data: Dictionary potentially containing sensitive data

        Returns:
            Dictionary with sensitive values redacted
        """
        if not data:
            return data

        filtered = {}
        for key, value in data.items():
            key_lower = key.lower()

            # Check if key contains sensitive pattern
            if any(pattern in key_lower for pattern in self.SENSITIVE_PATTERNS):
                filtered[key] = "[REDACTED]"
            elif isinstance(value, dict):
                filtered[key] = self._filter_sensitive_data(value)  # type: ignore[assignment]
            elif isinstance(value, str) and len(value) > 20:
                # Redact long strings that might be tokens
                if any(pattern in key_lower for pattern in ["key", "token", "secret"]):
                    filtered[key] = f"{value[:8]}...[REDACTED]"
                else:
                    filtered[key] = value
            else:
                filtered[key] = value

        return filtered

    def log_event(self, event: AuditEvent) -> None:
        """
        Log an audit event.

        Args:
            event: AuditEvent to log
        """
        # Filter sensitive data from details
        if event.details:
            event.details = self._filter_sensitive_data(event.details)

        # Write JSON line
        self.logger.info(event.to_json())

    def log_file_operation(
        self,
        action: str,
        file_path: str,
        success: bool,
        user: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        """
        Log a file operation (read, write, delete).

        Args:
            action: Operation type (read, write, delete)
            file_path: Path to file
            success: Whether operation succeeded
            user: User performing operation
            details: Additional context
            error: Error message if failed
        """
        category_map = {
            "read": AuditCategory.FILE_READ,
            "write": AuditCategory.FILE_WRITE,
            "delete": AuditCategory.FILE_DELETE,
        }

        event_details = details or {}
        if error:
            event_details["error"] = error

        event = AuditEvent(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            category=category_map.get(action, AuditCategory.FILE_WRITE).value,
            action=action,
            resource=file_path,
            result="success" if success else "failure",
            severity=(
                AuditSeverity.INFO.value if success else AuditSeverity.WARNING.value
            ),
            user=user,
            details=event_details if event_details else None,
        )

        self.log_event(event)

    def log_command_execution(
        self,
        command: str,
        success: bool,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        exit_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        """
        Log a command execution.

        Args:
            command: Command that was executed
            success: Whether command succeeded
            user: User executing command
            cwd: Working directory
            exit_code: Command exit code
            details: Additional context
            error: Error message if failed
        """
        event_details = details or {}
        if cwd:
            event_details["cwd"] = cwd
        if exit_code is not None:
            event_details["exit_code"] = exit_code
        if error:
            event_details["error"] = error

        event = AuditEvent(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            category=AuditCategory.COMMAND_EXEC.value,
            action="execute",
            resource=command,
            result="success" if success else "failure",
            severity=(
                AuditSeverity.INFO.value if success else AuditSeverity.WARNING.value
            ),
            user=user,
            details=event_details if event_details else None,
        )

        self.log_event(event)

    def log_api_call(
        self,
        api_name: str,
        endpoint: str,
        success: bool,
        user: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        """
        Log an API call.

        Args:
            api_name: Name of API (GitHub, ClickUp, etc.)
            endpoint: API endpoint called
            success: Whether call succeeded
            user: User making call
            status_code: HTTP status code
            details: Additional context
            error: Error message if failed
        """
        event_details = details or {}
        if status_code:
            event_details["status_code"] = status_code
        if error:
            event_details["error"] = error

        event = AuditEvent(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            category=AuditCategory.API_CALL.value,
            action=api_name,
            resource=endpoint,
            result="success" if success else "failure",
            severity=(
                AuditSeverity.INFO.value if success else AuditSeverity.WARNING.value
            ),
            user=user,
            details=event_details if event_details else None,
        )

        self.log_event(event)

    def log_access_denied(
        self,
        resource: str,
        reason: str,
        user: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log an access denied event.

        Args:
            resource: Resource that was denied
            reason: Reason for denial
            user: User who was denied
            details: Additional context
        """
        event_details = details or {}
        event_details["reason"] = reason

        event = AuditEvent(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            category=AuditCategory.ACCESS_DENIED.value,
            action="denied",
            resource=resource,
            result="failure",
            severity=AuditSeverity.WARNING.value,
            user=user,
            details=event_details if event_details else None,
        )

        self.log_event(event)

    def log_config_change(
        self,
        key: str,
        old_value: Optional[str],
        new_value: str,
        user: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log a configuration change.

        Args:
            key: Configuration key changed
            old_value: Previous value
            new_value: New value
            user: User making change
            details: Additional context
        """
        event_details = details or {}
        event_details["old_value"] = old_value
        event_details["new_value"] = new_value

        event = AuditEvent(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            category=AuditCategory.CONFIG_CHANGE.value,
            action="update",
            resource=key,
            result="success",
            severity=AuditSeverity.INFO.value,
            user=user,
            details=event_details if event_details else None,
        )

        self.log_event(event)

    def search_logs(
        self,
        category: Optional[str] = None,
        user: Optional[str] = None,
        resource: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Search audit logs with filters.

        Args:
            category: Filter by category
            user: Filter by user
            resource: Filter by resource (partial match)
            start_date: Filter by start date
            end_date: Filter by end date
            limit: Maximum results to return

        Returns:
            List of matching audit events
        """
        results: List[Dict[str, Any]] = []

        if not self.audit_file.exists():
            return results

        try:
            with open(self.audit_file, "r", encoding="utf-8") as f:
                for line in f:
                    if len(results) >= limit:
                        break

                    try:
                        event = json.loads(line.strip())

                        # Apply filters
                        if category and event.get("category") != category:
                            continue

                        if user and event.get("user") != user:
                            continue

                        if resource and resource not in event.get("resource", ""):
                            continue

                        if start_date or end_date:
                            event_time = datetime.fromisoformat(
                                event["timestamp"].replace("Z", "+00:00")
                            )
                            if start_date and event_time < start_date:
                                continue
                            if end_date and event_time > end_date:
                                continue

                        results.append(event)

                    except json.JSONDecodeError:
                        continue

        except Exception as e:
            logger.error(f"Error searching audit logs: {e}")

        return results

    def get_summary(self, days: int = 7) -> Dict[str, Any]:
        """
        Get summary statistics for recent audit logs.

        Args:
            days: Number of days to summarize

        Returns:
            Dictionary with summary statistics
        """
        cutoff = datetime.now(timezone.utc).timestamp() - (days * 86400)

        stats: Dict[str, Any] = {
            "total_events": 0,
            "by_category": {},
            "by_result": {"success": 0, "failure": 0},
            "by_severity": {},
            "top_users": {},
            "recent_failures": [],
        }

        if not self.audit_file.exists():
            return stats

        try:
            with open(self.audit_file, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        event = json.loads(line.strip())

                        # Check if within time range
                        event_time = datetime.fromisoformat(
                            event["timestamp"].replace("Z", "+00:00")
                        ).timestamp()

                        if event_time < cutoff:
                            continue

                        stats["total_events"] += 1

                        # Count by category
                        category = event.get("category", "unknown")
                        stats["by_category"][category] = (
                            stats["by_category"].get(category, 0) + 1
                        )

                        # Count by result
                        result = event.get("result", "unknown")
                        if result in stats["by_result"]:
                            stats["by_result"][result] += 1

                        # Count by severity
                        severity = event.get("severity", "unknown")
                        stats["by_severity"][severity] = (
                            stats["by_severity"].get(severity, 0) + 1
                        )

                        # Count by user
                        user = event.get("user")
                        if user:
                            stats["top_users"][user] = (
                                stats["top_users"].get(user, 0) + 1
                            )

                        # Track recent failures
                        if result == "failure" and len(stats["recent_failures"]) < 10:
                            stats["recent_failures"].append(
                                {
                                    "timestamp": event["timestamp"],
                                    "category": category,
                                    "resource": event.get("resource"),
                                    "error": event.get("details", {}).get("error"),
                                }
                            )

                    except (json.JSONDecodeError, KeyError):
                        continue

        except Exception as e:
            logger.error(f"Error generating audit summary: {e}")

        return stats


# Global audit logger instance
_audit_logger: Optional[AuditLogger] = None


def get_auditor() -> AuditLogger:
    """
    Get the global audit logger instance.

    Returns:
        Global AuditLogger instance
    """
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


def init_auditor(
    log_dir: Optional[str] = None,
    max_bytes: int = 10 * 1024 * 1024,
    backup_count: int = 5,
) -> AuditLogger:
    """
    Initialize the global audit logger.

    Args:
        log_dir: Directory for audit logs
        max_bytes: Maximum size per log file
        backup_count: Number of backup files

    Returns:
        Initialized AuditLogger instance
    """
    global _audit_logger
    _audit_logger = AuditLogger(log_dir, max_bytes, backup_count)
    return _audit_logger
