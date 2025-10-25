#!/usr/bin/env python3
"""
Generate secure API keys for MCP server
"""

import secrets
import os


def generate_keys():
    """Generate secure API keys and save to .env file"""

    print("🔐 Generating secure API keys for MCP server...")

    # Generate secure keys
    admin_key = secrets.token_urlsafe(32)
    user_key = secrets.token_urlsafe(32)
    public_key = secrets.token_urlsafe(32)

    # Display keys
    print("\n📋 Generated API Keys:")
    print(f"Admin Key:  {admin_key}")
    print(f"User Key:   {user_key}")
    print(f"Public Key: {public_key}")

    # Save to .env file
    env_content = f"""# MCP Server Security Configuration
# Generated on {datetime.now().isoformat()}

# API Keys - Keep these secure!
MCP_ADMIN_KEY={admin_key}
MCP_USER_KEY={user_key}
MCP_PUBLIC_KEY={public_key}

# Security Settings
MCP_RATE_LIMIT_ENABLED=true
MCP_AUDIT_LOGGING=true
MCP_SECURE_MODE=true
"""

    with open(".env", "w") as f:
        f.write(env_content)

    # Set restrictive permissions on .env file
    os.chmod(".env", 0o600)

    print(f"\n💾 Keys saved to .env file")
    print("🔒 File permissions set to 600 (owner read/write only)")

    # Create secure directories
    secure_dir = os.path.expanduser("~/secure_mcp_data")
    os.makedirs(secure_dir, exist_ok=True)
    os.chmod(secure_dir, 0o700)

    # Create sample personal data
    notes_file = os.path.join(secure_dir, "notes.txt")
    if not os.path.exists(notes_file):
        with open(notes_file, "w") as f:
            f.write(
                """# Personal Notes

This is a secure area for personal data.
Only accessible with admin API key.

## Sample Data
- Personal task: Review security setup
- Private note: MCP server is working great!
- Secure file: This data is protected by RBAC
"""
            )
        os.chmod(notes_file, 0o600)

    print(f"📁 Secure directory created at: {secure_dir}")
    print(f"📝 Sample notes created at: {notes_file}")

    # Instructions
    print(f"\n🚀 Next Steps:")
    print(f"1. Source the environment: source .env")
    print(f"2. Test with: python secure_main.py")
    print(f"3. Use admin key for personal data access")
    print(f"4. Use user key for general access")
    print(f"5. Use public key for demo/public access")

    return {"admin": admin_key, "user": user_key, "public": public_key}


if __name__ == "__main__":
    from datetime import datetime

    generate_keys()
