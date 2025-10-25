#!/usr/bin/env python3
"""
Test script to verify API key configuration
"""
import os
from dotenv import load_dotenv


def test_api_key_loading():
    """Test if the API key loads correctly from .env file"""
    print("🧪 Testing API Key Configuration...")

    # Load environment variables
    load_dotenv()

    # Check if API key exists
    api_key = os.getenv("MY_SERVER_API_KEY")

    if api_key:
        print(f"✅ API Key found: {api_key[:8]}...{api_key[-8:]} (masked)")
        print(f"📏 Key length: {len(api_key)} characters")

        # Verify it matches expected format (should be 64 chars hex)
        if len(api_key) == 64 and all(c in "0123456789abcdef" for c in api_key.lower()):
            print("✅ API key format looks correct (64-char hex)")
        else:
            print("⚠️  API key format might be incorrect")

        return api_key
    else:
        print("❌ API Key not found in environment variables")
        print("🔍 Available environment variables:")
        for key in sorted(os.environ.keys()):
            if any(
                keyword in key.upper() for keyword in ["KEY", "TOKEN", "SECRET", "API"]
            ):
                value = os.environ[key]
                print(
                    f"   {key}: {value[:8]}...{value[-4:] if len(value) > 12 else value}"
                )
        return None


def test_other_tokens():
    """Test other API tokens configuration"""
    print("\n🔑 Testing Other API Tokens...")

    tokens = {
        "GITHUB_TOKEN": "GitHub API Token",
        "CLICKUP_API_TOKEN": "ClickUp API Token",
        "BOOKSTACK_TOKEN_ID": "BookStack Token ID",
        "BOOKSTACK_TOKEN_SECRET": "BookStack Token Secret",
    }

    for token_name, description in tokens.items():
        token_value = os.getenv(token_name)
        if (
            token_value
            and not token_value.startswith("pk_your_")
            and not token_value.startswith("ghp_your_")
        ):
            print(f"✅ {description}: Found")
        else:
            print(f"⚠️  {description}: Not configured (using placeholder)")


if __name__ == "__main__":
    api_key = test_api_key_loading()
    test_other_tokens()

    if api_key:
        print(f"\n🎯 Ready to test! Your API key is properly loaded.")
        print(f"💡 Next steps:")
        print(f"   1. Test local server: python main.py --transport stdio")
        print(f"   2. Test remote server: curl with API key")
        print(f"   3. Test via VS Code/Copilot")
    else:
        print(f"\n❌ Fix the API key loading before proceeding.")
