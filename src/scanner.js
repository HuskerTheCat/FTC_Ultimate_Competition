import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// The decoder ships with the app, so scanning never loads code from elsewhere. It starts loading when the app opens,
// so scanning still works if the connection drops later. A failed load is tried again by the next scan
// (a new locateFile makes zxing-wasm forget the failed one).
let decoder;
const loadDecoder = () => (decoder ??= prepareZXingModule({ overrides: { locateFile: () => wasmUrl }, fireImmediately: true })
  .catch((error) => {
    console.error(error);
    decoder = null;
    throw new Error('Couldn’t load the scanner. Check your internet connection and try again.');
  }));
loadDecoder().catch(() => {});

// Shows the camera in the dialog and resolves with the text of the first QR code it sees, or null if cancelled.
export function scanCode(dialog, title, hint) {
  const options = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 };
  dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>${title}</h2>
      <video id="camera" playsinline muted></video>
      <p class="muted small">${hint}</p>
      <div class="row"><button value="cancel" class="secondary">Cancel</button></div>
    </form>`;
  const video = dialog.querySelector('#camera');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  dialog.showModal();

  return new Promise((resolve, reject) => {
    let stream = null;
    let open = true;
    dialog.addEventListener('close', () => {
      open = false;
      stream?.getTracks().forEach((track) => track.stop());
      resolve(null);
    }, { once: true });

    const scan = async () => {
      await loadDecoder();
      while (open) {
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const [code] = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), options);
          if (code && open) {
            resolve(code.text);
            return dialog.close();
          }
        }
        await new Promise(requestAnimationFrame);
      }
    };

    // A sharper picture than the camera's default reads small or distant codes.
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } }).then((s) => {
      stream = s;
      if (!open) return s.getTracks().forEach((track) => track.stop());
      video.srcObject = s;
      video.play();
      scan().catch((error) => {
        if (!open) return; // cancelled while the decoder was loading; the dialog may show something else by now
        reject(error);
        dialog.close();
      });
    }, (error) => {
      reject(new Error(`Couldn't open the camera: ${error.message}`));
      dialog.close();
    });
  });
}
