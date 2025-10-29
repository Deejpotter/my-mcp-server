import pytest
from tools import get_all_tools

# Example: Test that get_all_tools returns a non-empty list


def test_get_all_tools_returns_tools():
    result = get_all_tools()
    assert isinstance(result, list)
    assert len(result) > 0
