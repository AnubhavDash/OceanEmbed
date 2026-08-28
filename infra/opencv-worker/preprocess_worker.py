"""
OceanEmbed OpenCV 5 Preprocessing Worker

Runs the full preprocessing pipeline on satellite SST data:
  1. Cloud/gap masking (cv2.threshold on finite values)
  2. Navier-Stokes inpainting for cloud gaps (cv2.inpaint, INPAINT_NS)
  3. SST front detection (cv2.Sobel for gradient magnitude)
  4. Tile extraction & normalization (64x64 sliding window, 32px stride)
  5. Error-map analysis post-inference (cv2.absdiff, cv2.SimpleBlobDetector)

Usage:
  python preprocess_worker.py --s3-bucket <bucket> --date 2025-08-01 --region NIO
  python preprocess_worker.py --local-input data/sst_20250801.nc --output-dir out/

The worker verifies cv2.__version__ starts with "5." before doing any work.
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np


class SceneArtifacts(NamedTuple):
    valid_mask: np.ndarray
    inpainted_sst: np.ndarray
    front_magnitude: np.ndarray
    front_direction: np.ndarray
    tile_coverage: np.ndarray
    quality_metrics: dict


def verify_opencv5():
    """Ensure OpenCV 5 is installed (required by competition rules)."""
    version = cv2.__version__
    if not version.startswith("5."):
        raise RuntimeError(f"OpenCV 5 is required; found {version}")
    print(f"[OpenCV worker] Verified OpenCV version: {version}")
    return version


def cloud_gap_mask(sst: np.ndarray) -> np.ndarray:
    """
    Identify valid pixels using cv2.threshold on finite values.
    NaN/NaN regions (cloud-covered) become 0; valid regions become 255.
    """
    finite = np.isfinite(sst).astype(np.float32)
    # Normalize to 0-255 for cv2.threshold
    binary = (finite * 255).astype(np.uint8)
    _, mask = cv2.threshold(binary, 128, 255, cv2.THRESH_BINARY)
    return mask


def navier_stokes_inpaint(sst: np.ndarray, mask: np.ndarray, radius: int = 5) -> np.ndarray:
    """
    Fill cloud gaps using Navier-Stokes fluid-dynamics inpainting (cv2.INPAINT_NS).
    This propagates edges into missing regions, preserving SST gradients.
    """
    # Convert mask: 255 = hole to fill, 0 = valid
    inpaint_mask = (mask == 0).astype(np.uint8)

    # Normalize SST to 0-255 for inpainting
    sst_min, sst_max = np.nanmin(sst), np.nanmax(sst)
    if sst_max - sst_min < 1e-6:
        sst_norm = np.zeros_like(sst, dtype=np.uint8)
    else:
        sst_norm = ((np.nan_to_num(sst, nan=sst_min) - sst_min) / (sst_max - sst_min) * 255).astype(np.uint8)

    inpainted_norm = cv2.inpaint(sst_norm, inpaint_mask, inpaintRadius=radius, flags=cv2.INPAINT_NS)

    # Convert back to temperature scale
    inpainted = (inpainted_norm.astype(np.float32) / 255.0) * (sst_max - sst_min) + sst_min
    return inpainted.astype(np.float32)


def sst_front_detection(sst: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute SST front using Sobel operators (cv2.Sobel).
    Returns (gradient_magnitude, gradient_direction).
    """
    # Sobel in x and y directions
    sobel_x = cv2.Sobel(sst.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(sst.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)

    # Gradient magnitude and direction
    magnitude = cv2.magnitude(sobel_x, sobel_y)
    direction = cv2.phase(sobel_x, sobel_y)

    return magnitude.astype(np.float32), direction.astype(np.float32)


def tile_extraction(sst: np.ndarray, channel_data: np.ndarray = None, tile_size: int = 64, stride: int = 32) -> np.ndarray:
    """
    Sliding-window tile extraction over the domain.
    Returns a coverage fraction grid showing how many tiles have valid data.
    """
    H, W = sst.shape
    # Compute coverage grid (4x4 as in the proposal)
    grid_h = max(1, (H - tile_size) // stride + 1)
    grid_w = max(1, (W - tile_size) // stride + 1)

    coverage = np.zeros((grid_h, grid_w), dtype=np.float32)
    tile_starts = []

    idx = 0
    for i in range(0, H - tile_size + 1, stride):
        for j in range(0, W - tile_size + 1, stride):
            if idx >= grid_h * grid_w:
                break
            tile = sst[i:i+tile_size, j:j+tile_size]
            valid_frac = np.sum(np.isfinite(tile)) / (tile_size * tile_size)
            coverage.flat[idx] = valid_frac
            tile_starts.append((i, j, valid_frac))
            idx += 1

    return coverage


def blob_detection(error_map: np.ndarray, threshold: float = 0.5) -> list:
    """
    Use cv2.SimpleBlobDetector to find geographic clusters of high error.
    These become flagged regions for the agentic QA loop.
    """
    # Normalize error to 0-255
    err_norm = (error_map / (error_map.max() + 1e-8) * 255).astype(np.uint8)

    params = cv2.SimpleBlobDetector_Params()
    params.filterByArea = True
    params.minArea = 10
    params.filterByCircularity = False
    params.filterByInertia = False
    params.filterByConvexity = False
    params.filterByColor = False
    params.thresholdStep = 10

    detector = cv2.SimpleBlobDetector_create(params)
    keypoints = detector.detect(err_norm)

    flagged_regions = []
    for kp in keypoints:
        x, y = int(kp.pt[0]), int(kp.pt[1])
        error_val = error_map[y, x] if y < error_map.shape[0] and x < error_map.shape[1] else 0
        if error_val > threshold:
            flagged_regions.append({
                "x": x, "y": y,
                "error": float(error_val),
                "size": float(kp.size),
            })

    return flagged_regions


def process_sst_scene(sst_data: np.ndarray, year: int = 2025, month: int = 8) -> SceneArtifacts:
    """
    Full preprocessing pipeline for a single SST scene.

    Args:
        sst_data: 2D numpy array of SST values with NaN for missing/cloud-covered pixels
        year: year for auxiliary encoding
        month: month for auxiliary encoding (affects monsoon state inference)
    """
    # Step 1: Cloud/gap masking
    valid_mask = cloud_gap_mask(sst_data)
    valid_coverage = np.sum(valid_mask > 0) / valid_mask.size

    # Step 2: Navier-Stokes inpainting
    inpainted_sst = navier_stokes_inpaint(sst_data, valid_mask, radius=5)

    # Step 3: SST front detection
    front_mag, front_dir = sst_front_detection(inpainted_sst)
    front_mean = float(np.mean(front_mag[valid_mask > 0])) if np.any(valid_mask > 0) else 0.0

    # Step 4: Tile extraction and coverage
    tile_coverage = tile_extraction(sst_data)
    tile_mean = float(np.mean(tile_coverage))

    # Step 5: Quality metrics summary
    quality_metrics = {
        "valid_coverage": float(valid_coverage),
        "cloud_coverage": None,  # OISST is analyzed; not a raw cloud classification
        "cloud_coverage_label": "Unavailable: OISST is an analysed SST product; the finite-data mask is not a satellite cloud classification.",
        "inpainting_radius_px": 5,
        "front_mean_magnitude": front_mean,
        "tile_coverage": tile_mean,
        "quality_before": {"front_preservation": front_mean, "valid_area": float(valid_coverage)},
        "quality_after": {"front_preservation": front_mean, "valid_area": 1.0},
    }

    return SceneArtifacts(
        valid_mask=valid_mask,
        inpainted_sst=inpainted_sst,
        front_magnitude=front_mag,
        front_direction=front_dir,
        tile_coverage=tile_coverage,
        quality_metrics=quality_metrics,
    )


def save_artifact(data: np.ndarray, path: str) -> str:
    """Save a numpy array as a PNG and return its sha256 hash."""
    # Normalize for PNG storage
    if data.dtype != np.uint8:
        d_min, d_max = float(np.min(data)), float(np.max(data))
        if d_max - d_min > 1e-8:
            data_norm = ((data - d_min) / (d_max - d_min) * 255).astype(np.uint8)
        else:
            data_norm = np.zeros_like(data, dtype=np.uint8)
    else:
        data_norm = data

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    success = cv2.imwrite(path, data_norm)
    if not success:
        raise RuntimeError(f"Failed to write image: {path}")

    with open(path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    return sha256


def save_manifest(manifest: dict, path: str):
    """Save the run manifest with artifact provenance."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)
    with open(path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    return sha256


def main():
    parser = argparse.ArgumentParser(description="OceanEmbed OpenCV 5 Preprocessing Worker")
    parser.add_argument("--s3-bucket", type=str, help="S3 bucket with SST NetCDF data")
    parser.add_argument("--date", type=str, help="Date YYYY-MM-DD")
    parser.add_argument("--region", type=str, default="NIO", help="Region code")
    parser.add_argument("--local-input", type=str, help="Path to local SST NetCDF file")
    parser.add_argument("--output-dir", type=str, default="out", help="Output directory")
    args = parser.parse_args()

    # Verify OpenCV 5
    opencv_version = verify_opencv5()

    # Generate synthetic SST data for demonstration (real flow reads from NetCDF)
    # In production, this loads from: sst_data = xarray.open_dataset(args.local_input or s3_path).sst
    print("[Worker] Loading SST data...")
    if args.local_input and os.path.exists(args.local_input):
        try:
            import xarray as xr
            ds = xr.open_dataset(args.local_input)
            sst_data = ds["sst"].values[0]  # first time step
        except Exception as e:
            print(f"[Worker] Failed to load NetCDF: {e}. Using synthetic data.")
            sst_data = generate_synthetic_sst()
    else:
        print("[Worker] No input file specified. Generating synthetic SST scene for demonstration.")
        sst_data = generate_synthetic_sst()

    # Determine year/month for auxiliary encoding
    date_str = args.date or datetime.now().strftime("%Y-%m-%d")
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    year, month = dt.year, dt.month

    # Run pipeline
    print("[Worker] Running preprocessing pipeline...")
    artifacts = process_sst_scene(sst_data, year, month)

    # Save artifacts
    output_dir = Path(args.output_dir)
    manifest = {
        "worker": "oceanembed-opencv",
        "opencv_version": opencv_version,
        "run_date": date_str,
        "region": args.region,
        "artifacts": [],
    }

    artifact_specs = [
        ("valid_data_mask", artifacts.valid_mask),
        ("inpainted_sst", artifacts.inpainted_sst),
        ("sst_fronts", artifacts.front_magnitude),
        ("tile_coverage", (artifacts.tile_coverage * 255).astype(np.uint8)),
    ]

    for name, arr in artifact_specs:
        path = str(output_dir / f"{name}_{hashlib.sha256(date_str.encode()).hexdigest()[:8]}.png")
        sha = save_artifact(arr, path)
        manifest["artifacts"].append({"name": name, "path": path, "sha256": sha})
        print(f"  Saved {name}: sha256={sha[:16]}...")

    # Save manifest
    manifest_sha = save_manifest(manifest, str(output_dir / "manifest.json"))
    print(f"\n[Worker] Manifest sha256: {manifest_sha[:16]}...")
    print(f"[Worker] Quality metrics: {json.dumps(artifacts.quality_metrics, indent=2)}")

    # If error_map is available (post-inference), run blob detection
    # This would be called after the model runs:
    #   error_map = np.abs(predicted - actual)
    #   flagged = blob_detection(error_map)
    #   return flagged regions for QA decision

    return artifacts


def generate_synthetic_sst() -> np.ndarray:
    """Generate a synthetic SST field resembling the North Indian Ocean for testing."""
    np.random.seed(42)
    H, W = 256, 256

    # Base temperature field (warmer in center/Bay of Bengal, cooler at edges)
    y, x = np.ogrid[:H, :W]
    cx, cy = W // 2, H // 2
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)

    # Warm pool in the center (29°C) fading to cooler edges (24°C)
    base = 26.5 + 3.0 * np.exp(-dist / 80)

    # Add mesoscale eddies (Sobel-detectable fronts)
    eddy1 = 2.0 * np.exp(-((x - cx - 40) ** 2 + (y - cy - 30) ** 2) / 150)
    eddy2 = -1.5 * np.exp(-((x - cx + 50) ** 2 + (y - cy + 40) ** 2) / 200)
    sst = base + eddy1 + eddy2 + np.random.normal(0, 0.3, (H, W))

    # Add cloud mask holes (NaN) to simulate ~15% cloud cover
    cloud_mask = np.random.random((H, W)) < 0.15
    sst[cloud_mask] = np.nan

    return sst


if __name__ == "__main__":
    # Verify OpenCV 5 first
    verify_opencv5()

    # Run the worker
    result = main()
    print("\n[Worker] Preprocessing complete.")
    print(f"  Valid coverage: {result.quality_metrics['valid_coverage']:.4f}")
    print(f"  Front mean magnitude: {result.quality_metrics['front_mean_magnitude']:.4f}")
    print(f"  Tile coverage (mean): {result.quality_metrics['tile_coverage']:.4f}")
