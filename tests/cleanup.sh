#!/usr/bin/env bash
# Remove test conversations created by the harness (anything containing the
# TEST-HARNESS marker). Leaves real customer conversations untouched.
set -uo pipefail
cd /opt/chatwoot
docker compose exec -T rails bundle exec rails runner '
ids = Message.where("content LIKE ?", "%TEST-HARNESS%").pluck(:conversation_id).uniq
convs = Conversation.where(id: ids)
n = convs.count
convs.find_each(&:destroy)
puts "removed #{n} test conversations"
' 2>&1 | grep -E "removed"
