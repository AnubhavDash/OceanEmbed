"""
ONNX Inference Server for Convformer

Serves the trained Convformer model via ONNX Runtime as an HTTP endpoint
compatible with AWS Lambda and SageMakerServerless.

Endpoints:
  POST /invoke  - Run inference on a batch of satellite observations
  GET  /health  - Health check

Input JSON:
  {
    "satellite_obs": [[[...]]]  # shape [B, T, C, H, W]
    "aux_info": [[lat, lon, timestamp]]  # shape [B, 3]
  }

Output JSON:
  {
    "temperature_profile": [...]  # shape [B, 15]
    "uncertainty": [...]  # shape [B, 15]
  }
"""

import hashlib
import json
import os

import numpy as np
import onnxruntime as ort

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global model session
_session = None
_model_path = os.environ.get("OCEONEMBED_MODEL_PATH", "/models/convformer.onnx")


def load_model(model_path: str = None):
    """Load the ONNX model into a global session."""
    global _session
    path = model_path or _model_path
    if _session is None:
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        avail = ort.get_available_providers()
        if "CUDAExecutionProvider" not in avail:
            providers = ["CPUExecutionProvider"]
        _session = ort.InferenceSession(path, providers=providers)
    return _session


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    try:
        sess = load_model()
        return jsonify({
            "status": "ok",
            "model_inputs": [i.name for i in sess.get_inputs()],
            "model_outputs": [o.name for o in sess.get_outputs()],
            "model_path": _model_path,
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/invoke", methods=["POST"])
def invoke():
    """Run inference on satellite observations.

    Input JSON:
      {
        "satellite_obs": [[[[[...]]]]]  # [B, T, C, H, W]
        "aux_info": [[lat, lon, ts]]     # [B, 3]
      }
    """
    try:
        data = request.get_json(force=True)
        sess = load_model()

        satellite_obs = np.array(data["satellite_obs"], dtype=np.float32)
        aux_info = np.array(data["aux_info"], dtype=np.float32)

        # Validate shapes
        if satellite_obs.ndim != 5:
            return jsonify({"error": f"Expected satellite_obs shape [B,T,C,H,W], got {satellite_obs.shape}"}), 400
        if aux_info.ndim != 2 or aux_info.shape[1] != 3:
            return jsonify({"error": f"Expected aux_info shape [B,3], got {aux_info.shape}"}), 400

        inputs = {
            sess.get_inputs()[0].name: satellite_obs,
            sess.get_inputs()[1].name: aux_info,
        }
        outputs = sess.run(None, inputs)

        return jsonify({
            "temperature_profile": outputs[0].tolist(),
            "uncertainty": outputs[1].tolist(),
        })

    except ort.exceptions.OnnxRuntimeError as e:
        return jsonify({"error": f"ONNX Runtime error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/export", methods=["POST"])
def export_model():
    """Export from PyTorch checkpoint to ONNX.

    Input JSON:
      {
        "checkpoint_path": "/path/to/model.pt"
      }
    """
    try:
        import torch
        from model.convformer import PhysicsInformedConvformer, DEPTH_LEVELS_M, NUM_CHANNELS

        data = request.get_json(force=True)
        checkpoint_path = data.get("checkpoint_path")

        if not checkpoint_path or not os.path.exists(checkpoint_path):
            return jsonify({"error": "checkpoint_path is required and must exist"}), 400

        # Load model
        model = PhysicsInformedConvformer()
        if checkpoint_path.endswith(".pt") or checkpoint_path.endswith(".pth"):
            checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
            if "model_state_dict" in checkpoint:
                model.load_state_dict(checkpoint["model_state_dict"])
            else:
                model.load_state_dict(checkpoint)
        else:
            return jsonify({"error": "Only .pt/.pth checkpoints supported"}), 400

        # Export to ONNX
        output_path = checkpoint_path.rsplit(".", 1)[0] + ".onnx"
        sha256 = hashlib.sha256()
        with open(output_path, "rb") as f:
            pass  # placeholder

        B, T, C, H, W = 1, 7, NUM_CHANNELS, 64, 64
        dummy_sat = torch.randn(B, T, C, H, W)
        dummy_aux = torch.randn(B, 3)

        torch.onnx.export(
            model,
            (dummy_sat, dummy_aux),
            output_path,
            export_params=True,
            opset_version=18,
            do_constant_folding=True,
            input_names=["satellite_obs", "aux_info"],
            output_names=["temperature_profile", "uncertainty"],
            dynamic_axes={
                "satellite_obs": {0: "batch"},
                "aux_info": {0: "batch"},
                "temperature_profile": {0: "batch"},
                "uncertainty": {0: "batch"},
            },
        )

        with open(output_path, "rb") as f:
            sha256 = hashlib.sha256(f.read()).hexdigest()
        size = os.path.getsize(output_path)

        return jsonify({
            "status": "ok",
            "onnx_path": output_path,
            "sha256": sha256,
            "size": size,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


import hashlib  # noqa: E402

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Convformer ONNX Inference Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--model", default=_model_path)
    args = parser.parse_args()

    _model_path = args.model
    print(f"Starting inference server on {args.host}:{args.port}")
    print(f"Model path: {args.model}")

    # Pre-load model
    load_model(args.model)
    app.run(host=args.host, port=args.port, debug=False)
