
/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GenerateVideosParameters, GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.API_KEY;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>(async (resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

interface VideoSettings {
  aspectRatio: string;
  durationSeconds: number;
  quality: string;
  numberOfVideos: number;
}

async function generateContent(
  prompt: string,
  imageBytes: string,
  settings: VideoSettings,
) {
  const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
  const videoContainer = document.querySelector(
    '#video-container',
  ) as HTMLDivElement;

  // NOTE: The 'quality' setting from the UI is not currently used as the Veo API
  // does not support a direct quality parameter. It is logged here for demonstration.
  console.log(`Selected quality (not sent to API): ${settings.quality}`);

  const config: GenerateVideosParameters = {
    model: 'veo-2.0-generate-001',
    prompt,
    config: {
      numberOfVideos: settings.numberOfVideos,
    },
  };

  if (settings.aspectRatio) {
    config.config.aspectRatio = settings.aspectRatio as
      | '1:1'
      | '16:9'
      | '9:16'
      | '3:4'
      | '4:3';
  }
  if (settings.durationSeconds && !isNaN(settings.durationSeconds)) {
    config.config.durationSeconds = settings.durationSeconds;
  }

  if (imageBytes) {
    config.image = {
      imageBytes,
      mimeType: 'image/png',
    };
  }

  let operation = await ai.models.generateVideos(config);

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(1000);
    operation = await ai.operations.getVideosOperation({operation});
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos generated');
  }

  await Promise.all(
    videos.map(async (v, index) => {
      const url = decodeURIComponent(v.video.uri);
      const res = await fetch(`${url}&key=${GEMINI_API_KEY}`);
      const blob = await res.blob();
      const objectURL = URL.createObjectURL(blob);
      const videoFile = new File([blob], `generated-video-${index + 1}.mp4`, {
        type: 'video/mp4',
      });

      // Create DOM elements
      const card = document.createElement('div');
      card.className = 'video-card';

      const videoEl = document.createElement('video');
      videoEl.src = objectURL;
      videoEl.autoplay = true;
      videoEl.loop = true;
      videoEl.controls = true;

      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'card-actions';

      // Download button
      const downloadButton = document.createElement('button');
      downloadButton.className = 'download-button';
      downloadButton.textContent = 'Download';
      downloadButton.addEventListener('click', () => {
        downloadFile(objectURL, videoFile.name);
      });
      actionsContainer.appendChild(downloadButton);

      // Share button (only if supported)
      if (navigator.canShare && navigator.canShare({files: [videoFile]})) {
        const shareButton = document.createElement('button');
        shareButton.className = 'share-button';
        shareButton.textContent = 'Share';
        shareButton.addEventListener('click', async () => {
          try {
            await navigator.share({
              files: [videoFile],
              title: 'Generated Video',
              text: promptEl.value || 'Check out this video!',
            });
          } catch (error) {
            console.log('Sharing failed or was cancelled', error);
          }
        });
        actionsContainer.appendChild(shareButton);
      }

      card.appendChild(videoEl);
      card.appendChild(actionsContainer);
      videoContainer.appendChild(card);
    }),
  );
}

// DOM Elements
const upload = document.querySelector('#file-input') as HTMLInputElement;
const promptEl = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const statusEl = document.querySelector('#status') as HTMLParagraphElement;
const quotaErrorEl = document.querySelector('#quota-error') as HTMLDivElement;
const openKeyEl = document.querySelector('#open-key') as HTMLButtonElement;
const generateButton = document.querySelector(
  '#generate-button',
) as HTMLButtonElement;
const aspectRatioSelect = document.querySelector(
  '#aspect-ratio-select',
) as HTMLSelectElement;
const durationInput = document.querySelector(
  '#duration-input',
) as HTMLInputElement;
const qualitySelect = document.querySelector(
  '#quality-select',
) as HTMLSelectElement;
const numberOfVideosSelect = document.querySelector(
  '#number-of-videos-select',
) as HTMLSelectElement;
const fileNameEl = document.querySelector('#file-name') as HTMLSpanElement;
const loaderEl = document.querySelector('#loader') as HTMLDivElement;
const presetPromptsContainer = document.querySelector(
  '#preset-prompts-container',
) as HTMLDivElement;
const imgEl = document.querySelector('#img') as HTMLImageElement;
const themeToggle = document.querySelector('#theme-toggle') as HTMLInputElement;

// State
let base64data = '';

// --- Theme Management ---
function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.checked = true;
  } else {
    document.body.classList.remove('dark-mode');
    themeToggle.checked = false;
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
  const systemPrefersDark = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches;

  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (systemPrefersDark) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }
}

// Event Listeners
upload.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files[0];
  if (file) {
    base64data = await blobToBase64(file);
    fileNameEl.textContent = file.name;
    const objectURL = URL.createObjectURL(file);
    imgEl.src = objectURL;
    imgEl.style.display = 'block';
  } else {
    base64data = '';
    fileNameEl.textContent = 'No file chosen';
    imgEl.src = '';
    imgEl.style.display = 'none';
  }
});

openKeyEl.addEventListener('click', async (e) => {
  await window.aistudio?.openSelectKey();
});

generateButton.addEventListener('click', (e) => {
  generate();
});

presetPromptsContainer.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('preset-prompt')) {
    promptEl.value = target.textContent || '';
  }
});

themeToggle.addEventListener('change', () => {
  const newTheme = themeToggle.checked ? 'dark' : 'light';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
});


function setControlsDisabled(disabled: boolean) {
  generateButton.disabled = disabled;
  upload.disabled = disabled;
  promptEl.disabled = disabled;
  aspectRatioSelect.disabled = disabled;
  durationInput.disabled = disabled;
  qualitySelect.disabled = disabled;
  numberOfVideosSelect.disabled = disabled;
}

async function generate() {
  const videoContainer = document.querySelector(
    '#video-container',
  ) as HTMLDivElement;
  statusEl.innerText = 'Generating...';
  loaderEl.style.display = 'block';
  videoContainer.innerHTML = '';
  quotaErrorEl.style.display = 'none';
  setControlsDisabled(true);

  try {
    // Read current settings from DOM just before generation
    const prompt = promptEl.value;
    const videoSettings: VideoSettings = {
      aspectRatio: aspectRatioSelect.value,
      durationSeconds: parseInt(durationInput.value, 10),
      quality: qualitySelect.value,
      numberOfVideos: parseInt(numberOfVideosSelect.value, 10),
    };

    await generateContent(prompt, base64data, videoSettings);
    statusEl.innerText = 'Generation complete.';
  } catch (e) {
    try {
      const err = JSON.parse(e.message);
      if (err.error.code === 429) {
        // Out of quota.
        quotaErrorEl.style.display = 'block';
        statusEl.innerText = 'Quota exceeded.';
      } else {
        statusEl.innerText = `Error: ${err.error.message}`;
      }
    } catch (err) {
      statusEl.innerText = `Error: ${e.message}`;
      console.log('error', e.message);
    }
  } finally {
    loaderEl.style.display = 'none';
    setControlsDisabled(false);
  }
}

// Initial page load setup
initializeTheme();
