#!/bin/sh
# 把 Wiki 检查装进当前 clone 的 Git 钩子。不修改 git config。
# 钩子已经调用 wiki.py 时不覆盖。
set -eu
top=$(git rev-parse --show-toplevel)
hooks=$(git -C "$top" rev-parse --git-path hooks)
case "$hooks" in
  /*) ;;
  *) hooks="$top/$hooks" ;;
esac
mkdir -p "$hooks"

install_one() {
  name=$1
  marker=$2
  dest="$hooks/$name"
  if [ -f "$dest" ] && grep -q 'wiki.py' "$dest" && grep -q "$marker" "$dest"; then
    echo "$name already calls wiki.py $marker"
    return 0
  fi
  if [ -e "$dest" ]; then
    echo "$dest exists and does not call wiki.py $marker; left unchanged" >&2
    return 1
  fi
  cat > "$dest"
  chmod +x "$dest"
  echo "installed $dest"
}

install_one pre-commit "check --staged" << 'EOF'
#!/bin/sh
top=$(git rev-parse --show-toplevel) || exit 1
exec "${PYTHON:-python3}" "$top/scripts/wiki/wiki.py" check --staged --root "$top"
EOF

install_one commit-msg "remind --staged" << 'EOF'
#!/bin/sh
top=$(git rev-parse --show-toplevel) || exit 1
exec "${PYTHON:-python3}" "$top/scripts/wiki/wiki.py" remind --staged --message-file "$1" --root "$top"
EOF
