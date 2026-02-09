import re
import base64

import httpx

# Files that reveal architecture/tech stack — fetched for content
_KEY_FILES = {
    "package.json", "tsconfig.json", "vite.config.ts", "vite.config.js",
    "next.config.js", "next.config.ts", "next.config.mjs",
    "requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
    "Cargo.toml", "go.mod", "build.gradle", "pom.xml",
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "Makefile", ".env.example",
    "README.md",
}

# Max bytes to read from a single file (truncate large READMEs, etc.)
_MAX_FILE_BYTES = 4000


def parse_github_url(url: str) -> tuple[str, str]:
    """Extract owner and repo from a GitHub URL."""
    # Handle various formats: https://github.com/owner/repo, github.com/owner/repo, owner/repo
    url = url.strip().rstrip("/")
    match = re.match(r"(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/]+?)(?:\.git)?$", url)
    if match:
        return match.group(1), match.group(2)
    # Try plain owner/repo
    match = re.match(r"^([^/]+)/([^/]+)$", url)
    if match:
        return match.group(1), match.group(2)
    raise ValueError(f"Could not parse GitHub URL: {url}")


async def fetch_repo_context(repo_url: str) -> str:
    """Fetch repo structure and key files, return a text summary for the LLM."""
    owner, repo = parse_github_url(repo_url)

    async with httpx.AsyncClient(timeout=30) as client:
        headers = {"Accept": "application/vnd.github.v3+json"}

        # 1. Repo metadata
        meta_resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
        meta_resp.raise_for_status()
        meta = meta_resp.json()

        description = meta.get("description") or "No description"
        default_branch = meta.get("default_branch", "main")
        language = meta.get("language") or "Unknown"
        topics = meta.get("topics") or []

        # 2. File tree
        tree_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
            headers=headers,
        )
        tree_resp.raise_for_status()
        tree_data = tree_resp.json()

        all_paths = []
        key_file_paths = []
        for item in tree_data.get("tree", []):
            path = item["path"]
            all_paths.append(path)
            filename = path.rsplit("/", 1)[-1]
            if filename in _KEY_FILES and item["type"] == "blob":
                key_file_paths.append(path)

        # 3. Fetch key files (parallel)
        file_contents: dict[str, str] = {}
        if key_file_paths:
            # Limit to 10 files to stay within rate limits
            tasks = key_file_paths[:10]
            for file_path in tasks:
                try:
                    file_resp = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                        headers=headers,
                    )
                    if file_resp.status_code == 200:
                        data = file_resp.json()
                        if data.get("encoding") == "base64" and data.get("content"):
                            content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                            file_contents[file_path] = content[:_MAX_FILE_BYTES]
                except Exception:
                    continue

    # 4. Build summary text
    parts = [
        f"# GitHub Repository: {owner}/{repo}",
        f"Description: {description}",
        f"Primary Language: {language}",
        f"Topics: {', '.join(topics) if topics else 'None'}",
        f"Default Branch: {default_branch}",
        "",
        "## Directory Structure",
        "```",
    ]

    # Build a compact tree representation (limit depth to avoid huge output)
    dirs_seen = set()
    file_list = []
    for p in sorted(all_paths):
        depth = p.count("/")
        if depth <= 3:  # Show up to 3 levels deep
            file_list.append(p)
        else:
            # Just show the parent dir
            parent = "/".join(p.split("/")[:3]) + "/..."
            if parent not in dirs_seen:
                dirs_seen.add(parent)
                file_list.append(parent)

    parts.extend(file_list[:200])  # Cap at 200 entries
    parts.append("```")
    parts.append("")

    # 5. Include key file contents
    if file_contents:
        parts.append("## Key Configuration Files")
        for path, content in file_contents.items():
            parts.append(f"\n### {path}")
            parts.append("```")
            parts.append(content)
            parts.append("```")

    return "\n".join(parts)
