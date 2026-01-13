import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

// Variabel Global & Referensi DOM
let pdfData = null, pdfFile = null, currentSignatureDataURL = null;
let sigNaturalWidth = 0, sigNaturalHeight = 0, copiedStampData = null;
let activeContainer = null, selectedStamp = null;
let isAddingShape = false, shapeType = "rectangle", shapeColor = "#ff0000";
let shapeStartX = 0, shapeStartY = 0, tempShapeEl = null;
let currentZoom = 1.0, isPanMode = false, startPanX = 0, startPanY = 0;
let currentTranslateX = 0, currentTranslateY = 0;
let historyStack = [], redoStack = [];
let contextMenuData = { target: null };
let totalPages = 0, currentPage = 1;

// Global var untuk Timestamp
let globalTimestampLeft = null, globalTimestampTop = null; 
// Global var untuk Label (NEW)
let globalLabelLeft = null, globalLabelTop = null;
let activeLabelType = null; // 'RANDOM', 'QC'

let signatureImageDataURLs = []; 
let showJiNotify = true; 
let dragGhostElement = null; 

// DOM Elements
const pdfFileInput = document.getElementById('pdf-file');
const sigFileInput = document.getElementById('sig-file');
const signatureList = document.getElementById('signature-gallery');
const btnDownload = document.getElementById('btnDownload');
const outputFileNameInput = document.getElementById('outputFileName');
const pdfPagesWrapper = document.getElementById('pdf-pages-wrapper');
const userSelect = document.getElementById('user');
const fontFamilySelect = document.getElementById('font-family');
const fontSizeSelect = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');
const btnBold = document.getElementById('btn-bold');
const btnItalic = document.getElementById('btn-italic');
const btnUnderline = document.getElementById('btn-underline');
const btnAlignLeft = document.getElementById('btn-align-left');
const btnAlignCenter = document.getElementById('btn-align-center');
const btnAlignRight = document.getElementById('btn-align-right');
const shapeButtonsContainer = document.getElementById('shape-buttons');
const shapeButtons = shapeButtonsContainer.querySelectorAll('.shape-btn');
const shapeColorInput = document.getElementById('shape-color');
const btnToggleShape = document.getElementById('btnToggleShape');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnPanMode = document.getElementById('btnPanMode');
const zoomInput = document.getElementById('zoomInput');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const currentPageInput = document.getElementById('currentPageInput');
const totalPagesSpan = document.getElementById('totalPagesSpan');
const pdfMain = document.querySelector('.pdf-main');
const customContextMenu = document.getElementById('custom-context-menu');
const textFormattingSection = document.getElementById('text-formatting-section');

const dropzone = document.getElementById('dropzone');
const previewSection = document.getElementById('preview-section');
const mainContent = document.getElementById('main-content');
const settingsButtonEditor = document.getElementById('settings-button-editor');

const pdfLoadingOverlay = document.getElementById('pdf-loading-overlay');

const jiConfirmModalContainer = document.getElementById('ji-confirm-modal-container');
const jiConfirmOverlay = document.getElementById('ji-confirm-overlay');
const jiConfirmModalContent = document.getElementById('ji-confirm-modal-content');
const jiConfirmSesuai = document.getElementById('ji-confirm-sesuai');
const jiConfirmCekUlang = document.getElementById('ji-confirm-cek-ulang');

const jiNotifyOnBtn = document.getElementById('ji-notify-on');
const jiNotifyOffBtn = document.getElementById('ji-notify-off');

// BARU: Referensi ke Checklist Box & Header
const jiChecklistBox = document.getElementById('ji-checklist-box');
const checklistHeader = document.getElementById('checklist-header');

// --- FUNGSI VALIDASI CHECKLIST ---
function checkChecklistCompleteness() {
  if (!showJiNotify) return true; // Jika notifikasi mati, selalu anggap lengkap

  const checkboxes = document.querySelectorAll('#ji-checklist-box .modern-checkbox');
  let allChecked = true;
  checkboxes.forEach(cb => {
      if (!cb.checked) allChecked = false;
  });

  const crbRadios = document.querySelectorAll('input[name="crb-status"]');
  let crbSelected = false;
  crbRadios.forEach(r => {
      if (r.checked) crbSelected = true;
  });

  return allChecked && crbSelected;
}

function updateDownloadButtonState() {
  if (!pdfFile) return; // Jangan aktifkan jika belum ada file

  const isValid = checkChecklistCompleteness();
  
  if (isValid) {
      btnDownload.classList.remove('action-button-disabled');
      btnDownload.removeAttribute('disabled');
      btnDownload.innerHTML = '<span id="mergeButtonText">Unduh PDF</span><div id="mergeSpinner" class="spinner ml-2 hidden"></div>';
  } else {
      if (showJiNotify) {
        btnDownload.classList.add('action-button-disabled');
        btnDownload.innerHTML = '<span id="mergeButtonText"><i class="fas fa-lock mr-2"></i>Selesaikan Checklist</span>';
      } else {
        // Jika notifikasi off, tombol tetap aktif
        btnDownload.classList.remove('action-button-disabled');
        btnDownload.removeAttribute('disabled');
        btnDownload.innerHTML = '<span id="mergeButtonText">Unduh PDF</span><div id="mergeSpinner" class="spinner ml-2 hidden"></div>';
      }
  }
}

// Event Listener untuk Checkbox & Radio Button
document.querySelectorAll('#ji-checklist-box .modern-checkbox, input[name="crb-status"]').forEach(el => {
    el.addEventListener('change', updateDownloadButtonState);
});

// --- FUNGSI DRAGGABLE UNTUK CHECKLIST BOX ---
function dragElement(elmnt, dragHandle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (dragHandle) {
    dragHandle.onmousedown = dragMouseDown;
  } else {
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    // Hapus right/bottom properties jika ada agar top/left yang dominan
    elmnt.style.right = "auto";
    elmnt.style.bottom = "auto";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Inisialisasi Drag untuk Checklist Box (Hanya bisa di-drag dari headernya)
if (jiChecklistBox && checklistHeader) {
  dragElement(jiChecklistBox, checklistHeader);
}
// ---------------------------------------------

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) { console.warn("Toast: ", message); return; }
  const toast = document.createElement('div');
  let borderColor = 'transparent';
  if (type === 'error') borderColor = 'var(--accent-rose-start)';
  if (type === 'success') borderColor = 'var(--accent-emerald-start)';
  if (type === 'warning') borderColor = '#eab308';
  
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.borderLeft = `4px solid ${borderColor}`;
  container.appendChild(toast); 
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

function setupConstellationEffect() {
  const canvas = document.getElementById('constellation-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let particlesArray;
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init();
  });
  class Particle {
    constructor(x, y, directionX, directionY, size, color) { this.x = x; this.y = y; this.directionX = directionX; this.directionY = directionY; this.size = size; this.color = color; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); }
    update() { if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX; if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY; this.x += this.directionX; this.y += this.directionY; this.draw(); }
  }
  function init() {
    particlesArray = [];
    let numberOfParticles = (canvas.height * canvas.width) / 9000;
    for (let i = 0; i < numberOfParticles; i++) {
      let size = (Math.random() * 2) + 1;
      let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
      let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
      let directionX = (Math.random() * .4) - .2;
      let directionY = (Math.random() * .4) - .2;
      let color = getComputedStyle(document.documentElement).getPropertyValue('--accent-start').trim();
      particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
    }
  }
  function connect() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
      for (let b = a; b < particlesArray.length; b++) {
        let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
        if (distance < (canvas.width / 7) * (canvas.height / 7)) {
          opacityValue = 1 - (distance / 20000);
          let color = getComputedStyle(document.documentElement).getPropertyValue('--accent-start').trim();
          if (color.startsWith('#')) {
              const rgb = parseInt(color.slice(1,3),16) + ", " + parseInt(color.slice(3,5),16) + ", " + parseInt(color.slice(5,7),16);
              ctx.strokeStyle = `rgba(${rgb}, ${opacityValue})`;
          } else {
              ctx.strokeStyle = `rgba(168, 85, 247, ${opacityValue})`; 
          }
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(particlesArray[a].x, particlesArray[a].y); ctx.lineTo(particlesArray[b].x, particlesArray[b].y); ctx.stroke();
        }
      }
    }
  }
  function animate() { requestAnimationFrame(animate); ctx.clearRect(0, 0, innerWidth, innerHeight); for (let i = 0; i < particlesArray.length; i++) particlesArray[i].update(); connect(); }
  init();
  animate();
  const observer = new MutationObserver((mutations) => { mutations.forEach((mutation) => { if (mutation.type === 'attributes' && mutation.attributeName === 'style') { init(); } }); });
  observer.observe(document.documentElement, { attributes: true });
}

function setupThemeEventListeners() {
  const spotlight = document.getElementById('spotlight');
  window.addEventListener('mousemove', (e) => { spotlight.style.left = `${e.clientX}px`; spotlight.style.top = `${e.clientY}px`; });
  
  const settingsButton = document.getElementById('settings-button-editor');
  const closeSettingsButton = document.getElementById('close-settings-button');
  const modalContainer = document.getElementById('settings-modal-container');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsModalContent = document.getElementById('settings-modal-content');
  const themeDarkButton = document.getElementById('theme-dark-button');
  const themeLightButton = document.getElementById('theme-light-button');
  const accentColorPicker = document.getElementById('accent-color-picker');

  if (!settingsButton || !modalContainer) return;

  const openModal = () => { modalContainer.classList.remove('hidden'); requestAnimationFrame(() => { settingsOverlay.style.opacity = '1'; settingsModalContent.style.opacity = '1'; settingsModalContent.style.transform = 'translateY(0)'; }); };
  const closeModal = () => { settingsOverlay.style.opacity = '0'; settingsModalContent.style.opacity = '0'; settingsModalContent.style.transform = 'translateY(-1rem)'; setTimeout(() => modalContainer.classList.add('hidden'), 300); };
  
  settingsButton.addEventListener('click', openModal); 
  closeSettingsButton.addEventListener('click', closeModal); 
  settingsOverlay.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => e.key === 'Escape' && !modalContainer.classList.contains('hidden') && closeModal());
  
  themeDarkButton.addEventListener('click', () => applyTheme('dark')); 
  themeLightButton.addEventListener('click', () => applyTheme('light'));
  accentColorPicker.addEventListener('click', (e) => e.target.tagName === 'BUTTON' && e.target.dataset.colorName && applyAccentColor(e.target.dataset.colorName));
  
  jiNotifyOnBtn.addEventListener('click', () => applyJiNotifySetting(true));
  jiNotifyOffBtn.addEventListener('click', () => applyJiNotifySetting(false));
}

function openJiConfirmModal() {
  if (!jiConfirmModalContainer) return;
  jiConfirmModalContainer.classList.remove('hidden');
  requestAnimationFrame(() => {
    jiConfirmOverlay.style.opacity = '1';
    jiConfirmModalContent.style.opacity = '1';
    jiConfirmModalContent.style.transform = 'translateY(0)';
  });
}

function closeJiConfirmModal() {
  if (!jiConfirmModalContainer) return;
  jiConfirmOverlay.style.opacity = '0';
  jiConfirmModalContent.style.opacity = '0';
  jiConfirmModalContent.style.transform = 'translateY(-1rem)';
  setTimeout(() => jiConfirmModalContainer.classList.add('hidden'), 300);
}

jiConfirmCekUlang.addEventListener('click', closeJiConfirmModal);
jiConfirmOverlay.addEventListener('click', closeJiConfirmModal);

function applyTheme(theme) { 
  document.body.classList.toggle('light-theme', theme === 'light'); 
  document.getElementById('theme-light-button').style.backgroundColor = theme === 'light' ? 'var(--border-color)' : 'transparent'; 
  document.getElementById('theme-dark-button').style.backgroundColor = theme === 'dark' ? 'var(--border-color)' : 'transparent'; 
  localStorage.setItem('pdf-editor-theme', theme); 
}

function applyAccentColor(colorName) {
  const root = document.documentElement;
  const appIcon = document.getElementById('app-icon');
  const dropzoneIcon = document.getElementById('dropzone-icon');
  const iconMap = { purple: 'https://ajmaerlangga.github.io/image/EDITPDF_PURPLE.png', blue: 'https://ajmaerlangga.github.io/image/EDITPDF_BLUE.png', emerald: 'https://ajmaerlangga.github.io/image/EDITPDF_GREEN.png', rose: 'https://ajmaerlangga.github.io/image/EDITPDF_RED.png' };
  const iconUrl = iconMap[colorName] || iconMap.purple;
  if (appIcon) appIcon.src = iconUrl;
  if (dropzoneIcon) dropzoneIcon.src = iconUrl;

  root.style.setProperty('--accent-start', `var(--accent-${colorName}-start)`);
  root.style.setProperty('--accent-end', `var(--accent-${colorName}-end)`);
  document.querySelectorAll('#accent-color-picker button').forEach(btn => { const ringColor = document.body.classList.contains('light-theme') ? '#ffffff' : '#111827'; btn.style.boxShadow = btn.dataset.colorName === colorName ? `0 0 0 2px ${ringColor}, 0 0 0 4px var(--accent-start)` : 'none'; });
  localStorage.setItem('pdf-editor-accent-name', colorName);
}

function applyJiNotifySetting(show) {
  showJiNotify = show;
  if (jiNotifyOnBtn && jiNotifyOffBtn) {
    jiNotifyOnBtn.style.backgroundColor = show ? 'var(--border-color)' : 'transparent';
    jiNotifyOffBtn.style.backgroundColor = !show ? 'var(--border-color)' : 'transparent';
  }
  localStorage.setItem('pdf-editor-ji-notify', show);
  
  if (jiChecklistBox && pdfFile) {
     if (show) {
       jiChecklistBox.classList.remove('hidden');
       // Reset position when reshown might be better, or keep last pos
     } else {
       jiChecklistBox.classList.add('hidden');
     }
     updateDownloadButtonState(); // Update state based on new setting
  }
}

function loadSavedTheme() { 
  applyTheme(localStorage.getItem('pdf-editor-theme') || 'dark'); 
  applyAccentColor(localStorage.getItem('pdf-editor-accent-name') || 'purple'); 
  shapeColorInput.value = getComputedStyle(document.documentElement).getPropertyValue('--accent-rose-start').trim();
  shapeColor = shapeColorInput.value;
  
  const savedJiNotify = localStorage.getItem('pdf-editor-ji-notify');
  applyJiNotifySetting(savedJiNotify === null ? true : (savedJiNotify === 'true'));
}

function hexToRgbNormalized(hex) {
  hex = hex.replace('#', '');
  const bigint = parseInt(hex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return PDFLib.rgb(r, g, b);
}

btnBold.addEventListener('click', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    const currentWeight = window.getComputedStyle(selectedStamp).fontWeight;
    if (parseInt(currentWeight) >= 700) {
      selectedStamp.style.fontWeight = 'normal';
      btnBold.classList.remove('active-btn');
    } else {
      selectedStamp.style.fontWeight = 'bold';
      btnBold.classList.add('active-btn');
    }
    saveHistory();
  }
});
btnItalic.addEventListener('click', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    const currentStyle = window.getComputedStyle(selectedStamp).fontStyle;
    if (currentStyle === 'italic') {
      selectedStamp.style.fontStyle = 'normal';
      btnItalic.classList.remove('active-btn');
    } else {
      selectedStamp.style.fontStyle = 'italic';
      btnItalic.classList.add('active-btn');
    }
    saveHistory();
  }
});
btnUnderline.addEventListener('click', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    const currentDecoration = window.getComputedStyle(selectedStamp).textDecorationLine;
    if (currentDecoration.includes('underline')) {
      selectedStamp.style.textDecoration = 'none';
      btnUnderline.classList.remove('active-btn');
    } else {
      selectedStamp.style.textDecoration = 'underline';
      btnUnderline.classList.add('active-btn');
    }
    saveHistory();
  }
});
btnAlignLeft.addEventListener('click', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    selectedStamp.style.textAlign = 'left';
    btnAlignLeft.classList.add('active-btn');
    btnAlignCenter.classList.remove('active-btn');
    btnAlignRight.classList.remove('active-btn');
    saveHistory();
  }
});
btnAlignCenter.addEventListener('click', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    selectedStamp.style.textAlign = 'center';
    btnAlignCenter.classList.add('active-btn');
    btnAlignLeft.classList.remove('active-btn');
    btnAlignRight.classList.remove('active-btn');
    saveHistory();
  }
});
btnAlignRight.addEventListener('click', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    selectedStamp.style.textAlign = 'right';
    btnAlignRight.classList.add('active-btn');
    btnAlignLeft.classList.remove('active-btn');
    btnAlignCenter.classList.remove('active-btn');
    saveHistory();
  }
});

function updateTransform() {
  pdfPagesWrapper.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;
}
btnZoomIn.addEventListener('click', () => {
  currentZoom += 0.1;
  zoomInput.value = Math.round(currentZoom * 100);
  updateTransform();
});
btnZoomOut.addEventListener('click', () => {
  currentZoom = Math.max(0.1, currentZoom - 0.1);
  zoomInput.value = Math.round(currentZoom * 100);
  updateTransform();
});
zoomInput.addEventListener('change', () => {
  currentZoom = zoomInput.value / 100;
  updateTransform();
});
btnPanMode.addEventListener('click', () => {
  isPanMode = !isPanMode;
  btnPanMode.classList.toggle('active-btn', isPanMode);
  pdfMain.style.cursor = isPanMode ? 'grab' : 'default';
});
pdfMain.addEventListener('mousedown', (e) => {
  if (!isPanMode) return;
  if (e.target.closest('.stamp-container, .shape-element, .text-element, .resize-handle, .timestamp-preview, .label-preview')) {
      return;
  }
  pdfMain.style.cursor = 'grabbing';
  startPanX = e.clientX;
  startPanY = e.clientY;
  const onMouseMove = (eMove) => {
    const dx = eMove.clientX - startPanX;
    const dy = eMove.clientY - startPanY;
    currentTranslateX += dx;
    currentTranslateY += dy;
    startPanX = eMove.clientX;
    startPanY = eMove.clientY;
    updateTransform();
  };
  const onMouseUp = () => {
    pdfMain.style.cursor = 'grab';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

function saveHistory() {
  const state = [];
  document.querySelectorAll('.preview-container').forEach(container => {
    const interactiveElements = Array.from(container.children)
      .filter(child => child.tagName.toLowerCase() !== 'canvas' && !child.classList.contains('timestamp-preview') && !child.classList.contains('label-preview'))
      .map(child => child.outerHTML)
      .join('');
    state.push({ id: container.id, interactive: interactiveElements });
  });
  historyStack.push(state);
  redoStack = [];
  updateUndoRedoButtons();
}
function restoreHistory(state) {
  state.forEach(item => {
    const container = document.getElementById(item.id);
    if (container) {
      const canvas = container.querySelector('canvas');
      const timestamp = container.querySelector('.timestamp-preview');
      const label = container.querySelector('.label-preview');

      container.innerHTML = "";
      if (canvas) container.appendChild(canvas);
      if (timestamp) container.appendChild(timestamp);
      if (label) container.appendChild(label);
      
      container.insertAdjacentHTML('beforeend', item.interactive);
    }
  });
  rebindInteractiveEvents();
}
function rebindInteractiveEvents() {
  document.querySelectorAll('.preview-container').forEach(container => {
    const timestampEl = container.querySelector('.timestamp-preview');
    if(timestampEl) {
      timestampEl.addEventListener('mousedown', (e) => {
        if (isPanMode) { e.stopPropagation(); return; }
        startDrag(e, timestampEl, container, true, false); 
      });
    }
    // Rebind label event
    const labelEl = container.querySelector('.label-preview');
    if(labelEl) {
      labelEl.addEventListener('mousedown', (e) => {
        if (isPanMode) { e.stopPropagation(); return; }
        startDrag(e, labelEl, container, false, true); 
      });
    }

    container.querySelectorAll('.stamp-container, .text-element, .shape-element').forEach(element => {
      element.addEventListener('mousedown', (ev) => {
        if (ev.target.classList.contains('resize-handle') || ev.target.classList.contains('stamp-delete-button')) return;
        if (isPanMode) { ev.stopPropagation(); return; }
        selectStamp(element);
        startDrag(ev, element, container, false, false);
      });
      element.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('stamp-delete-button')) return;
        selectStamp(element)
      });
      const deleteBtn = element.querySelector('.stamp-delete-button');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          element.remove();
          saveHistory();
        });
      }
      if (element.classList.contains('text-element')) {
        element.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          element.setAttribute("contenteditable", "true");
          element.focus();
        });
        element.addEventListener('blur', () => { 
          element.removeAttribute("contenteditable"); 
          saveHistory();
        });
      }
    });
  });
}
function updateUndoRedoButtons() {
  btnUndo.disabled = historyStack.length <= 1;
  btnRedo.disabled = redoStack.length === 0;
  btnUndo.style.opacity = btnUndo.disabled ? 0.5 : 1;
  btnRedo.style.opacity = btnRedo.disabled ? 0.5 : 1;
}
btnUndo.addEventListener('click', () => {
  if (historyStack.length > 1) {
    const currentState = historyStack.pop();
    redoStack.push(currentState);
    const previousState = historyStack[historyStack.length - 1];
    restoreHistory(previousState);
    updateUndoRedoButtons();
  }
});
btnRedo.addEventListener('click', () => {
  if (redoStack.length > 0) {
    const state = redoStack.pop();
    historyStack.push(state);
    restoreHistory(state);
    updateUndoRedoButtons();
  }
});

// Expose fungsi ke window untuk diakses dari HTML
window.triggerFileInput = () => pdfFileInput.click();
window.clearAllFiles = () => {
  pdfFileInput.value = "";
  pdfData = null;
  pdfFile = null;
  pdfPagesWrapper.innerHTML = "";
  
  currentSignatureDataURL = null; 
  activeContainer = null;
  currentZoom = 1.0;
  currentTranslateX = 0;
  currentTranslateY = 0;
  zoomInput.value = 100;
  pdfPagesWrapper.style.transform = `translate(0px, 0px) scale(1)`;
  historyStack = [];
  redoStack = [];
  totalPages = 0;
  currentPage = 1;
  currentPageInput.value = 1;
  totalPagesSpan.textContent = 1;
  
  // Reset Timestamp
  globalTimestampLeft = null; 
  globalTimestampTop = null;
  document.querySelectorAll('.timestamp-btn').forEach(btn => btn.classList.remove('active-timestamp'));
  userSelect.value = '0';

  // Reset Label
  globalLabelLeft = null;
  globalLabelTop = null;
  activeLabelType = null;
  document.querySelectorAll('.label-btn').forEach(btn => btn.classList.remove('active-label'));

  updateUndoRedoButtons();
  
  dropzone.classList.remove('hidden');
  previewSection.classList.add('hidden');
  document.querySelector('.pdf-controls').style.display = 'none';
  
  jiChecklistBox.classList.add('hidden');
  document.querySelectorAll('.modern-checkbox, .toggle-input').forEach(cb => cb.checked = false);
  // Reset posisi checklist box
  jiChecklistBox.style.top = "20px";
  jiChecklistBox.style.left = "auto";
  jiChecklistBox.style.right = "20px";
  
  // Reset tombol unduh
  btnDownload.classList.remove('action-button-disabled');
  btnDownload.innerHTML = '<span id="mergeButtonText">Unduh PDF</span><div id="mergeSpinner" class="spinner ml-2 hidden"></div>';
};

pdfFileInput.addEventListener('change', async () => {
  const file = pdfFileInput.files[0];
  if (!file) { showToast("Pilih file PDF terlebih dahulu.", "warning"); return; }
  pdfFile = file;
  pdfData = await file.arrayBuffer();
  
  pdfLoadingOverlay.classList.remove('hidden'); 
  try {
    await renderPDF(pdfData);
  } catch (err) {
    console.error("Error rendering PDF:", err);
    showToast("Gagal memuat PDF.", "error");
  } finally {
    pdfLoadingOverlay.classList.add('hidden'); 
  }
});

async function renderPDF(arrayBuffer) {
  pdfPagesWrapper.innerHTML = "";
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  totalPages = pdf.numPages;
  totalPagesSpan.textContent = totalPages;
  currentPage = 1;
  currentPageInput.value = currentPage;
  
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const desiredWidth = 700;
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    const pageContainer = document.createElement('div');
    pageContainer.className = 'preview-container';
    pageContainer.id = `page-container-${i}`;
    pageContainer.style.width = scaledViewport.width + 'px';
    pageContainer.style.height = scaledViewport.height + 'px';
    pageContainer.setAttribute('data-page', i);
    pageContainer.setAttribute('data-scale', scale);
    pageContainer.setAttribute('data-original-height', viewport.height);
    const ratio = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width * ratio;
    canvas.height = scaledViewport.height * ratio;
    canvas.style.width = scaledViewport.width + 'px';
    canvas.style.height = scaledViewport.height + 'px';
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    pageContainer.appendChild(canvas);
    pdfPagesWrapper.appendChild(pageContainer);
    
    pageContainer.addEventListener('click', () => { 
      activeContainer = pageContainer; 
      document.querySelectorAll('.preview-container').forEach(c => c.style.borderColor = 'var(--border-color)');
      pageContainer.style.borderColor = 'var(--accent-start)';
    });

    pageContainer.addEventListener('dblclick', (e) => {
      if (isAddingShape) return;
      if (e.target === pageContainer || e.target.tagName.toLowerCase() === "canvas") {
        const rect = pageContainer.getBoundingClientRect();
        const textX = (e.clientX - rect.left) / currentZoom;
        const textY = (e.clientY - rect.top) / currentZoom;
        createTextInputAt(pageContainer, textX, textY);
      }
    });
  }

  dropzone.classList.add('hidden');
  previewSection.classList.remove('hidden');
  document.querySelector('.pdf-controls').style.display = 'flex';

  if (showJiNotify) {
    jiChecklistBox.classList.remove('hidden');
    // Update status tombol saat file dimuat
    updateDownloadButtonState();
  }

  currentZoom = 1.0;
  currentTranslateX = 0;
  currentTranslateY = 0;
  pdfPagesWrapper.style.transform = `translate(0px, 0px) scale(1)`;
  zoomInput.value = 100;
  
  updateTimestampPreview();
  updateLabelPreview(); // Init Label Preview if any active

  historyStack = []; 
  redoStack = [];
  saveHistory();
  updateUndoRedoButtons();
}

pdfMain.addEventListener('scroll', onScrollUpdatePage);
function onScrollUpdatePage() {
  const mainRect = pdfMain.getBoundingClientRect();
  const mainCenterY = mainRect.top + (mainRect.height / 2);
  let bestPage = currentPage;
  let minDistance = Infinity;
  document.querySelectorAll('.preview-container').forEach(container => {
    const containerRect = container.getBoundingClientRect();
    const containerCenterY = containerRect.top + (containerRect.height / 2);
    const distance = Math.abs(containerCenterY - mainCenterY);
    if (distance < minDistance) {
      minDistance = distance;
      bestPage = parseInt(container.dataset.page);
    }
  });
  if (bestPage !== currentPage) {
    currentPage = bestPage;
    currentPageInput.value = currentPage;
  }
}

// --- LOGIKA TIMESTAMP ---
function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
function updateTimestampPreview() {
  const selectedUser = userSelect.value;
  
  document.querySelectorAll('.preview-container').forEach(container => {
    const existingTimestamp = container.querySelector('.timestamp-preview');
    if (existingTimestamp) existingTimestamp.remove();

    if (selectedUser !== "0") {
      const timestamp = formatTimestamp();
      const texttimeAdd = `${selectedUser} - ${timestamp}`;
      const timestampEl = document.createElement('div');
      timestampEl.className = "timestamp-preview";
      
      if(globalTimestampLeft && globalTimestampTop) { 
        timestampEl.style.left = globalTimestampLeft;
        timestampEl.style.top = globalTimestampTop;
      } else {
        const containerHeight = container.clientHeight;
        const leftPos = (selectedUser === 'sales') ? 200 : 50; 
        timestampEl.style.left = leftPos + "px";
        timestampEl.style.top = containerHeight - 10 + "px";
      }
      
      timestampEl.textContent = texttimeAdd;
      container.appendChild(timestampEl);

      timestampEl.addEventListener('mousedown', (e) => {
        if (isPanMode) { e.stopPropagation(); return; }
        startDrag(e, timestampEl, container, true, false);
      });
    }
  });
}
userSelect.addEventListener('change', updateTimestampPreview);

document.getElementById('timestamp-controls').addEventListener('click', (e) => {
    const target = e.target.closest('.timestamp-btn');
    if (!target) return;
    const type = target.dataset.type;
    if (!type) return;

    document.querySelectorAll('.timestamp-btn').forEach(btn => btn.classList.remove('active-timestamp'));
    
    if (type.toUpperCase() === 'SSS') {
        userSelect.value = 'sss';
        target.classList.add('active-timestamp');
    } else if (type.toUpperCase() === 'SALES') {
        userSelect.value = 'sales';
        target.classList.add('active-timestamp');
    } else { // NONE
        userSelect.value = '0';
        target.classList.add('active-timestamp');
    }
    
    userSelect.dispatchEvent(new Event('change'));
});

// --- LOGIKA LABEL QC / RANDOM (BARU) ---
function updateLabelPreview() {
  const type = activeLabelType;

  document.querySelectorAll('.preview-container').forEach(container => {
    // Hapus label yang ada
    const existingLabel = container.querySelector('.label-preview');
    if (existingLabel) existingLabel.remove();

    if (type && type !== 'NONE') {
      const labelEl = document.createElement('div');
      labelEl.className = 'label-preview';
      
      const img = document.createElement('img');
      if (type === 'RANDOM') {
        img.src = 'https://ajmaerlangga.github.io/image/RANDOM_CHECK.png';
      } else if (type === 'QC') {
        img.src = 'https://ajmaerlangga.github.io/image/QC_100.png';
      }
      labelEl.appendChild(img);

      // Set Posisi
      if (globalLabelLeft && globalLabelTop) {
        labelEl.style.left = globalLabelLeft;
        labelEl.style.top = globalLabelTop;
      } else {
        // Posisi default (kanan atas)
        labelEl.style.left = (container.clientWidth - 120) + 'px';
        labelEl.style.top = '20px';
      }

      container.appendChild(labelEl);

      // Drag Event
      labelEl.addEventListener('mousedown', (e) => {
         if (isPanMode) { e.stopPropagation(); return; }
         startDrag(e, labelEl, container, false, true); // isLabel = true
      });
    }
  });
}

document.getElementById('label-controls').addEventListener('click', (e) => {
  const target = e.target.closest('.label-btn');
  if (!target) return;
  const type = target.dataset.type;
  if (!type) return;

  document.querySelectorAll('.label-btn').forEach(btn => btn.classList.remove('active-label'));
  
  if (type === 'NONE') {
    activeLabelType = null;
    target.classList.add('active-label');
  } else {
    activeLabelType = type;
    target.classList.add('active-label');
  }

  updateLabelPreview();
});

window.triggerSignatureUpload = () => {
  sigFileInput.click();
}

sigFileInput.addEventListener('change', (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) return; 

  let filesProcessed = 0;
  for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = function(e) {
          const dataURL = e.target.result;
          if (!signatureImageDataURLs.includes(dataURL)) {
              signatureImageDataURLs.push(dataURL);
          }
          filesProcessed++;
          if (filesProcessed === imageFiles.length) {
              renderSignatureGallery();
          }
      };
      reader.readAsDataURL(file);
  }
  sigFileInput.value = "";
});

function renderSignatureGallery() {
    signatureList.innerHTML = ''; 

    signatureImageDataURLs.forEach((dataURL, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'sig-thumbnail-wrapper';

        const img = document.createElement('img');
        img.src = dataURL;
        img.className = 'sig-thumbnail';
        img.draggable = false; 
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'sig-thumbnail-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Hapus TTD ini';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const removedDataURL = signatureImageDataURLs.splice(index, 1)[0]; 
            renderSignatureGallery();
            if (currentSignatureDataURL === removedDataURL) {
              currentSignatureDataURL = null;
            }
        };

        wrapper.addEventListener('mousedown', (e) => {
            e.preventDefault(); 
            
            currentSignatureDataURL = dataURL;
            
            document.querySelectorAll('.sig-thumbnail-wrapper').forEach(thumb => { 
              thumb.classList.remove('signature-thumb-active'); 
            });
            wrapper.classList.add('signature-thumb-active');
            
            const tempImg = new Image();
            tempImg.onload = () => {
              sigNaturalWidth = tempImg.naturalWidth;
              sigNaturalHeight = tempImg.naturalHeight;
            };
            tempImg.src = dataURL;

            if (dragGhostElement) dragGhostElement.remove();
            dragGhostElement = document.createElement('img');
            dragGhostElement.src = dataURL;
            dragGhostElement.style.position = 'fixed';
            dragGhostElement.style.zIndex = '10000';
            dragGhostElement.style.pointerEvents = 'none';
            dragGhostElement.style.opacity = '0.8';
            dragGhostElement.style.width = '120px';
            dragGhostElement.style.height = 'auto';
            dragGhostElement.style.objectFit = 'contain';
            dragGhostElement.style.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))';
            document.body.appendChild(dragGhostElement);

            positionDragGhost(e);

            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('mouseup', onDragEnd);
        });
        
        if (dataURL === currentSignatureDataURL) {
          wrapper.classList.add('signature-thumb-active');
        }

        wrapper.appendChild(img);
        wrapper.appendChild(deleteBtn);
        signatureList.appendChild(wrapper);
    });
}

function positionDragGhost(e) {
  if (!dragGhostElement) return;
  dragGhostElement.style.left = (e.clientX + 5) + 'px';
  dragGhostElement.style.top = (e.clientY + 5) + 'px';
}

function onDragMove(e) {
  positionDragGhost(e);
}

function onDragEnd(e) {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);

  if (!dragGhostElement) return;

  dragGhostElement.style.display = 'none';
  const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
  
  dragGhostElement.remove();
  dragGhostElement = null;

  const pageContainer = dropTarget ? dropTarget.closest('.preview-container') : null;

  if (pageContainer) {
    const rect = pageContainer.getBoundingClientRect();
    const scale = parseFloat(pageContainer.dataset.scale);
    
    const dropX = (e.clientX - rect.left) / currentZoom;
    const dropY = (e.clientY - rect.top) / currentZoom;
    
    const stampContainer = createStampElement(dropX, dropY, pageContainer, scale);
    pageContainer.appendChild(stampContainer);
    selectStamp(stampContainer);
    saveHistory();
  }
}


function createStampElement(dropX, dropY, container, scale) {
  const stampWidth = sigNaturalWidth > 150 ? 150 : sigNaturalWidth;
  const stampHeight = (stampWidth / sigNaturalWidth) * sigNaturalHeight;
  
  const stampContainer = document.createElement('div');
  stampContainer.className = "stamp-container";
  stampContainer.style.width = stampWidth + "px";
  stampContainer.style.height = stampHeight + "px";
  stampContainer.style.left = (dropX - stampWidth / 2) + "px";
  stampContainer.style.top = (dropY - stampHeight / 2) + "px";
  
  const img = document.createElement('img');
  img.src = currentSignatureDataURL;
  stampContainer.appendChild(img);
  
  const resizeHandle = document.createElement('div');
  resizeHandle.className = "resize-handle";
  stampContainer.appendChild(resizeHandle);
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = "stamp-delete-button";
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    stampContainer.remove();
    saveHistory();
  });
  stampContainer.appendChild(deleteBtn);
  
  stampContainer.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('stamp-delete-button')) return;
    if (isPanMode) { e.stopPropagation(); return; }
    selectStamp(stampContainer);
    startDrag(e, stampContainer, container, false, false);
  });
  stampContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('stamp-delete-button')) return;
    selectStamp(stampContainer)
  });
  return stampContainer;
}

function selectStamp(element) {
  if (selectedStamp && selectedStamp !== element) {
    selectedStamp.classList.remove('stamp-selected');
  }
  selectedStamp = element;
  element.classList.add('stamp-selected');
  
  if (element.classList.contains('text-element')) {
    textFormattingSection.style.display = 'block';
    const computedStyle = window.getComputedStyle(element);
    const computedFontFamily = computedStyle.fontFamily.split(',')[0].replace(/['"]/g, '');
    const fontSelectOptions = Array.from(fontFamilySelect.options).map(o => o.value);
    fontFamilySelect.value = fontSelectOptions.includes(computedFontFamily) ? computedFontFamily : "Helvetica";
    
    fontSizeSelect.value = parseInt(computedStyle.fontSize) || 16;
    
    const colorCSS = computedStyle.color;
    fontColorInput.value = rgbToHex(colorCSS);
    
    btnBold.classList.toggle('active-btn', parseInt(computedStyle.fontWeight) >= 700);
    btnItalic.classList.toggle('active-btn', computedStyle.fontStyle === "italic");
    btnUnderline.classList.toggle('active-btn', (computedStyle.textDecorationLine || computedStyle.textDecoration).includes("underline"));

    if (computedStyle.textAlign === 'center') {
      btnAlignCenter.classList.add('active-btn');
      btnAlignLeft.classList.remove('active-btn');
      btnAlignRight.classList.remove('active-btn');
    } else if (computedStyle.textAlign === 'right') {
      btnAlignRight.classList.add('active-btn');
      btnAlignLeft.classList.remove('active-btn');
      btnAlignCenter.classList.remove('active-btn');
    } else {
      btnAlignLeft.classList.add('active-btn');
      btnAlignCenter.classList.remove('active-btn');
      btnAlignRight.classList.remove('active-btn');
    }
  } else if (element.classList.contains('shape-element')) {
    textFormattingSection.style.display = 'none';
    shapeColorInput.value = element.getAttribute('data-color');
    shapeButtons.forEach(btn => {
      btn.classList.toggle('active-btn', btn.dataset.shape === element.dataset.shape);
    });
  } else {
    textFormattingSection.style.display = 'none';
  }
}

function rgbToHex(rgbStr) {
  const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function createTextInputAt(container, x, y) {
  const textElement = document.createElement('div');
  textElement.className = "text-element";
  textElement.style.left = x + "px";
  textElement.style.top = y + "px";
  textElement.innerText = "Ketik di sini...";
  textElement.style.fontFamily = fontFamilySelect.value;
  textElement.style.fontSize = fontSizeSelect.value + "px";
  textElement.style.color = fontColorInput.value;
  textElement.style.zIndex = 9999;
  textElement.style.width = "150px";
  textElement.style.border = "1px dashed #000";
  
  const resizeHandle = document.createElement('div');
  resizeHandle.className = "resize-handle";
  textElement.appendChild(resizeHandle);
  
  textElement.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    if (isPanMode) { e.stopPropagation(); return; }
    selectStamp(textElement);
    startDrag(e, textElement, container, false, false);
  });
  textElement.addEventListener('click', () => selectStamp(textElement));
  textElement.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    textElement.setAttribute("contenteditable", "true");
    textElement.focus();
  });
  textElement.addEventListener('blur', () => { 
    textElement.removeAttribute("contenteditable"); 
    textElement.style.border = "none";
    if(textElement.innerText.trim() === "" || textElement.innerText.trim() === "Ketik di sini...") {
      textElement.remove();
    }
    saveHistory(); 
  });
  
  container.appendChild(textElement);
  selectStamp(textElement);
  
  textElement.setAttribute("contenteditable", "true");
  textElement.focus();
  if (window.getSelection) {
      const selection = window.getSelection();
      selection.selectAllChildren(textElement);
  } else {
      document.execCommand('selectAll', false, null);
  }
}

fontFamilySelect.addEventListener('input', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    selectedStamp.style.fontFamily = fontFamilySelect.value;
  }
});
fontSizeSelect.addEventListener('input', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    selectedStamp.style.fontSize = fontSizeSelect.value + "px";
  }
});
fontColorInput.addEventListener('input', () => {
  if (selectedStamp && selectedStamp.classList.contains('text-element')) {
    selectedStamp.style.color = fontColorInput.value;
  }
});

function startDrag(e, element, container, isTimestamp = false, isLabel = false) {
  e.preventDefault();
  let isDragging = true;
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  const offsetX = (e.clientX - elementRect.left) / currentZoom;
  const offsetY = (e.clientY - elementRect.top) / currentZoom;
  
  const onMouseMove = (eMove) => {
    if (!isDragging) return;
    
    let newX = (eMove.clientX - containerRect.left) / currentZoom - offsetX;
    let newY = (eMove.clientY - containerRect.top) / currentZoom - offsetY;
    
    // Boundary check
    newX = Math.max(0, Math.min(newX, container.clientWidth - element.offsetWidth));
    newY = Math.max(0, Math.min(newY, container.clientHeight - element.offsetHeight));
    
    element.style.left = newX + "px";
    element.style.top = newY + "px";

    if (isTimestamp) {
      const newLeft = newX + "px";
      const newTop = newY + "px";
      document.querySelectorAll('.timestamp-preview').forEach(ts => {
          if (ts !== element) {
              ts.style.left = newLeft;
              ts.style.top = newTop;
          }
      });
    }

    if (isLabel) {
      const newLeft = newX + "px";
      const newTop = newY + "px";
      document.querySelectorAll('.label-preview').forEach(lbl => {
          if (lbl !== element) {
            lbl.style.left = newLeft;
            lbl.style.top = newTop;
          }
      });
    }
  };
  const onMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    if (isTimestamp) {
       globalTimestampLeft = element.style.left;
       globalTimestampTop = element.style.top;
    } else if (isLabel) {
       globalLabelLeft = element.style.left;
       globalLabelTop = element.style.top;
    } else {
       saveHistory();
    }
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function startResize(e, element) {
  e.preventDefault();
  let isResizing = true;
  const startX = e.clientX;
  const startY = e.clientY;
  
  if (element.classList.contains('text-element')) {
    const startWidth = element.offsetWidth;
    const onMouseMove = (eMove) => {
      if (!isResizing) return;
      const deltaX = eMove.clientX - startX;
      let newWidth = startWidth + (deltaX / currentZoom);
      newWidth = Math.max(newWidth, 50);
      element.style.width = newWidth + "px";
    };
    const onMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      saveHistory();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

  } else {
    let startWidth = element.offsetWidth;
    let startHeight = element.offsetHeight;
    const aspectRatio = startWidth / startHeight;
    
    const onMouseMove = (eMove) => {
      if (!isResizing) return;
      const deltaX = eMove.clientX - startX;
      let newWidth = startWidth + (deltaX / currentZoom);
      newWidth = Math.max(newWidth, 20);
      let newHeight = newWidth / aspectRatio;
      
      element.style.width = newWidth + "px";
      element.style.height = newHeight + "px";
    };
    const onMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      saveHistory();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
document.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('resize-handle')) {
    startResize(e, e.target.parentElement);
  }
  if (!e.target.closest('.stamp-container, .shape-element, .text-element, aside, .pdf-controls, .timestamp-preview, .label-preview')) {
    if (selectedStamp) {
      selectedStamp.classList.remove('stamp-selected');
      selectedStamp = null;
      textFormattingSection.style.display = 'none';
    }
  }
});
document.addEventListener('keydown', (e) => {
  if (!selectedStamp) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    if(document.activeElement === selectedStamp && selectedStamp.isContentEditable) return;
    
    selectedStamp.remove();
    selectedStamp = null;
    textFormattingSection.style.display = 'none';
    saveHistory();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'c') {
    e.preventDefault();
    if (selectedStamp) {
      copyElement(selectedStamp);
      showToast("Elemen disalin!", "success");
    }
  }
  if (e.ctrlKey && e.key === 'v') {
    e.preventDefault();
    if (copiedStampData && activeContainer) {
      const centerX = activeContainer.clientWidth / 2;
      const centerY = activeContainer.clientHeight / 2;
      pasteCopiedElement(activeContainer, centerX, centerY, false);
      saveHistory();
    }
  }
});

document.addEventListener('contextmenu', (e) => {
  const targetElement = e.target.closest('.stamp-container, .text-element, .shape-element');
  
  if (targetElement) {
    e.preventDefault();
    contextMenuData.target = targetElement;
    showContextMenu(e.pageX, e.pageY);
  } else {
    hideContextMenu();
  }
});

function showContextMenu(pageX, pageY) {
  customContextMenu.style.left = pageX + "px";
  customContextMenu.style.top = pageY + "px";
  customContextMenu.style.display = "block";
}
function hideContextMenu() {
  customContextMenu.style.display = "none";
}

document.getElementById('context-copy-all').addEventListener('click', () => {
  if (contextMenuData.target) {
    copyElement(contextMenuData.target);
    if (copiedStampData) {
      document.querySelectorAll('.preview-container').forEach(container => {
        if (container.id !== contextMenuData.target.closest('.preview-container').id) {
           pasteCopiedElement(container, 0, 0, true);
        }
      });
      saveHistory();
      showToast("Disalin ke semua halaman!", "success");
    }
  }
  hideContextMenu();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-context-menu')) {
    hideContextMenu();
  }
});

function copyElement(element) {
  if (!element) return;
  selectedStamp = element;
  if (selectedStamp.classList.contains('text-element')) {
    const computedStyle = window.getComputedStyle(selectedStamp);
    copiedStampData = {
      type: 'text',
      width: selectedStamp.offsetWidth,
      height: selectedStamp.offsetHeight,
      text: selectedStamp.innerText,
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontColor: computedStyle.color,
      fontWeight: computedStyle.fontWeight,
      fontStyle: computedStyle.fontStyle,
      textDecoration: computedStyle.textDecoration,
      textAlign: computedStyle.textAlign,
      left: selectedStamp.style.left,
      top: selectedStamp.style.top
    };
  } else if (selectedStamp.querySelector('img')) {
    copiedStampData = {
      type: 'stamp',
      width: selectedStamp.offsetWidth,
      height: selectedStamp.offsetHeight,
      src: selectedStamp.querySelector('img').src,
      left: selectedStamp.style.left,
      top: selectedStamp.style.top
    };
  } else if (selectedStamp.getAttribute('data-shape')) {
    copiedStampData = {
      type: 'shape',
      width: selectedStamp.offsetWidth,
      height: selectedStamp.offsetHeight,
      shape: selectedStamp.getAttribute('data-shape'),
      color: selectedStamp.getAttribute('data-color'),
      left: selectedStamp.style.left,
      top: selectedStamp.style.top,
      angle: selectedStamp.dataset.angle || 0,
      thickness: selectedStamp.dataset.thickness || 2
    };
  }
}

function pasteCopiedElement(container, posX, posY, useCopiedCoordinates) {
  let newElement;
  if (!copiedStampData) return;
  let left, top;
  
  if (useCopiedCoordinates && copiedStampData.left && copiedStampData.top) {
    left = copiedStampData.left;
    top = copiedStampData.top;
    const existing = container.querySelector(`[style*="left: ${left}"][style*="top: ${top}"]`);
    if (existing) return; 

  } else {
    left = (posX - copiedStampData.width / 2) + "px";
    top = (posY - copiedStampData.height / 2) + "px";
  }
  
  if (copiedStampData.type === 'stamp') {
    newElement = document.createElement('div');
    newElement.className = "stamp-container";
    newElement.style.width = copiedStampData.width + "px";
    newElement.style.height = copiedStampData.height + "px";
    const img = document.createElement('img');
    img.src = copiedStampData.src;
    newElement.appendChild(img);
  } else if (copiedStampData.type === 'shape') {
    newElement = document.createElement('div');
    newElement.className = "shape-element";
    newElement.setAttribute('data-shape', copiedStampData.shape);
    newElement.setAttribute('data-color', copiedStampData.color);
    newElement.style.width = copiedStampData.width + "px";
    newElement.style.height = copiedStampData.height + "px";
    if (copiedStampData.shape === 'line') {
      newElement.style.background = "transparent";
      newElement.style.borderTop = `${copiedStampData.thickness}px solid ${copiedStampData.color}`;
      newElement.style.transform = `rotate(${copiedStampData.angle}deg)`;
      newElement.dataset.angle = copiedStampData.angle;
      newElement.dataset.thickness = copiedStampData.thickness;
    } else {
      newElement.style.background = copiedStampData.color;
      if (copiedStampData.shape === 'ellipse') {
        newElement.style.borderRadius = "50%";
      }
    }
  } else if (copiedStampData.type === 'text') {
    newElement = document.createElement('div');
    newElement.className = "text-element";
    newElement.innerText = copiedStampData.text;
    newElement.style.fontFamily = copiedStampData.fontFamily || "Helvetica";
    newElement.style.fontSize = copiedStampData.fontSize || "12px";
    newElement.style.color = copiedStampData.fontColor || "#000000";
    newElement.style.fontWeight = copiedStampData.fontWeight || "normal";
    newElement.style.fontStyle = copiedStampData.fontStyle || "normal";
    newElement.style.textDecoration = copiedStampData.textDecoration || "none";
    newElement.style.textAlign = copiedStampData.textAlign || "left";
    newElement.style.width = copiedStampData.width + "px";
  }
  
  if (newElement) {
    newElement.style.left = left;
    newElement.style.top = top;
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = "resize-handle";
    newElement.appendChild(resizeHandle);
    
    if (copiedStampData.type !== 'text') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = "stamp-delete-button";
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        newElement.remove();
        saveHistory();
      });
      newElement.appendChild(deleteBtn);
    }

    newElement.addEventListener('mousedown', (ev) => {
      if (ev.target.classList.contains('resize-handle') || ev.target.classList.contains('stamp-delete-button')) return;
      if (isPanMode) { ev.stopPropagation(); return; }
      selectStamp(newElement);
      startDrag(ev, newElement, container, false, false);
    });
    newElement.addEventListener('click', (ev) => {
       if (ev.target.classList.contains('stamp-delete-button')) return;
       selectStamp(newElement)
    });
    if (copiedStampData.type === 'text') {
      newElement.addEventListener('dblclick', (e) => { e.stopPropagation(); newElement.setAttribute("contenteditable", "true"); newElement.focus(); });
      newElement.addEventListener('blur', () => { newElement.removeAttribute("contenteditable"); saveHistory(); });
    }
    
    container.appendChild(newElement);
    if (!useCopiedCoordinates) {
      selectStamp(newElement);
    }
  }
}

btnToggleShape.addEventListener('click', () => {
  isAddingShape = !isAddingShape;
  btnToggleShape.textContent = isAddingShape ? "Cancel Shape" : "Add Shape";
  btnToggleShape.classList.toggle('action-button-secondary');
  btnToggleShape.classList.toggle('action-button-primary');
});
shapeColorInput.addEventListener('input', () => {
  shapeColor = shapeColorInput.value;
  if (selectedStamp && selectedStamp.classList.contains('shape-element')) {
    selectedStamp.setAttribute('data-color', shapeColor);
    if (selectedStamp.getAttribute('data-shape') === 'line') {
      selectedStamp.style.borderTop = "2px solid " + shapeColor;
    } else {
      selectedStamp.style.background = shapeColor;
      if (selectedStamp.getAttribute('data-shape') === 'ellipse') {
        selectedStamp.style.borderRadius = "50%";
      }
    }
    saveHistory();
  }
});
shapeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    shapeButtons.forEach(b => b.classList.remove('active-btn'));
    btn.classList.add('active-btn');
    shapeType = btn.getAttribute('data-shape');
  });
});

pdfMain.addEventListener('mousedown', (e) => {
  if (!isAddingShape || isPanMode) return;
  if (e.target.closest('aside, .pdf-controls, #custom-context-menu, .stamp-container, .text-element, .shape-element, .timestamp-preview, .label-preview')) return;
  
  const container = e.target.closest('.preview-container');
  if (!container) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const rect = container.getBoundingClientRect();
  
  shapeStartX = (e.clientX - rect.left) / currentZoom;
  shapeStartY = (e.clientY - rect.top) / currentZoom;
  
  tempShapeEl = document.createElement('div');
  tempShapeEl.className = "shape-element";
  tempShapeEl.style.border = "none";
  tempShapeEl.setAttribute('data-shape', shapeType);
  tempShapeEl.setAttribute('data-color', shapeColor);
  
  if (shapeType === 'line') {
    tempShapeEl.style.left = shapeStartX + "px";
    tempShapeEl.style.top = shapeStartY + "px";
    tempShapeEl.style.width = "0px";
    tempShapeEl.style.height = "2px";
    tempShapeEl.style.borderTop = "2px solid " + shapeColor;
    tempShapeEl.style.transformOrigin = "0 50%";
    tempShapeEl.dataset.thickness = "2";
  } else {
    tempShapeEl.style.left = shapeStartX + "px";
    tempShapeEl.style.top = shapeStartY + "px";
    tempShapeEl.style.width = "0px";
    tempShapeEl.style.height = "0px";
    tempShapeEl.style.background = shapeColor;
    if (shapeType === 'ellipse') {
      tempShapeEl.style.borderRadius = "50%";
    }
  }
  container.appendChild(tempShapeEl);

  const onShapeMouseMove = (eMove) => {
    if (!tempShapeEl || !isAddingShape) return;
    
    const currentX = (eMove.clientX - rect.left) / currentZoom;
    const currentY = (eMove.clientY - rect.top) / currentZoom;
    
    if (tempShapeEl.getAttribute('data-shape') === 'line') {
      const dx = currentX - shapeStartX;
      const dy = currentY - shapeStartY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      tempShapeEl.style.width = length + "px";
      tempShapeEl.style.transform = `rotate(${angle}deg)`;
      tempShapeEl.dataset.angle = angle;
    } else {
      const w = currentX - shapeStartX;
      const h = currentY - shapeStartY;
      tempShapeEl.style.left = (w < 0 ? currentX : shapeStartX) + "px";
      tempShapeEl.style.top = (h < 0 ? currentY : shapeStartY) + "px";
      tempShapeEl.style.width = Math.abs(w) + "px";
      tempShapeEl.style.height = Math.abs(h) + "px";
      if (tempShapeEl.getAttribute('data-shape') === 'ellipse') {
        tempShapeEl.style.borderRadius = "50%";
      }
    }
  };
  const onShapeMouseUp = (eUp) => {
    if (!tempShapeEl || !isAddingShape) return;
    
    let w = parseFloat(tempShapeEl.style.width);
    let h = parseFloat(tempShapeEl.style.height);
    if (tempShapeEl.getAttribute('data-shape') === 'line') {
      if (w < 10) { tempShapeEl.remove(); tempShapeEl = null; return; }
    } else {
      if (w < 10 || h < 10) { tempShapeEl.remove(); tempShapeEl = null; return; }
    }
    
    const finalizedShape = tempShapeEl;
    finalizedShape.style.border = "1px dashed var(--accent-start)";
    
    finalizedShape.addEventListener('click', () => selectStamp(finalizedShape));
    finalizedShape.addEventListener('mousedown', (ev) => {
      if (ev.target.classList.contains('resize-handle') || ev.target.classList.contains('stamp-delete-button')) return;
      if (isPanMode) { ev.stopPropagation(); return; }
      selectStamp(finalizedShape);
      startDrag(ev, finalizedShape, container, false, false);
    });
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = "resize-handle";
    finalizedShape.appendChild(resizeHandle);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "stamp-delete-button";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      finalizedShape.remove();
      saveHistory();
    });
    if (finalizedShape.getAttribute('data-shape') === 'line') {
      deleteBtn.style.transform = "rotate(" + (-parseFloat(finalizedShape.dataset.angle)) + "deg)";
    }
    finalizedShape.appendChild(deleteBtn);
    
    tempShapeEl = null;
    isAddingShape = false;
    btnToggleShape.textContent = "Add Shape";
    btnToggleShape.classList.add('action-button-secondary');
    btnToggleShape.classList.remove('action-button-primary');
    
    saveHistory();
    
    document.removeEventListener('mousemove', onShapeMouseMove);
    document.removeEventListener('mouseup', onShapeMouseUp);
  };

  document.addEventListener('mousemove', onShapeMouseMove);
  document.addEventListener('mouseup', onShapeMouseUp);
});


function goToPage(pageNumber) {
  if (pageNumber < 1) pageNumber = 1;
  if (pageNumber > totalPages) pageNumber = totalPages;
  currentPage = pageNumber;
  currentPageInput.value = currentPage;
  const targetPage = document.getElementById(`page-container-${pageNumber}`);
  if (targetPage) { 
    targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
    document.querySelectorAll('.preview-container').forEach(c => c.style.borderColor = 'var(--border-color)');
    targetPage.style.borderColor = 'var(--accent-start)';
    activeContainer = targetPage;
  }
}
btnPrevPage.addEventListener('click', () => { if (currentPage > 1) goToPage(currentPage - 1); });
btnNextPage.addEventListener('click', () => { if (currentPage < totalPages) goToPage(currentPage + 1); });
currentPageInput.addEventListener('change', (e) => {
  const requestedPage = parseInt(e.target.value);
  if (!isNaN(requestedPage)) { goToPage(requestedPage); }
});

async function executePdfDownload() {
  if (!pdfFile) { showToast("PDF belum di-preview.", "warning"); return; }
  
  const spinner = document.getElementById('mergeSpinner');
  spinner.classList.remove('hidden');
  btnDownload.disabled = true;

  try {
    const freshPdfData = await pdfFile.arrayBuffer();
    const pdfDocLib = await PDFLib.PDFDocument.load(freshPdfData);
    
    const fontMapping = {
      "Helvetica": {
        regular: PDFLib.StandardFonts.Helvetica,
        bold: PDFLib.StandardFonts.HelveticaBold,
        italic: PDFLib.StandardFonts.HelveticaOblique,
        boldItalic: PDFLib.StandardFonts.HelveticaBoldOblique
      },
      "Times Roman": {
        regular: PDFLib.StandardFonts.TimesRoman,
        bold: PDFLib.StandardFonts.TimesRomanBold,
        italic: PDFLib.StandardFonts.TimesRomanItalic,
        boldItalic: PDFLib.StandardFonts.TimesRomanBoldItalic
      },
      "Courier": {
        regular: PDFLib.StandardFonts.Courier,
        bold: PDFLib.StandardFonts.CourierBold,
        italic: PDFLib.StandardFonts.CourierOblique,
        boldItalic: PDFLib.StandardFonts.CourierBoldOblique
      },
      "Verdana": { 
        regular: PDFLib.StandardFonts.Helvetica,
        bold: PDFLib.StandardFonts.HelveticaBold,
        italic: PDFLib.StandardFonts.HelveticaOblique,
        boldItalic: PDFLib.StandardFonts.HelveticaBoldOblique
      }
    };
    const embeddedFontMapping = {};
    for (const family in fontMapping) {
      embeddedFontMapping[family] = {
        regular: await pdfDocLib.embedFont(fontMapping[family].regular),
        bold: await pdfDocLib.embedFont(fontMapping[family].bold),
        italic: await pdfDocLib.embedFont(fontMapping[family].italic),
        boldItalic: await pdfDocLib.embedFont(fontMapping[family].boldItalic)
      };
    }

    // --- EMBED LABEL IMAGE IF ACTIVE ---
    let labelImageEmbed = null;
    let labelWidth = 0;
    let labelHeight = 0;

    if (activeLabelType && activeLabelType !== 'NONE') {
      try {
        const imgUrl = (activeLabelType === 'RANDOM') 
          ? 'https://ajmaerlangga.github.io/image/RANDOM_CHECK.png' 
          : 'https://ajmaerlangga.github.io/image/QC_100.png';
        
        // Fetch gambar sebagai array buffer
        const response = await fetch(imgUrl);
        const imageBuffer = await response.arrayBuffer();
        
        // Embed PNG
        labelImageEmbed = await pdfDocLib.embedPng(imageBuffer);
        
        // Dapatkan dimensi asli untuk rasio aspek jika diperlukan, 
        // tapi kita akan gunakan ukuran dari elemen DOM
        const dims = labelImageEmbed.scale(1);
        labelWidth = dims.width;
        labelHeight = dims.height;

      } catch (err) {
        console.error("Gagal memuat gambar label:", err);
        showToast("Gagal memuat gambar Label QC/Random.", "error");
      }
    }
    
    const containers = document.querySelectorAll(".preview-container");
    for (const container of containers) {
      const pageNumber = parseInt(container.getAttribute('data-page'));
      const scale = parseFloat(container.getAttribute('data-scale'));
      const originalHeight = parseFloat(container.getAttribute('data-original-height'));
      const pdfPage = pdfDocLib.getPages()[pageNumber - 1];
      
      const stamps = container.querySelectorAll(".stamp-container");
      for (const stamp of stamps) {
        const stampX = parseFloat(stamp.style.left) || 0;
        const stampY = parseFloat(stamp.style.top) || 0;
        const stampWidth = stamp.offsetWidth;
        const stampHeight = stamp.offsetHeight;
        const pdfX = stampX / scale;
        const pdfWidth = stampWidth / scale;
        const pdfHeight = stampHeight / scale;
        const pdfY = originalHeight - (stampY + stampHeight) / scale;
        const stampImgSrc = stamp.querySelector('img').src;
        let stampEmbed;
        if (stampImgSrc.startsWith("data:image/png")) {
          stampEmbed = await pdfDocLib.embedPng(stampImgSrc);
        } else if (stampImgSrc.startsWith("data:image/jpeg")) {
          stampEmbed = await pdfDocLib.embedJpg(stampImgSrc);
        } else { 
          // Jika gambar dari URL external (misal copy paste)
          try {
             const resp = await fetch(stampImgSrc);
             const buf = await resp.arrayBuffer();
             stampEmbed = await pdfDocLib.embedPng(buf);
          } catch(e) {
             showToast("Format gambar TTD tidak didukung.", "error"); 
             continue; 
          }
        }
        pdfPage.drawImage(stampEmbed, { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight });
      }
      
      const shapes = container.querySelectorAll(".shape-element");
      for (const shape of shapes) {
        const shapeX = parseFloat(shape.style.left) || 0;
        const shapeY = parseFloat(shape.style.top) || 0;
        const shapeWidth = shape.offsetWidth;
        const shapeHeight = shape.offsetHeight;
        const pdfX = shapeX / scale;
        const pdfWidth = shapeWidth / scale;
        const pdfHeight = shapeHeight / scale;
        const pdfY = originalHeight - (shapeY + shapeHeight) / scale;
        const shapeType = shape.getAttribute('data-shape');
        const shapeColorHex = shape.getAttribute('data-color') || "#000000";
        const color = hexToRgbNormalized(shapeColorHex);
        
        if (shapeType === "rectangle") {
          pdfPage.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
            color: color
          });
        } else if (shapeType === "ellipse") {
          pdfPage.drawEllipse({
            x: pdfX + pdfWidth / 2,
            y: pdfY + pdfHeight / 2,
            xScale: pdfWidth / 2,
            yScale: pdfHeight / 2,
            color: color
          });
        } else if (shapeType === "line") {
          const angle = parseFloat(shape.dataset.angle) || 0;
          const thickness = parseFloat(shape.dataset.thickness) || 2;
          const startX = pdfX;
          const startY = originalHeight - (shapeY / scale) - (shapeHeight / 2 / scale);
          const endX = startX + pdfWidth * Math.cos(angle * Math.PI / 180);
          const endY = startY + pdfWidth * Math.sin(angle * Math.PI / 180);
          pdfPage.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            color: color,
            thickness: thickness
          });
        }
      }
      
      const texts = container.querySelectorAll(".text-element");
      for (const textEl of texts) {
        const text = textEl.innerText;
        const textX = parseFloat(textEl.style.left) || 0;
        const textY = parseFloat(textEl.style.top) || 0;
        const fontSize = parseFloat(textEl.style.fontSize) || 12;
        const pdfX = textX / scale;
        const pdfY = originalHeight - (textY / scale) - (fontSize / scale * 0.9);
        const fontFamily = textEl.style.fontFamily || "Helvetica";
        const color = hexToRgbNormalized(textEl.style.color || "#000000");
        let font;
        
        const computedStyle = window.getComputedStyle(textEl);
        const isBold = parseInt(computedStyle.fontWeight) >= 700;
        const isItalic = computedStyle.fontStyle === "italic";

        if (isBold && isItalic) {
          font = embeddedFontMapping[fontFamily].boldItalic;
        } else if (isBold) {
          font = embeddedFontMapping[fontFamily].bold;
        } else if (isItalic) {
          font = embeddedFontMapping[fontFamily].italic;
        } else {
          font = embeddedFontMapping[fontFamily].regular;
        }
        
        const textAlign = computedStyle.textAlign || 'left'; 
        const isUnderlined = (computedStyle.textDecoration || '').includes('underline'); 
        const scaledFontSize = fontSize / scale;
        const maxWidth = (textEl.offsetWidth / scale);
        
        const lines = text.split('\n');
        const lineHeight = (fontSize * 1.2) / scale;
        let currentDrawY = pdfY; 

        for (const line of lines) {
          const lineWidth = font.widthOfTextAtSize(line, scaledFontSize);
          let lineX; 
          
          if (textAlign === 'center') {
              lineX = pdfX + (maxWidth / 2) - (lineWidth / 2); 
          } else if (textAlign === 'right') {
              lineX = pdfX + maxWidth - lineWidth; 
          } else {
              lineX = pdfX; 
          }
          
          pdfPage.drawText(line, {
            x: lineX,
            y: currentDrawY,
            size: scaledFontSize,
            font: font,
            color: color,
          });

          if (isUnderlined) {
            pdfPage.drawLine({
                start: { x: lineX, y: currentDrawY - 2 / scale }, 
                end: { x: lineX + lineWidth, y: currentDrawY - 2 / scale },
                thickness: 0.5 / scale, 
                color: color,
            });
          }
          
          currentDrawY -= lineHeight;
        }
      }
      
      // DRAW TIMESTAMP
      const timestamps = container.querySelectorAll(".timestamp-preview");
      timestamps.forEach(ts => {
        const tsX = parseFloat(ts.style.left) || 0;
        const tsY = parseFloat(ts.style.top) || 0;
        const tsText = ts.textContent;
        const pdfX = tsX / scale;
        const pdfY = originalHeight - (tsY / scale) - (8 / scale);
        pdfPage.drawText(tsText, {
          x: pdfX,
          y: pdfY,
          size: 8 / scale,
          font: embeddedFontMapping["Helvetica"].regular,
          color: PDFLib.rgb(0, 0, 0)
        });
      });

      // DRAW LABEL (BARU)
      const labels = container.querySelectorAll(".label-preview");
      labels.forEach(lbl => {
        if (labelImageEmbed) {
          const lblX = parseFloat(lbl.style.left) || 0;
          const lblY = parseFloat(lbl.style.top) || 0;
          const lblW = lbl.offsetWidth;
          const lblH = lbl.offsetHeight;

          const pdfX = lblX / scale;
          const pdfW = lblW / scale;
          const pdfH = lblH / scale;
          // Koordinat Y di PDF dimulai dari bawah, di HTML dari atas
          const pdfY = originalHeight - (lblY + lblH) / scale;

          pdfPage.drawImage(labelImageEmbed, {
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH
          });
        }
      });
    }
    
    const modifiedPdfBytes = await pdfDocLib.save();
    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileNameInput.value ? outputFileNameInput.value + '.pdf' : 'Modified_PDF.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast("PDF berhasil diunduh!", "success");
    
  } catch (error) {
    console.error("Download error:", error);
    showToast("Terjadi kesalahan saat mengunduh PDF.", "error");
  } finally {
    spinner.classList.add('hidden');
    btnDownload.disabled = false;
  }
}

btnDownload.addEventListener('click', async () => {
  if (showJiNotify) {
    if (!checkChecklistCompleteness()) {
      showToast("Harap lengkapi Checklist dan opsi CRB terlebih dahulu!", "warning");
      const box = document.getElementById('ji-checklist-box');
      box.classList.remove('pulsing-border');
      void box.offsetWidth; // trigger reflow
      box.classList.add('pulsing-border');
      return;
    }
    openJiConfirmModal();
  } else {
    await executePdfDownload();
  }
});

jiConfirmSesuai.addEventListener('click', async () => {
  closeJiConfirmModal();
  await executePdfDownload();
});


mainContent.addEventListener('dragover', (e) => {
  e.preventDefault();
  mainContent.classList.add('drag-over-active');
});
mainContent.addEventListener('dragleave', (e) => {
  mainContent.classList.remove('drag-over-active');
});
mainContent.addEventListener('drop', async (e) => {
  e.preventDefault();
  mainContent.classList.remove('drag-over-active');
  
  if (e.target.closest('aside')) {
    return;
  }

  if (e.dataTransfer.files.length > 0) {
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile.type === "application/pdf") {
      pdfFile = droppedFile;
      pdfData = await droppedFile.arrayBuffer();
      
      pdfLoadingOverlay.classList.remove('hidden'); 
      try {
        await renderPDF(pdfData);
      } catch (err) {
        console.error("Error rendering PDF:", err);
        showToast("Gagal memuat PDF.", "error");
      } finally {
        pdfLoadingOverlay.classList.add('hidden'); 
      }

    } else {
      showToast("Silakan drop file PDF.", "warning");
    }
  }
});

loadSavedTheme();
setupConstellationEffect();
setupThemeEventListeners();
updateUndoRedoButtons(); 

const shapesHeader = document.getElementById('shapes-header');
const shapesContent = document.getElementById('shapes-content');
shapesHeader.addEventListener('click', () => {
  const isCollapsed = shapesContent.style.display === 'none';
  shapesContent.style.display = isCollapsed ? 'block' : 'none';
  shapesHeader.classList.toggle('collapsed', !isCollapsed);
});

document.querySelectorAll('.initial-hidden').forEach((el, i) => setTimeout(() => {
    el.classList.add('animate-fade-in');
    el.classList.remove('initial-hidden');
}, i * 200));
