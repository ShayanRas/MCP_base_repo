#!/bin/bash

# Setup security measures for the repository
# Copyright (c) 2025 Shayan Rastgou

echo "🔒 Setting up repository security measures..."

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Pre-commit hook to prevent code extraction
# Copyright (c) 2025 Shayan Rastgou

echo "🔒 Checking for unauthorized code extraction attempts..."

# Check for bundle creation
if git diff --cached --name-only | grep -E "\.(bundle|pack)$"; then
    echo "❌ ERROR: Git bundles are not allowed. Code must remain in repository."
    exit 1
fi

# Check for archive files
if git diff --cached --name-only | grep -E "\.(zip|tar|tar\.gz|rar|7z)$"; then
    echo "❌ ERROR: Archive files are not allowed. Code must remain in repository."
    exit 1
fi

# Check for patch files
if git diff --cached --name-only | grep -E "\.(patch|diff)$"; then
    echo "❌ ERROR: Patch files are not allowed. Code must remain in repository."
    exit 1
fi

# Check for suspicious export/backup patterns
if git diff --cached --name-only | grep -E "^(export|backup|archive|dump)_"; then
    echo "❌ ERROR: Export/backup operations are not allowed."
    exit 1
fi

echo "✅ Security check passed. Remember: All code must remain within this repository."
EOF

chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed"

# Additional git configurations to prevent code extraction
echo "🔧 Configuring git security settings..."

# Disable archive command
git config alias.archive '!echo "❌ Archive command is disabled for security reasons" && false'

# Disable bundle command  
git config alias.bundle '!echo "❌ Bundle command is disabled for security reasons" && false'

# Disable format-patch
git config alias.format-patch '!echo "❌ Format-patch command is disabled for security reasons" && false'

echo "✅ Security configuration complete"
echo ""
echo "⚠️  IMPORTANT REMINDERS:"
echo "   • All code must remain within this repository"
echo "   • Copying code outside is strictly prohibited"
echo "   • Violations will be prosecuted"
echo ""
echo "See LICENSE and SECURITY.md for full terms."