import cv2

if not cv2.__version__.startswith("5."):
    raise RuntimeError(f"OpenCV 5 is required; found {cv2.__version__}")

print({"worker": "oceanembed-opencv", "opencv_version": cv2.__version__, "status": "ready"})
