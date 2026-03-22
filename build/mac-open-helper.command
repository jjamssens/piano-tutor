#!/bin/bash
# Piano Tutor — Mac Security Unblock Helper
# Double-click this file if macOS says "Piano Tutor can't be opened
# because it is from an unidentified developer."
#
# It removes the quarantine flag that macOS adds to downloaded apps,
# then opens Piano Tutor normally.

APP="/Applications/Piano Tutor.app"

if [ -d "$APP" ]; then
  echo "Removing macOS quarantine flag from Piano Tutor..."
  xattr -dr com.apple.quarantine "$APP" 2>/dev/null
  echo "Done. Opening Piano Tutor..."
  open "$APP"
else
  osascript -e 'display alert "Piano Tutor Not Found" message "Please drag Piano Tutor to your Applications folder first, then run this script."'
fi
