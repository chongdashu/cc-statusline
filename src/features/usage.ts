import { cacheManager, generateContextHash } from '../utils/cache-manager.js'
import { optimizeBashCode } from '../generators/bash-optimizer.js'

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

  // Generate cache context for memory caching
  const cacheContext = generateContextHash(
    JSON.stringify(config),
    colors.toString()
  )
  const cacheKey = cacheManager.generateCacheKey('ccusage', cacheContext)

  // Check memory cache first
  const cachedResult = cacheManager.getFromMemory<string>(cacheKey)
  if (cachedResult) {
    return cachedResult
  }

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
usage_clr() { [[ $use_color -eq 1 ]] && printf '\\033[1;35m'; }
cost_clr() { [[ $use_color -eq 1 ]] && printf '\\033[1;36m'; }
sess_clr() { 
  rem_pct=$(( 100 - pct ))
  if   (( rem_pct <= 10 )); then SCLR='1;31'
  elif (( rem_pct <= 25 )); then SCLR='1;33'
  else                          SCLR='1;32'; fi
  [[ $use_color -eq 1 ]] && printf '\\033[%sm' "$SCLR"
}
` : `
usage_clr() { :; }
cost_clr() { :; }
sess_clr() { :; }
`

  const bashCode = `${colorCode}
# ---- ccusage integration ----
sess_txt="" pct=0 sess_bar=""
cost_usd="" cost_ph="" tpm="" tot_tokens=""

if command -v jq >/dev/null 2>&1; then
${cacheManager.generateFileCacheCode('ccusage', 'ccusage blocks --json 2>/dev/null || timeout 3 npx ccusage@latest blocks --json 2>/dev/null')}
  
  if [[ $cached_result ]]; then
    blocks_output="$cached_result"
    # Single optimized jq call for all data extraction
    eval "$(echo "$blocks_output" | jq -r '
      .blocks[] | select(.isActive == true) | 
      ${jqQuery} | 
      to_entries | .[] | "\\(.key)=\\(.value | @sh)"
    ' 2>/dev/null)" 2>/dev/null${config.showSession || config.showProgressBar ? `
    
    # Session time calculation
    if [[ $reset_time_str && $start_time_str ]]; then
      start_sec=$(to_epoch "$start_time_str"); end_sec=$(to_epoch "$reset_time_str"); now_sec=\${EPOCHSECONDS:-\$(date +%s)}
      total=$(( end_sec - start_sec )); (( total<1 )) && total=1
      elapsed=$(( now_sec - start_sec )); (( elapsed<0 ))&&elapsed=0; (( elapsed>total ))&&elapsed=$total
      pct=$(( elapsed * 100 / total ))
      remaining=$(( end_sec - now_sec )); (( remaining<0 )) && remaining=0
      rh=$(( remaining / 3600 )); rm=$(( (remaining % 3600) / 60 ))
      end_hm=$(fmt_time_hm "$end_sec")${config.showSession ? `
      sess_txt="$(printf '%dh %dm until reset at %s (%d%%)' "$rh" "$rm" "$end_hm" "$pct")"` : ''}${config.showProgressBar ? `
      sess_bar=$(progress_bar "$pct" 10)` : ''}
    fi` : ''}
  fi
fi`

  // Apply micro-optimizations before caching
  const optimizedCode = optimizeBashCode(bashCode)
  
  // Cache the optimized bash code in memory
  cacheManager.setInMemory(cacheKey, optimizedCode, 'ccusage', cacheContext)
  
  return optimizedCode
}

export function generateUsageUtilities(): string {
  const utilities = `
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
  p="\${1:-0}"; w="\${2:-10}"
  [[ $p =~ ^[0-9]+$ ]] || p=0; ((p<0))&&p=0; ((p>100))&&p=100
  filled=$(( p * w / 100 )); empty=$(( w - filled ))
  printf '%*s' "$filled" '' | tr ' ' '='
  printf '%*s' "$empty" '' | tr ' ' '-'
}`

  return optimizeBashCode(utilities)
}

export function generateUsageDisplayCode(config: UsageFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  let displayCode = ''

  if (config.showSession) {
    const sessionEmoji = emojis ? '⌛' : 'session:'
    displayCode += `
# session time
if [[ $sess_txt ]]; then
  printf '  ${sessionEmoji} %s%s%s' "$(sess_clr)" "$sess_txt" "$(rst)"${config.showProgressBar ? `
  printf '  %s[%s]%s' "$(sess_clr)" "$sess_bar" "$(rst)"` : ''}
fi`
  }

  if (config.showCost) {
    const costEmoji = emojis ? '💵' : '$'
    displayCode += `
# cost
if [[ $cost_usd && $cost_usd =~ ^[0-9.]+$ ]]; then
  if [[ $cost_ph && $cost_ph =~ ^[0-9.]+$ ]]; then
    printf '  ${costEmoji} %s$%.2f ($%.2f/h)%s' "$(cost_clr)" "$cost_usd" "$cost_ph" "$(rst)"
  else
    printf '  ${costEmoji} %s$%.2f%s' "$(cost_clr)" "$cost_usd" "$(rst)"
  fi
fi`
  }

  if (config.showTokens) {
    const tokenEmoji = emojis ? '📊' : 'tok:'
    displayCode += `
# tokens
if [[ $tot_tokens && $tot_tokens =~ ^[0-9]+$ ]]; then
  if [[ $tpm && $tpm =~ ^[0-9.]+$ ]] && ${config.showBurnRate ? 'true' : 'false'}; then
    printf '  ${tokenEmoji} %s%s tok (%.0f tpm)%s' "$(usage_clr)" "$tot_tokens" "$tpm" "$(rst)"
  else
    printf '  ${tokenEmoji} %s%s tok%s' "$(usage_clr)" "$tot_tokens" "$(rst)"
  fi
fi`
  }

  return optimizeBashCode(displayCode)
}