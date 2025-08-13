# cc-statusline

🚀 **Dead simple statusline generator for Claude Code**

Transform your Claude Code experience with a beautiful, informative statusline showing directory, git branch, model info, usage stats, and more.

## ⚡ Super Quick Start

**Just run this one command:**

```bash
npx cc-statusline init
```

That's it! Answer 2 simple questions and restart Claude Code. Done! 🎉

### What you get:
- 📁 Current directory 
- 🌿 Git branch
- 🤖 Claude model info
- 💵 Real-time costs
- ⌛ Session time remaining
- Plus optional token stats and burn rate

### Sample result:
```
📁 ~/my-project  🌿 main  🤖 Opus 4.1  💵 $2.48 ($12.50/h)  ⌛ 2h 15m until reset (68%)
```

## 🎯 More Options

```bash
# Preview an existing statusline.sh with mock data
cc-statusline preview .claude/statusline.sh

# Generate to custom location
cc-statusline init --output ./my-statusline.sh

# Skip auto-installation
cc-statusline init --no-install
```

**How preview works:**
The `preview` command takes a path to an existing `statusline.sh` file and:
1. **Loads** your actual statusline script
2. **Runs** it with fake Claude Code data (directory: `/home/user/projects/my-project`, model: `Opus 4.1`, mock usage stats)  
3. **Shows** you exactly what the output looks like
4. **Reports** performance and basic functionality

Perfect for testing your statusline changes before restarting Claude Code.

### Global Installation
```bash
# If you prefer global install
npm install -g cc-statusline
cc-statusline init
```

## 🎛️ Available Features

**Default features (pre-selected):**
- 📁 **Working Directory** - Current folder with `~` shorthand
- 🌿 **Git Branch** - Current branch name  
- 🤖 **Model Name** - Which Claude model you're using
- 💵 **Usage & Cost** - Real-time cost tracking (requires ccusage)
- ⌛ **Session Time** - Time until usage limit resets

**Optional features:**
- 📊 **Token Statistics** - Total tokens used this session
- ⚡ **Burn Rate** - Tokens consumed per minute

## ⚙️ How It Works

**Two simple questions:**
1. **What to show** - Pick features from a checklist (directory, git, model, costs, etc.)
2. **Colors & emojis** - Enable/disable colors and emoji icons

**Then it:**
- Generates a bash script optimized for speed
- Auto-installs to `.claude/statusline.sh`
- Updates your `.claude/settings.json`
- Shows you a preview of what it looks like

**Requirements:**
- Claude Code (obviously! 😄)
- `jq` command (usually pre-installed)
- `ccusage` for usage stats (works via `npx ccusage@latest` - no install needed)

## 🎨 Example Outputs

**Minimal setup:**
```
📁 ~/my-app  🌿 main  🤖 Claude Sonnet
```

**With usage tracking:**
```
📁 ~/my-app  🌿 main  🤖 Opus 4.1  💵 $2.48 ($12.50/h)
```

**Full features:**
```
📁 ~/projects/my-app  🌿 main  🤖 Opus 4.1  ⌛ 2h 15m until reset (68%) [======----]  💵 $2.48 ($12.50/h)
```

## 📋 Dependencies

**Required:**
- Claude Code (the tool you're already using!)
- `jq` for JSON processing (pre-installed on most systems)

**Optional:**
- `git` for branch display
- `ccusage` for usage stats (auto-installs via npx when needed)

**Check if you're ready:**
```bash
command -v jq && echo "✅ Ready to go!"
```

## 📂 What Gets Created

After running `cc-statusline init`, you'll have:

```
.claude/
├── statusline.sh    # Your custom statusline script  
└── settings.json    # Auto-updated with statusline config
```

**Manual Setup (if auto-config fails):**
If the tool can't update your settings.json automatically, just add this:

```json
{
  "statusLine": {
    "type": "command",
    "command": ".claude/statusline.sh",
    "padding": 0
  }
}
```

## Troubleshooting

### Statusline not showing
1. Restart Claude Code after installation
2. Verify `.claude/settings.json` contains:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": ".claude/statusline.sh",
       "padding": 0
     }
   }
   ```

### Performance Issues
- Use `cc-statusline preview` to check execution time
- Reduce number of features if >500ms execution time
- Disable ccusage integration if not needed

### Missing Features
- Ensure `jq` is installed: `brew install jq` (macOS) or `apt install jq` (Ubuntu)
- Usage stats require ccusage (works automatically via `npx ccusage@latest`)
- Check script permissions: `chmod +x .claude/statusline.sh`

## Development

```bash
# Clone repository
git clone https://github.com/chongdashu/cc-statusline
cd cc-statusline

# Install dependencies
npm install

# Build project
npm run build

# Test locally
npm run dev
```

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)  
5. Open Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [ccusage](https://github.com/ryoppippi/ccusage) - Claude Code usage analytics
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - Official documentation

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.

---

**Made by [Chong-U](https://github.com/chongdashu) @ [AIOriented](https://aioriented.dev)**