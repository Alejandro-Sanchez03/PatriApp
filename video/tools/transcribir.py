import sys, subprocess, numpy as np, sherpa_onnx as so
import os; d=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","models","whisper-small","")
r=so.OfflineRecognizer.from_whisper(encoder=d+"small-encoder.int8.onnx",decoder=d+"small-decoder.int8.onnx",tokens=d+"small-tokens.txt",language="es",task="transcribe",num_threads=4)
for f in sys.argv[1:]:
    pcm=subprocess.run(["ffmpeg","-v","error","-i",f,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
    a=np.frombuffer(pcm,np.float32); print("==",f.split("/")[-1][:8], len(a)/16000)
    for i in range(0,len(a),16000*25):
        s=r.create_stream(); s.accept_waveform(16000,a[i:i+16000*25]); r.decode_stream(s)
        print(f"  [{i//16000:>3}s] {s.result.text}")
