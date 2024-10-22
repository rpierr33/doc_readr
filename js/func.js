
            const fileInput = document.getElementById('file-input');
            const pdfViewer = document.getElementById('pdf-viewer');
            const captionContainer = document.getElementById('caption-container');
            const readBtn = document.getElementById('read-btn');
            const rewindBtn = document.getElementById('rewind-btn');
            const forwardBtn = document.getElementById('forward-btn');
            const voiceSelect = document.getElementById('voice-select');
            const prevPageBtn = document.getElementById('prev-page');
            const nextPageBtn = document.getElementById('next-page');
            const pageNumSpan = document.getElementById('page-num');
            const speedControl = document.getElementById('speed-control');
            const speedValue = document.getElementById('speed-value');
            const progressBar = document.getElementById('progress');

            let pdfDoc = null;
            let pageNum = 1;
            let pdfText = [];
            let currentSpeech = null;
            let voices = [];
            let currentWordIndex = 0;
            let words = [];

            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

            async function loadPDF(file) {
                const data = await file.arrayBuffer();
                pdfDoc = await pdfjsLib.getDocument(data).promise;
                pdfText = [];
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    pdfText.push(pageText);
                }
                pageNum = 1;
                renderPage(pageNum);
                words = pdfText[pageNum - 1].split(/\s+/);
                currentWordIndex = 0;
            }

            async function renderPage(num) {
                const page = await pdfDoc.getPage(num);
                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext);

                pdfViewer.innerHTML = '';
                pdfViewer.appendChild(canvas);
                pageNumSpan.textContent = `Page ${num} of ${pdfDoc.numPages}`;
            }

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file.type !== 'application/pdf') {
                    alert('Error: Not a PDF file');
                    return;
                }
                loadPDF(file);
            });

            function populateVoiceList() {
                voices = window.speechSynthesis.getVoices();
                voiceSelect.innerHTML = '';
                voices.forEach((voice, i) => {
                    const option = document.createElement('option');
                    option.textContent = `${voice.name} (${voice.lang})`;
                    option.setAttribute('data-lang', voice.lang);
                    option.setAttribute('data-name', voice.name);
                    voiceSelect.appendChild(option);
                });
            }

            populateVoiceList();
            if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = populateVoiceList;
            }

            function highlightWord(word, container) {
                const regex = new RegExp(`\\b${word}\\b`, 'i');
                container.innerHTML = container.innerHTML.replace(regex, `<span class="highlight">$&</span>`);
            }

            function updateProgress() {
                const progress = (currentWordIndex / words.length) * 100;
                progressBar.style.width = `${progress}%`;
            }

            function startReading(startIndex = 0) {
                if (!pdfText.length) {
                    alert('Please upload a PDF file first.');
                    return;
                }

                if (currentSpeech) {
                    window.speechSynthesis.cancel();
                }

                const selectedVoice = voices.find(voice => `${voice.name} (${voice.lang})` === voiceSelect.value);

                words = pdfText[pageNum - 1].split(/\s+/);
                const utterance = new SpeechSynthesisUtterance(words.slice(startIndex).join(' '));
                utterance.voice = selectedVoice;
                utterance.rate = parseFloat(speedControl.value);
                utterance.pitch = 1;

                currentWordIndex = startIndex;

                utterance.onboundary = (event) => {
                    if (event.name === 'word') {
                        const word = words[currentWordIndex];
                        captionContainer.textContent = words.slice(Math.max(0, currentWordIndex - 10), currentWordIndex + 20).join(' ');
                        highlightWord(word, captionContainer);
                        captionContainer.scrollTop = captionContainer.scrollHeight;
                        currentWordIndex++;
                        updateProgress();
                    }
                };

                utterance.onend = () => {
                    currentSpeech = null;
                    readBtn.textContent = 'Read Aloud';
                    captionContainer.innerHTML = '';
                    if (pageNum < pdfDoc.numPages) {
                        pageNum++;
                        renderPage(pageNum);
                        startReading(0);
                    }
                };

                window.speechSynthesis.speak(utterance);
                currentSpeech = utterance;
                readBtn.textContent = 'Pause';
            }

            readBtn.addEventListener('click', () => {
                if (currentSpeech && window.speechSynthesis.speaking) {
                    if (window.speechSynthesis.paused) {
                        window.speechSynthesis.resume();
                        readBtn.textContent = 'Pause';
                    } else {
                        window.speechSynthesis.pause();
                        readBtn.textContent = 'Resume';
                    }
                } else {
                    startReading(currentWordIndex);
                }
            });

            rewindBtn.addEventListener('click', () => {
                const newIndex = Math.max(0, currentWordIndex - 30);
                startReading(newIndex);
            });

            forwardBtn.addEventListener('click', () => {
                const newIndex = Math.min(words.length - 1, currentWordIndex + 30);
                startReading(newIndex);
            });

            prevPageBtn.addEventListener('click', () => {
                if (pageNum <= 1) return;
                pageNum--;
                renderPage(pageNum);
                if (currentSpeech) {
                    window.speechSynthesis.cancel();
                    startReading(0);
                }
            });

            nextPageBtn.addEventListener('click', () => {
                if (pageNum >= pdfDoc.numPages) return;
                pageNum++;
                renderPage(pageNum);
                if (currentSpeech) {
                    window.speechSynthesis.cancel();
                    startReading(0);
                }
            });

            speedControl.addEventListener('input', (e) => {
                const speed = parseFloat(e.target.value);
                speedValue.textContent = `Speed: ${speed.toFixed(1)}x`;
                if (currentSpeech) {
                    window.speechSynthesis.cancel();
                    startReading(currentWordIndex);
                }
            });
       