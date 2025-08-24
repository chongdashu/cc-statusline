#!/bin/bash
# Unix-Prompt Theme for cc-statusline
# A compact 2-line statusline with traditional shell prompt format
# Created by: dlepold
# 
# Features:
# - Traditional user@hostname prompt
# - Compact 2-line layout (vs 3-line default)
# - Subtle grayscale colors for metrics
# - Smart number formatting (2.5M instead of 2500000)

LOG_FILE="${HOME}/.claude/statusline.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ---- logging ----
{
  echo "[$TIMESTAMP] Status line triggered with input:"
  (echo "$input" | jq . 2>/dev/null) || echo "$input"
  echo "---"
} >> "$LOG_FILE" 2>/dev/null

input=$(cat)

# ---- color helpers (force colors for Claude Code) ----
use_color=1
[ -n "$NO_COLOR" ] && use_color=0

C() { if [ "$use_color" -eq 1 ]; then printf '\033[%sm' "$1"; fi; }
RST() { if [ "$use_color" -eq 1 ]; then printf '\033[0m'; fi; }

# ---- modern sleek colors ----
dir_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;117m'; fi; }    # sky blue
model_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;147m'; fi; }  # light purple  
version_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;180m'; fi; } # soft yellow
cc_version_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;249m'; fi; } # light gray
style_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;245m'; fi; } # gray
git_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;150m'; fi; }  # soft green
rst() { if [ "$use_color" -eq 1 ]; then printf '\033[0m'; fi; }

# ---- time helpers ----
to_epoch() {
  ts="$1"
  if command -v gdate >/dev/null 2>&1; then gdate -d "$ts" +%s 2>/dev/null && return; fi
  date -u -j -f "%Y-%m-%dT%H:%M:%S%z" "${ts/Z/+0000}" +%s 2>/dev/null && return
  python3 - "$ts" <<'PY' 2>/dev/null
import sys, datetime
s=sys.argv[1].replace('Z','+00:00')
print(int(datetime.datetime.fromisoformat(s).timestamp()))
PY
}

fmt_time_hm() {
  epoch="$1"
  if date -r 0 +%s >/dev/null 2>&1; then date -r "$epoch" +"%H:%M"; else date -d "@$epoch" +"%H:%M"; fi
}

progress_bar() {
  pct="${1:-0}"; width="${2:-10}"
  [[ "$pct" =~ ^[0-9]+$ ]] || pct=0; ((pct<0))&&pct=0; ((pct>100))&&pct=100
  filled=$(( pct * width / 100 )); empty=$(( width - filled ))
  printf '%*s' "$filled" '' | tr ' ' '='
  printf '%*s' "$empty" '' | tr ' ' '-'
}

# ---- basics ----
if command -v jq >/dev/null 2>&1; then
  current_dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "unknown"' 2>/dev/null | sed "s|^$HOME|~|g")
  model_name=$(echo "$input" | jq -r '.model.display_name // "Claude"' 2>/dev/null)
  model_version=$(echo "$input" | jq -r '.model.version // ""' 2>/dev/null)
  session_id=$(echo "$input" | jq -r '.session_id // ""' 2>/dev/null)
  cc_version=$(echo "$input" | jq -r '.version // ""' 2>/dev/null)
  output_style=$(echo "$input" | jq -r '.output_style.name // ""' 2>/dev/null)
else
  current_dir="unknown"
  model_name="Claude"; model_version=""
  session_id=""
  cc_version=""
  output_style=""
fi

# ---- git ----
git_branch=""
if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
fi

# ---- context window calculation ----
context_pct=""
context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;246m'; fi; }  # light gray default

get_max_context() {
  local model_name="$1"
  case "$model_name" in
    *"Opus"*|*"opus"*) echo "200000" ;;
    *"Sonnet"*|*"sonnet"*) echo "200000" ;;
    *"Haiku"*|*"haiku"*) echo "200000" ;;
    *) echo "200000" ;;
  esac
}

if [ -n "$session_id" ] && command -v jq >/dev/null 2>&1; then
  MAX_CONTEXT=$(get_max_context "$model_name")
  project_dir=$(echo "$current_dir" | sed "s|~|$HOME|g" | sed 's|/|-|g' | sed 's|^-||')
  session_file="$HOME/.claude/projects/-${project_dir}/${session_id}.jsonl"
  
  if [ -f "$session_file" ]; then
    latest_tokens=$(tail -20 "$session_file" | jq -r 'select(.message.usage) | .message.usage | ((.input_tokens // 0) + (.cache_read_input_tokens // 0))' 2>/dev/null | tail -1)
    
    if [ -n "$latest_tokens" ] && [ "$latest_tokens" -gt 0 ]; then
      context_used_pct=$(( latest_tokens * 100 / MAX_CONTEXT ))
      context_remaining_pct=$(( 100 - context_used_pct ))
      
      # Muted colors based on remaining percentage
      if [ "$context_remaining_pct" -le 20 ]; then
        context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;244m'; fi; }
      elif [ "$context_remaining_pct" -le 40 ]; then
        context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;245m'; fi; }
      else
        context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;242m'; fi; }
      fi
      
      context_pct="${context_remaining_pct}%"
    fi
  fi
fi

# ---- subtle usage colors ----
usage_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;245m'; fi; }  # medium gray
cost_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;243m'; fi; }   # darker gray
burn_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;240m'; fi; }   # dark gray
session_color() { 
  rem_pct=$(( 100 - session_pct ))
  if   (( rem_pct <= 10 )); then SCLR='38;5;245'
  elif (( rem_pct <= 25 )); then SCLR='38;5;243'
  else                          SCLR='38;5;241'; fi
  if [ "$use_color" -eq 1 ]; then printf '\033[%sm' "$SCLR"; fi
}

# ---- ccusage integration ----
session_txt=""; session_pct=0; session_bar=""
cost_usd=""; cost_per_hour=""; tpm=""; tot_tokens=""

if command -v jq >/dev/null 2>&1; then
  blocks_output=$(npx ccusage@latest blocks --json 2>/dev/null || ccusage blocks --json 2>/dev/null)
  if [ -n "$blocks_output" ]; then
    active_block=$(echo "$blocks_output" | jq -c '.blocks[] | select(.isActive == true)' 2>/dev/null | head -n1)
    if [ -n "$active_block" ]; then
      cost_usd=$(echo "$active_block" | jq -r '.costUSD // empty')
      cost_per_hour=$(echo "$active_block" | jq -r '.burnRate.costPerHour // empty')
      tot_tokens=$(echo "$active_block" | jq -r '.totalTokens // empty')
      tpm=$(echo "$active_block" | jq -r '.burnRate.tokensPerMinute // empty')
      
      # Session time calculation
      reset_time_str=$(echo "$active_block" | jq -r '.usageLimitResetTime // .endTime // empty')
      start_time_str=$(echo "$active_block" | jq -r '.startTime // empty')
      
      if [ -n "$reset_time_str" ] && [ -n "$start_time_str" ]; then
        start_sec=$(to_epoch "$start_time_str"); end_sec=$(to_epoch "$reset_time_str"); now_sec=$(date +%s)
        total=$(( end_sec - start_sec )); (( total<1 )) && total=1
        elapsed=$(( now_sec - start_sec )); (( elapsed<0 ))&&elapsed=0; (( elapsed>total ))&&elapsed=$total
        session_pct=$(( elapsed * 100 / total ))
        remaining=$(( end_sec - now_sec )); (( remaining<0 )) && remaining=0
        rh=$(( remaining / 3600 )); rm=$(( (remaining % 3600) / 60 ))
        end_hm=$(fmt_time_hm "$end_sec")
        session_txt="$(printf '%dh %dm until reset at %s (%d%%)' "$rh" "$rm" "$end_hm" "$session_pct")"
        session_bar=$(progress_bar "$session_pct" 10)
      fi
    fi
  fi
fi

# ---- render statusline ----
# Line 1: Unix prompt + Core info
BASE=$(printf '\033[01;31m%s\033[01;33m@\033[01;36m%s \033[01;33m%s \033[01;35m$ \033[00m' \
  "$(whoami)" "$(hostname -s)" "$(pwd)")
printf '%s' "$BASE"

if [ -n "$git_branch" ]; then
  printf '🌿 %s%s%s  ' "$(git_color)" "$git_branch" "$(rst)"
fi

printf '🤖 %s%s%s' "$(model_color)" "$model_name" "$(rst)"
if [ -n "$model_version" ] && [ "$model_version" != "null" ]; then
  printf ' %s(%s)%s' "$(version_color)" "$model_version" "$(rst)"
fi

if [ -n "$cc_version" ] && [ "$cc_version" != "null" ]; then
  printf '  📟 %sv%s%s' "$(cc_version_color)" "$cc_version" "$(rst)"
fi

if [ -n "$output_style" ] && [ "$output_style" != "null" ]; then
  printf '  🎨 %s%s%s' "$(style_color)" "$output_style" "$(rst)"
fi

# Line 2: All metrics in one line
line2=""

# Context
if [ -n "$context_pct" ]; then
  context_bar=$(progress_bar "$context_remaining_pct" 10)
  line2="🧠 $(context_color)${context_pct} [${context_bar}]$(rst)"
else
  line2="🧠 $(context_color)TBD$(rst)"
fi

# Session (compact)
if [ -n "$session_txt" ]; then
  if [[ "$session_txt" =~ ([0-9]+h\ [0-9]+m) ]]; then
    compact_time="${BASH_REMATCH[1]}"
    line2="$line2  ⌛ $(session_color)${compact_time} [${session_bar}]$(rst)"
  else
    line2="$line2  ⌛ $(session_color)${session_txt}$(rst)"
  fi
fi

# Cost
if [ -n "$cost_usd" ] && [[ "$cost_usd" =~ ^[0-9.]+$ ]]; then
  if [ -n "$cost_per_hour" ] && [[ "$cost_per_hour" =~ ^[0-9.]+$ ]]; then
    cost_per_hour_formatted=$(printf '%.2f' "$cost_per_hour")
    line2="$line2  💰 $(cost_color)\$$(printf '%.2f' \"$cost_usd\")$(rst) ($(burn_color)\$${cost_per_hour_formatted}/h$(rst))"
  else
    line2="$line2  💰 $(cost_color)\$$(printf '%.2f' \"$cost_usd\")$(rst)"
  fi
fi

# Tokens (smart formatting)
if [ -n "$tot_tokens" ] && [[ "$tot_tokens" =~ ^[0-9]+$ ]]; then
  if [ "$tot_tokens" -ge 1000000 ]; then
    tok_display=$(printf '%.1fM' "$(echo "scale=1; $tot_tokens/1000000" | bc)")
  elif [ "$tot_tokens" -ge 1000 ]; then
    tok_display=$(printf '%.0fK' "$(echo "scale=0; $tot_tokens/1000" | bc)")
  else
    tok_display="$tot_tokens"
  fi
  
  if [ -n "$tpm" ] && [[ "$tpm" =~ ^[0-9.]+$ ]]; then
    tpm_formatted=$(printf '%.0f' "$tpm")
    if [ "${tpm_formatted%.*}" -ge 10000 ]; then
      tpm_display=$(printf '%.0fK' "$(echo "scale=0; $tpm_formatted/1000" | bc)")
    else
      tpm_display="$tpm_formatted"
    fi
    line2="$line2  📊 $(usage_color)${tok_display} (${tpm_display}tpm)$(rst)"
  else
    line2="$line2  📊 $(usage_color)${tok_display}$(rst)"
  fi
fi

if [ -n "$line2" ]; then
  printf '\n%s' "$line2"
fi
printf '\n'