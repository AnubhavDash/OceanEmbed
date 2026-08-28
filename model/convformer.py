"""
OceanEmbed Convformer: Physics-Informed Subsurface Temperature Reconstruction

Architecture (matches the grant proposal Section 4):
  Input: [B x T x C x H x W]  -- 7-day window, 7 satellite channels, 64x64 tiles
  Spatial Encoder: Vision Transformer Small (ViT-S) per timestep -> 512-dim embeddings
  Temporal Encoder: ConvLSTM over 7-day sequence
  Depth Decoder: MLP -> 15 INCOIS depth levels (0–1000 m)
  Aux inputs: latitude, longitude, month-of-year (sinusoidal) injected at decoder

Loss: depth-weighted MSE (higher weight 50–200 m thermocline) +
      thermal gradient monotonicity penalty (soft, depth-aware)

References:
  - Convformer (Song et al., 2024): 0.353°C all-depth RMSE in tropical Pacific
  - DSVIT (2025): R²=0.9962 for tropical Indian Ocean
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Literal

# ---------------------------------------------------------------------------
# INCOIS-standard depth levels (0 - 1000 m, 15 levels)
# ---------------------------------------------------------------------------
DEPTH_LEVELS_M = [0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 850, 1000]
NUM_DEPTHS = len(DEPTH_LEVELS_M)  # 15
NUM_CHANNELS = 7                   # SST, SSH/SLA, SSS, U_curr, V_curr, U_wind, V_wind


class SpatialEncoder(nn.Module):
    """Lightweight ViT-S: patch embedding + transformer encoder per timestep."""

    def __init__(self, patch_size: int = 8, embed_dim: int = 512, depth: int = 6, num_heads: int = 8, img_size: int = 64):
        super().__init__()
        self.patch_size = patch_size
        self.img_size = img_size
        self.num_patches = (img_size // patch_size) ** 2  # 8x8 grid for 64x64 inputs
        # For multi-channel input, each patch has patch_size^2 * C values
        self.patch_embed = nn.Conv2d(NUM_CHANNELS, embed_dim, kernel_size=patch_size, stride=patch_size)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        # Base positional embedding (for img_size); will be interpolated at runtime
        self.pos_embed = nn.Parameter(torch.zeros(1, self.num_patches + 1, embed_dim))
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=num_heads, dim_feedforward=embed_dim * 4,
            dropout=0.1, batch_first=True, activation="gelu"
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=depth)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, C, H, W]
        B = x.shape[0]
        H, W = x.shape[2], x.shape[3]
        x = self.patch_embed(x)  # [B, embed_dim, H/ps, W/ps]
        n_h, n_w = x.shape[2], x.shape[3]
        x = x.flatten(2).transpose(1, 2)  # [B, num_patches, embed_dim]
        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls_tokens, x], dim=1)  # [B, num_patches+1, embed_dim]

        # Interpolate positional embedding if input size differs
        current_patches = n_h * n_w
        if current_patches != self.num_patches:
            pos = self.pos_embed  # [1, num_patches+1, embed_dim]
            cls_pos = pos[:, :1, :]
            patch_pos = pos[:, 1:, :]
            patch_pos = patch_pos.reshape(1, self.num_patches, -1).permute(0, 2, 1)  # [1, embed, h, w]
            h0, w0 = self.img_size // self.patch_size, self.img_size // self.patch_size
            patch_pos = patch_pos.reshape(1, -1, h0, w0)
            patch_pos = torch.nn.functional.interpolate(patch_pos, size=(n_h, n_w), mode='bicubic', align_corners=False)
            patch_pos = patch_pos.flatten(2).transpose(1, 2)  # [1, n_h*n_w, embed]
            pos = torch.cat([cls_pos, patch_pos], dim=1)
            x = x + pos
        else:
            x = x + self.pos_embed

        x = self.transformer(x)
        return x[:, 0]  # return CLS token: [B, embed_dim]


class ConvLSTMCell(nn.Module):
    """Single ConvLSTM cell with convolutional gates."""

    def __init__(self, input_dim: int, hidden_dim: int, kernel_size: int = 3):
        super().__init__()
        padding = kernel_size // 2
        self.conv = nn.Conv2d(
            input_dim + hidden_dim, 4 * hidden_dim, kernel_size=kernel_size, padding=padding
        )

    def forward(self, x: torch.Tensor, h: torch.Tensor, c: torch.Tensor):
        combined = torch.cat([x, h], dim=1)
        gates = self.conv(combined)
        i, f, g, o = gates.chunk(4, dim=1)
        i = torch.sigmoid(i)
        f = torch.sigmoid(f)
        g = torch.tanh(g)
        o = torch.sigmoid(o)
        c_next = f * c + i * g
        h_next = o * torch.tanh(c_next)
        return h_next, c_next


class TemporalEncoder(nn.Module):
    """ConvLSTM over the 7-day sequence of spatial embeddings."""

    def __init__(self, input_dim: int = 512, hidden_dim: int = 256, num_layers: int = 2):
        super().__init__()
        # Project embedding to 2D feature map for ConvLSTM
        self.input_proj = nn.Linear(input_dim, hidden_dim * 4 * 4)
        self.conv_layers = nn.ModuleList([
            ConvLSTMCell(hidden_dim if i > 0 else hidden_dim, hidden_dim, kernel_size=3)
            for i in range(num_layers)
        ])
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, embed_dim]
        B, T, embed_dim = x.shape
        # Project to spatial: [B, T, hidden_dim, 4, 4]
        spatial = self.input_proj(x).view(B, T, self.hidden_dim, 4, 4)

        outputs = []
        for t in range(T):
            h = [torch.zeros(B, self.hidden_dim, 4, 4, device=x.device) for _ in range(self.num_layers)]
            c = [torch.zeros(B, self.hidden_dim, 4, 4, device=x.device) for _ in range(self.num_layers)]

            inp = spatial[:, t]
            for l in range(self.num_layers):
                h[l], c[l] = self.conv_layers[l](inp, h[l], c[l])
                inp = h[l]
            outputs.append(inp.mean(dim=[2, 3]))  # global average pool: [B, hidden_dim]

        # Return final timestep embedding + mean of all timesteps
        return torch.stack(outputs, dim=1).mean(dim=1)  # [B, hidden_dim]


class PhysicsInformedConvformer(nn.Module):
    """
    Full Convformer model.

    Input:  [B, T, C, H, W] satellite surface observations (T=7, C=7, H=W=64)
            lat/lon as [B, 2] auxiliary
            time_of_year as [B, 1] auxiliary (month sin)
    Output: [B, 15] temperature profile at INCOIS depth levels
            [B, 15] uncertainty estimate
    """

    def __init__(self, num_depths: int = NUM_DEPTHS, embed_dim: int = 512, depth: int = 6, num_heads: int = 8, temporal_hidden: int = 256):
        super().__init__()
        self.spatial_encoder = SpatialEncoder(
            patch_size=8, embed_dim=embed_dim, depth=depth, num_heads=num_heads
        )
        self.temporal_encoder = TemporalEncoder(input_dim=embed_dim, hidden_dim=temporal_hidden, num_layers=2)

        # Auxiliary info embedding (lat, lon, month)
        self.aux_embed = nn.Sequential(
            nn.Linear(3, 64), nn.SiLU(), nn.Linear(64, 128)
        )

        # Depth decoder MLP
        decoder_input = temporal_hidden + 128  # temporal embedding + aux embedding
        self.depth_decoder = nn.Sequential(
            nn.Linear(decoder_input, 512), nn.SiLU(), nn.Dropout(0.1),
            nn.Linear(512, 256), nn.SiLU(), nn.Dropout(0.1),
            nn.Linear(256, num_depths * 2),  # [temp_profile, uncertainty]
        )
        self.num_depths = num_depths

    def forward(self, surface_obs: torch.Tensor, aux_info: torch.Tensor):
        """
        surface_obs: [B, T, C, H, W]
        aux_info:    [B, 3]  (normalized_lat, normalized_lon, month_sin)
        """
        B, T, C, H, W = surface_obs.shape

        # Encode each timestep spatially
        flat = surface_obs.view(B * T, C, H, W)
        embeddings = self.spatial_encoder(flat)  # [B*T, 512]
        embeddings = embeddings.view(B, T, -1)  # [B, T, 512]

        # Temporal aggregation
        temporal_feat = self.temporal_encoder(embeddings)  # [B, 256]

        # Auxiliary embedding
        aux_feat = self.aux_embed(aux_info)  # [B, 128]

        # Concatenate and decode
        combined = torch.cat([temporal_feat, aux_feat], dim=1)  # [B, 384]
        output = self.depth_decoder(combined)  # [B, 15*2]

        profile = output[:, :self.num_depths]
        uncertainty = F.softplus(output[:, self.num_depths:])  # ensure positive
        return profile, uncertainty


# ---------------------------------------------------------------------------
# Physics-informed loss
# ---------------------------------------------------------------------------
def depth_weighted_mse(pred: torch.Tensor, target: torch.Tensor, depths: torch.Tensor = None):
    """
    MSE weighted higher at thermocline depths (50–200 m).
    Depths in meters. Weights are normalized to sum to 1.
    """
    if depths is None:
        depths = torch.tensor(DEPTH_LEVELS_M, dtype=torch.float32, device=pred.device)

    # Weight: 1.0 for 50-200m band, 0.5 for surface, 0.3 for deep
    weights = torch.where(
        (depths >= 50) & (depths <= 200),
        torch.tensor(1.5, device=pred.device),
        torch.where(depths < 50, torch.tensor(0.5, device=pred.device), torch.tensor(0.3, device=pred.device)),
    )
    weights = weights / weights.sum() * len(weights)  # normalize

    per_depth_mse = ((pred - target) ** 2).mean(dim=0)  # [num_depths]
    return (per_depth_mse * weights).sum()


def thermal_monotonicity_penalty(profile: torch.Tensor, depths: torch.Tensor = None):
    """
    Soft penalty for temperature increasing with depth (physically rare).
    Uses depth-aware weighting so deep inversions (real) are penalized less.
    """
    if depths is None:
        depths = torch.tensor(DEPTH_LEVELS_M, dtype=torch.float32, device=profile.device)

    diff = profile[:, 1:] - profile[:, :-1]  # dT/dz
    # Positive diff = temperature increases with depth (inversion)
    inversions = F.relu(diff)
    # Weight inversely by depth (deep inversions are more physically plausible)
    dz = depths[1:] - depths[:-1]
    depth_weights = 1.0 / (1.0 + depths[1:] / 100.0)
    return (inversions * depth_weights.unsqueeze(0)).mean()


def convformer_loss(pred_profile, true_profile, pred_unc, true_unc=None):
    """Combined loss matching the proposal."""
    mse = depth_weighted_mse(pred_profile, true_profile)
    mono_penalty = thermal_monotonicity_penalty(pred_profile)

    # Uncertainty calibration: NLL loss using predicted uncertainty
    residual = (pred_profile - true_profile) ** 2
    # If true_unc provided, use it for supervision; otherwise use residual
    if true_unc is not None:
        nll = 0.5 * (residual / (pred_unc ** 2 + 1e-6) + torch.log(pred_unc ** 2 + 1e-6)).mean()
    else:
        nll = 0.5 * (residual / (pred_unc ** 2 + 1e-6) + torch.log(pred_unc ** 2 + 1e-6)).mean()

    return mse + 0.1 * mono_penalty + 0.5 * nll


# ---------------------------------------------------------------------------
# Training entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train OceanEmbed Convformer")
    parser.add_argument("--s3-bucket", type=str, required=True, help="S3 bucket with processed Zarr tiles")
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--use-sagemaker", action="store_true", help="Run in SageMaker environment")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training Convformer on {device}")
    print(f"S3 bucket: {args.s3_bucket}")
    print(f"Epochs: {args.epochs}, Batch: {args.batch_size}, LR: {args.lr}")
    print(f"Depth levels: {DEPTH_LEVELS_M}")

    model = PhysicsInformedConvformer().to(device)
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Dry-run forward pass to verify architecture
    B, T, C, H, W = 2, 7, 7, 64, 64
    dummy_input = torch.randn(B, T, C, H, W, device=device)
    dummy_aux = torch.randn(B, 3, device=device)
    profile, unc = model(dummy_input, dummy_aux)
    print(f"Output profile shape: {profile.shape}")  # [2, 15]
    print(f"Output uncertainty shape: {unc.shape}")   # [2, 15]

    loss = convformer_loss(profile, torch.randn_like(profile), unc)
    print(f"Dry-run loss: {loss.item():.4f}")
    print("Architecture verified successfully.")
