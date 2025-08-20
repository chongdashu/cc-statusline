export interface UsageFeature {
  enabled: boolean
  showCost: boolean
  showTokens: boolean
  showBurnRate: boolean
  showSession: boolean
  showProgressBar: boolean
}

export function generateUsageBashCode(config: UsageFeature, colors: boolean): string {
  if (!config.enabled) return ''

  const colorCode = colors ? `
# ---- usage colors ----
usage_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;189m'; fi; }  # lavender
cost_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;222m'; fi; }   # light gold
burn_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;220m'; fi; }   # bright gold
session_color() { 
  rem_pct=$(( 100 - session_pct ))
  if   (( rem_pct <= 10 )); then SCLR='38;5;210'  # light pink
  elif (( rem_pct <= 25 )); then SCLR='38;5;228'  # light yellow  
  else                          SCLR='38;5;194'; fi  # light green
  if [ "$use_color" -eq 1 ]; then printf '\\033[%sm' "$SCLR"; fi
}
` : `
usage_color() { :; }
cost_color() { :; }
burn_color() { :; }
session_color() { :; }
`

  return `${colorCode}
# ---- ccusage integration ----
session_txt=""; session_pct=0; session_bar=""
cost_usd=""; cost_per_hour=""; tpm=""; tot_tokens=""

if command -v jq >/dev/null 2>&1; then
  blocks_output=$(npx ccusage@latest blocks --json 2>/dev/null || ccusage blocks --json 2>/dev/null)
  if [ -n "$blocks_output" ]; then
    active_block=$(echo "$blocks_output" | jq -c '.blocks[] | select(.isActive == true)' 2>/dev/null | head -n1)
    if [ -n "$active_block" ]; then${config.showCost ? `
      cost_usd=$(echo "$active_block" | jq -r '.costUSD // empty')
      cost_per_hour=$(echo "$active_block" | jq -r '.burnRate.costPerHour // empty')` : ''}${config.showTokens ? `
      tot_tokens=$(echo "$active_block" | jq -r '.totalTokens // empty')` : ''}${config.showBurnRate ? `
      tpm=$(echo "$active_block" | jq -r '.burnRate.tokensPerMinute // empty')` : ''}${config.showSession || config.showProgressBar ? `
      
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
        end_hm=$(fmt_time_hm "$end_sec")${config.showSession ? `
        session_txt="$(printf '%dh %dm until reset at %s (%d%%)' "$rh" "$rm" "$end_hm" "$session_pct")"` : ''}${config.showProgressBar ? `
        session_bar=$(progress_bar "$session_pct" 10)` : ''}
      fi` : ''}
    fi
  fi
fi`
}

export function generateUsageUtilities(): string {
  return `
# ---- time helpers ----
to_epoch() {
  ts="$1"
  if command -v gdate >/dev/null 2>&1; then gdate -d "$ts" +%s 2>/dev/null && return; fi
  date -u -j -f "%Y-%m-%dT%H:%M:%S%z" "\${ts/Z/+0000}" +%s 2>/dev/null && return
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
  pct="\${1:-0}"; width="\${2:-10}"
  [[ "$pct" =~ ^[0-9]+$ ]] || pct=0; ((pct<0))&&pct=0; ((pct>100))&&pct=100
  filled=$(( pct * width / 100 )); empty=$(( width - filled ))
  printf '%*s' "$filled" '' | tr ' ' '='
  printf '%*s' "$empty" '' | tr ' ' '-'
}`
}

export function generateUsageDisplayCode(config: UsageFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  let displayCode = ''

  if (config.showSession) {
    const sessionEmoji = emojis ? '⌛' : 'session:'
    displayCode += `
# session time
if [ -n "$session_txt" ]; then
  printf '  ${sessionEmoji} %s%s%s' "$(session_color)" "$session_txt" "$(rst)"${config.showProgressBar ? `
  printf '  %s[%s]%s' "$(session_color)" "$session_bar" "$(rst)"` : ''}
fi`
  }

  if (config.showCost) {
    const costEmoji = emojis ? '💵' : '$'
    displayCode += `
# cost
if [ -n "$cost_usd" ] && [[ "$cost_usd" =~ ^[0-9.]+$ ]]; then
  if [ -n "$cost_per_hour" ] && [[ "$cost_per_hour" =~ ^[0-9.]+$ ]]; then
    printf '  ${costEmoji} %s$%.2f ($%.2f/h)%s' "$(cost_color)" "$cost_usd" "$cost_per_hour" "$(rst)"
  else
    printf '  ${costEmoji} %s$%.2f%s' "$(cost_color)" "$cost_usd" "$(rst)"
  fi
fi`
  }

  if (config.showTokens) {
    const tokenEmoji = emojis ? '📊' : 'tok:'
    displayCode += `
# tokens
if [ -n "$tot_tokens" ] && [[ "$tot_tokens" =~ ^[0-9]+$ ]]; then
  if [ -n "$tpm" ] && [[ "$tpm" =~ ^[0-9.]+$ ]] && ${config.showBurnRate ? 'true' : 'false'}; then
    printf '  ${tokenEmoji} %s%s tok (%.0f tpm)%s' "$(usage_color)" "$tot_tokens" "$tpm" "$(rst)"
  else
    printf '  ${tokenEmoji} %s%s tok%s' "$(usage_color)" "$tot_tokens" "$(rst)"
  fi
fi`
  }

  return displayCode
}