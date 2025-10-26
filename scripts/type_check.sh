#!/bin/bash
# Type checking script using mypy
# Run this before committing to ensure type safety

echo "🔍 Running mypy type checker..."
echo ""

uv run mypy src/ main.py --show-error-codes --pretty

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Type checking passed! No issues found."
    exit 0
else
    echo ""
    echo "❌ Type checking failed. Please fix the errors above."
    exit 1
fi
