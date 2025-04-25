  // DOM Elements
  const chatContainer = document.querySelector('.chat-container');
  const messagesContainer = document.querySelector('.messages-container');
  const inputForm = document.querySelector('.input-area');
  const messageInput = inputForm.querySelector('input');
  const submitButton = inputForm.querySelector('button');
  const messagesEndRef = document.querySelector('.messages-end-ref');
  const loadingIndicator = document.querySelector('.message-loading');
  
  // Templates
  const messageTemplate = {
    user: document.querySelector('.message-template.user'),
    assistant: document.querySelector('.message-template.assistant')
  };
  const sopFilesTemplate = document.querySelector('.sop-files-container');
  const fileItemTemplate = document.querySelector('.file-item-template');
  const fileViewerTemplate = document.querySelector('.file-viewer-overlay');

  // State
  const state = {
    messages: [],
    isLoading: false,
    openedFile: null,
    fileContent: null,
    fileStates: {}
  };

  // Initialize the chat
  function initChat() {
    // Load any saved messages from localStorage
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      state.messages = JSON.parse(savedMessages);
      renderMessages();
    }

    // Add welcome message if it's a new chat
    if (state.messages.length === 0) {
      addAssistantMessage('Halo! Saya QI Lab Assistant. Ada yang bisa saya bantu?');
    }

    // Set up event listeners
    inputForm.addEventListener('submit', handleSubmit);
    messageInput.addEventListener('input', updateSubmitButton);
    
    // Enable the input now that JS is loaded
    messageInput.disabled = false;
    submitButton.disabled = false;
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    const inputText = messageInput.value.trim();
    if (!inputText || state.isLoading) return;

    // Add user message
    addUserMessage(inputText);
    messageInput.value = '';
    updateSubmitButton();
    
    // Show loading indicator
    showLoading(true);
    
    try {
      // Prepare messages for the API (without sensitive data)
      const messagesForApi = state.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // This will be replaced with your Google Apps Script endpoint
      const API_URL = 'https://script.google.com/macros/s/AKfycbxFpF4Y85F0gr84csDQl0KwQ9hWjP3LISfbFGlpQClfGBkeEurBdB4A6cGu42d26WE9/exec'; // You'll set this in your Apps Script deployment
      
      // Send to your Google Apps Script backend
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesForApi,
          // Add any other non-sensitive data you need here
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add assistant message
      addAssistantMessage(data.content, data.metadata);
      
    } catch (error) {
      console.error('Error:', error);
      addAssistantMessage(
        '**Terjadi Kesalahan**\n' + 
        'Maaf, proses tidak dapat dilanjutkan. ' +
        'Silakan coba lagi atau hubungi admin.'
      );
    } finally {
      showLoading(false);
    }
  }

  // Add a user message to the chat
  function addUserMessage(content) {
    const message = {
      role: 'user',
      content: content,
      timestamp: new Date().toISOString()
    };
    state.messages.push(message);
    saveMessages();
    renderMessages();
  }

  // Add an assistant message to the chat
  function addAssistantMessage(content, metadata = null) {
    const message = {
      role: 'assistant',
      content: content,
      metadata: metadata,
      timestamp: new Date().toISOString()
    };
    state.messages.push(message);
    saveMessages();
    renderMessages();
    
    // Handle SOP files if included in metadata
    if (metadata?.files) {
      renderSopFiles(metadata.files);
    }
  }

  // Render all messages
  function renderMessages() {
    // Clear existing messages
    messagesContainer.querySelectorAll('.message').forEach(el => el.remove());
    
    // Add each message
    state.messages.forEach((message, index) => {
      const template = messageTemplate[message.role].cloneNode(true);
      template.style.display = 'flex';
      template.id = `message-${index}`;
      
      const contentEl = template.querySelector('.message-content');
      
      // Simple markdown rendering (basic implementation)
      contentEl.innerHTML = renderMarkdown(message.content);
      
      messagesContainer.appendChild(template);
    });
    
    scrollToBottom();
  }

  // Basic markdown rendering (simplified from ReactMarkdown)
  function renderMarkdown(text) {
    if (!text) return '';
    
    // Process code blocks
    text = text.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
      return `<div class="code-block-wrapper">
        <div class="code-block-header">${lang || 'code'}
          <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
        </div>
        <pre class="code-block-content"><code>${escapeHtml(code)}</code></pre>
      </div>`;
    });
    
    // Process inline code
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Process bold text
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Process italic text
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Process links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Process line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }

  // Helper to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Copy to clipboard function
  function copyToClipboard(button) {
    const codeBlock = button.closest('.code-block-wrapper');
    const codeContent = codeBlock.querySelector('.code-block-content').textContent;
    
    navigator.clipboard.writeText(codeContent).then(() => {
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 2000);
    });
  }

  // Render SOP files
  function renderSopFiles(files) {
    const lastMessage = messagesContainer.lastElementChild;
    if (!lastMessage || !lastMessage.classList.contains('assistant')) return;
    
    const sopContainer = sopFilesTemplate.cloneNode(true);
    sopContainer.style.display = 'block';
    
    const fileGrid = sopContainer.querySelector('.file-grid');
    
    files.forEach(file => {
      const fileItem = fileItemTemplate.cloneNode(true);
      fileItem.style.display = 'block';
      
      const fileItemWrapper = fileItem.querySelector('.file-item-wrapper');
      const fileCard = fileItem.querySelector('.file-card');
      const fileErrorCard = fileItem.querySelector('.file-error-card');
      const fileIcon = fileItem.querySelector('.file-icon');
      const fileName = fileItem.querySelector('.file-name');
      const fileType = fileItem.querySelector('.file-type');
      const fileErrorMessage = fileItem.querySelector('.file-error-message');
      
      // Set file info
      fileName.textContent = file.name;
      fileType.textContent = file.type;
      
      // Initially show checking state
      fileErrorCard.classList.add('state-checking');
      fileIcon.textContent = '⏳';
      fileErrorMessage.textContent = 'Memverifikasi...';
      
      // Add click handler
      fileCard.addEventListener('click', () => handleFileClick(file));
      fileCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleFileClick(file);
      });
      
      // Verify file availability
      verifyFileAvailability(file.url).then(state => {
        if (state === 'available') {
          fileErrorCard.style.display = 'none';
          fileCard.style.display = 'flex';
          fileIcon.textContent = file.type === 'image' ? '🖼️' : '📝';
          fileCard.classList.add(`file-type-${file.type}`);
        } else {
          fileErrorCard.classList.remove('state-checking');
          fileErrorCard.classList.add(`state-${state}`);
          fileIcon.textContent = '❌';
          fileErrorMessage.textContent = state === 'unavailable' 
            ? 'File tidak tersedia' 
            : 'Error memverifikasi file';
        }
      });
      
      fileGrid.appendChild(fileItem);
    });
    
    lastMessage.appendChild(sopContainer);
    scrollToBottom();
  }

  // Verify file availability (simple HEAD request)
  async function verifyFileAvailability(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok ? 'available' : 'unavailable';
    } catch {
      return 'error';
    }
  }

  // Handle file click
  function handleFileClick(file) {
    if (file.type === 'image') {
      showFileViewer({
        type: 'image',
        data: file.url
      });
    } else {
      // For text files, fetch the content
      fetch(file.url)
        .then(response => response.text())
        .then(text => {
          showFileViewer({
            type: 'text',
            data: text
          });
        })
        .catch(error => {
          showFileViewer({
            type: 'error',
            data: `Gagal memuat file: ${error.message}`
          });
        });
    }
  }

  // Show file viewer
  function showFileViewer(fileData) {
    const fileViewer = fileViewerTemplate.cloneNode(true);
    fileViewer.style.display = 'flex';
    document.body.appendChild(fileViewer);
    
    const scrollContainer = fileViewer.querySelector('.file-viewer-scroll-container');
    const closeBtn = fileViewer.querySelector('.file-viewer-close-btn');
    const backdrop = fileViewer.querySelector('.file-viewer-backdrop');
    
    // Set content based on file type
    if (fileData.type === 'image') {
      scrollContainer.innerHTML = `
        <img src="${fileData.data}" alt="Preview SOP" class="file-viewer-img" draggable="false">
      `;
    } else if (fileData.type === 'text') {
      scrollContainer.innerHTML = `
        <pre class="file-viewer-text-content">${escapeHtml(fileData.data)}</pre>
      `;
    } else {
      scrollContainer.innerHTML = `
        <div class="file-viewer-error">${fileData.data}</div>
      `;
    }
    
    // Add event listeners
    closeBtn.addEventListener('click', () => {
      fileViewer.remove();
    });
    
    backdrop.addEventListener('click', () => {
      fileViewer.remove();
    });
    
    // Add screenshot/keyboard protection
    setupFileProtection(fileViewer);
  }

  // Setup file protection (prevent screenshots/copying)
  function setupFileProtection(fileViewer) {
    const alertEl = fileViewer.querySelector('.file-viewer-alert');
    const scrollContainer = fileViewer.querySelector('.file-viewer-scroll-container');
    
    let showWarning = false;
    
    // Keyboard protection
    function handleKeyDown(e) {
      if (e.key === 'PrintScreen' || 
          (e.ctrlKey && e.key === 'p') || 
          (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        showWarning = true;
        alertEl.style.display = 'block';
        setTimeout(() => {
          alertEl.style.display = 'none';
          showWarning = false;
        }, 3000);
      }
    }
    
    // Right-click protection
    function handleContextMenu(e) {
      e.preventDefault();
      showWarning = true;
      alertEl.style.display = 'block';
      setTimeout(() => {
        alertEl.style.display = 'none';
        showWarning = false;
      }, 3000);
    }
    
    window.addEventListener('keydown', handleKeyDown);
    scrollContainer.addEventListener('contextmenu', handleContextMenu);
    
    // Cleanup when viewer is closed
    fileViewer.addEventListener('remove', () => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  }

  // Show/hide loading indicator
  function showLoading(show) {
    state.isLoading = show;
    updateSubmitButton();
    
    if (show) {
      loadingIndicator.style.display = 'flex';
      loadingIndicator.classList.add('assistant');
    } else {
      loadingIndicator.style.display = 'none';
    }
    
    scrollToBottom();
  }

  // Update submit button state
  function updateSubmitButton() {
    submitButton.disabled = state.isLoading || !messageInput.value.trim();
    submitButton.textContent = state.isLoading ? 'Mengirim...' : 'Kirim';
  }

  // Scroll to bottom of messages
  function scrollToBottom() {
    messagesEndRef.scrollIntoView({ behavior: 'smooth' });
  }

  // Save messages to localStorage
  function saveMessages() {
    localStorage.setItem('chatMessages', JSON.stringify(state.messages));
  }

  // Initialize the chat when DOM is loaded
  document.addEventListener('DOMContentLoaded', initChat);