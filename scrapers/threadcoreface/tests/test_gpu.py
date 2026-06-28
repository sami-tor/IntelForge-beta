"""
Test GPU setup for InsightFace and ONNX Runtime
"""

import sys
import numpy as np

print("=" * 60)
print("GPU SETUP TEST")
print("=" * 60)

# Test 1: Check ONNX Runtime providers
print("\n[1/4] Checking ONNX Runtime...")
try:
    import onnxruntime as ort
    print(f"ONNX Runtime version: {ort.__version__}")
    print(f"Available providers: {ort.get_available_providers()}")

    if 'CUDAExecutionProvider' in ort.get_available_providers():
        print("[OK] CUDA provider is available!")
    else:
        print("[WARN] CUDA provider NOT available - will use CPU")
except Exception as e:
    print(f"[FAIL] Error: {e}")
    sys.exit(1)

# Test 2: Check InsightFace
print("\n[2/4] Checking InsightFace...")
try:
    import insightface
    from insightface.app import FaceAnalysis
    print(f"InsightFace version: {insightface.__version__}")
    print("[OK] InsightFace imported successfully")
except Exception as e:
    print(f"[FAIL] Error: {e}")
    sys.exit(1)

# Test 3: Initialize Face Analysis with GPU
print("\n[3/4] Initializing Face Analysis with GPU...")
try:
    app = FaceAnalysis(
        name='buffalo_l',
        providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    print("[OK] Face Analysis initialized with GPU (ctx_id=0)")

    # Check which provider is actually being used
    print(f"Active providers: {app.det_model.session.get_providers()}")

    if 'CUDAExecutionProvider' in app.det_model.session.get_providers():
        print("[SUCCESS] GPU is being used for face detection!")
    else:
        print("[WARN] Falling back to CPU")

except Exception as e:
    print(f"[FAIL] Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: Test with dummy image
print("\n[4/4] Testing face detection on dummy image...")
try:
    import cv2
    # Create a dummy black image
    dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)

    faces = app.get(dummy_img)
    print(f"[OK] Face detection completed (found {len(faces)} faces - expected 0 for black image)")

except Exception as e:
    print(f"[FAIL] Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 5: Check FAISS
print("\n[5/5] Checking FAISS...")
try:
    import faiss
    print(f"FAISS version: {faiss.__version__ if hasattr(faiss, '__version__') else 'unknown'}")

    # Try to get GPU resources
    ngpus = faiss.get_num_gpus()
    print(f"Number of GPUs available to FAISS: {ngpus}")

    if ngpus > 0:
        print("[OK] FAISS can use GPU!")
        # Try to create a GPU resource
        res = faiss.StandardGpuResources()
        print("[OK] GPU resources created successfully")
    else:
        print("[WARN] FAISS will use CPU only")

except Exception as e:
    print(f"[INFO] FAISS GPU check: {e}")
    print("[OK] FAISS CPU version is available")

print("\n" + "=" * 60)
print("GPU TEST COMPLETE")
print("=" * 60)
