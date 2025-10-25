#!/usr/bin/env python3
"""
Test API key authentication
"""
import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def test_local_server():
    """Test local server API key authentication"""
    print("🧪 Testing Local Server Authentication...")

    api_key = os.getenv("MY_SERVER_API_KEY")
    base_url = "http://127.0.0.1:8000"

    # Test 1: Health endpoint (no auth required)
    print("\n1. Testing health endpoint (no auth)...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test 2: MCP endpoint without API key (should fail)
    print("\n2. Testing MCP endpoint without API key...")
    try:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
        response = requests.post(f"{base_url}/", json=payload, timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test 3: MCP endpoint with API key (should work)
    print("\n3. Testing MCP endpoint with API key...")
    try:
        headers = {"X-API-Key": api_key}
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
        response = requests.post(
            f"{base_url}/", json=payload, headers=headers, timeout=5
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            tools_count = len(data.get("result", {}).get("tools", []))
            print(f"   ✅ Success! Found {tools_count} tools")
        else:
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")


def test_remote_server():
    """Test remote server API key authentication"""
    print("\n🌐 Testing Remote Server Authentication...")

    api_key = os.getenv("MY_SERVER_API_KEY")
    base_url = "https://mcp.deejpotter.com"

    # Test health endpoint
    print("\n1. Testing remote health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test with API key
    print("\n2. Testing remote MCP endpoint with API key...")
    try:
        headers = {"X-API-Key": api_key}
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
        response = requests.post(
            f"{base_url}/", json=payload, headers=headers, timeout=10
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            tools_count = len(data.get("result", {}).get("tools", []))
            print(f"   ✅ Remote server authenticated! Found {tools_count} tools")
        else:
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")


if __name__ == "__main__":
    print("🔑 API Key Authentication Test")
    print("=" * 50)

    api_key = os.getenv("MY_SERVER_API_KEY")
    if not api_key:
        print("❌ API key not found in environment!")
        exit(1)

    print(f"Using API key: {api_key[:8]}...{api_key[-8:]}")

    # Test local server first
    test_local_server()

    # Test remote server
    test_remote_server()

    print("\n" + "=" * 50)
    print("🎯 Next steps:")
    print("1. If local tests work, rebuild and deploy your Docker container")
    print("2. If remote tests fail, you need to update your deployed server")
    print("3. Make sure .env file is copied to your server deployment")
