"""
Tests for Configuration Management System
Created: 26/10/25
"""

import os
import json
import tempfile
from pathlib import Path
import pytest

from src.utils.config import ConfigManager, ConfigSchema, get_config, init_config


class TestConfigSchema:
    """Test ConfigSchema dataclass"""

    def test_schema_creation(self):
        """Test creating a configuration schema"""
        schema = ConfigSchema(
            key="api_key",
            value_type=str,
            required=True,
            description="API key for authentication",
        )

        assert schema.key == "api_key"
        assert schema.value_type == str
        assert schema.required is True
        assert schema.env_var == "API_KEY"  # Auto-generated

    def test_schema_custom_env_var(self):
        """Test schema with custom environment variable name"""
        schema = ConfigSchema(key="timeout", value_type=int, env_var="CUSTOM_TIMEOUT")

        assert schema.env_var == "CUSTOM_TIMEOUT"


class TestConfigManager:
    """Test ConfigManager functionality"""

    def test_basic_get_set(self):
        """Test basic get/set operations"""
        config = ConfigManager()
        config.set("test_key", "test_value")

        assert config.get("test_key") == "test_value"
        assert config.get("nonexistent", "default") == "default"

    def test_typed_getters(self):
        """Test type-specific getters"""
        config = ConfigManager()
        config.set("str_val", "hello")
        config.set("int_val", 42)
        config.set("float_val", 3.14)
        config.set("bool_val", True)
        config.set("list_val", ["a", "b", "c"])

        assert config.get_str("str_val") == "hello"
        assert config.get_int("int_val") == 42
        assert config.get_float("float_val") == 3.14
        assert config.get_bool("bool_val") is True
        assert config.get_list("list_val") == ["a", "b", "c"]

    def test_type_conversion(self):
        """Test automatic type conversion"""
        config = ConfigManager()

        # String to int
        config.set("num_str", "123")
        assert config.get_int("num_str") == 123

        # String to bool
        config.set("bool_str", "true")
        assert config.get_bool("bool_str") is True

        # String to list
        config.set("list_str", "a,b,c")
        assert config.get_list("list_str") == ["a", "b", "c"]

    def test_schema_registration(self):
        """Test registering configuration schema"""
        config = ConfigManager()

        schemas = [
            ConfigSchema("api_key", str, required=True, description="API key"),
            ConfigSchema("timeout", int, default=30, description="Timeout in seconds"),
        ]

        config.register_schema(schemas)

        # Should have default for timeout
        assert config.get_int("timeout") == 30

    def test_schema_validation(self):
        """Test schema validation"""
        config = ConfigManager()

        schemas = [
            ConfigSchema("required_key", str, required=True),
            ConfigSchema("optional_key", str, required=False),
        ]

        config.register_schema(schemas)

        # Should report missing required key
        missing = config.validate()
        assert len(missing) > 0
        assert any("required_key" in m for m in missing)

        # Set the required key
        config.set("required_key", "value")
        missing = config.validate()
        assert len(missing) == 0

    def test_custom_validator(self):
        """Test custom validation function"""
        config = ConfigManager()

        def positive_int(value: int) -> bool:
            return isinstance(value, int) and value > 0

        schema = ConfigSchema(
            "port", int, validator=positive_int, description="Port number"
        )

        config.register_schema([schema])

        # Valid value
        config.set("port", 8080)
        assert config.get_int("port") == 8080

        # Invalid value should raise
        with pytest.raises(ValueError):
            config.set("port", -1)

    def test_config_from_file(self):
        """Test loading configuration from JSON file"""
        # Create temporary config file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            config_data = {"app_name": "test_app", "debug": True, "timeout": 60}
            json.dump(config_data, f)
            temp_file = f.name

        try:
            config = ConfigManager(config_file=temp_file)

            assert config.get("app_name") == "test_app"
            assert config.get_bool("debug") is True
            assert config.get_int("timeout") == 60
        finally:
            os.unlink(temp_file)

    def test_environment_variable_priority(self):
        """Test that environment variables have priority"""
        # Set environment variable
        os.environ["TEST_CONFIG_VAR"] = "from_env"

        try:
            config = ConfigManager()
            config.set("test_config_var", "from_code")

            # Environment variable should take precedence
            schema = ConfigSchema("test_config_var", str, env_var="TEST_CONFIG_VAR")
            config.register_schema([schema])

            assert config.get("test_config_var") == "from_env"
        finally:
            del os.environ["TEST_CONFIG_VAR"]

    def test_get_all(self):
        """Test getting all configuration as dictionary"""
        config = ConfigManager()
        config.set("key1", "value1")
        config.set("key2", 42)

        all_config = config.get_all()

        assert all_config["key1"] == "value1"
        assert all_config["key2"] == 42

    def test_get_info(self):
        """Test getting configuration with metadata"""
        config = ConfigManager()
        config.set("test_key", "test_value")

        info = config.get_info("test_key")

        assert info is not None
        assert info.value == "test_value"
        assert info.source == "programmatic"

    def test_reload(self):
        """Test reloading configuration"""
        # Create temporary config file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"key": "original"}, f)
            temp_file = f.name

        try:
            config = ConfigManager(config_file=temp_file)
            assert config.get("key") == "original"

            # Update file
            with open(temp_file, "w") as f:
                json.dump({"key": "updated"}, f)

            config.reload()
            assert config.get("key") == "updated"
        finally:
            os.unlink(temp_file)


class TestGlobalConfig:
    """Test global configuration functions"""

    def test_get_config_singleton(self):
        """Test that get_config returns same instance"""
        config1 = get_config()
        config2 = get_config()

        assert config1 is config2

    def test_init_config(self):
        """Test initializing global config with schema"""
        schemas = [ConfigSchema("test_app_key", str, default="test_value")]

        config = init_config(schema=schemas)

        assert config.get("test_app_key") == "test_value"

        # get_config should return the same instance
        assert get_config() is config


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
