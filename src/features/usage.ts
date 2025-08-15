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

  // Build optimized jq query fields
  const jqFields: string[] = []
  if (config.showCost) {
    jqFields.push('cost_usd: (.costUSD // "")')
    jqFields.push('cost_per_hour: (.burnRate.costPerHour // "")')
  }
  if (config.showTokens) {
    jqFields.push('tot_tokens: (.totalTokens // "")')
  }
  if (config.showBurnRate) {
    jqFields.push('tpm: (.burnRate.tokensPerMinute // "")')
  }
  if (config.showSession || config.showProgressBar) {
    jqFields.push('reset_time_str: (.usageLimitResetTime // .endTime // "")')
    jqFields.push('start_time_str: (.startTime // "")')
  }
  
  const jqQuery = jqFields.length > 0 ? `{${jqFields.join(', ')}}` : '{}'

  const colorCode = colors ? `
# ---- usage colors ----
usage_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;35m'; fi; }
cost_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[1;36m'; fi; }
session_color() { 
  rem_pct=$(( 100 - session_pct ))
  if   (( rem_pct <= 10 )); then SCLR='1;31'
  elif (( rem_pct <= 25 )); then SCLR='1;33'
  else                          SCLR='1;32'; fi
  if [ "$use_color" -eq 1 ]; then printf '\\033[%sm' "$SCLR"; fi
}
` : `
usage_color() { :; }
cost_color() { :; }
session_color() { :; }
`

  return `${colorCode}
# ---- ccusage integration ----
session_txt=""; session_pct=0; session_bar=""
cost_usd=""; cost_per_hour=""; tpm=""; tot_tokens=""

if command -v jq >/dev/null 2>&1; then
  # Try cache first (valid for 30 seconds)
  cache_file="\${HOME}/.claude/ccusage_cache.json"
  cache_age=30
  use_cache=0
  
  if [ -f "$cache_file" ] && [ $(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null || echo 0))) -lt $cache_age ]; then
    use_cache=1
    blocks_output=$(cat "$cache_file" 2>/dev/null)
  fi
  
  if [ $use_cache -eq 0 ]; then
    # Try local ccusage first, fallback to npx
    blocks_output=$(ccusage blocks --json 2>/dev/null || timeout 3 npx ccusage@latest blocks --json 2>/dev/null)
    if [ -n "$blocks_output" ]; then
      mkdir -p "\${HOME}/.claude" 2>/dev/null
      echo "$blocks_output" > "$cache_file" 2>/dev/null
    fi
  fi
  
  if [ -n "$blocks_output" ]; then
    # Single optimized jq call for all data extraction
    eval "$(echo "$blocks_output" | jq -r '
      .blocks[] | select(.isActive == true) | 
      ${jqQuery} | 
      to_entries | .[] | "\\(.key)=\\(.value | @sh)"
    ' 2>/dev/null)" 2>/dev/null${config.showSession || config.showProgressBar ? `
    
    # Session time calculation
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