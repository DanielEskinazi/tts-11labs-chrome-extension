#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "elevenlabs",
#     "python-dotenv",
# ]
# ///

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

def main():
    """
    ElevenLabs Turbo v2.5 TTS Script
    
    Uses ElevenLabs' Turbo v2.5 model for fast, high-quality text-to-speech.
    Accepts optional text prompt as command-line argument.
    
    Usage:
    - ./eleven_turbo_tts.py                    # Uses default text
    - ./eleven_turbo_tts.py "Your custom text" # Uses provided text
    
    Features:
    - Fast generation (optimized for real-time use)
    - High-quality voice synthesis
    - Stable production model
    - Cost-effective for high-volume usage
    """
    
    # Load environment variables
    load_dotenv()
    
    # Get API key from environment
    api_key = os.getenv('ELEVENLABS_API_KEY')
    if not api_key:
        print("❌ Error: ELEVENLABS_API_KEY not found in environment variables")
        print("Please add your ElevenLabs API key to .env file:")
        print("ELEVENLABS_API_KEY=your_api_key_here")
        sys.exit(1)
    
    try:
        from elevenlabs.client import ElevenLabs
        import tempfile
        import subprocess
        import platform

        # Initialize client
        elevenlabs = ElevenLabs(api_key=api_key)

        print("🎙️  ElevenLabs Turbo v2.5 TTS")
        print("=" * 40)

        # Get text from command line argument or use default
        if len(sys.argv) > 1:
            text = " ".join(sys.argv[1:])  # Join all arguments as text
        else:
            text = "The first move is what sets everything in motion."

        print(f"🎯 Text: {text}")
        print("🔊 Generating and playing...")

        try:
            # Generate audio
            audio_generator = elevenlabs.text_to_speech.convert(
                text=text,
                # voice_id="pNInz6obpgDQGcFmaJgB",  # Adam voice (default)
                voice_id="nPczCjzI2devNBz1zQrb",  # Brian voice (default)
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128",
            )

            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_audio:
                # Write audio chunks to file
                for chunk in audio_generator:
                    temp_audio.write(chunk)
                temp_audio_path = temp_audio.name

            # Play audio using system player
            system = platform.system()
            if system == "Darwin":  # macOS
                subprocess.run(["afplay", temp_audio_path], check=True)
            elif system == "Linux":
                # Try common Linux audio players
                for player in ["paplay", "aplay", "ffplay", "mpg123"]:
                    try:
                        subprocess.run([player, temp_audio_path], check=True, stderr=subprocess.DEVNULL)
                        break
                    except (subprocess.CalledProcessError, FileNotFoundError):
                        continue
            elif system == "Windows":
                os.startfile(temp_audio_path)

            print("✅ Playback complete!")

            # Clean up temp file
            try:
                os.unlink(temp_audio_path)
            except:
                pass

        except Exception as e:
            print(f"❌ Error during generation/playback: {e}")
            print(f"Error type: {type(e).__name__}")
        
        
    except ImportError:
        print("❌ Error: elevenlabs package not installed")
        print("This script uses UV to auto-install dependencies.")
        print("Make sure UV is installed: https://docs.astral.sh/uv/")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()