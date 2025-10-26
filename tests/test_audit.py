"""
Tests for Audit Logging System
Created: 26/10/25
"""

import json
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
import pytest

from src.utils.audit import (
    AuditLogger,
    AuditEvent,
    AuditCategory,
    AuditSeverity,
    get_auditor,
    init_auditor,
)


class TestAuditEvent:
    """Test AuditEvent dataclass"""

    def test_event_creation(self):
        """Test creating an audit event"""
        event = AuditEvent(
            timestamp="2025-10-26T10:00:00Z",
            category="file_write",
            action="write",
            resource="/path/to/file",
            result="success",
            severity="info",
            user="test_user",
        )

        assert event.timestamp == "2025-10-26T10:00:00Z"
        assert event.category == "file_write"
        assert event.user == "test_user"

    def test_event_to_dict(self):
        """Test converting event to dictionary"""
        event = AuditEvent(
            timestamp="2025-10-26T10:00:00Z",
            category="file_write",
            action="write",
            resource="/path/to/file",
            result="success",
            severity="info",
        )

        d = event.to_dict()
        assert "timestamp" in d
        assert "category" in d
        assert d["result"] == "success"

    def test_event_to_json(self):
        """Test converting event to JSON"""
        event = AuditEvent(
            timestamp="2025-10-26T10:00:00Z",
            category="file_write",
            action="write",
            resource="/path/to/file",
            result="success",
            severity="info",
        )

        json_str = event.to_json()
        parsed = json.loads(json_str)
        assert parsed["category"] == "file_write"


class TestAuditLogger:
    """Test AuditLogger functionality"""

    @pytest.fixture
    def temp_log_dir(self):
        """Create temporary log directory"""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def auditor(self, temp_log_dir):
        """Create AuditLogger with temporary directory"""
        auditor = AuditLogger(log_dir=temp_log_dir, enable_rotation=False)
        yield auditor
        # Close file handlers to release file locks on Windows
        auditor.close()

    def test_logger_initialization(self, temp_log_dir):
        """Test initializing audit logger"""
        auditor = AuditLogger(log_dir=temp_log_dir)

        assert auditor.log_dir.exists()
        assert auditor.audit_file.exists()

        # Close to release file locks
        auditor.close()

    def test_sensitive_data_filtering(self, auditor):
        """Test that sensitive data is redacted"""
        data = {
            "username": "test_user",
            "password": "secret123",
            "api_key": "sk_test_1234567890",
            "normal_field": "value",
        }

        filtered = auditor._filter_sensitive_data(data)

        assert filtered["username"] == "test_user"
        assert filtered["password"] == "[REDACTED]"
        assert filtered["api_key"] == "[REDACTED]"
        assert filtered["normal_field"] == "value"

    def test_nested_sensitive_data_filtering(self, auditor):
        """Test filtering nested sensitive data"""
        data = {
            "config": {"username": "test", "token": "secret_token", "other": "value"}
        }

        filtered = auditor._filter_sensitive_data(data)

        assert filtered["config"]["username"] == "test"
        assert filtered["config"]["token"] == "[REDACTED]"
        assert filtered["config"]["other"] == "value"

    def test_log_file_operation(self, auditor):
        """Test logging file operations"""
        auditor.log_file_operation(
            action="write",
            file_path="/test/file.txt",
            success=True,
            user="test_user",
            details={"size": 1024},
        )

        # Read log file
        with open(auditor.audit_file, "r") as f:
            line = f.readline()
            event = json.loads(line)

        assert event["category"] == "file_write"
        assert event["resource"] == "/test/file.txt"
        assert event["result"] == "success"
        assert event["user"] == "test_user"
        assert event["details"]["size"] == 1024

    def test_log_command_execution(self, auditor):
        """Test logging command executions"""
        auditor.log_command_execution(
            command="git status",
            success=True,
            user="test_user",
            cwd="/repo",
            exit_code=0,
        )

        with open(auditor.audit_file, "r") as f:
            line = f.readline()
            event = json.loads(line)

        assert event["category"] == "command_exec"
        assert event["resource"] == "git status"
        assert event["details"]["cwd"] == "/repo"
        assert event["details"]["exit_code"] == 0

    def test_log_api_call(self, auditor):
        """Test logging API calls"""
        auditor.log_api_call(
            api_name="GitHub",
            endpoint="/repos/test/repo",
            success=True,
            status_code=200,
        )

        with open(auditor.audit_file, "r") as f:
            line = f.readline()
            event = json.loads(line)

        assert event["category"] == "api_call"
        assert event["action"] == "GitHub"
        assert event["resource"] == "/repos/test/repo"
        assert event["details"]["status_code"] == 200

    def test_log_access_denied(self, auditor):
        """Test logging access denied events"""
        auditor.log_access_denied(
            resource="/secure/file.txt",
            reason="Insufficient permissions",
            user="test_user",
        )

        with open(auditor.audit_file, "r") as f:
            line = f.readline()
            event = json.loads(line)

        assert event["category"] == "access_denied"
        assert event["result"] == "failure"
        assert event["severity"] == "warning"
        assert event["details"]["reason"] == "Insufficient permissions"

    def test_log_config_change(self, auditor):
        """Test logging configuration changes"""
        auditor.log_config_change(
            key="timeout", old_value="30", new_value="60", user="admin"
        )

        with open(auditor.audit_file, "r") as f:
            line = f.readline()
            event = json.loads(line)

        assert event["category"] == "config_change"
        assert event["resource"] == "timeout"
        assert event["details"]["old_value"] == "30"
        assert event["details"]["new_value"] == "60"

    def test_search_logs_by_category(self, auditor):
        """Test searching logs by category"""
        # Log multiple events
        auditor.log_file_operation("write", "/file1.txt", True)
        auditor.log_file_operation("read", "/file2.txt", True)
        auditor.log_command_execution("git status", True)

        # Search for file operations
        results = auditor.search_logs(category="file_write")

        assert len(results) >= 1
        assert results[0]["category"] == "file_write"

    def test_search_logs_by_user(self, auditor):
        """Test searching logs by user"""
        auditor.log_file_operation("write", "/file1.txt", True, user="alice")
        auditor.log_file_operation("write", "/file2.txt", True, user="bob")

        results = auditor.search_logs(user="alice")

        assert len(results) >= 1
        assert results[0]["user"] == "alice"

    def test_search_logs_by_resource(self, auditor):
        """Test searching logs by resource"""
        auditor.log_file_operation("write", "/test/file1.txt", True)
        auditor.log_file_operation("write", "/other/file2.txt", True)

        results = auditor.search_logs(resource="/test/")

        assert len(results) >= 1
        assert "/test/" in results[0]["resource"]

    def test_search_logs_with_limit(self, auditor):
        """Test search limit"""
        # Log many events
        for i in range(20):
            auditor.log_file_operation("write", f"/file{i}.txt", True)

        results = auditor.search_logs(limit=5)

        assert len(results) == 5

    def test_get_summary(self, auditor):
        """Test getting audit summary"""
        # Log various events
        auditor.log_file_operation("write", "/file1.txt", True, user="alice")
        auditor.log_file_operation("read", "/file2.txt", True, user="alice")
        auditor.log_command_execution("git status", False, error="Not a git repo")
        auditor.log_api_call("GitHub", "/repos/test", True, status_code=200)

        summary = auditor.get_summary(days=1)

        assert summary["total_events"] >= 4
        assert "file_write" in summary["by_category"]
        assert summary["by_result"]["success"] >= 3
        assert summary["by_result"]["failure"] >= 1
        assert "alice" in summary["top_users"]
        assert len(summary["recent_failures"]) >= 1

    def test_multiple_log_entries(self, auditor):
        """Test logging multiple entries"""
        for i in range(10):
            auditor.log_file_operation(
                "write",
                f"/file{i}.txt",
                success=(i % 2 == 0),  # Alternate success/failure
                user=f"user{i % 3}",  # 3 different users
            )

        # Verify all entries were logged
        with open(auditor.audit_file, "r") as f:
            lines = f.readlines()

        assert len(lines) == 10

        # Verify structure
        for line in lines:
            event = json.loads(line)
            assert "timestamp" in event
            assert "category" in event
            assert "result" in event

    def test_log_with_error(self, auditor):
        """Test logging operations with errors"""
        auditor.log_file_operation(
            action="write",
            file_path="/protected/file.txt",
            success=False,
            error="Permission denied",
        )

        with open(auditor.audit_file, "r") as f:
            line = f.readline()
            event = json.loads(line)

        assert event["result"] == "failure"
        assert event["severity"] == "warning"
        assert event["details"]["error"] == "Permission denied"


class TestGlobalAuditor:
    """Test global auditor functions"""

    def test_get_auditor_singleton(self):
        """Test that get_auditor returns same instance"""
        auditor1 = get_auditor()
        auditor2 = get_auditor()

        assert auditor1 is auditor2

    def test_init_auditor(self):
        """Test initializing global auditor"""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = init_auditor(log_dir=tmpdir)

            assert auditor.log_dir == Path(tmpdir)

            # get_auditor should return the same instance
            assert get_auditor() is auditor

            # Close to release file locks
            auditor.close()


class TestAuditEnums:
    """Test audit enumerations"""

    def test_audit_category_values(self):
        """Test AuditCategory enum values"""
        assert AuditCategory.FILE_READ.value == "file_read"
        assert AuditCategory.FILE_WRITE.value == "file_write"
        assert AuditCategory.COMMAND_EXEC.value == "command_exec"
        assert AuditCategory.API_CALL.value == "api_call"
        assert AuditCategory.ACCESS_DENIED.value == "access_denied"

    def test_audit_severity_values(self):
        """Test AuditSeverity enum values"""
        assert AuditSeverity.INFO.value == "info"
        assert AuditSeverity.WARNING.value == "warning"
        assert AuditSeverity.ERROR.value == "error"
        assert AuditSeverity.CRITICAL.value == "critical"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
