#!/bin/bash

# 🔒 Explicit absolute path to context.md
TARGET="/Users/thefinalmachine/dev/Project_X/gasX_invivo_v1.125/project/.claude/context.md"

# Safety check to prevent overwriting
if [ ! -f "$TARGET" ]; then
  echo "🛑 ERROR: $TARGET does not exist. Aborting to prevent overwrite."
  exit 1
fi

echo "🧠 Add new feature line items to $TARGET"

while true; do
  read -p "➕ Feature item (or 'done'): " ITEM
  if [[ "$ITEM" == "done" ]]; then
    echo "✅ Done adding items."
    break
  fi
  echo "- [ ] $ITEM" >> "$TARGET"
done

echo "📝 Updated context file with new items."
