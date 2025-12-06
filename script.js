// Marcadores internos
const _ecSeed37 = 37;
const _ecRevCode = 1201;
const _ecBuildYear = 2025;
const _ecB64 = "RUMtTVpGLTIwMjUtMTItMDEtQjFBLTQw";

function _ecDecodeSignature() {
  try {
    const raw = atob(_ecB64);
    return raw.split("-").slice(0, 4).join("-");
  } catch (e) {
    return _ecSeed37 + "-" + _ecRevCode + "-" + _ecBuildYear;
  }
}

function _ecPaddingHelper(v) {
  return String(v).padStart(2, "0");
}

// API Railway
const API_URL = "https://video-converter-api-production-bb8e.up.railway.app/convert";

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const switchCameraBtn = document.getElementById('switch-camera');
const photoPreview = document.getElementById('photo-preview');
const previewContainer = document.getElementById('preview-container');
const saveBtn = document.getElementById('save-btn');
const retryBtn = document.getElementById('retry-btn');
const instructions = document.getElementById('instructions');

const startRecordBtn = document.getElementById('start-recording');
const stopRecordBtn = document.getElementById('stop-recording');
const recordingIndicator = document.getElementById('recording-indicator');
const recordingCanvas = document.getElementById('recordingCanvas');

const videoPreviewContainer = document.getElementById('video-preview-container');
const videoPreviewEl = document.getElementById('video-preview');
const saveVideoBtn = document.getElementById('save-video-btn');
const videoInstructions = document.getElementById('video-instructions');

const loadingMessage = document.getElementById('loading-message');

let usingFrontCamera = true;
let stream;

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordStartTime = 0;
let recordTimerInterval = null;
let recordedMimeType = 'video/webm';
let lastVideoUrl = null;

const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

function showLoading() {
  loadingMessage.style.display = 'block';
}

function hideLoading() {
  loadingMessage.style.display = 'none';
}

function setButtonsDisabledDuringProcess(disabled) {
  switchCameraBtn.disabled = disabled;
  captureBtn.disabled = disabled;
  startRecordBtn.disabled = disabled;
  stopRecordBtn.disabled = disabled;
}

async function startCamera() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  if (stream) stream.getTracks().forEach(track => track.stop());
  const constraints = {
    video: {
      facingMode: usingFrontCamera ? 'user' : 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: true
  };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  video.style.transform = usingFrontCamera ? 'scaleX(-1)' : 'scaleX(1)';
  overlay.style.transform = 'scaleX(1)';
}

switchCameraBtn.onclick = () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
};

// FOTO
captureBtn.onclick = () => {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const width = settings.width;
  const height = settings.height;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (usingFrontCamera) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(overlay, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/png');
  photoPreview.src = dataUrl;
  previewContainer.style.display = 'flex';
};

saveBtn.onclick = () => {
  const link = document.createElement('a');
  link.download = 'foto-moldura.png';
  link.href = photoPreview.src;
  link.click();
  if (isiOS) {
    instructions.style.display = 'block';
  }
};

retryBtn.onclick = () => {
  previewContainer.style.display = 'none';
  instructions.style.display = 'none';
};

function startRecordingTimer() {
  recordStartTime = Date.now();
  recordingIndicator.style.display = 'block';
  recordingIndicator.textContent = '🔴 REC 00:00';

  recordTimerInterval = setInterval(() => {
    const elapsedMs = Date.now() - recordStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    recordingIndicator.textContent = `🔴 REC ${minutes}:${seconds}`;
  }, 500);
}

function stopRecordingTimer() {
  if (recordTimerInterval) {
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
  }
  recordingIndicator.style.display = 'none';
}

function startVideoRecording() {
  if (!stream) return;

  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const camWidth = settings.width || 1920;
  const camHeight = settings.height || 1080;

  const targetWidth = 640;
  const ratio = targetWidth / camWidth;
  const targetHeight = Math.round(camHeight * ratio);

  const width = targetWidth;
  const height = targetHeight;

  recordingCanvas.width = width;
  recordingCanvas.height = height;
  const rctx = recordingCanvas.getContext('2d');

  isRecording = true;
  recordedChunks = [];
  videoPreviewContainer.style.display = 'none';
  videoInstructions.style.display = 'none';

  function drawFrame() {
    if (!isRecording) return;

    rctx.clearRect(0, 0, width, height);

    if (usingFrontCamera) {
      rctx.save();
      rctx.translate(width, 0);
      rctx.scale(-1, 1);
      rctx.drawImage(video, 0, 0, width, height);
      rctx.restore();
    } else {
      rctx.drawImage(video, 0, 0, width, height);
    }

    rctx.drawImage(overlay, 0, 0, width, height);

    requestAnimationFrame(drawFrame);
  }
  drawFrame();

  const baseFps = 24;
  const videoStream = recordingCanvas.captureStream(baseFps);
  const combinedStream = new MediaStream();

  videoStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length > 0) {
    combinedStream.addTrack(audioTracks[0]);
  }

  let options = {};
  recordedMimeType = 'video/webm';

  try {
    if (isiOS) {
      options.mimeType = 'video/mp4';
      recordedMimeType = 'video/mp4';
    } else {
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          options.mimeType = 'video/webm;codecs=vp9,opus';
          recordedMimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          options.mimeType = 'video/webm;codecs=vp8,opus';
          recordedMimeType = 'video/webm';
        }
      }
    }

    mediaRecorder = new MediaRecorder(combinedStream, options);
  } catch (e) {
    console.error('Erro ao iniciar MediaRecorder:', e);
    alert('Este navegador não suporta gravação de vídeo com som nesta moldura. As fotos vão funcionar normalmente. 🥹');
    isRecording = false;
    stopRecordingTimer();
    startRecordBtn.style.display = 'inline-block';
    stopRecordBtn.style.display = 'none';
    return;
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    isRecording = false;
    stopRecordingTimer();

    const blob = new Blob(recordedChunks, { type: recordedMimeType });

    if (!blob || blob.size === 0) {
      alert('Nenhum dado de vídeo foi gravado.');
      startRecordBtn.style.display = 'inline-block';
      stopRecordBtn.style.display = 'none';
      return;
    }

    showLoading();
    setButtonsDisabledDuringProcess(true);

    try {
      const formData = new FormData();
      formData.append('video', blob, 'video.webm');

      const device = isiOS ? 'ios' : 'android';

      const resposta = await fetch(`${API_URL}?device=${device}`, {
        method: 'POST',
        body: formData
      });

      if (!resposta.ok) {
        let erroTxt = '';
        try {
          erroTxt = await resposta.text();
        } catch (e) {}
        console.error('Erro na conversão no servidor:', erroTxt);
        alert('Ocorreu um erro ao converter o vídeo. Tente novamente.');
      } else {
        const mp4Blob = await resposta.blob();
        const url = URL.createObjectURL(mp4Blob);
        lastVideoUrl = url;

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'video-moldura.mp4';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
        }, 1000);

        if (isiOS) {
          videoPreviewContainer.style.display = 'flex';
          videoPreviewEl.style.display = 'none';
          saveVideoBtn.style.display = 'none';
          videoInstructions.style.display = 'block';
        } else {
          videoPreviewContainer.style.display = 'none';
        }

        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Erro ao enviar vídeo para o servidor:', err);
      alert('Erro ao enviar o vídeo para o servidor.');
    } finally {
      hideLoading();
      setButtonsDisabledDuringProcess(false);
      startRecordBtn.style.display = 'inline-block';
      stopRecordBtn.style.display = 'none';
    }
  };

  startRecordingTimer();
  mediaRecorder.start(100);

  startRecordBtn.style.display = 'none';
  stopRecordBtn.style.display = 'inline-block';
}

startRecordBtn.onclick = () => {
  if (isRecording) return;
  startVideoRecording();
};

stopRecordBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
};

saveVideoBtn.onclick = () => {
  if (!lastVideoUrl) return;
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = lastVideoUrl;
  const ext = recordedMimeType.includes('mp4') ? 'mp4' : 'webm';
  a.download = 'video-moldura.' + ext;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 1000);

  if (isiOS) {
    videoInstructions.style.display = 'block';
  }
};

startCamera();
