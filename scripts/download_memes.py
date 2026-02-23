#!/usr/bin/env python3
"""
Download meme templates from Google Drive folder.

Usage:
    # Option 1: Use virtual environment (recommended)
    python3 -m venv venv
    source venv/bin/activate
    pip install gdown
    python download_memes.py

    # Option 2: Manual download
    Go to: https://drive.google.com/drive/folders/1UXKquhbrh_aC48FeqY60TW6YXls9gAMD
    Download all files and place them in: data/memes/
    Then run: python download_memes.py --index-only

This script downloads meme templates from the specified Google Drive folder
and organizes them in the data/memes directory with a searchable index.
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path

# Google Drive folder ID from the URL
# https://drive.google.com/drive/folders/1UXKquhbrh_aC48FeqY60TW6YXls9gAMD
FOLDER_ID = "1UXKquhbrh_aC48FeqY60TW6YXls9gAMD"

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "memes"


def check_gdown():
    """Check if gdown is available."""
    try:
        import gdown
        return True
    except ImportError:
        return False


def install_gdown():
    """Try to install gdown."""
    print("Attempting to install gdown...")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "gdown", "--user"],
            stderr=subprocess.DEVNULL
        )
        return True
    except subprocess.CalledProcessError:
        try:
            # Try with --break-system-packages for newer Python versions
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "gdown", "--break-system-packages"],
                stderr=subprocess.DEVNULL
            )
            return True
        except subprocess.CalledProcessError:
            return False


def download_folder():
    """Download the entire folder from Google Drive."""
    if not check_gdown():
        if not install_gdown():
            return False

    import gdown

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading memes from Google Drive folder: {FOLDER_ID}")
    print(f"Output directory: {OUTPUT_DIR}")

    # Download the folder
    url = f"https://drive.google.com/drive/folders/{FOLDER_ID}"

    try:
        gdown.download_folder(url, output=str(OUTPUT_DIR), quiet=False, use_cookies=False, remaining_ok=True)
        print("\nDownload complete!")
        return True
    except Exception as e:
        print(f"\nError downloading folder: {e}")
        return False


def create_index():
    """Create a searchable index of meme templates."""
    print("\nCreating meme index...")

    if not OUTPUT_DIR.exists():
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    memes = []
    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}

    for file_path in OUTPUT_DIR.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in image_extensions:
            # Generate name and tags from filename
            stem = file_path.stem
            name = stem.replace("-", " ").replace("_", " ").title()

            # Generate tags from filename words
            words = stem.replace("-", " ").replace("_", " ").lower().split()
            tags = list(set(words))  # Unique tags

            meme = {
                "id": stem,
                "name": name,
                "filename": file_path.name,
                "tags": tags
            }
            memes.append(meme)
            print(f"  Indexed: {name} ({len(tags)} tags)")

    # Sort by name
    memes.sort(key=lambda m: m["name"])

    # Save index
    index_path = OUTPUT_DIR / "index.json"
    with open(index_path, "w") as f:
        json.dump(memes, f, indent=2)

    print(f"\nCreated index with {len(memes)} meme templates")
    print(f"Index saved to: {index_path}")

    return memes


def print_summary(memes):
    """Print summary of downloaded memes."""
    print("\n" + "=" * 50)
    print("MEME TEMPLATES SUMMARY")
    print("=" * 50)
    print(f"Total templates: {len(memes)}")
    print(f"Location: {OUTPUT_DIR}")
    print("\nAvailable memes:")
    for meme in memes[:20]:  # Show first 20
        print(f"  - {meme['name']}")
    if len(memes) > 20:
        print(f"  ... and {len(memes) - 20} more")
    print("\nTo use in the editor:")
    print("  1. Restart the backend to load new memes")
    print("  2. Use the 'Memes' panel in the sidebar")
    print("  3. Search by name or tags")


def print_manual_instructions():
    """Print manual download instructions."""
    print("\n" + "=" * 50)
    print("MANUAL DOWNLOAD REQUIRED")
    print("=" * 50)
    print("\ngdown could not be installed automatically.")
    print("\nOption 1: Use a virtual environment")
    print("  python3 -m venv venv")
    print("  source venv/bin/activate  # On Windows: venv\\Scripts\\activate")
    print("  pip install gdown")
    print("  python download_memes.py")
    print("\nOption 2: Download manually")
    print(f"  1. Go to: https://drive.google.com/drive/folders/{FOLDER_ID}")
    print(f"  2. Download all image files")
    print(f"  3. Place them in: {OUTPUT_DIR}")
    print(f"  4. Run: python download_memes.py --index-only")
    print("\nOption 3: Use the Docker container")
    print("  docker exec -it gemini-editor-backend bash")
    print("  pip install gdown")
    print("  python -c \"import gdown; gdown.download_folder('https://drive.google.com/drive/folders/1UXKquhbrh_aC48FeqY60TW6YXls9gAMD', '/app/memes')\"")


def main():
    parser = argparse.ArgumentParser(description='Download meme templates from Google Drive')
    parser.add_argument('--index-only', action='store_true',
                       help='Only create index from existing files (skip download)')
    args = parser.parse_args()

    print("=" * 50)
    print("MEME TEMPLATES DOWNLOADER")
    print("=" * 50)

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.index_only:
        print("Index-only mode: skipping download")
    else:
        # Try to download
        if check_gdown():
            success = download_folder()
        else:
            if install_gdown():
                success = download_folder()
            else:
                success = False
                print_manual_instructions()

    # Check if there are any files to index
    existing_files = list(OUTPUT_DIR.glob("*"))
    image_files = [f for f in existing_files if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}]

    if image_files:
        # Create index
        memes = create_index()
        if memes:
            print_summary(memes)
    else:
        print(f"\nNo image files found in {OUTPUT_DIR}")
        if not args.index_only:
            print_manual_instructions()

    print("\nDone!")


if __name__ == "__main__":
    main()
