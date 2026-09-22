import os
import sys
import logging
import time
from pathlib import Path
from PIL import Image
from icrawler.builtin import BingImageCrawler

# Silence excessive icrawler logs
logging.getLogger('icrawler').setLevel(logging.ERROR)

PATTERNS = [
    "Head and Shoulders",
    "Inverse Head and Shoulders",
    "Double Top",
    "Double Bottom",
    "Triple Top",
    "Triple Bottom",
    "Ascending Triangle",
    "Descending Triangle",
    "Symmetrical Triangle",
    "Cup and Handle",
    "Inverse Cup and Handle",
    "Bullish Flag",
    "Bearish Flag",
    "Bullish Pennant",
    "Bearish Pennant",
    "Rising Wedge",
    "Falling Wedge",
    "Rounding Bottom",
    "Broadening Top",
    "Diamond Top"
]

TARGET_ROOT = Path(__file__).resolve().parent
MIN_WIDTH = 300
MIN_HEIGHT = 300
MIN_REQUIRED = 10
TARGET_COUNT = 15

def clean_and_verify_folder(folder_path: Path) -> int:
    """Removes invalid, corrupt, or undersized images and returns valid image count."""
    valid_count = 0
    if not folder_path.exists():
        return 0

    for file_path in list(folder_path.iterdir()):
        if file_path.is_file() and file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']:
            try:
                with Image.open(file_path) as img:
                    width, height = img.size
                    if width < MIN_WIDTH or height < MIN_HEIGHT:
                        img.close()
                        file_path.unlink(missing_ok=True)
                    else:
                        valid_count += 1
            except Exception:
                try:
                    file_path.unlink(missing_ok=True)
                except Exception:
                    pass

    return valid_count

def crawl_pattern(pattern: str, pattern_dir: Path, target_count: int = TARGET_COUNT):
    """Crawls images for a pattern using multiple query variations until target_count is reached."""
    current_count = clean_and_verify_folder(pattern_dir)
    if current_count >= target_count:
        return current_count

    queries = [
        f'"{pattern}" stock chart pattern technical analysis',
        f'{pattern} chart pattern technical analysis trading',
        f'{pattern} chart pattern stock market',
        f'{pattern} breakout chart pattern',
    ]

    for q in queries:
        needed = target_count - current_count + 10  # request buffer
        crawler = BingImageCrawler(
            feeder_threads=2,
            parser_threads=2,
            downloader_threads=4,
            storage={'root_dir': str(pattern_dir)},
            log_level=logging.ERROR
        )
        try:
            crawler.crawl(
                keyword=q,
                max_num=needed,
                min_size=(MIN_WIDTH, MIN_HEIGHT),
                file_idx_offset='auto'
            )
        except Exception as e:
            pass

        current_count = clean_and_verify_folder(pattern_dir)
        if current_count >= target_count:
            break
        time.sleep(0.5)

    return current_count

def download_pattern_images():
    print("=" * 70)
    print("      AUTOMATED CLASSICAL CHART PATTERN IMAGE DOWNLOADER")
    print("=" * 70)
    print(f"Target Root Directory: {TARGET_ROOT}")
    print(f"Total Patterns: {len(PATTERNS)}")
    print(f"Target Download Count: {TARGET_COUNT} images/pattern (Min: {MIN_REQUIRED})")
    print(f"Min Resolution: {MIN_WIDTH}x{MIN_HEIGHT} px")
    print("=" * 70)

    for idx, pattern in enumerate(PATTERNS, 1):
        safe_folder_name = pattern.replace("/", "_").replace("\\", "_").strip()
        pattern_dir = TARGET_ROOT / safe_folder_name
        pattern_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n[{idx}/{len(PATTERNS)}] Checking & Fetching: '{pattern}'")
        valid_count = crawl_pattern(pattern, pattern_dir, TARGET_COUNT)
        print(f"  -> Valid images verified: {valid_count}")

    # =========================================================================
    # Automated Verification & Summary Loop
    # =========================================================================
    print("\n" + "=" * 70)
    print("                    DOWNLOAD VERIFICATION SUMMARY")
    print("=" * 70)
    print(f"{'#':<4}{'Pattern Name':<35}{'Folder Count':<15}{'Status'}")
    print("-" * 70)

    flagged_folders = []
    total_downloaded = 0

    for idx, pattern in enumerate(PATTERNS, 1):
        safe_folder_name = pattern.replace("/", "_").replace("\\", "_").strip()
        pattern_dir = TARGET_ROOT / safe_folder_name
        valid_count = clean_and_verify_folder(pattern_dir)
        total_downloaded += valid_count

        if valid_count >= MIN_REQUIRED:
            status = f"PASS ({valid_count} images)"
        else:
            status = f"FLAGGED (< {MIN_REQUIRED} images: {valid_count})"
            flagged_folders.append((pattern, valid_count))

        print(f"{idx:<4}{pattern:<35}{valid_count:<15}{status}")

    print("=" * 70)
    print(f"Total Valid Images Downloaded: {total_downloaded}")
    if flagged_folders:
        print(f"WARNING: {len(flagged_folders)} folder(s) have fewer than {MIN_REQUIRED} images:")
        for name, cnt in flagged_folders:
            print(f"  - {name}: {cnt} images")
    else:
        print("SUCCESS: All folders meet the minimum requirement of >= 10 valid images.")
    print("=" * 70)

if __name__ == '__main__':
    download_pattern_images()
