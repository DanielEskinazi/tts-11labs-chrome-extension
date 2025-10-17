#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
# ]
# ///

import argparse
import json
import os
import sys
import random
import subprocess
import re
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
from collections import defaultdict

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def get_completion_messages():
    """Return list of friendly completion messages."""
    return [
        "Work complete!",
        "All done!",
        "Task finished!",
        "Job complete!",
        "Ready for next task!"
    ]


def get_tts_script_path():
    """
    Determine which TTS script to use based on available API keys.
    Priority order: ElevenLabs > OpenAI > pyttsx3
    """
    # Get current script directory and construct utils/tts path
    script_dir = Path(__file__).parent
    tts_dir = script_dir / "utils" / "tts"
    
    # Check for ElevenLabs API key (highest priority)
    if os.getenv('ELEVENLABS_API_KEY'):
        elevenlabs_script = tts_dir / "elevenlabs_tts.py"
        if elevenlabs_script.exists():
            return str(elevenlabs_script)
    
    # Check for OpenAI API key (second priority)
    if os.getenv('OPENAI_API_KEY'):
        openai_script = tts_dir / "openai_tts.py"
        if openai_script.exists():
            return str(openai_script)
    
    # Fall back to pyttsx3 (no API key required)
    pyttsx3_script = tts_dir / "pyttsx3_tts.py"
    if pyttsx3_script.exists():
        return str(pyttsx3_script)
    
    return None


def get_llm_completion_message():
    """
    Generate completion message using available LLM services.
    Priority order: OpenAI > Anthropic > Ollama > fallback to random message
    
    Returns:
        str: Generated or fallback completion message
    """
    # Get current script directory and construct utils/llm path
    script_dir = Path(__file__).parent
    llm_dir = script_dir / "utils" / "llm"
    
    # Try OpenAI first (highest priority)
    if os.getenv('OPENAI_API_KEY'):
        oai_script = llm_dir / "oai.py"
        if oai_script.exists():
            try:
                result = subprocess.run([
                    "uv", "run", str(oai_script), "--completion"
                ], 
                capture_output=True,
                text=True,
                timeout=10
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
            except (subprocess.TimeoutExpired, subprocess.SubprocessError):
                pass
    
    # Try Anthropic second
    if os.getenv('ANTHROPIC_API_KEY'):
        anth_script = llm_dir / "anth.py"
        if anth_script.exists():
            try:
                result = subprocess.run([
                    "uv", "run", str(anth_script), "--completion"
                ], 
                capture_output=True,
                text=True,
                timeout=10
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
            except (subprocess.TimeoutExpired, subprocess.SubprocessError):
                pass
    
    # Try Ollama third (local LLM)
    ollama_script = llm_dir / "ollama.py"
    if ollama_script.exists():
        try:
            result = subprocess.run([
                "uv", "run", str(ollama_script), "--completion"
            ], 
            capture_output=True,
            text=True,
            timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except (subprocess.TimeoutExpired, subprocess.SubprocessError):
            pass
    
    # Fallback to random predefined message
    messages = get_completion_messages()
    return random.choice(messages)

def announce_completion(enable_insights: bool = False, insights_detail: str = "medium"):
    """Announce completion using the best available TTS service."""
    try:
        tts_script = get_tts_script_path()
        if not tts_script:
            return  # No TTS scripts available
        
        # Get completion message (LLM-generated or fallback)
        completion_message = get_llm_completion_message()
        
        # Generate learning insights if enabled
        if enable_insights:
            insights = generate_learning_insights(detail_level=insights_detail)
            if insights:
                # Combine completion message with insights
                full_message = f"{completion_message} {insights}"
            else:
                full_message = completion_message
        else:
            full_message = completion_message
        
        # Call the TTS script with the full message
        subprocess.run([
            "uv", "run", tts_script, full_message
        ], 
        capture_output=True,  # Suppress output
        timeout=20  # Increased timeout for longer messages
        )
        
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        # Fail silently if TTS encounters issues
        pass
    except Exception:
        # Fail silently for any other errors
        pass


@dataclass
class ChangeAnalysis:
    """Represents analysis of code changes"""
    files_changed: List[str]
    files_added: List[str]
    files_deleted: List[str]
    total_additions: int
    total_deletions: int
    commit_messages: List[str]
    key_functions_changed: List[str]
    imports_added: List[str]
    config_changes: List[str]
    test_changes: List[str]


class GitRepository:
    """Simplified Git operations for analyzing changes"""
    
    def __init__(self, repo_path: str = "."):
        self.repo_path = Path(repo_path)
        if not (self.repo_path / ".git").exists():
            raise RuntimeError(f"'{self.repo_path}' is not a Git repository.")
    
    def _run_git_command(self, cmd: List[str]) -> str:
        """Run a git command with error handling"""
        try:
            result = subprocess.run(
                ["git"] + cmd, 
                cwd=self.repo_path,
                capture_output=True, 
                text=True, 
                check=True
            )
            return result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            return ""
    
    def get_diff_content(self, commits_back: int = 1) -> str:
        """Get diff content for recent changes"""
        return self._run_git_command(["diff", f"HEAD~{commits_back}", "--no-color"])
    
    def get_file_changes(self, commits_back: int = 1) -> Tuple[List[str], List[str], List[str]]:
        """Get file changes with status"""
        diff_output = self._run_git_command(["diff", "--name-status", f"HEAD~{commits_back}"])
        
        files_changed, files_added, files_deleted = [], [], []
        
        for line in diff_output.split("\n"):
            if not line:
                continue
            parts = line.split("\t", 1)
            if len(parts) < 2:
                continue
            status, filename = parts[0], parts[1]
            
            if status == "A":
                files_added.append(filename)
            elif status == "D":
                files_deleted.append(filename)
            else:
                files_changed.append(filename)
        
        return files_changed, files_added, files_deleted
    
    def get_line_stats(self, commits_back: int = 1) -> Tuple[int, int]:
        """Get line addition/deletion statistics"""
        stat_output = self._run_git_command(["diff", "--numstat", f"HEAD~{commits_back}"])
        
        total_additions = total_deletions = 0
        for line in stat_output.split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
                total_additions += int(parts[0])
                total_deletions += int(parts[1])
        
        return total_additions, total_deletions
    
    def get_commit_messages(self, commits_back: int = 1) -> List[str]:
        """Get recent commit messages"""
        commit_output = self._run_git_command(["log", f"-{commits_back}", "--oneline", "--no-merges"])
        
        if not commit_output:
            return []
        
        return [line.split(" ", 1)[1] if len(line.split(" ", 1)) > 1 else "" 
                for line in commit_output.split("\n") if line]


class ProjectAnalyzer:
    """Analyzes project structure and recent changes"""
    
    def __init__(self, repo_path: str = "."):
        self.git_repo = GitRepository(repo_path)
        self.project_type = self._detect_project_type()
        
    def _detect_project_type(self) -> str:
        """Detect the primary project type"""
        detectors = {
            "package.json": "JavaScript/Node.js",
            "tsconfig.json": "TypeScript",
            "requirements.txt": "Python",
            "pyproject.toml": "Python", 
            "setup.py": "Python",
            "go.mod": "Go",
            "Cargo.toml": "Rust",
            "pom.xml": "Java",
            "Gemfile": "Ruby",
        }
        
        for file, proj_type in detectors.items():
            if (self.git_repo.repo_path / file).exists():
                return proj_type
        return "Unknown"
    
    def get_recent_changes(self, commits_back: int = 1) -> ChangeAnalysis:
        """Analyze recent changes in the repository"""
        try:
            # Get commit messages
            commit_messages = self.git_repo.get_commit_messages(commits_back)
            
            # Get file changes
            files_changed, files_added, files_deleted = self.git_repo.get_file_changes(commits_back)
            
            # Get line statistics
            total_additions, total_deletions = self.git_repo.get_line_stats(commits_back)
            
            # Get diff content for analysis
            diff_content = self.git_repo.get_diff_content(commits_back)
            
            # Analyze code changes
            key_functions_changed = self._analyze_function_changes(diff_content)
            imports_added = self._analyze_import_changes(diff_content)
            config_changes = self._analyze_config_changes(files_changed + files_added)
            test_changes = self._analyze_test_changes(files_changed + files_added)
            
            return ChangeAnalysis(
                files_changed=files_changed,
                files_added=files_added,
                files_deleted=files_deleted,
                total_additions=total_additions,
                total_deletions=total_deletions,
                commit_messages=commit_messages,
                key_functions_changed=key_functions_changed,
                imports_added=imports_added,
                config_changes=config_changes,
                test_changes=test_changes
            )
        except Exception:
            # Return empty analysis as fallback
            return ChangeAnalysis([], [], [], 0, 0, [], [], [], [], [])
    
    def _analyze_function_changes(self, diff_content: str) -> List[str]:
        """Detect function/method changes with context"""
        functions_with_context = []
        patterns = {
            "Python": [
                (r"^\+.*(?:async\s+)?def\s+(\w+)\s*\(.*?\):", "function"),
                (r"^\+.*class\s+(\w+)\s*[\(:]", "class")
            ],
            "JavaScript/Node.js": [
                (r"^\+.*function\s+(\w+)\s*\(", "function"),
                (r"^\+.*const\s+(\w+)\s*=.*=>", "function"),
            ],
            "TypeScript": [
                (r"^\+.*function\s+(\w+)\s*\(", "function"),
                (r"^\+.*const\s+(\w+)\s*=.*=>", "function"),
                (r"^\+.*interface\s+(\w+)\s*{", "interface"),
            ],
        }
        
        project_patterns = patterns.get(self.project_type, [])
        
        # Split diff into lines for context analysis
        lines = diff_content.split('\n')
        
        for i, line in enumerate(lines):
            if not line.startswith('+'):
                continue
                
            for pattern, func_type in project_patterns:
                match = re.search(pattern, line)
                if match:
                    func_name = match.group(1)
                    # Look for docstring or comment above
                    purpose = self._extract_function_purpose(lines, i, func_name)
                    if purpose:
                        functions_with_context.append(f"{func_name} ({purpose})")
                    else:
                        functions_with_context.append(f"{func_name} ({func_type})")
        
        return list(dict.fromkeys(functions_with_context))[:8]  # Unique functions, increased limit
    
    def _extract_function_purpose(self, lines: List[str], func_line_index: int, func_name: str) -> Optional[str]:
        """Extract the purpose of a function from docstring or comments"""
        # Look for docstring in the next few lines
        if func_line_index + 1 < len(lines):
            for j in range(func_line_index + 1, min(func_line_index + 5, len(lines))):
                line = lines[j].strip()
                if line.startswith('+'):
                    line = line[1:].strip()
                    # Check for docstring
                    if line.startswith('"""') or line.startswith("'''"):
                        # Extract first line of docstring
                        docstring = line.strip('"""').strip("'''").strip()
                        if docstring and not docstring.startswith(func_name):
                            return docstring[:50]  # Limit length
                    # Check for comment
                    elif j == func_line_index + 1 and line.startswith('#'):
                        return line[1:].strip()[:50]
        
        # Look for comment on the same line or above
        if func_line_index > 0:
            prev_line = lines[func_line_index - 1].strip()
            if prev_line.startswith('+') and '#' in prev_line:
                comment = prev_line[prev_line.index('#')+1:].strip()
                if comment:
                    return comment[:50]
        
        # Infer purpose from function name
        return self._infer_purpose_from_name(func_name)
    
    def _infer_purpose_from_name(self, func_name: str) -> Optional[str]:
        """Infer function purpose from its name"""
        name_lower = func_name.lower()
        
        # Common patterns
        if name_lower.startswith('get_'):
            return f"retrieves {name_lower[4:].replace('_', ' ')}"
        elif name_lower.startswith('set_'):
            return f"sets {name_lower[4:].replace('_', ' ')}"
        elif name_lower.startswith('is_') or name_lower.startswith('has_'):
            return f"checks {name_lower.replace('_', ' ')}"
        elif name_lower.startswith('create_'):
            return f"creates {name_lower[7:].replace('_', ' ')}"
        elif name_lower.startswith('update_'):
            return f"updates {name_lower[7:].replace('_', ' ')}"
        elif name_lower.startswith('delete_'):
            return f"deletes {name_lower[7:].replace('_', ' ')}"
        elif name_lower.startswith('test_'):
            return f"tests {name_lower[5:].replace('_', ' ')}"
        elif '_test' in name_lower:
            return "test function"
        elif 'init' in name_lower:
            return "initialization"
        elif 'main' in name_lower:
            return "main entry point"
        elif 'format' in name_lower:
            return "formatting utility"
        elif 'analyze' in name_lower or 'analysis' in name_lower:
            return "analyzes data"
        elif 'service' in name_lower:
            return "service class"
        
        return None
    
    def _analyze_import_changes(self, diff_content: str) -> List[str]:
        """Detect new imports/dependencies"""
        imports = []
        patterns = {
            "Python": [
                r"^\+\s*import\s+(\w+)",
                r"^\+\s*from\s+(\w+)"
            ],
            "JavaScript/Node.js": [
                r"^\+\s*import.*from\s+['\"]([^'\"]+)['\"]",
                r"^\+\s*const\s+.*=\s+require\(['\"]([^'\"]+)['\"]\)"
            ],
            "TypeScript": [
                r"^\+\s*import.*from\s+['\"]([^'\"]+)['\"]",
            ],
        }
        
        project_patterns = patterns.get(self.project_type, [])
        for pattern in project_patterns:
            matches = re.findall(pattern, diff_content, re.MULTILINE)
            imports.extend(matches)
        
        # Clean up import names
        clean_imports = []
        for imp in imports:
            cleaned = imp.split('/')[-1].split('.')[0]
            if cleaned and not cleaned.startswith('.'):
                clean_imports.append(cleaned)
        
        return list(set(clean_imports))[:5]
    
    def _analyze_config_changes(self, files: List[str]) -> List[str]:
        """Detect configuration file changes"""
        config_files = []
        config_patterns = [
            r'\.json$', r'\.yaml$', r'\.yml$', r'\.toml$', r'\.ini$', 
            r'\.env', r'config', r'settings'
        ]
        
        for file in files:
            for pattern in config_patterns:
                if re.search(pattern, file, re.IGNORECASE):
                    config_files.append(file)
                    break
        
        return config_files
    
    def _analyze_test_changes(self, files: List[str]) -> List[str]:
        """Detect test file changes"""
        test_files = []
        test_patterns = [
            r'test_', r'_test\.', r'\.test\.', r'spec\.', r'\.spec\.',
            r'/tests?/', r'/spec/', r'/__tests__/'
        ]
        
        for file in files:
            for pattern in test_patterns:
                if re.search(pattern, file, re.IGNORECASE):
                    test_files.append(file)
                    break
        
        return test_files


class LearningInsightGenerator:
    """Generates learning-focused summaries for developers"""
    
    def __init__(self, analysis: ChangeAnalysis, project_type: str):
        self.analysis = analysis
        self.project_type = project_type
        self.file_purposes = self._analyze_file_purposes()
    
    def generate_insights(self, detail_level: str = "medium") -> str:
        """Generate learning-focused insights"""
        if not self._has_changes():
            return "No code changes detected in this session."
        
        insights = []
        
        # Opening context
        insights.append(self._get_session_summary())
        
        # Key learnings (show more detail for higher levels)
        learnings = self._extract_key_learnings()
        if learnings:
            if detail_level == "low":
                insights.append("Key learnings from this session: " + " ".join(learnings[:2]))
            else:
                insights.append("Key learnings from this session: " + " ".join(learnings))
        
        # Recommendations (only for medium and high detail)
        if detail_level in ["medium", "high"]:
            recommendations = self._get_learning_recommendations()
            if recommendations:
                insights.append("Consider reviewing: " + " ".join(recommendations))
        
        return " ".join(insights)
    
    def _has_changes(self) -> bool:
        """Check if there are any meaningful changes"""
        return bool(
            self.analysis.files_changed or 
            self.analysis.files_added or 
            self.analysis.files_deleted or
            self.analysis.total_additions or 
            self.analysis.total_deletions
        )
    
    def _get_session_summary(self) -> str:
        """Generate session summary focused on specific files and reasons"""
        if not self.file_purposes:
            return "Claude made some changes in this session."
        
        # Build a narrative about what files were changed and why
        file_descriptions = []
        
        # Process the most important files first
        for filename, purpose in list(self.file_purposes.items())[:5]:  # Limit to top 5 files
            file_descriptions.append(f"{filename} - {purpose}")
        
        summary = "Claude worked on these files: " + ", ".join(file_descriptions) + "."
        
        # Add context from commit messages if available
        if self.analysis.commit_messages:
            main_commit = self.analysis.commit_messages[0]
            summary = f"Claude's main task: {main_commit}. Files changed: " + ", ".join(file_descriptions) + "."
        
        return summary
    
    def _extract_key_learnings(self) -> List[str]:
        """Extract key learning points from changes"""
        learnings = []
        
        # New functions/classes added with context
        if self.analysis.key_functions_changed:
            # Show functions with their purposes
            func_descriptions = []
            for func_desc in self.analysis.key_functions_changed[:5]:
                # func_desc is now like "function_name (purpose)"
                func_descriptions.append(func_desc)
            
            if func_descriptions:
                if len(func_descriptions) > 3:
                    learnings.append(f"Key functions added: {', '.join(func_descriptions[:3])}, and {len(func_descriptions) - 3} more.")
                else:
                    learnings.append(f"Key functions added: {', '.join(func_descriptions)}.")
        
        # New dependencies with purpose
        if self.analysis.imports_added:
            imports_desc = []
            for imp in self.analysis.imports_added[:3]:
                # Try to infer purpose of import
                if imp in ['dataclasses', 'typing', 'List', 'Dict']:
                    imports_desc.append(f"{imp} for data structures")
                elif imp in ['subprocess', 'os', 'sys']:
                    imports_desc.append(f"{imp} for system operations")
                elif imp in ['re', 'json']:
                    imports_desc.append(f"{imp} for text processing")
                else:
                    imports_desc.append(imp)
            learnings.append(f"New dependencies: {', '.join(imports_desc)}.")
        
        # Specific config changes
        if self.analysis.config_changes:
            config_files = [Path(f).name for f in self.analysis.config_changes]
            learnings.append(f"Configuration updated in: {', '.join(config_files)}.")
        
        # Test coverage with specifics
        if self.analysis.test_changes:
            test_files = [Path(f).name for f in self.analysis.test_changes]
            learnings.append(f"Tests updated in: {', '.join(test_files)}.")
        elif len(self.file_purposes) > 2 and not self.analysis.test_changes:
            learnings.append(f"Consider adding tests for the new changes.")
        
        return learnings
    
    def _get_learning_recommendations(self) -> List[str]:
        """Generate learning recommendations"""
        recommendations = []
        
        # Specific file recommendations
        important_files = [f for f, purpose in self.file_purposes.items() 
                          if any(key in purpose for key in ['created', 'API', 'model', 'configuration'])]
        
        if important_files:
            recommendations.append(f"the implementation in {', '.join(important_files[:3])}")
        
        # New patterns introduced
        if self.analysis.key_functions_changed and len(self.analysis.key_functions_changed) > 3:
            recommendations.append(f"how the new functions ({', '.join(self.analysis.key_functions_changed[:2])}) work")
        
        # Dependencies
        if self.analysis.imports_added:
            deps = ', '.join(self.analysis.imports_added[:2])
            recommendations.append(f"the documentation for {deps}")
        
        # Config changes
        if self.analysis.config_changes:
            config_names = [Path(f).name for f in self.analysis.config_changes[:2]]
            recommendations.append(f"the changes in {', '.join(config_names)}")
        
        return recommendations
    
    def _analyze_file_purposes(self) -> Dict[str, str]:
        """Analyze the purpose of each file change"""
        file_purposes = {}
        
        # Combine all changed files
        all_files = (
            [(f, 'modified') for f in self.analysis.files_changed] +
            [(f, 'created') for f in self.analysis.files_added] +
            [(f, 'deleted') for f in self.analysis.files_deleted]
        )
        
        for filepath, action in all_files:
            filename = Path(filepath).name
            purpose = self._infer_file_purpose(filepath, action)
            file_purposes[filename] = purpose
        
        return file_purposes
    
    def _infer_file_purpose(self, filepath: str, action: str) -> str:
        """Infer the purpose of a file change based on its path and type"""
        path = Path(filepath)
        filename = path.name
        path_parts = path.parts
        
        # Check if it's a test file
        if any(pattern in str(path).lower() for pattern in ['test', 'spec', '__tests__']):
            if action == 'created':
                return "added test coverage"
            elif action == 'modified':
                return "updated tests"
            else:
                return "removed test"
        
        # Check if it's a config file
        if filename in ['package.json', 'tsconfig.json', 'pyproject.toml', '.env', 'docker-compose.yml']:
            return f"{action} project configuration"
        
        # Check for specific file types
        if filename.endswith(('.md', '.txt', '.rst')):
            return f"{action} documentation"
        
        if filename.endswith(('.py', '.js', '.ts', '.jsx', '.tsx')):
            # Look for clues in the path
            if 'component' in str(path).lower():
                return f"{action} UI component"
            elif 'util' in str(path).lower() or 'helper' in str(path).lower():
                return f"{action} utility function"
            elif 'hook' in str(path).lower():
                return f"{action} hook functionality"
            elif 'api' in str(path).lower() or 'route' in str(path).lower():
                return f"{action} API endpoint"
            elif 'model' in str(path).lower():
                return f"{action} data model"
            else:
                # Check for specific function changes
                if filename in self.analysis.key_functions_changed:
                    return f"{action} with new functions"
                elif self.analysis.imports_added and action == 'modified':
                    return "added new dependencies"
                else:
                    return f"{action} implementation"
        
        # Default based on action
        if action == 'created':
            return "added new functionality"
        elif action == 'modified':
            return "updated functionality"
        else:
            return "removed"


def generate_learning_insights(repo_path: str = ".", detail_level: str = "medium") -> Optional[str]:
    """Generate learning insights for the current session"""
    try:
        # Check if we're in a git repository
        if not (Path(repo_path) / ".git").exists():
            return None
        
        # Analyze recent changes
        analyzer = ProjectAnalyzer(repo_path)
        analysis = analyzer.get_recent_changes(commits_back=1)
        
        # Generate insights
        generator = LearningInsightGenerator(analysis, analyzer.project_type)
        return generator.generate_insights(detail_level)
        
    except Exception:
        # Fail silently and return None
        return None


def main():
    try:
        # Parse command line arguments
        parser = argparse.ArgumentParser()
        parser.add_argument('--chat', action='store_true', help='Copy transcript to chat.json')
        parser.add_argument('--notify', action='store_true', help='Enable TTS completion announcement')
        parser.add_argument('--insights', action='store_true', help='Enable learning insights analysis')
        parser.add_argument('--insights-detail', choices=['low', 'medium', 'high'], default='medium',
                           help='Detail level for learning insights (default: medium)')
        args = parser.parse_args()
        
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        # Extract required fields
        session_id = input_data.get("session_id", "")
        stop_hook_active = input_data.get("stop_hook_active", False)

        # Ensure log directory exists
        log_dir = os.path.join(os.getcwd(), "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "stop.json")

        # Read existing log data or initialize empty list
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []
        
        # Append new data
        log_data.append(input_data)
        
        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        # Handle --chat switch
        if args.chat and 'transcript_path' in input_data:
            transcript_path = input_data['transcript_path']
            if os.path.exists(transcript_path):
                # Read .jsonl file and convert to JSON array
                chat_data = []
                try:
                    with open(transcript_path, 'r') as f:
                        for line in f:
                            line = line.strip()
                            if line:
                                try:
                                    chat_data.append(json.loads(line))
                                except json.JSONDecodeError:
                                    pass  # Skip invalid lines
                    
                    # Write to logs/chat.json
                    chat_file = os.path.join(log_dir, 'chat.json')
                    with open(chat_file, 'w') as f:
                        json.dump(chat_data, f, indent=2)
                except Exception:
                    pass  # Fail silently

        # Announce completion via TTS (only if --notify flag is set)
        if args.notify:
            announce_completion(enable_insights=args.insights, insights_detail=args.insights_detail)

        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)


if __name__ == "__main__":
    main()
