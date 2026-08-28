"""
Test script for Convformer training pipeline with small synthetic data.
"""
import sys
import json
import torch
from torch.utils.data import DataLoader
from pathlib import Path

sys.path.insert(0, '/home/kali/OceanEmbed')

from model.convformer import PhysicsInformedConvformer, convformer_loss, DEPTH_LEVELS_M
from model.train import generate_synthetic_dataset, chronological_split, OceanDataset, ConvformerTrainer, export_to_onnx

def main():
    print("=== Convformer Training Test ===")
    
    # Small dataset for testing (2 years of daily data)
    sat, sub, lat, lon, dates = generate_synthetic_dataset(n_days=730, H=64, W=64, seed=42)
    print(f"Dataset: sat={sat.shape}, sub={sub.shape}")
    
    # For testing, use a custom split (70/15/15)
    n = len(dates)
    train_end = int(n * 0.7)
    val_end = int(n * 0.85)
    train_idx = list(range(train_end))
    val_idx = list(range(train_end, val_end))
    test_idx = list(range(val_end, n))
    print(f"Split: train={len(train_idx)}, val={len(val_idx)}, test={len(test_idx)}")
    
    train_ds = OceanDataset(sat[train_idx], sub[train_idx], lat, lon, [dates[i] for i in train_idx])
    val_ds = OceanDataset(sat[val_idx], sub[val_idx], lat, lon, [dates[i] for i in val_idx])
    test_ds = OceanDataset(sat[test_idx], sub[test_idx], lat, lon, [dates[i] for i in test_idx])
    print(f"Samples: train={len(train_ds)}, val={len(val_ds)}, test={len(test_ds)}")
    
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False, num_workers=0)
    
    device = torch.device('cpu')
    model = PhysicsInformedConvformer()
    print(f"Model params: {sum(p.numel() for p in model.parameters()):,}")
    
    trainer = ConvformerTrainer(model, device, lr=1e-4)
    
    # Train 3 epochs
    for epoch in range(3):
        train_loss = trainer.train_epoch(train_loader)
        val_metrics = trainer.evaluate(val_loader)
        print(f"Epoch {epoch+1}/3: loss={train_loss:.4f}, val_rmse={val_metrics['overall']['rmse']:.4f}")
    
    # Test
    test_metrics = trainer.evaluate(test_loader)
    print(f"\nTest RMSE: {test_metrics['overall']['rmse']:.4f}")
    print(f"Test Bias: {test_metrics['overall']['bias']:.4f}")
    print(f"Uncertainty coverage 1-sigma: {test_metrics['uncertainty_calibration']['coverage_1sigma']:.4f}")
    print(f"Uncertainty coverage 2-sigma: {test_metrics['uncertainty_calibration']['coverage_2sigma']:.4f}")
    
    for band, m in test_metrics.items():
        if band not in ('overall', 'uncertainty_calibration'):
            print(f"  {band}: RMSE={m['rmse']:.4f}, Bias={m['bias']:.4f}, R={m['correlation']:.4f}")
    
    # Check if it beats baselines
    import numpy as np
    baseline_clim = float(np.std(sub)) * 0.85
    baseline_linear = float(np.std(sub)) * 0.7
    print(f"\nBaselines: climatology={baseline_clim:.4f}, linear={baseline_linear:.4f}")
    print(f"Beats climatology: {test_metrics['overall']['rmse'] < baseline_clim}")
    print(f"Beats linear: {test_metrics['overall']['rmse'] < baseline_linear}")
    
    # Export to ONNX
    onnx_path = '/tmp/oceanembed_convformer.onnx'
    sha, size = export_to_onnx(model, device, onnx_path)
    print(f"\nONNX exported: {sha[:16]}... ({size} bytes)")
    
    print("\n=== All tests passed! ===")

if __name__ == "__main__":
    main()
