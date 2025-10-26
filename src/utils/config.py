"""
Configuration Management System
Created: 26/10/25
By: Daniel Potter

Centralized configuration management with support for multiple sources,
validation, type conversion, and defaults. Provides a clean interface
for accessing configuration throughout the application.

Features:
- Multiple config sources (.env, config files, environment variables)
- Type conversion and validation
- Default values with overrides
- Schema-based validation
- Configuration reloading without restart

References:
Python dotenv: https://github.com/theskumar/python-dotenv
Pydantic Settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
"""

import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Type, TypeVar, cast, Callable
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class ConfigValue:
    """
    Represents a single configuration value with metadata.

    Attributes:
        value: The actual configuration value
        source: Where the value came from (env, file, default)
        required: Whether this value is required
        description: Human-readable description
    """

    value: Any
    source: str
    required: bool = False
    description: str = ""


@dataclass
class ConfigSchema:
    """
    Schema for a configuration value with validation rules.

    Attributes:
        key: Configuration key name
        value_type: Expected Python type
        default: Default value if not provided
        required: Whether this config is required
        description: Human-readable description
        validator: Optional custom validation function
        env_var: Environment variable name (defaults to key in uppercase)
    """

    key: str
    value_type: Type
    default: Any = None
    required: bool = False
    description: str = ""
    validator: Optional[Callable[[Any], bool]] = None
    env_var: Optional[str] = None

    def __post_init__(self) -> None:
        """Set default env_var if not provided"""
        if self.env_var is None:
            self.env_var = self.key.upper()


class ConfigManager:
    """
    Centralized configuration management system.

    Supports multiple configuration sources with priority:
    1. Environment variables (highest priority)
    2. Configuration file
    3. Default values (lowest priority)

    Usage:
        config = ConfigManager()
        config.register_schema([
            ConfigSchema('api_key', str, required=True, description='API key'),
            ConfigSchema('timeout', int, default=30, description='Request timeout'),
        ])

        api_key = config.get('api_key')
        timeout = config.get_int('timeout', default=30)
    """

    def __init__(
        self,
        config_file: Optional[Union[str, Path]] = None,
        schema: Optional[List[ConfigSchema]] = None,
    ):
        """
        Initialize configuration manager.

        Args:
            config_file: Optional path to JSON configuration file
            schema: Optional list of configuration schemas
        """
        self._config: Dict[str, ConfigValue] = {}
        self._schema: Dict[str, ConfigSchema] = {}
        self._config_file: Optional[Path] = Path(config_file) if config_file else None

        # Load configuration from file if provided
        if self._config_file and self._config_file.exists():
            self._load_from_file()

        # Register schema if provided
        if schema:
            self.register_schema(schema)

    def register_schema(self, schemas: List[ConfigSchema]) -> None:
        """
        Register configuration schema for validation.

        Args:
            schemas: List of ConfigSchema objects defining expected configuration
        """
        for schema_item in schemas:
            self._schema[schema_item.key] = schema_item

            # Load value from environment or use default
            value = self._load_value(schema_item)
            if value is not None or schema_item.required:
                self._set_config_value(
                    schema_item.key,
                    value,
                    "schema_default" if value == schema_item.default else "environment",
                )

    def _load_value(self, schema: ConfigSchema) -> Any:
        """Load value from environment or return default"""
        env_value = os.getenv(schema.env_var or schema.key.upper())

        if env_value is not None:
            # Convert string to appropriate type
            try:
                return self._convert_type(env_value, schema.value_type)
            except (ValueError, TypeError) as e:
                logger.warning(
                    f"Failed to convert {schema.key} from env: {e}. Using default."
                )
                return schema.default

        return schema.default

    def _convert_type(self, value: str, target_type: Type[T]) -> T:
        """
        Convert string value to target type.

        Args:
            value: String value to convert
            target_type: Target Python type

        Returns:
            Converted value
        """
        if target_type == bool:
            return cast(T, value.lower() in ("true", "1", "yes", "on"))
        elif target_type == int:
            return cast(T, int(value))
        elif target_type == float:
            return cast(T, float(value))
        elif target_type == list:
            # Handle comma-separated lists
            return cast(T, [item.strip() for item in value.split(",") if item.strip()])
        else:
            return cast(T, value)

    def _load_from_file(self) -> None:
        """Load configuration from JSON file"""
        if not self._config_file or not self._config_file.exists():
            return

        try:
            with open(self._config_file, "r") as f:
                data = json.load(f)

            for key, value in data.items():
                self._set_config_value(key, value, "config_file")

            logger.info(f"Loaded configuration from {self._config_file}")
        except Exception as e:
            logger.error(f"Failed to load config file: {e}")

    def _set_config_value(self, key: str, value: Any, source: str) -> None:
        """Set a configuration value with metadata"""
        # Check if we have schema for this key
        schema = self._schema.get(key)

        # Validate if schema exists
        if schema:
            # Custom validation
            if schema.validator is not None and not schema.validator(value):
                raise ValueError(f"Validation failed for {key}: {value}")

            # Type validation
            if not isinstance(value, schema.value_type) and value is not None:
                try:
                    value = self._convert_type(str(value), schema.value_type)
                except (ValueError, TypeError) as e:
                    raise TypeError(
                        f"Config key '{key}' expects {schema.value_type.__name__}, "
                        f"got {type(value).__name__}: {e}"
                    )

        self._config[key] = ConfigValue(
            value=value,
            source=source,
            required=schema.required if schema else False,
            description=schema.description if schema else "",
        )

    def get(self, key: str, default: Optional[Any] = None) -> Any:
        """
        Get configuration value by key.

        Args:
            key: Configuration key
            default: Default value if key not found

        Returns:
            Configuration value or default
        """
        config_value = self._config.get(key)
        if config_value is not None:
            return config_value.value

        # Check environment variable as fallback
        env_var = key.upper()
        env_value = os.getenv(env_var)
        if env_value is not None:
            return env_value

        # Check schema for default
        schema = self._schema.get(key)
        if schema and schema.default is not None:
            return schema.default

        return default

    def get_str(self, key: str, default: str = "") -> str:
        """Get string configuration value"""
        value = self.get(key, default)
        return str(value) if value is not None else default

    def get_int(self, key: str, default: int = 0) -> int:
        """Get integer configuration value"""
        value = self.get(key, default)
        if isinstance(value, int):
            return value
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def get_float(self, key: str, default: float = 0.0) -> float:
        """Get float configuration value"""
        value = self.get(key, default)
        if isinstance(value, float):
            return value
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    def get_bool(self, key: str, default: bool = False) -> bool:
        """Get boolean configuration value"""
        value = self.get(key, default)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes", "on")
        return bool(value)

    def get_list(self, key: str, default: Optional[List[str]] = None) -> List[str]:
        """Get list configuration value (comma-separated string)"""
        value = self.get(key)
        if value is None:
            return default or []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return default or []

    def set(self, key: str, value: Any) -> None:
        """
        Set configuration value programmatically.

        Args:
            key: Configuration key
            value: Value to set
        """
        self._set_config_value(key, value, "programmatic")

    def reload(self) -> None:
        """Reload configuration from all sources"""
        self._config.clear()

        # Reload from file
        if self._config_file:
            self._load_from_file()

        # Re-register schema to load from environment
        if self._schema:
            schema_list = list(self._schema.values())
            self._schema.clear()
            self.register_schema(schema_list)

    def validate(self) -> List[str]:
        """
        Validate all required configuration is present.

        Returns:
            List of missing required keys
        """
        missing = []
        for key, schema in self._schema.items():
            if schema.required:
                value = self.get(key)
                if value is None:
                    missing.append(f"{key} ({schema.description or 'no description'})")
        return missing

    def get_all(self) -> Dict[str, Any]:
        """
        Get all configuration as dictionary.

        Returns:
            Dictionary of all configuration values
        """
        return {key: config.value for key, config in self._config.items()}

    def get_info(self, key: str) -> Optional[ConfigValue]:
        """
        Get configuration value with metadata.

        Args:
            key: Configuration key

        Returns:
            ConfigValue with metadata or None
        """
        return self._config.get(key)

    def __repr__(self) -> str:
        """String representation of configuration"""
        lines = ["ConfigManager:"]
        for key, config in sorted(self._config.items()):
            lines.append(f"  {key}: {config.value} (from: {config.source})")
        return "\n".join(lines)


# Global configuration manager instance
_config_manager: Optional[ConfigManager] = None


def get_config() -> ConfigManager:
    """
    Get the global configuration manager instance.

    Returns:
        Global ConfigManager instance
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def init_config(
    config_file: Optional[Union[str, Path]] = None,
    schema: Optional[List[ConfigSchema]] = None,
) -> ConfigManager:
    """
    Initialize the global configuration manager.

    Args:
        config_file: Optional path to configuration file
        schema: Optional configuration schema

    Returns:
        Initialized ConfigManager instance
    """
    global _config_manager
    _config_manager = ConfigManager(config_file, schema)
    return _config_manager
